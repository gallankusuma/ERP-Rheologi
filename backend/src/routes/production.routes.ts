import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { validateTransition, EXECUTION_STATUSES, ISSUABLE_STATUSES, MRP_OPEN_STATUSES } from '../utils/wo-transitions';
import { autoCreateFpa } from '../services/qc.service';
import { issueWoMaterial, returnWoMaterial, postFinishedGoods } from '../services/production.service';
import { explodeBom } from '../services/bom.service';
import { respondWithDomainError } from '../errors/domain.error';

// Bound once so /mrp and /mrp/shortage cannot drift apart the way they drifted
// from /mrp/dashboard.
const MRP_WO_STATUSES = MRP_OPEN_STATUSES;
const MRP_STATUS_PLACEHOLDERS = MRP_OPEN_STATUSES.map(() => '?').join(',');

const router = Router();

// ============================================================
// Production Events
// ============================================================
router.get('/events', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const events = await dbAll(
      `SELECT id, type, title, description, event_date, event_time, location, created_at
       FROM production_events ORDER BY event_date ASC, event_time ASC`
    );
    res.json(events);
  } catch (error) {
    console.error('Error fetching production events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

router.get('/events/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const event = await dbGet(
      `SELECT id, type, title, description, event_date, event_time, location, created_at
       FROM production_events WHERE id = ?`, [req.params.id]
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

router.post('/events', authMiddleware, requirePermission('production.planning', 'create'), async (req: Request, res: Response) => {
  try {
    const { type, title, description, event_date, event_time, location } = req.body;
    if (!type || !title || !event_date) {
      return res.status(400).json({ error: 'type, title, and event_date are required' });
    }
    const result = await dbRun(
      `INSERT INTO production_events (type, title, description, event_date, event_time, location) VALUES (?, ?, ?, ?, ?, ?)`,
      [type, title, description || null, event_date, event_time || null, location || null]
    );
    res.status(201).json({ message: 'Event created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create event' });
  }
});

router.put('/events/:id', authMiddleware, requirePermission('production.planning', 'update'), async (req: Request, res: Response) => {
  try {
    const { type, title, description, event_date, event_time, location } = req.body;
    await dbRun(
      `UPDATE production_events SET type=?, title=?, description=?, event_date=?, event_time=?, location=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [type, title, description || null, event_date, event_time || null, location || null, req.params.id]
    );
    res.json({ message: 'Event updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update event' });
  }
});

router.delete('/events/:id', authMiddleware, requirePermission('production.planning', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM production_events WHERE id = ?', [req.params.id]);
    res.json({ message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// ============================================================
// Production Tasks
// ============================================================
router.get('/tasks', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const tasks = await dbAll(
      `SELECT t.id, t.task_name, t.priority, t.due_date, t.status, t.description,
              w.wo_number, COALESCE(u.full_name, u.username) AS assigned_to
       FROM production_tasks t
       LEFT JOIN work_orders w ON t.wo_id = w.id
       LEFT JOIN users u ON t.assigned_to_user_id = u.id
       ORDER BY t.created_at DESC`
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

router.post('/tasks', authMiddleware, requirePermission('production.planning', 'create'), async (req: Request, res: Response) => {
  try {
    const { task_name, wo_id, assigned_to_user_id, priority, due_date, status, description } = req.body;
    if (!task_name) return res.status(400).json({ error: 'task_name is required' });
    const result = await dbRun(
      `INSERT INTO production_tasks (task_name, wo_id, assigned_to_user_id, priority, due_date, status, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [task_name, wo_id || null, assigned_to_user_id || null, priority || 'medium', due_date || null, status || 'pending', description || null]
    );
    res.status(201).json({ message: 'Task created', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/tasks/:id/status', authMiddleware, requirePermission('production.planning', 'update'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });
    await dbRun('UPDATE production_tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Task status updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task status' });
  }
});

// ============================================================
// Production Planning — schedule & capacity
// ============================================================
router.get('/planning', authMiddleware, requirePermission('production.planning', 'view'), async (_req: Request, res: Response) => {
  try {
    const workOrders = await dbAll(
      `SELECT w.id, w.wo_number, w.quantity, w.status, w.scheduled_start, w.scheduled_end,
              w.actual_start, w.actual_end, w.notes, w.created_at,
              p.name AS product_name, p.sku,
              COALESCE(u.full_name, u.username) AS created_by_name
       FROM work_orders w
       LEFT JOIN products p ON w.product_id = p.id
       LEFT JOIN users u ON w.created_by = u.id
       ORDER BY w.scheduled_start ASC`
    );
    res.json({ success: true, data: workOrders });
  } catch (error) {
    console.error('Error fetching production planning:', error);
    res.status(500).json({ error: 'Failed to fetch production planning' });
  }
});

router.get('/planning/summary', authMiddleware, requirePermission('production.planning', 'view'), async (_req: Request, res: Response) => {
  try {
    const summary = await dbAll(
      `SELECT status, COUNT(*) as count, SUM(quantity) as total_qty
       FROM work_orders GROUP BY status`
    );
    const capacity = await dbGet(
      `SELECT COUNT(*) as total_wo,
              SUM(CASE WHEN status='in_progress' OR status='in-progress' THEN 1 ELSE 0 END) as active_wo,
              SUM(CASE WHEN status='completed' THEN quantity ELSE 0 END) as completed_qty,
              SUM(CASE WHEN status='pending' OR status='planned' THEN quantity ELSE 0 END) as pending_qty
       FROM work_orders`
    );
    res.json({ success: true, data: { summary, capacity } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch planning summary' });
  }
});

// GET /planning/weekly — MPS-style weekly grid data
router.get('/planning/weekly', authMiddleware, requirePermission('production.planning', 'view'), async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || (new Date().getMonth() + 1);

    // Generate week columns for the month (same pattern as MPS)
    const weekColumns: any[] = [];
    const firstDay = new Date(year, month - 1, 1);
    const lastDay = new Date(year, month, 0);

    // Get ISO weeks that overlap with the month
    const getISOWeek = (d: Date) => {
      const tmp = new Date(d.getTime());
      tmp.setHours(0, 0, 0, 0);
      tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7);
      const week1 = new Date(tmp.getFullYear(), 0, 4);
      return 1 + Math.round(((tmp.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
    };

    const seenWeeks = new Set<string>();
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      const wk = getISOWeek(d);
      const yr = d.getFullYear();
      const key = `${yr}-W${wk}`;
      if (!seenWeeks.has(key)) {
        seenWeeks.add(key);
        // Find Monday of this week
        const mon = new Date(d);
        const day = mon.getDay();
        const diff = mon.getDate() - day + (day === 0 ? -6 : 1);
        mon.setDate(diff);
        const sun = new Date(mon);
        sun.setDate(sun.getDate() + 6);
        weekColumns.push({
          week: wk,
          year: yr,
          label: `W${wk}`,
          dateRange: `${mon.getDate()}/${mon.getMonth() + 1} - ${sun.getDate()}/${sun.getMonth() + 1}`
        });
      }
    }

    // status filter params
    const includeHistorical = req.query.include_historical === '1';
    const statusFilter = req.query.status ? String(req.query.status) : null;

    // default: operational statuses only; exclude completed/closed/cancelled
    let statusClause = '';
    const statusParams: any[] = [];
    if (statusFilter) {
      statusClause = 'AND w.status = ?';
      statusParams.push(statusFilter);
    } else if (!includeHistorical) {
      statusClause = "AND w.status NOT IN ('completed', 'COMPLETED', 'closed', 'CLOSED', 'cancelled', 'CANCELLED')";
    }

    // Fetch WOs with MPS provenance
    const workOrders = await dbAll(
      `SELECT w.id, w.wo_number, w.product_id, w.quantity, w.status,
              w.scheduled_start, w.scheduled_end, w.actual_start, w.actual_end,
              w.notes, w.created_at, w.line_process_id,
              w.source_type, w.mps_detail_id, w.week_number as wo_week_number,
              p.name AS product_name, p.sku,
              COALESCE(u.full_name, u.username) AS created_by_name,
              lp.name AS line_process_name, lp.code AS line_process_code,
              lp.capacity_per_hour, uom.name AS capacity_unit_name,
              mh.mps_number,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id) AS qc_total,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.status = 'passed') AS qc_passed,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.is_mandatory = 1 AND qc.status NOT IN ('passed')) AS qc_pending_mandatory
       FROM work_orders w
       LEFT JOIN products p ON w.product_id = p.id
       LEFT JOIN users u ON w.created_by = u.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom uom ON lp.capacity_unit_id = uom.id
       LEFT JOIN mps_details md ON w.mps_detail_id = md.id
       LEFT JOIN mps_headers mh ON md.mps_header_id = mh.id
       WHERE (
         (w.scheduled_start IS NOT NULL AND YEAR(w.scheduled_start) = ? AND MONTH(w.scheduled_start) = ?)
         OR (w.scheduled_end IS NOT NULL AND YEAR(w.scheduled_end) = ? AND MONTH(w.scheduled_end) = ?)
         OR (w.actual_start IS NOT NULL AND YEAR(w.actual_start) = ? AND MONTH(w.actual_start) = ?)
         OR (w.status IN ('in_progress', 'in-progress'))
       )
       ${statusClause}
       ORDER BY w.scheduled_start ASC, w.created_at ASC`,
      [year, month, year, month, year, month, ...statusParams]
    ) as any[];

    // For each WO, get process logs and QC checkpoints
    for (const wo of workOrders) {
      // Process logs (Line Process)
      wo.process_logs = await dbAll(
        `SELECT process_name, status, start_time, end_time, duration_minutes
         FROM wo_process_logs WHERE wo_id = ? ORDER BY start_time ASC`,
        [wo.id]
      );

      // QC checkpoints
      wo.qc_checkpoints = await dbAll(
        `SELECT c.process_stage, c.status, c.is_mandatory, f.fpa_number
         FROM wo_qc_checkpoints c
         LEFT JOIN qc_analysis_requests f ON c.fpa_id = f.id
         WHERE c.wo_id = ? ORDER BY c.id ASC`,
        [wo.id]
      );

      // Actual output (from wo_results)
      wo.results = await dbGet(
        `SELECT output_quantity, loss_quantity, loss_percentage, batch_number, qc_status
         FROM wo_results WHERE wo_id = ?`,
        [wo.id]
      );

      // The SAVED daily schedule, if this WO has one. The frontend's capacity
      // auto-spread is a seed for WOs that have never been scheduled by hand;
      // when these rows exist they win, which is the whole point of persisting
      // them. Sent as a plain date->{planned,actual} map so the grid can look up
      // a day without scanning an array.
      const savedDays = await dbAll(
        `SELECT DATE_FORMAT(schedule_date, '%Y-%m-%d') AS d, planned_qty, actual_qty
         FROM wo_daily_schedule WHERE wo_id = ? ORDER BY schedule_date`,
        [wo.id]
      ) as any[];
      wo.daily_schedule = savedDays.reduce((acc: any, r: any) => {
        acc[r.d] = { planned: Number(r.planned_qty), actual: r.actual_qty === null ? null : Number(r.actual_qty) };
        return acc;
      }, {});
      wo.has_saved_schedule = savedDays.length > 0;

      // Distribute planned qty across weeks based on scheduled dates
      wo.planned_weeks = {};
      wo.actual_weeks = {};
      wo.process_weeks = {};
      wo.qc_weeks = {};

      if (wo.scheduled_start && wo.scheduled_end) {
        const start = new Date(wo.scheduled_start);
        const end = new Date(wo.scheduled_end);
        // Find which weeks this WO spans
        const woWeeks: number[] = [];
        for (const wc of weekColumns) {
          // Check if this week overlaps with WO dates
          const mon = new Date(firstDay);
          // Find monday of this week
          for (let d = new Date(year, 0, 1); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
            if (getISOWeek(d) === wc.week) {
              const dd = new Date(d);
              const day = dd.getDay();
              const diff = dd.getDate() - day + (day === 0 ? -6 : 1);
              dd.setDate(diff);
              const wkStart = dd;
              const wkEnd = new Date(dd);
              wkEnd.setDate(wkEnd.getDate() + 6);
              if (start <= wkEnd && end >= wkStart) {
                woWeeks.push(wc.week);
              }
              break;
            }
          }
        }

        // Distribute qty evenly across weeks
        const qtyPerWeek = woWeeks.length > 0 ? Math.round(Number(wo.quantity) / woWeeks.length) : 0;
        for (const wk of woWeeks) {
          wo.planned_weeks[wk] = qtyPerWeek;
        }
      }

      // Map process logs to weeks
      for (const log of wo.process_logs) {
        if (log.start_time) {
          const logDate = new Date(log.start_time);
          const logWeek = getISOWeek(logDate);
          if (!wo.process_weeks[logWeek]) wo.process_weeks[logWeek] = [];
          wo.process_weeks[logWeek].push({ name: log.process_name, status: log.status });
        }
      }

      // Map QC checkpoints to weeks
      for (const cp of wo.qc_checkpoints) {
        // Just show all checkpoints for now (no specific week mapping)
      }
    }

    // Summary stats
    const stats = {
      total: workOrders.length,
      active: workOrders.filter(w => w.status === 'in_progress' || w.status === 'in-progress').length,
      completed: workOrders.filter(w => w.status === 'completed').length,
      pending: workOrders.filter(w => w.status === 'pending' || w.status === 'planned').length,
      on_hold: workOrders.filter(w => w.status === 'on_hold').length,
      total_planned_qty: workOrders.reduce((s, w) => s + Number(w.quantity || 0), 0)
    };

    res.json({
      success: true,
      data: {
        weekColumns,
        workOrders,
        stats,
        year,
        month
      }
    });
  } catch (error) {
    console.error('Error fetching weekly planning:', error);
    res.status(500).json({ error: 'Failed to fetch weekly planning data' });
  }
});

/**
 * PUT /planning/daily — persist the daily schedule for one WO.
 *
 * The missing half of the Planning screen. The grid computed a spread, let the
 * user edit it, and dropped the edit on the next refresh because there was
 * nowhere to send it. The review made the call: this is an operational
 * schedule, so it persists.
 *
 * Whole-WO replace rather than per-cell patch, because the grid edits a row at
 * a time and a partial write would leave the WO's days disagreeing with each
 * other. Days sent with planned 0 and no actual are DELETED rather than stored,
 * so clearing a cell removes the commitment instead of recording a promise of
 * nothing.
 */
router.put('/planning/daily/:woId', authMiddleware, requirePermission('production.planning', 'update'), async (req: Request, res: Response) => {
  try {
    const woId = Number(req.params.woId);
    const { days } = req.body as { days?: Array<{ date: string; planned?: number; actual?: number | null; notes?: string }> };
    if (!Number.isFinite(woId)) return res.status(400).json({ error: 'Invalid work order id' });
    if (!Array.isArray(days)) return res.status(400).json({ error: 'days[] is required' });

    const wo = await dbGet('SELECT id, status FROM work_orders WHERE id = ?', [woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    // A closed or cancelled WO is a record, not a plan. Editing its schedule
    // would rewrite history that inventory and QC have already acted on.
    const locked = ['closed', 'cancelled'];
    if (locked.includes(String(wo.status || '').toLowerCase())) {
      return res.status(400).json({ error: `Cannot edit the schedule of a ${wo.status} work order.` });
    }

    const userId = (req as any).user?.userId ?? null;
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;

    for (const d of days) {
      if (!d || !isoDate.test(String(d.date))) {
        return res.status(400).json({ error: `Invalid date '${d?.date}'. Expected YYYY-MM-DD.` });
      }
      const planned = Number(d.planned ?? 0);
      const actual = d.actual === null || d.actual === undefined || d.actual === ('' as any) ? null : Number(d.actual);
      if (!Number.isFinite(planned) || planned < 0) {
        return res.status(400).json({ error: `Planned quantity for ${d.date} must be a number >= 0.` });
      }
      if (actual !== null && (!Number.isFinite(actual) || actual < 0)) {
        return res.status(400).json({ error: `Actual quantity for ${d.date} must be a number >= 0.` });
      }
    }

    await dbTransaction(async (conn) => {
      for (const d of days) {
        const planned = Number(d.planned ?? 0);
        const actual = d.actual === null || d.actual === undefined || d.actual === ('' as any) ? null : Number(d.actual);

        if (planned === 0 && actual === null) {
          await conn.execute('DELETE FROM wo_daily_schedule WHERE wo_id = ? AND schedule_date = ?', [woId, d.date]);
          continue;
        }
        await conn.execute(
          `INSERT INTO wo_daily_schedule (wo_id, schedule_date, planned_qty, actual_qty, notes, updated_by)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE planned_qty = VALUES(planned_qty), actual_qty = VALUES(actual_qty),
                                   notes = VALUES(notes), updated_by = VALUES(updated_by)`,
          [woId, d.date, planned, actual, d.notes || null, userId]
        );
      }
    });

    const saved = await dbAll(
      `SELECT DATE_FORMAT(schedule_date, '%Y-%m-%d') AS d, planned_qty, actual_qty
       FROM wo_daily_schedule WHERE wo_id = ? ORDER BY schedule_date`,
      [woId]
    );
    res.json({ success: true, message: 'Daily schedule saved', data: saved });
  } catch (error) {
    console.error('Error saving daily schedule:', error);
    res.status(500).json({ error: 'Failed to save daily schedule' });
  }
});

/** GET /planning/daily/:woId — the saved schedule for one WO. */
router.get('/planning/daily/:woId', authMiddleware, requirePermission('production.planning', 'view'), async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT DATE_FORMAT(schedule_date, '%Y-%m-%d') AS date, planned_qty AS planned, actual_qty AS actual, notes
       FROM wo_daily_schedule WHERE wo_id = ? ORDER BY schedule_date`,
      [Number(req.params.woId)]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch daily schedule' });
  }
});

// ============================================================
// MRP — Material Requirement Planning
// ============================================================
router.get('/mrp', authMiddleware, requirePermission('production.mrp', 'view'), async (_req: Request, res: Response) => {
  try {
    // BOM RESOLUTION: the WO's own pinned recipe first.
    //
    // This endpoint was left behind by the BOM-integrity fix, which corrected
    // Generate WO Materials and /mrp/dashboard but not /mrp or /mrp/shortage.
    // Two defects lived here: it matched `bh.status = 'approved'` when canonical
    // BOM status is 'ACTIVE' (so every row silently dropped out and the screen
    // read "no requirements" rather than "no BOM"), and it re-looked-up the
    // recipe by product instead of using work_orders.bom_id — meaning a BOM
    // revised after the WO was cut would quietly restate that WO's requirements
    // against a recipe it was never planned on.
    //
    // Same COALESCE shape as /mrp/dashboard so all three agree.
    const requirements = await dbAll(
      `SELECT w.id AS wo_id, w.wo_number, w.quantity AS wo_qty, w.status AS wo_status,
              w.scheduled_start,
              p.name AS product_name, p.sku,
              bd.raw_material_id, rm.name AS material_name, rm.sku AS material_sku,
              bd.quantity AS bom_qty_per_unit,
              (bd.quantity * w.quantity) AS total_required,
              COALESCE(inv.quantity, 0) AS stock_available,
              GREATEST((bd.quantity * w.quantity) - COALESCE(inv.quantity, 0), 0) AS shortage
       FROM work_orders w
       JOIN products p ON w.product_id = p.id
       LEFT JOIN bom_headers bh ON bh.id = w.bom_id
       JOIN bom_details bd ON bd.bom_header_id = COALESCE(bh.id,
            (SELECT id FROM bom_headers WHERE product_id = w.product_id AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1))
       JOIN products rm ON rm.id = bd.raw_material_id
       LEFT JOIN inventory_stocks inv ON inv.product_id = bd.raw_material_id
       WHERE LOWER(w.status) IN (${MRP_STATUS_PLACEHOLDERS})
       ORDER BY w.scheduled_start ASC, rm.name ASC`,
      MRP_WO_STATUSES
    );
    res.json({ success: true, data: requirements });
  } catch (error) {
    console.error('Error fetching MRP data:', error);
    res.status(500).json({ error: 'Failed to calculate MRP' });
  }
});

router.get('/mrp/shortage', authMiddleware, requirePermission('production.mrp', 'view'), async (_req: Request, res: Response) => {
  try {
    // Same two corrections as /mrp above: pinned BOM, canonical 'ACTIVE' status,
    // and a WO status list that includes RELEASED.
    const shortages = await dbAll(
      `SELECT rm.id AS product_id, rm.name AS material_name, rm.sku AS material_sku,
              SUM(bd.quantity * w.quantity) AS total_required,
              COALESCE(MAX(inv.quantity), 0) AS stock_available,
              GREATEST(SUM(bd.quantity * w.quantity) - COALESCE(MAX(inv.quantity), 0), 0) AS shortage
       FROM work_orders w
       LEFT JOIN bom_headers bh ON bh.id = w.bom_id
       JOIN bom_details bd ON bd.bom_header_id = COALESCE(bh.id,
            (SELECT id FROM bom_headers WHERE product_id = w.product_id AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1))
       JOIN products rm ON rm.id = bd.raw_material_id
       LEFT JOIN inventory_stocks inv ON inv.product_id = bd.raw_material_id
       WHERE LOWER(w.status) IN (${MRP_STATUS_PLACEHOLDERS})
       GROUP BY rm.id, rm.name, rm.sku
       HAVING shortage > 0
       ORDER BY shortage DESC`,
      MRP_WO_STATUSES
    );
    res.json({ success: true, data: shortages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate shortages' });
  }
});

// ============================================================
// Issue Material — pick materials from warehouse for WO
// ============================================================
router.get('/issue-material', authMiddleware, requirePermission('production.workorders', 'view'), async (_req: Request, res: Response) => {
  try {
    const materials = await dbAll(
      `SELECT wm.id, wm.wo_id, w.wo_number,
              p.name AS material_name, p.sku AS material_sku,
              wm.quantity_required, wm.quantity_issued,
              (wm.quantity_required - COALESCE(wm.quantity_issued, 0)) AS pending_qty,
              wm.batch_number, wm.issued_at,
              COALESCE(u.full_name, u.username) AS issued_by_name,
              wh.name AS warehouse_name
       FROM wo_materials wm
       JOIN work_orders w ON w.id = wm.wo_id
       JOIN products p ON p.id = wm.product_id
       LEFT JOIN users u ON u.id = wm.issued_by
       LEFT JOIN warehouses wh ON wh.id = wm.warehouse_id
       WHERE w.status IN ('pending', 'planned', 'in_progress', 'in-progress')
       ORDER BY w.wo_number ASC, p.name ASC`
    );
    res.json({ success: true, data: materials });
  } catch (error) {
    console.error('Error fetching material issues:', error);
    res.status(500).json({ error: 'Failed to fetch material issues' });
  }
});

router.get('/issue-material/wo/:woId', authMiddleware, requirePermission('production.workorders', 'view'), async (req: Request, res: Response) => {
  try {
    const materials = await dbAll(
      `SELECT wm.id, wm.product_id, p.name AS material_name, p.sku AS material_sku,
              wm.quantity_required, wm.quantity_issued,
              (wm.quantity_required - COALESCE(wm.quantity_issued, 0)) AS pending_qty,
              wm.batch_number, COALESCE(wm.warehouse_id, 1) AS warehouse_id,
              COALESCE(wh.name, (SELECT name FROM warehouses WHERE id = 1)) AS warehouse_name,
              COALESCE(
                (SELECT SUM(inv2.quantity) FROM inventory_stocks inv2
                 WHERE inv2.product_id = wm.product_id
                   AND inv2.warehouse_id = COALESCE(wm.warehouse_id, 1)
                   AND inv2.status = 'available'), 0
              ) AS stock_available
       FROM wo_materials wm
       JOIN products p ON p.id = wm.product_id
       LEFT JOIN warehouses wh ON wh.id = wm.warehouse_id
       WHERE wm.wo_id = ?
       ORDER BY p.name ASC`,
      [req.params.woId]
    );
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch WO materials' });
  }
});

router.post('/issue-material', authMiddleware, requirePermission('production.workorders', 'issue_material'), async (req: Request, res: Response) => {
  try {
    const { wo_material_id, quantity, warehouse_id, lot_id, idempotency_key } = req.body;
    const userId = (req as any).user?.userId;

    if (!idempotency_key || typeof idempotency_key !== 'string') {
      return res.status(422).json({ error: 'idempotency_key is required for material issue', code: 'VALIDATION_ERROR' });
    }
    if (!lot_id) {
      return res.status(422).json({ error: 'lot_id is required for material issue', code: 'VALIDATION_ERROR' });
    }

    const result = await issueWoMaterial({
      woMaterialId: Number(wo_material_id),
      quantity: Number(quantity),
      warehouseId: Number(warehouse_id) || 1,
      lotId: Number(lot_id),
      userId,
      idempotencyKey: idempotency_key
    });

    res.json(result);
  } catch (error: any) {
    // domain errors carry their own status and code
    if (respondWithDomainError(error, res)) return;
    console.error('Error issuing material:', error);
    const msg = error.message || 'Failed to issue material';
    let status = 500;
    if (msg.includes('not found')) status = 404;
    else if (msg.includes('Insufficient') || msg.includes('exceed') || msg.includes('required')) status = 422;
    else if (msg.includes('Cannot issue')) status = 409;
    res.status(status).json({ error: msg });
  }
});

// Return unused material from production to warehouse
router.post('/issue-material/return', authMiddleware, requirePermission('production.workorders', 'issue_material'), async (req: Request, res: Response) => {
  try {
    const { wo_material_id, quantity, warehouse_id, notes, idempotency_key, original_issue_id, reason } = req.body;
    const userId = (req as any).user?.userId;

    if (!idempotency_key || typeof idempotency_key !== 'string') {
      return res.status(400).json({ error: 'idempotency_key is required for material return' });
    }

    const result = await returnWoMaterial({
      woMaterialId: Number(wo_material_id),
      quantity: Number(quantity),
      warehouseId: Number(warehouse_id) || 1,
      originalIssueId: original_issue_id ? Number(original_issue_id) : null,
      notes,
      reason,
      userId,
      idempotencyKey: idempotency_key
    });

    res.json(result);
  } catch (error: any) {
    // domain errors carry their own status and code
    if (respondWithDomainError(error, res)) return;
    console.error('Error returning material:', error);
    const msg = error.message || 'Failed to return material';
    const status = msg.includes('exceed') || msg.includes('required') || msg.includes('Duplicate') || msg.includes('Nothing to return') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

// Auto-generate WO material list from BOM
router.post('/issue-material/generate/:woId', authMiddleware, requirePermission('production.workorders', 'issue_material'), async (req: Request, res: Response) => {
  try {
    const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [req.params.woId]);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    // strict: use only the pinned bom_id (auto-set at WO creation or by PPIC)
    const bomId = wo.bom_id;
    if (!bomId) {
      return res.status(400).json({ error: 'Work Order has no BOM assigned. Assign a BOM before generating materials.' });
    }

    // revalidate the pinned BOM is still valid
    const bomCheck = await dbGet(
      'SELECT id, status, approval_status FROM bom_headers WHERE id = ?',
      [bomId]
    ) as any;
    if (!bomCheck) {
      return res.status(400).json({ error: 'Pinned BOM no longer exists. Re-assign a valid BOM.' });
    }
    if (bomCheck.status !== 'ACTIVE' || Number(bomCheck.approval_status) !== 2) {
      return res.status(400).json({ error: `Pinned BOM is not valid for production (status=${bomCheck.status}, approval=${bomCheck.approval_status}). Requires ACTIVE + fully approved.` });
    }

    // P1-1: use canonical BOM explosion with batch qty support
    const materials = await explodeBom({ bomId, productionQty: Number(wo.quantity) });

    for (const mat of materials) {
      const exists = await dbGet('SELECT id FROM wo_materials WHERE wo_id = ? AND product_id = ?', [wo.id, mat.rawMaterialId]);
      if (!exists) {
        await dbRun(
          `INSERT INTO wo_materials (wo_id, product_id, quantity_required, quantity_issued) VALUES (?, ?, ?, 0)`,
          [wo.id, mat.rawMaterialId, mat.quantity]
        );
      }
    }

    res.json({ success: true, message: 'WO materials generated from BOM' });
  } catch (error) {
    console.error('Error generating WO materials:', error);
    res.status(500).json({ error: 'Failed to generate WO materials' });
  }
});

// ============================================================
// Production Execution — real-time WO tracking & process logging
// ============================================================
router.get('/execution', authMiddleware, requirePermission('production.execution', 'view'), async (_req: Request, res: Response) => {
  try {
    // include RELEASED (startable), IN_PROGRESS (active), ON_HOLD (paused)
    const statusPlaceholders = EXECUTION_STATUSES.map(() => '?').join(',');
    const active = await dbAll(
      `SELECT w.id, w.wo_number, w.quantity, w.status,
              w.scheduled_start, w.scheduled_end, w.actual_start, w.actual_end,
              p.name AS product_name, p.sku,
              lp.name AS line_process_name, lp.code AS line_process_code, lp.capacity_per_hour,
              (SELECT COUNT(*) FROM wo_process_logs wpl WHERE wpl.wo_id = w.id) AS process_count,
              (SELECT COUNT(*) FROM wo_materials wm WHERE wm.wo_id = w.id AND wm.quantity_issued >= wm.quantity_required) AS materials_ready,
              (SELECT COUNT(*) FROM wo_materials wm WHERE wm.wo_id = w.id) AS materials_total,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id) AS qc_total,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.status = 'passed') AS qc_passed,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.is_mandatory = 1 AND qc.status NOT IN ('passed')) AS qc_pending_mandatory
       FROM work_orders w
       JOIN products p ON w.product_id = p.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       WHERE LOWER(w.status) IN (${statusPlaceholders})
       ORDER BY w.actual_start DESC, w.scheduled_start ASC`,
      EXECUTION_STATUSES
    );
    res.json({ success: true, data: active });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch execution data' });
  }
});

router.post('/execution/:woId/start', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const wo = await dbGet('SELECT status FROM work_orders WHERE id = ?', [req.params.woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const check = validateTransition(wo.status, 'in_progress');
    if (!check.valid) return res.status(400).json({ error: check.error });

    await dbRun(
      `UPDATE work_orders SET status='in_progress', actual_start=COALESCE(actual_start, CURRENT_TIMESTAMP), updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start work order' });
  }
});

router.post('/execution/:woId/pause', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const wo = await dbGet('SELECT status FROM work_orders WHERE id = ?', [req.params.woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const check = validateTransition(wo.status, 'on_hold');
    if (!check.valid) return res.status(400).json({ error: check.error });

    await dbRun(
      `UPDATE work_orders SET status='on_hold', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause work order' });
  }
});

router.post('/execution/:woId/resume', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const wo = await dbGet('SELECT status FROM work_orders WHERE id = ?', [req.params.woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const check = validateTransition(wo.status, 'in_progress');
    if (!check.valid) return res.status(400).json({ error: check.error });

    await dbRun(
      `UPDATE work_orders SET status='in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order resumed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume work order' });
  }
});

router.post('/execution/:woId/complete', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const woId = req.params.woId;

    // validate state transition
    const wo = await dbGet('SELECT status FROM work_orders WHERE id = ?', [woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    const check = validateTransition(wo.status, 'completed');
    if (!check.valid) return res.status(400).json({ error: check.error });

    // Check mandatory QC checkpoints
    const pendingQC = await dbAll(
      `SELECT id, process_stage, status FROM wo_qc_checkpoints
       WHERE wo_id = ? AND is_mandatory = 1 AND status NOT IN ('passed')`,
      [woId]
    ) as any[];

    if (pendingQC.length > 0) {
      const stages = pendingQC.map((c: any) => `${c.process_stage} (${c.status})`).join(', ');
      return res.status(400).json({
        error: `Cannot complete WO: ${pendingQC.length} mandatory QC checkpoint(s) not passed`,
        pending_checkpoints: pendingQC,
        detail: `Pending stages: ${stages}`
      });
    }

    await dbRun(
      `UPDATE work_orders SET status='completed', actual_end=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [woId]
    );

    // P0-LIVE-2: FG FPA is created by the canonical FG receipt flow (postFinishedGoods),
    // not by WO completion. Removing duplicate FPA creation here to prevent mismatched
    // inspection requests. WO complete only validates mandatory QC checkpoints passed.

    res.json({
      success: true,
      message: 'Work order completed'
    });
  } catch (error) {
    console.error('Error completing WO:', error);
    res.status(500).json({ error: 'Failed to complete work order' });
  }
});

// Process logs for a WO
router.get('/execution/:woId/logs', authMiddleware, requirePermission('production.execution', 'view'), async (req: Request, res: Response) => {
  try {
    let logs = await dbAll(
      `SELECT wpl.*, COALESCE(u.full_name, u.username) AS recorded_by_name
       FROM wo_process_logs wpl
       LEFT JOIN users u ON u.id = wpl.recorded_by
       WHERE wpl.wo_id = ? ORDER BY wpl.id ASC`,
      [req.params.woId]
    ) as any[];

    // auto-backfill from template if no logs exist and WO has a line_process
    if (!logs.length) {
      const wo = await dbGet(
        'SELECT id, line_process_id, status FROM work_orders WHERE id = ?',
        [req.params.woId]
      ) as any;
      if (wo && wo.line_process_id) {
        const templateSteps = await dbAll(
          'SELECT * FROM line_process_steps WHERE line_process_id = ? ORDER BY step_order ASC',
          [wo.line_process_id]
        ) as any[];
        if (templateSteps.length) {
          const userId = (req as any).user?.userId || null;
          for (const step of templateSteps) {
            await dbRun(
              `INSERT INTO wo_process_logs (wo_id, process_name, status, notes, recorded_by)
               VALUES (?, ?, 'pending', ?, ?)`,
              [req.params.woId, step.process_name, step.description || null, userId]
            );
            // auto-create QC checkpoint for QC steps
            if (step.is_qc_checkpoint) {
              const existsQC = await dbGet(
                'SELECT id FROM wo_qc_checkpoints WHERE wo_id = ? AND process_stage = ?',
                [req.params.woId, step.process_name]
              );
              if (!existsQC) {
                await dbRun(
                  `INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type) VALUES (?, ?, 1, 'LP')`,
                  [req.params.woId, step.process_name]
                );
              }
            }
          }
          // re-fetch with user join
          logs = await dbAll(
            `SELECT wpl.*, COALESCE(u.full_name, u.username) AS recorded_by_name
             FROM wo_process_logs wpl
             LEFT JOIN users u ON u.id = wpl.recorded_by
             WHERE wpl.wo_id = ? ORDER BY wpl.id ASC`,
            [req.params.woId]
          ) as any[];
        }
      }
    }

    // enrich each log with QC gate info
    const checkpoints = await dbAll(
      `SELECT process_stage, status, is_mandatory, triggered_at FROM wo_qc_checkpoints WHERE wo_id = ?`,
      [req.params.woId]
    ) as any[];

    // check if any mandatory QC is triggered but not passed (global block)
    const hasUnresolvedQC = checkpoints.some((c: any) => 
      c.is_mandatory && c.triggered_at && c.status !== 'passed'
    );

    for (const log of logs) {
      const cp = checkpoints.find((c: any) => c.process_stage === log.process_name);
      log.has_qc_checkpoint = !!cp;
      log.qc_status = cp?.status || null;
      // block non-completed steps if any mandatory QC is unresolved
      log.qc_blocking = hasUnresolvedQC && log.status !== 'completed';
    }

    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch process logs' });
  }
});

router.put('/execution/:woId/process-logs/:logId', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const { status, start_time, end_time, notes } = req.body;

    // QC gate: block advancing if ANY mandatory QC checkpoint is triggered but not passed
    if (status === 'in_progress' || status === 'completed') {
      const unresolvedQC = await dbGet(
        `SELECT id, process_stage, status FROM wo_qc_checkpoints 
         WHERE wo_id = ? AND is_mandatory = 1 AND status IN ('in_review', 'pending')
         AND triggered_at IS NOT NULL
         LIMIT 1`,
        [req.params.woId]
      ) as any;
      if (unresolvedQC) {
        const currentLog = await dbGet('SELECT process_name FROM wo_process_logs WHERE id = ?', [req.params.logId]) as any;
        return res.status(400).json({
          error: `Proses "${currentLog?.process_name || ''}" tidak bisa dilanjutkan. QC Checkpoint "${unresolvedQC.process_stage}" belum passed (status: ${unresolvedQC.status}). Selesaikan QC terlebih dahulu.`
        });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (start_time) { updates.push('start_time = ?'); params.push(start_time); }
    if (end_time) {
      updates.push('end_time = ?');
      params.push(end_time);
      // auto-calc duration if both start and end exist
      const existing = await dbGet('SELECT start_time FROM wo_process_logs WHERE id = ?', [req.params.logId]) as any;
      const effectiveStart = start_time || existing?.start_time;
      if (effectiveStart) {
        const dur = Math.round((new Date(end_time).getTime() - new Date(effectiveStart).getTime()) / 60000);
        updates.push('duration_minutes = ?');
        params.push(dur > 0 ? dur : null);
      }
    }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(req.params.logId, req.params.woId);
    await dbRun(`UPDATE wo_process_logs SET ${updates.join(', ')} WHERE id = ? AND wo_id = ?`, params);

    // auto-trigger QC when step completed
    let qcTriggered = null;
    if (status === 'completed') {
      const log = await dbGet('SELECT process_name FROM wo_process_logs WHERE id = ?', [req.params.logId]) as any;
      if (log) {
        const checkpoint = await dbGet(
          `SELECT * FROM wo_qc_checkpoints WHERE wo_id = ? AND process_stage = ? AND status = 'pending'`,
          [req.params.woId, log.process_name]
        ) as any;
        if (checkpoint) {
          const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [req.params.woId]) as any;
          if (wo) {
            const userId = (req as any).user?.userId || null;
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
            const rand = Math.floor(100 + Math.random() * 900);
            const fpaNumber = `FPA-LP-${datePart}-${rand}`;
            try {
              const fpaResult = await dbRun(
                `INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, batch_no, notes, created_by, status)
                 VALUES (?, 'LP', ?, ?, ?, ?, ?, ?, 'Pending')`,
                [fpaNumber, wo.id, wo.wo_number, wo.product_id, null, `In-Process QC for ${log.process_name} | WO: ${wo.wo_number}`, userId]
              );
              const fpaId = fpaResult.insertId;
              await dbRun(
                `UPDATE wo_qc_checkpoints SET status = 'in_review', fpa_id = ?, triggered_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [fpaId, checkpoint.id]
              );
              // copy specs to FPA results
              const specs = await dbAll(
                `SELECT * FROM qc_specifications WHERE product_id = ? AND (qc_type = 'LP' OR qc_type IS NULL)`,
                [wo.product_id]
              ) as any[];
              for (const spec of specs) {
                await dbRun(
                  `INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?)`,
                  [fpaId, spec.parameter_id, spec.method_id, spec.standard_value, spec.min_value, spec.max_value]
                );
              }
              qcTriggered = { checkpoint_id: checkpoint.id, fpa_id: fpaId, fpa_number: fpaNumber };
              console.log(`Auto-triggered QC: ${fpaNumber} for WO ${wo.wo_number} stage "${log.process_name}"`);
            } catch (fpaErr: any) {
              console.warn(`Failed to auto-create FPA for checkpoint: ${fpaErr.message}`);
            }
          }
        }
      }
    }

    res.json({ message: 'Process log updated', qc_triggered: qcTriggered });
  } catch (error) {
    console.error('Error updating process log:', error);
    res.status(500).json({ error: 'Failed to update process log' });
  }
});

router.post('/execution/:woId/logs', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const { process_name, start_time, end_time, status, notes } = req.body;
    if (!process_name) return res.status(400).json({ error: 'process_name is required' });

    const userId = (req as any).user?.userId;
    const woId = req.params.woId;
    let duration = null;
    if (start_time && end_time) {
      duration = Math.round((new Date(end_time).getTime() - new Date(start_time).getTime()) / 60000);
    }

    const result = await dbRun(
      `INSERT INTO wo_process_logs (wo_id, process_name, start_time, end_time, duration_minutes, status, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [woId, process_name, start_time || null, end_time || null, duration, status || 'in_progress', notes || null, userId]
    );

    // Auto-trigger QC: if process log completed, check if a checkpoint exists for this stage
    let qcTriggered = null;
    if (status === 'completed') {
      const checkpoint = await dbGet(
        `SELECT * FROM wo_qc_checkpoints WHERE wo_id = ? AND process_stage = ? AND status = 'pending'`,
        [woId, process_name]
      ) as any;

      if (checkpoint) {
        // Auto-create FPA
        const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]) as any;
        if (wo) {
          const now = new Date();
          const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
          const rand = Math.floor(100 + Math.random() * 900);
          const fpaNumber = `FPA-LP-${datePart}-${rand}`;

          try {
            const fpaResult = await dbRun(
              `INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, batch_no, notes, created_by, status)
               VALUES (?, 'LP', ?, ?, ?, ?, ?, ?, 'Pending')`,
              [fpaNumber, wo.id, wo.wo_number, wo.product_id, null, `In-Process QC for ${process_name} | WO: ${wo.wo_number}`, userId, ]
            );
            const fpaId = fpaResult.insertId;

            // Update checkpoint with FPA reference
            await dbRun(
              `UPDATE wo_qc_checkpoints SET status = 'in_review', fpa_id = ?, triggered_at = CURRENT_TIMESTAMP WHERE id = ?`,
              [fpaId, checkpoint.id]
            );

            // Copy specs to FPA results (LP type)
            const specs = await dbAll(
              `SELECT * FROM qc_specifications WHERE product_id = ? AND (qc_type = 'LP' OR qc_type IS NULL)`,
              [wo.product_id]
            ) as any[];
            for (const spec of specs) {
              await dbRun(
                `INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?)`,
                [fpaId, spec.parameter_id, spec.method_id, spec.standard_value, spec.min_value, spec.max_value]
              );
            }

            qcTriggered = { checkpoint_id: checkpoint.id, fpa_id: fpaId, fpa_number: fpaNumber };
            console.log(`🧪 Auto-triggered QC: ${fpaNumber} for WO ${wo.wo_number} stage "${process_name}"`);
          } catch (fpaErr: any) {
            console.warn(`⚠️ Failed to auto-create FPA for checkpoint: ${fpaErr.message}`);
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      message: 'Process log created' + (qcTriggered ? ' + QC triggered' : ''),
      id: result.insertId,
      qc_triggered: qcTriggered
    });
  } catch (error) {
    console.error('Error creating process log:', error);
    res.status(500).json({ error: 'Failed to create process log' });
  }
});

// ============================================================
// QC Checkpoints for Work Orders
// ============================================================
router.get('/execution/:woId/qc-checkpoints', authMiddleware, async (req: Request, res: Response) => {
  try {
    const checkpoints = await dbAll(
      `SELECT c.*, f.fpa_number, f.status as fpa_status, f.result as fpa_result
       FROM wo_qc_checkpoints c
       LEFT JOIN qc_analysis_requests f ON c.fpa_id = f.id
       WHERE c.wo_id = ?
       ORDER BY c.id ASC`,
      [req.params.woId]
    );
    res.json({ success: true, data: checkpoints });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QC checkpoints' });
  }
});

router.post('/execution/:woId/qc-checkpoints', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const { stages } = req.body;
    // stages: [{ process_stage, is_mandatory, qc_type, notes }]
    if (!stages || !Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ error: 'stages array is required' });
    }

    const woId = req.params.woId;
    const userId = (req as any).user?.userId;

    // Get WO info for FPA creation
    const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const results = [];
    for (const stage of stages) {
      // Avoid duplicate
      const exists = await dbGet(
        'SELECT id FROM wo_qc_checkpoints WHERE wo_id = ? AND process_stage = ?',
        [woId, stage.process_stage]
      );
      if (exists) continue;

      // 1. Create checkpoint
      const r = await dbRun(
        `INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [woId, stage.process_stage, stage.is_mandatory !== false ? 1 : 0, stage.qc_type || 'LP', stage.notes || null]
      );
      const checkpointId = r.insertId;

      // 2. Auto-create FPA (QC Analysis Request)
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const rand = Math.floor(100 + Math.random() * 900);
      const fpaNumber = `FPA-LP-${datePart}-${rand}`;

      const fpaResult = await dbRun(
        `INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status)
         VALUES (?, 'LP', ?, ?, ?, ?, ?, 'Pending')`,
        [fpaNumber, wo.id, wo.wo_number, wo.product_id, `In-Process QC for ${stage.process_stage} | WO: ${wo.wo_number}`, userId]
      );

      // 3. Link FPA to checkpoint + set status to in_review
      await dbRun(
        `UPDATE wo_qc_checkpoints SET status = 'in_review', fpa_id = ?, triggered_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [fpaResult.insertId, checkpointId]
      );

      // 4. Copy QC specifications as analysis result rows
      const specs = await dbAll(
        `SELECT * FROM qc_specifications WHERE product_id = ? AND (qc_type = 'LP' OR qc_type IS NULL)`,
        [wo.product_id]
      ) as any[];
      for (const spec of specs) {
        await dbRun(
          `INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?)`,
          [fpaResult.insertId, spec.parameter_id, spec.method_id, spec.standard_value, spec.min_value, spec.max_value]
        );
      }

      console.log(`🧪 Auto QC: ${fpaNumber} for WO ${wo.wo_number} stage "${stage.process_stage}"`);
      results.push({ id: checkpointId, process_stage: stage.process_stage, fpa_number: fpaNumber, fpa_id: fpaResult.insertId });
    }

    res.status(201).json({ success: true, message: `${results.length} checkpoint(s) created with FPA`, data: results });
  } catch (error) {
    console.error('Error creating checkpoints:', error);
    res.status(500).json({ error: 'Failed to create QC checkpoints' });
  }
});

router.delete('/execution/:woId/qc-checkpoints/:id', authMiddleware, requirePermission('production.execution', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM wo_qc_checkpoints WHERE id = ? AND wo_id = ?', [req.params.id, req.params.woId]);
    res.json({ success: true, message: 'Checkpoint deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete checkpoint' });
  }
});

// Manual trigger QC for a checkpoint
router.post('/execution/:woId/trigger-qc/:checkpointId', authMiddleware, requirePermission('production.execution', 'create'), async (req: Request, res: Response) => {
  try {
    const { woId, checkpointId } = req.params;
    const userId = (req as any).user?.userId;

    const checkpoint = await dbGet(
      'SELECT * FROM wo_qc_checkpoints WHERE id = ? AND wo_id = ?',
      [checkpointId, woId]
    ) as any;
    if (!checkpoint) return res.status(404).json({ error: 'Checkpoint not found' });
    if (checkpoint.fpa_id) return res.status(400).json({ error: 'QC already triggered for this checkpoint', fpa_id: checkpoint.fpa_id });

    const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const fpaNumber = `FPA-LP-${datePart}-${rand}`;

    const fpaResult = await dbRun(
      `INSERT INTO qc_analysis_requests (fpa_number, type, reference_id, reference_number, product_id, notes, created_by, status)
       VALUES (?, 'LP', ?, ?, ?, ?, ?, 'Pending')`,
      [fpaNumber, wo.id, wo.wo_number, wo.product_id, `In-Process QC for ${checkpoint.process_stage} | WO: ${wo.wo_number}`, userId]
    );

    await dbRun(
      `UPDATE wo_qc_checkpoints SET status = 'in_review', fpa_id = ?, triggered_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [fpaResult.insertId, checkpointId]
    );

    // Copy specs
    const specs = await dbAll(
      `SELECT * FROM qc_specifications WHERE product_id = ? AND (qc_type = 'LP' OR qc_type IS NULL)`,
      [wo.product_id]
    ) as any[];
    for (const spec of specs) {
      await dbRun(
        `INSERT INTO qc_analysis_results (fpa_id, parameter_id, method_id, standard_value, min_value, max_value) VALUES (?, ?, ?, ?, ?, ?)`,
        [fpaResult.insertId, spec.parameter_id, spec.method_id, spec.standard_value, spec.min_value, spec.max_value]
      );
    }

    console.log(`🧪 Manual QC trigger: ${fpaNumber} for WO ${wo.wo_number} stage "${checkpoint.process_stage}"`);

    res.status(201).json({
      success: true,
      message: `QC triggered: ${fpaNumber}`,
      data: { fpa_id: fpaResult.insertId, fpa_number: fpaNumber }
    });
  } catch (error) {
    console.error('Error triggering QC:', error);
    res.status(500).json({ error: 'Failed to trigger QC' });
  }
});

// ============================================================
// Yield & Scrap — record output and losses
// ============================================================
router.get('/yield', authMiddleware, requirePermission('production.yield-scrap', 'view'), async (_req: Request, res: Response) => {
  try {
    const results = await dbAll(
      `SELECT wr.id, wr.wo_id, w.wo_number,
              p.name AS product_name, p.sku,
              wr.output_quantity, wr.loss_quantity, wr.loss_percentage,
              wr.batch_number, wr.qc_status,
              wr.completed_at, wr.notes,
              COALESCE(u.full_name, u.username) AS completed_by_name,
              w.quantity AS planned_quantity
       FROM wo_results wr
       JOIN work_orders w ON w.id = wr.wo_id
       JOIN products p ON p.id = w.product_id
       LEFT JOIN users u ON u.id = wr.completed_by
       ORDER BY wr.completed_at DESC`
    );
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch yield data' });
  }
});

router.get('/yield/wo/:woId', authMiddleware, requirePermission('production.yield-scrap', 'view'), async (req: Request, res: Response) => {
  try {
    const result = await dbGet(
      `SELECT wr.*, w.wo_number, w.quantity AS planned_quantity, p.name AS product_name
       FROM wo_results wr
       JOIN work_orders w ON w.id = wr.wo_id
       JOIN products p ON p.id = w.product_id
       WHERE wr.wo_id = ?`,
      [req.params.woId]
    );
    res.json({ success: true, data: result || null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch yield for WO' });
  }
});

router.post('/yield', authMiddleware, requirePermission('production.yield-scrap', 'create'), async (req: Request, res: Response) => {
  try {
    const { wo_id, output_quantity, loss_quantity, batch_number, notes } = req.body;
    if (!wo_id || output_quantity === undefined) {
      return res.status(400).json({ error: 'wo_id and output_quantity are required' });
    }

    // P1-5 + P0-3: strict positive validation
    const outQty = Number(output_quantity);
    const lossQty = Number(loss_quantity || 0);
    if (!Number.isFinite(outQty) || outQty < 0) {
      return res.status(400).json({ error: 'output_quantity must be a non-negative number' });
    }
    if (!Number.isFinite(lossQty) || lossQty < 0) {
      return res.status(400).json({ error: 'loss_quantity must be a non-negative number' });
    }

    const userId = (req as any).user?.userId;
    const totalOutput = outQty + lossQty;
    const lossPct = totalOutput > 0 ? ((lossQty / totalOutput) * 100).toFixed(2) : '0.00';

    // qc_status always starts as 'pending' — only QC module can set passed/failed
    const result = await dbRun(
      `INSERT INTO wo_results (wo_id, output_quantity, loss_quantity, loss_percentage, batch_number, qc_status, completed_by, completed_at, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?)`,
      [wo_id, outQty, lossQty, lossPct, batch_number || null, userId, notes || null]
    );
    res.status(201).json({ success: true, message: 'Yield recorded', id: result.insertId });
  } catch (error) {
    console.error('Error recording yield:', error);
    res.status(500).json({ error: 'Failed to record yield' });
  }
});

router.put('/yield/:id', authMiddleware, requirePermission('production.yield-scrap', 'update'), async (req: Request, res: Response) => {
  try {
    // qc_status is DELIBERATELY NOT READ FROM THE BODY.
    // QC is owned by the Quality module. Production records how much was produced;
    // Quality decides whether it is acceptable.
    const { output_quantity, loss_quantity, batch_number, notes } = req.body;

    // P1-5: strict positive validation
    const outQty = Number(output_quantity);
    const lossQty = Number(loss_quantity || 0);
    if (!Number.isFinite(outQty) || outQty < 0) {
      return res.status(400).json({ error: 'output_quantity must be a non-negative number' });
    }
    if (!Number.isFinite(lossQty) || lossQty < 0) {
      return res.status(400).json({ error: 'loss_quantity must be a non-negative number' });
    }

    // P1-5: prevent reducing yield below already-posted FG
    const existing = await dbGet('SELECT wo_id FROM wo_results WHERE id = ?', [req.params.id]) as any;
    if (existing) {
      const fgPosted = await dbGet(
        `SELECT COALESCE(SUM(quantity), 0) as total_fg FROM stock_movements
         WHERE reference_type = 'fg_receipt' AND reference_id = ? AND movement_type = 'in'`,
        [existing.wo_id]
      ) as any;
      const totalFg = Number(fgPosted?.total_fg || 0);

      // get total output from OTHER yield records for this WO (excluding the one being edited)
      const otherYield = await dbGet(
        'SELECT COALESCE(SUM(output_quantity), 0) as other_output FROM wo_results WHERE wo_id = ? AND id != ?',
        [existing.wo_id, req.params.id]
      ) as any;
      const otherOutput = Number(otherYield?.other_output || 0);
      const newTotalOutput = otherOutput + outQty;

      if (newTotalOutput < totalFg) {
        return res.status(400).json({
          error: `Cannot reduce output to ${outQty}. Total accepted output (${newTotalOutput}) would be less than already-posted FG receipts (${totalFg}).`
        });
      }
    }

    const totalOutput = outQty + lossQty;
    const lossPct = totalOutput > 0 ? ((lossQty / totalOutput) * 100).toFixed(2) : '0.00';

    await dbRun(
      `UPDATE wo_results SET output_quantity=?, loss_quantity=?, loss_percentage=?, batch_number=?, notes=? WHERE id=?`,
      [outQty, lossQty, lossPct, batch_number || null, notes || null, req.params.id]
    );
    res.json({ success: true, message: 'Yield updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update yield' });
  }
});

// ============================================================
// FG Receipt — receive finished goods into warehouse
// ============================================================
router.get('/fg-receipt', authMiddleware, requirePermission('production.fg-receipt', 'view'), async (_req: Request, res: Response) => {
  try {
    const receipts = await dbAll(
      `SELECT w.id AS wo_id, w.wo_number, w.quantity AS planned_qty, w.status,
              p.id AS product_id, p.name AS product_name, p.sku,
              wr.output_quantity, wr.batch_number,
              wr.completed_at,
              COALESCE(sm.received, 0) AS received_into_stock,
              COALESCE(qc.qc_total, 0) AS qc_total,
              COALESCE(qc.mandatory_not_passed, 0) AS qc_mandatory_pending,
              COALESCE(qc.mandatory_failed, 0) AS qc_mandatory_failed
       FROM work_orders w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN wo_results wr ON wr.wo_id = w.id
       LEFT JOIN (
         SELECT reference_id AS wo_id, SUM(quantity) AS received
         FROM stock_movements
         WHERE reference_type = 'fg_receipt' AND movement_type = 'in'
         GROUP BY reference_id
       ) sm ON sm.wo_id = w.id
       LEFT JOIN (
         SELECT wo_id,
                COUNT(*) AS qc_total,
                SUM(CASE WHEN is_mandatory = 1 AND status NOT IN ('passed') THEN 1 ELSE 0 END) AS mandatory_not_passed,
                SUM(CASE WHEN is_mandatory = 1 AND status = 'failed' THEN 1 ELSE 0 END) AS mandatory_failed
         FROM wo_qc_checkpoints
         GROUP BY wo_id
       ) qc ON qc.wo_id = w.id
       WHERE w.status = 'completed' OR wr.id IS NOT NULL
       ORDER BY wr.completed_at DESC`
    );

    // derive qc_status from mandatory checkpoints only — exact same rule as POST /fg-receipt gate
    const enriched = (receipts as any[]).map(r => {
      let qc_status = 'pending';
      if (r.qc_total === 0) {
        qc_status = 'pending';
      } else if (r.qc_mandatory_failed > 0) {
        qc_status = 'failed';
      } else if (r.qc_mandatory_pending > 0) {
        qc_status = 'pending';
      } else {
        qc_status = 'passed';
      }
      return { ...r, qc_status };
    });

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FG receipts' });
  }
});

router.post('/fg-receipt', authMiddleware, requirePermission('production.fg-receipt', 'create'), async (req: Request, res: Response) => {
  try {
    const { wo_id, warehouse_id, quantity, batch_number, idempotency_key } = req.body;
    const userId = (req as any).user?.userId;

    // P0-DELTA-6: idempotency key is mandatory for FG receipt
    if (!idempotency_key || typeof idempotency_key !== 'string') {
      return res.status(400).json({ error: 'idempotency_key is required for FG receipt' });
    }

    const result = await postFinishedGoods({
      woId: wo_id,
      warehouseId: warehouse_id,
      quantity,
      batchNumber: batch_number,
      idempotencyKey: idempotency_key,
      userId
    });

    res.json(result);
  } catch (error: any) {
    // domain errors carry their own status and code
    if (respondWithDomainError(error, res)) return;
    console.error('Error receiving FG:', error);
    const msg = error.message || 'Failed to receive FG';
    const status = msg.includes('Cannot receive') || msg.includes('exceed') || msg.includes('Duplicate') || msg.includes('required') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

// ============================================================
// Production History — all WOs with full detail
// ============================================================
router.get('/history', authMiddleware, requirePermission('production.history', 'view'), async (req: Request, res: Response) => {
  try {
    const { status, from_date, to_date, search } = req.query;
    let sql = `SELECT w.id, w.wo_number, w.quantity, w.status,
                      w.scheduled_start, w.scheduled_end, w.actual_start, w.actual_end,
                      w.notes, w.created_at,
                      p.name AS product_name, p.sku,
                      COALESCE(u.full_name, u.username) AS created_by_name,
                      wr.output_quantity, wr.loss_quantity, wr.loss_percentage
               FROM work_orders w
               LEFT JOIN products p ON p.id = w.product_id
               LEFT JOIN users u ON u.id = w.created_by
               LEFT JOIN wo_results wr ON wr.wo_id = w.id
               WHERE 1=1`;
    const params: any[] = [];

    if (status) {
      sql += ' AND w.status = ?';
      params.push(status);
    }
    if (from_date) {
      sql += ' AND w.created_at >= ?';
      params.push(from_date);
    }
    if (to_date) {
      sql += ' AND w.created_at <= ?';
      params.push(to_date);
    }
    if (search) {
      sql += ' AND (w.wo_number LIKE ? OR p.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY w.created_at DESC';

    const history = await dbAll(sql, params);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch production history' });
  }
});

router.get('/history/stats', authMiddleware, requirePermission('production.history', 'view'), async (_req: Request, res: Response) => {
  try {
    const stats = await dbGet(
      `SELECT
         COUNT(*) AS total_wo,
         SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,
         SUM(CASE WHEN status IN ('in_progress','in-progress') THEN 1 ELSE 0 END) AS in_progress,
         SUM(CASE WHEN status='pending' OR status='planned' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) AS cancelled,
         AVG(CASE WHEN actual_start IS NOT NULL AND actual_end IS NOT NULL
             THEN TIMESTAMPDIFF(HOUR, actual_start, actual_end) ELSE NULL END) AS avg_hours
       FROM work_orders`
    );
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history stats' });
  }
});

// GET /mrp/dashboard - WO Material Readiness dashboard
router.get('/mrp/dashboard', authMiddleware, requirePermission('production.mrp', 'view'), async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();

    const totalWOs = await dbGet(
      "SELECT COUNT(*) as count FROM work_orders WHERE YEAR(scheduled_start) = ? AND status NOT IN ('cancelled')",
      [year]
    ) as any;

    // material-level aggregation: per raw material, total required across all active WOs
    const materials = await dbAll(`
      SELECT p.id AS material_id, p.name AS material_name, p.sku AS material_sku,
             COALESCE(u.name, 'pcs') AS uom_name,
             COALESCE(mms.first_stock, inv.total_qty, 0) AS stock_available,
             COALESCE(req.total_required, 0) AS total_required,
             GREATEST(COALESCE(req.total_required, 0) - COALESCE(mms.first_stock, inv.total_qty, 0), 0) AS total_shortage
      FROM products p
      LEFT JOIN uom u ON p.unit_of_measure_id = u.id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS total_qty FROM inventory_stocks WHERE status = 'available' GROUP BY product_id) inv ON inv.product_id = p.id
      LEFT JOIN mrp_material_settings mms ON mms.material_id = p.id
      JOIN (
        SELECT bd.raw_material_id AS product_id, SUM(bd.quantity * wo.quantity / bh.qty) AS total_required
        FROM work_orders wo
        JOIN bom_headers bh ON wo.bom_id = bh.id
        JOIN bom_details bd ON bd.bom_header_id = bh.id
        WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
          AND wo.bom_id IS NOT NULL AND bh.qty > 0
        GROUP BY bd.raw_material_id
      ) req ON req.product_id = p.id
      ORDER BY total_shortage DESC, total_required DESC
      LIMIT 50
    `, [year]) as any[];

    // per-material WO breakdown: which WOs need each material
    const matWoLinks = await dbAll(`
      SELECT bd.raw_material_id AS material_id, wo.id AS wo_id, wo.wo_number, wo.status,
             WEEK(wo.scheduled_start, 1) AS week_number
      FROM work_orders wo
      JOIN bom_details bd ON bd.bom_header_id = wo.bom_id
      WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
        AND wo.bom_id IS NOT NULL
      ORDER BY wo.scheduled_start
    `, [year]) as any[];

    // attach wos[] to each material
    const wosByMaterial: Record<number, any[]> = {};
    for (const link of matWoLinks) {
      if (!wosByMaterial[link.material_id]) wosByMaterial[link.material_id] = [];
      wosByMaterial[link.material_id].push({
        wo_id: link.wo_id, wo_number: link.wo_number, status: link.status, week_number: link.week_number
      });
    }
    for (const mat of materials) {
      (mat as any).wos = wosByMaterial[mat.material_id] || [];
    }

    // per-WO view with material checklist
    const workOrders = await dbAll(`
      SELECT wo.id AS wo_id, wo.wo_number, wo.status, wo.quantity AS wo_qty,
             wo.scheduled_start, wo.scheduled_end,
             p.name AS product_name, p.sku,
             WEEK(wo.scheduled_start, 1) AS week_number
      FROM work_orders wo
      JOIN products p ON wo.product_id = p.id
      WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
      ORDER BY wo.scheduled_start
      LIMIT 50
    `, [year]) as any[];

    // per-WO material breakdown
    const woMaterials = await dbAll(`
      SELECT wo.id AS wo_id, bd.raw_material_id AS material_id,
             p.name AS material_name,
             bd.quantity * wo.quantity / bh.qty AS required,
             COALESCE(mms.first_stock, inv.total_qty, 0) AS available,
             GREATEST(bd.quantity * wo.quantity / bh.qty - COALESCE(mms.first_stock, inv.total_qty, 0), 0) AS shortage
      FROM work_orders wo
      JOIN bom_headers bh ON wo.bom_id = bh.id
      JOIN bom_details bd ON bd.bom_header_id = bh.id
      JOIN products p ON p.id = bd.raw_material_id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS total_qty FROM inventory_stocks WHERE status = 'available' GROUP BY product_id) inv ON inv.product_id = bd.raw_material_id
      LEFT JOIN mrp_material_settings mms ON mms.material_id = bd.raw_material_id
      WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
        AND wo.bom_id IS NOT NULL AND bh.qty > 0
      ORDER BY shortage DESC
    `, [year]) as any[];

    const matsByWo: Record<number, any[]> = {};
    for (const wm of woMaterials) {
      if (!matsByWo[wm.wo_id]) matsByWo[wm.wo_id] = [];
      matsByWo[wm.wo_id].push({
        material_id: wm.material_id, material_name: wm.material_name,
        required: wm.required, available: wm.available, shortage: wm.shortage
      });
    }
    for (const wo of workOrders) {
      (wo as any).materials = matsByWo[wo.wo_id] || [];
      (wo as any).has_shortage = (wo as any).materials.some((m: any) => m.shortage > 0);
    }

    const woWithShortage = workOrders.filter((wo: any) => wo.has_shortage).length;

    res.json({
      data: {
        summary: {
          totalWOs: totalWOs?.count || 0,
          woWithShortage,
          totalMaterials: materials.length,
          shortMaterials: materials.filter((m: any) => m.total_shortage > 0).length,
        },
        materials,
        workOrders,
      }
    });
  } catch (error) {
    console.error('Error fetching MRP dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch MRP dashboard' });
  }
});

// -- SPKP (Surat Perintah Kerja Produksi) --

// list SPKP for a WO
// ===== SPKP FLOOR BOARD =====
//
// One column per production line, every SPKP on it regardless of which work order it belongs
// to. That is why the card carries the work order number: the board is no longer scoped to one
// order, it is a picture of what is on each tank right now.

router.get(
  '/spkp-board',
  authMiddleware,
  requirePermission('production.execution', 'view'),
  async (req: Request, res: Response) => {
    try {
      const { wo_id, date_from, date_to } = req.query;

      const lines = await dbAll(
        `SELECT lp.id, lp.code, lp.name,
                (SELECT COUNT(*) FROM line_process_steps st WHERE st.line_process_id = lp.id) AS step_count
           FROM line_processes lp
          ORDER BY lp.code ASC, lp.id ASC`
      );

      const steps = await dbAll(
        `SELECT id, line_process_id, step_order, process_name, standard_duration_minutes, is_qc_checkpoint
           FROM line_process_steps
          ORDER BY line_process_id ASC, step_order ASC, id ASC`
      );

      const params: any[] = [];
      let where = '1=1';
      if (wo_id) { where += ' AND s.wo_id = ?'; params.push(Number(wo_id)); }
      if (date_from) { where += ' AND s.schedule_date >= ?'; params.push(date_from); }
      if (date_to) { where += ' AND s.schedule_date <= ?'; params.push(date_to); }

      const cards = await dbAll(
        `SELECT s.id, s.spkp_number, s.wo_id, s.schedule_date, s.planned_qty, s.actual_qty,
                s.operator_name, s.supervisor_name, s.notes, s.status, s.printed_at,
                s.line_process_id, s.current_step_id, s.step_started_at,
                w.wo_number, w.line_process_id AS wo_line_process_id,
                p.name AS product_name, p.sku,
                st.process_name AS current_step_name, st.step_order AS current_step_order,
                st.standard_duration_minutes AS current_step_minutes,
                st.is_qc_checkpoint AS current_step_is_qc,
                lp.code AS line_code, lp.name AS line_name
           FROM spkp s
           LEFT JOIN work_orders w ON w.id = s.wo_id
           LEFT JOIN products p ON p.id = w.product_id
           LEFT JOIN line_process_steps st ON st.id = s.current_step_id
           LEFT JOIN line_processes lp ON lp.id = s.line_process_id
          WHERE ${where}
          ORDER BY s.schedule_date ASC, s.id ASC`,
        params
      );

      res.json({ success: true, data: { lines, steps, cards } });
    } catch (error) {
      console.error('Error fetching SPKP board:', error);
      res.status(500).json({ error: 'Failed to fetch SPKP board' });
    }
  }
);

// Move an SPKP onto a line, or along the steps of the one it is on.
//
// A step belongs to exactly one line, so a step from a different line describes something that
// cannot happen on the floor and is refused rather than stored. Moving to a different line
// clears the step for the same reason: the old step does not exist on the new line.
router.put(
  '/spkp/:id/placement',
  authMiddleware,
  requirePermission('production.execution', 'update'),
  async (req: Request, res: Response) => {
    try {
      const { line_process_id, current_step_id } = req.body;
      const spkpRow = await dbGet('SELECT * FROM spkp WHERE id = ?', [req.params.id]) as any;
      if (!spkpRow) return res.status(404).json({ error: 'SPKP tidak ditemukan' });

      const nextLine =
        line_process_id === undefined ? spkpRow.line_process_id
        : line_process_id === null ? null
        : Number(line_process_id);

      if (nextLine !== null && nextLine !== undefined) {
        const line = await dbGet('SELECT id FROM line_processes WHERE id = ?', [nextLine]);
        if (!line) return res.status(404).json({ error: 'Line process tidak ditemukan', code: 'LINE_NOT_FOUND' });
      }

      // a line change invalidates whatever step it was on
      const lineChanged = String(nextLine ?? '') !== String(spkpRow.line_process_id ?? '');
      let nextStep = lineChanged ? null : spkpRow.current_step_id;

      if (current_step_id !== undefined) {
        if (current_step_id === null) {
          nextStep = null;
        } else {
          const step = await dbGet(
            'SELECT id, line_process_id FROM line_process_steps WHERE id = ?', [Number(current_step_id)]
          ) as any;
          if (!step) return res.status(404).json({ error: 'Step tidak ditemukan', code: 'STEP_NOT_FOUND' });
          if (nextLine === null || Number(step.line_process_id) !== Number(nextLine)) {
            return res.status(409).json({
              error: 'Step itu milik line lain, tidak bisa dipasang di sini.',
              code: 'STEP_LINE_MISMATCH',
            });
          }
          nextStep = step.id;
        }
      }

      // the clock restarts only when the step actually changes, so re-saving other fields does
      // not make a long-running step look like it just began
      const stepChanged = String(nextStep ?? '') !== String(spkpRow.current_step_id ?? '');
      await dbRun(
        `UPDATE spkp SET line_process_id = ?, current_step_id = ?,
                         step_started_at = ${stepChanged ? (nextStep === null ? 'NULL' : 'NOW()') : 'step_started_at'}
          WHERE id = ?`,
        [nextLine ?? null, nextStep ?? null, req.params.id]
      );

      const updated = await dbGet(
        `SELECT s.*, st.process_name AS current_step_name, lp.name AS line_name
           FROM spkp s
           LEFT JOIN line_process_steps st ON st.id = s.current_step_id
           LEFT JOIN line_processes lp ON lp.id = s.line_process_id
          WHERE s.id = ?`,
        [req.params.id]
      );
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating SPKP placement:', error);
      res.status(500).json({ error: 'Failed to update SPKP placement' });
    }
  }
);

// ===== SPKP BOARD COLUMNS =====
//
// The columns of the execution board belong to the user. spkp.status stores a stage_key, not
// the label, so renaming a column moves nothing and strands nothing.

/** a stable key from a label: lowercase, words joined by underscores, nothing else */
const toStageKey = (name: string) =>
  String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

router.get(
  '/spkp-stages',
  authMiddleware,
  requirePermission('production.execution', 'view'),
  async (_req: Request, res: Response) => {
    try {
      const stages = await dbAll('SELECT * FROM spkp_stages ORDER BY sort_order ASC, id ASC');
      res.json({ success: true, data: stages });
    } catch (error) {
      console.error('Error fetching SPKP stages:', error);
      res.status(500).json({ error: 'Failed to fetch SPKP stages' });
    }
  }
);

router.post(
  '/spkp-stages',
  authMiddleware,
  requirePermission('production.execution', 'configure'),
  async (req: Request, res: Response) => {
    try {
      const { name, color } = req.body;
      const label = String(name || '').trim();
      if (!label) return res.status(422).json({ error: 'Nama kolom wajib diisi', code: 'VALIDATION_ERROR' });

      const key = toStageKey(label);
      if (!key) {
        return res.status(422).json({
          error: 'Nama kolom harus mengandung huruf atau angka', code: 'VALIDATION_ERROR',
        });
      }

      const clash = await dbGet('SELECT id, name FROM spkp_stages WHERE stage_key = ?', [key]) as any;
      if (clash) {
        return res.status(409).json({
          error: `Kolom "${clash.name}" sudah memakai nama yang sama`, code: 'STAGE_EXISTS',
        });
      }

      const last = await dbGet('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM spkp_stages') as any;
      const result = await dbRun(
        'INSERT INTO spkp_stages (stage_key, name, color, sort_order, is_system) VALUES (?, ?, ?, ?, 0)',
        [key, label, color || '#6b7280', Number(last?.max_order ?? -1) + 1]
      );
      const created = await dbGet('SELECT * FROM spkp_stages WHERE id = ?', [result.insertId]);
      res.status(201).json({ success: true, data: created });
    } catch (error) {
      console.error('Error creating SPKP stage:', error);
      res.status(500).json({ error: 'Failed to create SPKP stage' });
    }
  }
);

// Only the label and the colour. stage_key is what the cards point at and never changes, which
// is what makes renaming safe.
router.put(
  '/spkp-stages/:id',
  authMiddleware,
  requirePermission('production.execution', 'configure'),
  async (req: Request, res: Response) => {
    try {
      const { name, color } = req.body;
      const fields: string[] = [];
      const values: any[] = [];
      if (name !== undefined) {
        const label = String(name).trim();
        if (!label) return res.status(422).json({ error: 'Nama kolom wajib diisi', code: 'VALIDATION_ERROR' });
        fields.push('name = ?');
        values.push(label);
      }
      if (color !== undefined) { fields.push('color = ?'); values.push(color); }
      if (!fields.length) return res.status(422).json({ error: 'Tidak ada yang diubah', code: 'VALIDATION_ERROR' });

      values.push(req.params.id);
      await dbRun(`UPDATE spkp_stages SET ${fields.join(', ')} WHERE id = ?`, values);
      const updated = await dbGet('SELECT * FROM spkp_stages WHERE id = ?', [req.params.id]);
      if (!updated) return res.status(404).json({ error: 'Kolom tidak ditemukan' });
      res.json({ success: true, data: updated });
    } catch (error) {
      console.error('Error updating SPKP stage:', error);
      res.status(500).json({ error: 'Failed to update SPKP stage' });
    }
  }
);

router.put(
  '/spkp-stages/reorder',
  authMiddleware,
  requirePermission('production.execution', 'configure'),
  async (req: Request, res: Response) => {
    try {
      const { order } = req.body as { order: Array<{ id: number; sort_order: number }> };
      if (!Array.isArray(order)) {
        return res.status(422).json({ error: 'order wajib berupa array', code: 'VALIDATION_ERROR' });
      }
      for (const row of order) {
        await dbRun('UPDATE spkp_stages SET sort_order = ? WHERE id = ?', [Number(row.sort_order), Number(row.id)]);
      }
      const stages = await dbAll('SELECT * FROM spkp_stages ORDER BY sort_order ASC, id ASC');
      res.json({ success: true, data: stages });
    } catch (error) {
      console.error('Error reordering SPKP stages:', error);
      res.status(500).json({ error: 'Failed to reorder SPKP stages' });
    }
  }
);

// Deleting a column the cards still point at would make them disappear from the board while
// staying in the database, so it is refused while anything is in it. The three original
// columns stay because existing rows were written against them.
router.delete(
  '/spkp-stages/:id',
  authMiddleware,
  requirePermission('production.execution', 'configure'),
  async (req: Request, res: Response) => {
    try {
      const stage = await dbGet('SELECT * FROM spkp_stages WHERE id = ?', [req.params.id]) as any;
      if (!stage) return res.status(404).json({ error: 'Kolom tidak ditemukan' });

      if (Number(stage.is_system) === 1) {
        return res.status(409).json({
          error: `"${stage.name}" adalah kolom bawaan dan tidak bisa dihapus. Ganti nama atau warnanya kalau perlu.`,
          code: 'STAGE_IS_SYSTEM',
        });
      }

      const inUse = await dbGet(
        'SELECT COUNT(*) AS n FROM spkp WHERE status = ?', [stage.stage_key]
      ) as any;
      if (Number(inUse?.n || 0) > 0) {
        return res.status(409).json({
          error: `Masih ada ${inUse.n} SPKP di kolom "${stage.name}". Pindahkan dulu sebelum kolomnya dihapus.`,
          code: 'STAGE_NOT_EMPTY',
          data: { count: Number(inUse.n) },
        });
      }

      await dbRun('DELETE FROM spkp_stages WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting SPKP stage:', error);
      res.status(500).json({ error: 'Failed to delete SPKP stage' });
    }
  }
);

router.get('/work-orders/:woId/spkp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const rows = await dbAll(
      `SELECT s.*, w.wo_number, w.quantity AS wo_quantity,
              p.name AS product_name, p.sku AS product_sku,
              lp.name AS line_process_name
         FROM spkp s
         JOIN work_orders w ON w.id = s.wo_id
         LEFT JOIN products p ON p.id = w.product_id
         LEFT JOIN line_processes lp ON lp.id = w.line_process_id
        WHERE s.wo_id = ?
        ORDER BY s.schedule_date`,
      [req.params.woId]
    );
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching SPKP:', error);
    res.status(500).json({ error: 'Failed to fetch SPKP' });
  }
});

// auto-generate SPKP from WO date range
router.post('/work-orders/:woId/spkp/generate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const woId = Number(req.params.woId);
    const wo = await dbGet(
      'SELECT id, wo_number, quantity, scheduled_start, scheduled_end FROM work_orders WHERE id = ?',
      [woId]
    ) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });
    if (!wo.scheduled_start || !wo.scheduled_end) {
      return res.status(400).json({ error: 'WO must have scheduled_start and scheduled_end' });
    }

    // collect working days (skip Sat=6, Sun=0)
    const start = new Date(wo.scheduled_start);
    const end = new Date(wo.scheduled_end);
    const workingDays: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) {
        workingDays.push(d.toISOString().slice(0, 10));
      }
    }
    if (workingDays.length === 0) {
      return res.status(400).json({ error: 'No working days in WO date range' });
    }

    // distribute qty evenly
    const totalQty = Number(wo.quantity) || 0;
    const perDay = Math.floor((totalQty / workingDays.length) * 100) / 100;
    const remainder = Math.round((totalQty - perDay * workingDays.length) * 100) / 100;

    const userId = (req as any).user?.userId || null;
    const existing = await dbAll('SELECT id FROM spkp WHERE wo_id = ?', [woId]) as any[];
    if (existing.length > 0) {
      return res.status(400).json({ error: `SPKP sudah ada (${existing.length} records). Hapus dulu jika ingin generate ulang.` });
    }

    const inserted: any[] = [];
    for (let i = 0; i < workingDays.length; i++) {
      const dateStr = workingDays[i];
      const qty = i === workingDays.length - 1 ? perDay + remainder : perDay;
      const seq = String(i + 1).padStart(3, '0');
      const spkpNumber = `SPKP-${dateStr.replace(/-/g, '')}-${woId}-${seq}`;

      await dbRun(
        `INSERT INTO spkp (wo_id, spkp_number, schedule_date, planned_qty, status, created_by)
         VALUES (?, ?, ?, ?, 'draft', ?)`,
        [woId, spkpNumber, dateStr, qty, userId]
      );
      inserted.push({ spkp_number: spkpNumber, schedule_date: dateStr, planned_qty: qty });
    }

    res.json({ message: `${inserted.length} SPKP generated`, data: inserted });
  } catch (error) {
    console.error('Error generating SPKP:', error);
    res.status(500).json({ error: 'Failed to generate SPKP' });
  }
});

// update a single SPKP
router.put('/spkp/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { planned_qty, actual_qty, operator_name, supervisor_name, notes, status } = req.body;
    const fields: string[] = [];
    const values: any[] = [];

    if (planned_qty !== undefined) { fields.push('planned_qty = ?'); values.push(planned_qty); }
    if (actual_qty !== undefined) { fields.push('actual_qty = ?'); values.push(actual_qty); }
    if (operator_name !== undefined) { fields.push('operator_name = ?'); values.push(operator_name); }
    if (supervisor_name !== undefined) { fields.push('supervisor_name = ?'); values.push(supervisor_name); }
    if (notes !== undefined) { fields.push('notes = ?'); values.push(notes); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.id);
    await dbRun(`UPDATE spkp SET ${fields.join(', ')} WHERE id = ?`, values);

    const updated = await dbGet('SELECT * FROM spkp WHERE id = ?', [req.params.id]);
    res.json({ data: updated });
  } catch (error) {
    console.error('Error updating SPKP:', error);
    res.status(500).json({ error: 'Failed to update SPKP' });
  }
});

// delete single SPKP
router.delete('/spkp/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM spkp WHERE id = ?', [req.params.id]);
    res.json({ message: 'SPKP deleted' });
  } catch (error) {
    console.error('Error deleting SPKP:', error);
    res.status(500).json({ error: 'Failed to delete SPKP' });
  }
});

// delete all SPKP for a WO (for re-generate)
router.delete('/work-orders/:woId/spkp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const result = await dbRun('DELETE FROM spkp WHERE wo_id = ?', [req.params.woId]);
    res.json({ message: 'All SPKP deleted', deleted: (result as any).changes || 0 });
  } catch (error) {
    console.error('Error deleting SPKP:', error);
    res.status(500).json({ error: 'Failed to delete SPKP' });
  }
});

// mark as printed
router.put('/spkp/:id/print', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('UPDATE spkp SET printed_at = NOW() WHERE id = ?', [req.params.id]);
    const updated = await dbGet('SELECT * FROM spkp WHERE id = ?', [req.params.id]);
    res.json({ data: updated });
  } catch (error) {
    console.error('Error marking SPKP printed:', error);
    res.status(500).json({ error: 'Failed to mark SPKP as printed' });
  }
});

// manual create single SPKP
router.post('/work-orders/:woId/spkp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const woId = Number(req.params.woId);
    const { schedule_date, planned_qty } = req.body;
    if (!schedule_date || !planned_qty) {
      return res.status(400).json({ error: 'schedule_date dan planned_qty wajib diisi' });
    }
    const userId = (req as any).user?.userId;
    const dateStr = schedule_date.slice(0, 10);

    // get next sequence
    const existing = await dbAll('SELECT id FROM spkp WHERE wo_id = ?', [woId]) as any[];
    const seq = String(existing.length + 1).padStart(3, '0');
    const spkpNumber = `SPKP-${dateStr.replace(/-/g, '')}-${woId}-${seq}`;

    const result = await dbRun(
      `INSERT INTO spkp (wo_id, spkp_number, schedule_date, planned_qty, status, created_by)
       VALUES (?, ?, ?, ?, 'draft', ?)`,
      [woId, spkpNumber, dateStr, planned_qty, userId]
    );
    const insertId = (result as any).insertId;
    const created = await dbGet('SELECT * FROM spkp WHERE id = ?', [insertId]);
    res.json({ data: created });
  } catch (error) {
    console.error('Error creating SPKP:', error);
    res.status(500).json({ error: 'Failed to create SPKP' });
  }
});

export default router;
