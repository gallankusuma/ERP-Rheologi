import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { validateTransition, EXECUTION_STATUSES, ISSUABLE_STATUSES, MRP_OPEN_STATUSES } from '../utils/wo-transitions';

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

    // Fetch all WOs (not just active)
    const workOrders = await dbAll(
      `SELECT w.id, w.wo_number, w.product_id, w.quantity, w.status,
              w.scheduled_start, w.scheduled_end, w.actual_start, w.actual_end,
              w.notes, w.created_at, w.line_process_id,
              p.name AS product_name, p.sku,
              COALESCE(u.full_name, u.username) AS created_by_name,
              lp.name AS line_process_name, lp.code AS line_process_code,
              lp.capacity_per_hour, uom.name AS capacity_unit_name,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id) AS qc_total,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.status = 'passed') AS qc_passed,
              (SELECT COUNT(*) FROM wo_qc_checkpoints qc WHERE qc.wo_id = w.id AND qc.is_mandatory = 1 AND qc.status NOT IN ('passed')) AS qc_pending_mandatory
       FROM work_orders w
       LEFT JOIN products p ON w.product_id = p.id
       LEFT JOIN users u ON w.created_by = u.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom uom ON lp.capacity_unit_id = uom.id
       WHERE (
         (w.scheduled_start IS NOT NULL AND YEAR(w.scheduled_start) = ? AND MONTH(w.scheduled_start) = ?)
         OR (w.scheduled_end IS NOT NULL AND YEAR(w.scheduled_end) = ? AND MONTH(w.scheduled_end) = ?)
         OR (w.actual_start IS NOT NULL AND YEAR(w.actual_start) = ? AND MONTH(w.actual_start) = ?)
         OR (w.status IN ('in_progress', 'in-progress', 'pending', 'planned'))
       )
       ORDER BY w.scheduled_start ASC, w.created_at ASC`,
      [year, month, year, month, year, month]
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
              wm.batch_number, wm.warehouse_id, wh.name AS warehouse_name,
              COALESCE(inv.quantity, 0) AS stock_available
       FROM wo_materials wm
       JOIN products p ON p.id = wm.product_id
       LEFT JOIN warehouses wh ON wh.id = wm.warehouse_id
       LEFT JOIN inventory_stocks inv ON inv.product_id = wm.product_id AND inv.warehouse_id = wm.warehouse_id
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
    const { wo_material_id, quantity, warehouse_id, batch_number } = req.body;
    if (!wo_material_id || !quantity) {
      return res.status(400).json({ error: 'wo_material_id and quantity are required' });
    }
    if (!warehouse_id) {
      return res.status(400).json({ error: 'warehouse_id is required for material issue' });
    }

    const userId = (req as any).user?.userId;

    await dbTransaction(async (conn) => {
      // 1. Lock and validate WO material
      const [matRows] = await conn.execute(
        'SELECT * FROM wo_materials WHERE id = ? FOR UPDATE', [wo_material_id]
      );
      const mat = matRows[0];
      if (!mat) throw new Error('WO material not found');

      // 1b. Check WO status — only allow issue for RELEASED/IN_PROGRESS/ON_HOLD
      const [woRows] = await conn.execute('SELECT status FROM work_orders WHERE id = ?', [mat.wo_id]);
      const woStatus = woRows[0]?.status?.toLowerCase();
      if (!ISSUABLE_STATUSES.includes(woStatus)) {
        throw new Error(`Cannot issue material for WO with status '${woRows[0]?.status}'. WO must be RELEASED, IN_PROGRESS, or ON_HOLD.`);
      }

      const newIssued = (mat.quantity_issued || 0) + quantity;
      if (newIssued > mat.quantity_required) {
        throw new Error(`Issue quantity (${quantity}) would exceed required quantity (${mat.quantity_required}). Already issued: ${mat.quantity_issued || 0}`);
      }

      // 2. Lock and validate inventory stock — prevent negative stock
      const [stockRows] = await conn.execute(
        'SELECT * FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
        [mat.product_id, warehouse_id]
      );
      const stock = stockRows[0];
      const currentQty = stock ? (stock.quantity || 0) : 0;

      if (currentQty < quantity) {
        throw new Error(`Insufficient stock. Available: ${currentQty}, Requested: ${quantity}`);
      }

      // 3. Update WO material issued quantity
      await conn.execute(
        `UPDATE wo_materials SET quantity_issued=?, warehouse_id=?, batch_number=?, issued_at=CURRENT_TIMESTAMP, issued_by=? WHERE id=?`,
        [newIssued, warehouse_id, batch_number || null, userId, wo_material_id]
      );

      // 4. Deduct inventory stock
      await conn.execute(
        `UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
        [quantity, stock.id]
      );

      // 5. Record stock movement for audit trail
      await conn.execute(
        `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, notes, created_by)
         VALUES (?, ?, ?, 'out', ?, 'work_order', ?, 'Material issued to WO', ?)`,
        [warehouse_id, mat.product_id, batch_number || null, quantity, mat.wo_id, userId]
      );
    });

    res.json({ success: true, message: 'Material issued successfully' });
  } catch (error: any) {
    console.error('Error issuing material:', error);
    const msg = error.message || 'Failed to issue material';
    const status = msg.includes('Insufficient stock') || msg.includes('exceed') || msg.includes('Cannot issue') || msg.includes('warehouse_id') ? 400 : 500;
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

    const bomDetails = await dbAll('SELECT * FROM bom_details WHERE bom_header_id = ?', [bomId]);

    for (const item of bomDetails) {
      const exists = await dbGet('SELECT id FROM wo_materials WHERE wo_id = ? AND product_id = ?', [wo.id, item.raw_material_id]);
      if (!exists) {
        await dbRun(
          `INSERT INTO wo_materials (wo_id, product_id, quantity_required, quantity_issued) VALUES (?, ?, ?, 0)`,
          [wo.id, item.raw_material_id, item.quantity * wo.quantity]
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
    res.json({ success: true, message: 'Work order completed' });
  } catch (error) {
    console.error('Error completing WO:', error);
    res.status(500).json({ error: 'Failed to complete work order' });
  }
});

// Process logs for a WO
router.get('/execution/:woId/logs', authMiddleware, requirePermission('production.execution', 'view'), async (req: Request, res: Response) => {
  try {
    const logs = await dbAll(
      `SELECT wpl.*, COALESCE(u.full_name, u.username) AS recorded_by_name
       FROM wo_process_logs wpl
       LEFT JOIN users u ON u.id = wpl.recorded_by
       WHERE wpl.wo_id = ? ORDER BY wpl.start_time ASC`,
      [req.params.woId]
    );
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch process logs' });
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

    const userId = (req as any).user?.userId;
    const totalOutput = Number(output_quantity) + Number(loss_quantity || 0);
    const lossPct = totalOutput > 0 ? ((Number(loss_quantity || 0) / totalOutput) * 100).toFixed(2) : '0.00';

    // qc_status always starts as 'pending' — only QC module can set passed/failed
    const result = await dbRun(
      `INSERT INTO wo_results (wo_id, output_quantity, loss_quantity, loss_percentage, batch_number, qc_status, completed_by, completed_at, notes)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP, ?)`,
      [wo_id, output_quantity, loss_quantity || 0, lossPct, batch_number || null, userId, notes || null]
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
    //
    // The create path was hardened to always insert 'pending', but this update
    // path still took qc_status straight from the request — so Production could
    // still mark its own output QC-passed, just by editing instead of creating.
    // Closing one of two doors into the same field leaves the field open.
    //
    // QC is owned by the Quality module: qc.routes.ts resolves an FPA and writes
    // wo_qc_checkpoints.status = passed/failed. Production records HOW MUCH was
    // produced; Quality decides whether it is acceptable. Those are different
    // authorities and this endpoint only carries the first.
    const { output_quantity, loss_quantity, batch_number, notes } = req.body;
    const totalOutput = Number(output_quantity) + Number(loss_quantity || 0);
    const lossPct = totalOutput > 0 ? ((Number(loss_quantity || 0) / totalOutput) * 100).toFixed(2) : '0.00';

    await dbRun(
      `UPDATE wo_results SET output_quantity=?, loss_quantity=?, loss_percentage=?, batch_number=?, notes=? WHERE id=?`,
      [output_quantity, loss_quantity || 0, lossPct, batch_number || null, notes || null, req.params.id]
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
              wr.output_quantity, wr.batch_number, wr.qc_status,
              wr.completed_at,
              COALESCE(sm.received, 0) AS received_into_stock
       FROM work_orders w
       JOIN products p ON p.id = w.product_id
       LEFT JOIN wo_results wr ON wr.wo_id = w.id
       LEFT JOIN (
         SELECT reference_id AS wo_id, SUM(quantity) AS received
         FROM stock_movements
         WHERE reference_type = 'fg_receipt' AND movement_type = 'in'
         GROUP BY reference_id
       ) sm ON sm.wo_id = w.id
       WHERE w.status = 'completed' OR wr.id IS NOT NULL
       ORDER BY wr.completed_at DESC`
    );
    res.json({ success: true, data: receipts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FG receipts' });
  }
});

router.post('/fg-receipt', authMiddleware, requirePermission('production.fg-receipt', 'create'), async (req: Request, res: Response) => {
  try {
    const { wo_id, warehouse_id, quantity, batch_number, idempotency_key } = req.body;
    if (!wo_id || !warehouse_id || !quantity) {
      return res.status(400).json({ error: 'wo_id, warehouse_id, and quantity are required' });
    }

    const userId = (req as any).user?.userId;

    await dbTransaction(async (conn) => {
      // 1. Lock and validate Work Order
      const [woRows] = await conn.execute(
        `SELECT w.*, p.name AS product_name FROM work_orders w JOIN products p ON p.id = w.product_id WHERE w.id = ? FOR UPDATE`, [wo_id]
      );
      const wo = woRows[0];
      if (!wo) throw new Error('Work order not found');

      // Validate WO status — must be in_progress or completed
      const allowedStatuses = ['in_progress', 'completed', 'IN_PROGRESS', 'COMPLETED'];
      if (!allowedStatuses.includes(wo.status)) {
        throw new Error(`Cannot receive FG for WO with status '${wo.status}'. WO must be in_progress or completed.`);
      }

      // 2. Idempotency check — prevent double-click creating duplicate receipts
      if (idempotency_key) {
        const [dupRows] = await conn.execute(
          `SELECT id FROM stock_movements WHERE reference_type = 'fg_receipt' AND reference_id = ? AND notes LIKE ?`,
          [wo_id, `%${idempotency_key}%`]
        );
        if (dupRows.length > 0) {
          throw new Error('Duplicate receipt detected. This FG receipt has already been processed.');
        }
      }

      // 3. QC GATE — asked of the module that actually owns the answer.
      //
      // This used to read `wo_results.qc_status = 'passed'`, and that column is
      // written by nothing except the Production yield endpoints. So the gate
      // was asking Production whether Production's own output had passed QC.
      // Once that field was correctly locked (see PUT /yield/:id), NOTHING in
      // the system could ever set it to 'passed' — the gate would have been
      // unsatisfiable and FG receipt permanently impossible. Locking the field
      // and keeping this query would have deadlocked the plant.
      //
      // wo_qc_checkpoints is the real record: qc.routes.ts resolves an FPA and
      // writes passed/failed there. Same predicate the `complete` endpoint
      // already enforces, so the two gates cannot drift apart.
      const [qcRows] = await conn.execute(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN is_mandatory = 1 AND status NOT IN ('passed') THEN 1 ELSE 0 END) AS pending_mandatory
         FROM wo_qc_checkpoints WHERE wo_id = ?`,
        [wo_id]
      );
      const qcTotal = Number(qcRows[0]?.total || 0);
      const qcPendingMandatory = Number(qcRows[0]?.pending_mandatory || 0);
      // No checkpoint at all is not "QC clean", it is "QC never happened".
      // Receiving finished goods on that basis is precisely the negative flow
      // the review requires rejected, and refusing keeps this gate at least as
      // strict as the one it replaces rather than quietly loosening it.
      if (qcTotal === 0) {
        throw new Error('Cannot receive FG: this WO has no QC checkpoints. Generate QC checkpoints and complete inspection first.');
      }
      if (qcPendingMandatory > 0) {
        throw new Error(`Cannot receive FG: ${qcPendingMandatory} mandatory QC checkpoint(s) not passed. Complete QC inspection first.`);
      }

      // Actual output, from wo_results. Planned quantity is NOT the ceiling —
      // a WO planned at 1,000 that yielded 820 with 180 scrap may receive 820,
      // never 1,000 and never the old `planned * 1.1`.
      const [yieldRows] = await conn.execute(
        `SELECT COALESCE(SUM(output_quantity), 0) as total_output FROM wo_results WHERE wo_id = ?`,
        [wo_id]
      );
      const maxReceivable = Number(yieldRows[0]?.total_output || 0);
      if (maxReceivable === 0) {
        throw new Error('Cannot receive FG: no yield recorded for this WO. Record actual output first.');
      }

      const [existingReceipts] = await conn.execute(
        `SELECT COALESCE(SUM(quantity), 0) as total_received FROM stock_movements 
         WHERE reference_type = 'fg_receipt' AND reference_id = ? AND movement_type = 'in'`,
        [wo_id]
      );
      const alreadyReceived = Number(existingReceipts[0]?.total_received || 0);
      if (alreadyReceived + quantity > maxReceivable) {
        throw new Error(`Total receipt (${alreadyReceived + quantity}) exceeds actual accepted output (${maxReceivable}). Already received: ${alreadyReceived}`);
      }

      // 4. Update inventory stock (with row lock)
      const [stockRows] = await conn.execute(
        'SELECT * FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? FOR UPDATE',
        [wo.product_id, warehouse_id]
      );
      if (stockRows[0]) {
        await conn.execute(
          'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
          [quantity, stockRows[0].id]
        );
      } else {
        await conn.execute(
          'INSERT INTO inventory_stocks (warehouse_id, product_id, quantity) VALUES (?, ?, ?)',
          [warehouse_id, wo.product_id, quantity]
        );
      }

      // 5. Record stock movement
      const receiptNotes = `FG receipt from ${wo.wo_number || 'WO-' + wo_id}${idempotency_key ? ' [key:' + idempotency_key + ']' : ''}`;
      await conn.execute(
        `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, notes, created_by)
         VALUES (?, ?, ?, 'in', ?, 'fg_receipt', ?, ?, ?)`,
        [warehouse_id, wo.product_id, batch_number || null, quantity, wo_id, receiptNotes, userId]
      );

      // 6. Update WO completed_quantity
      await conn.execute(
        'UPDATE work_orders SET completed_quantity = COALESCE(completed_quantity, 0) + ? WHERE id = ?',
        [quantity, wo_id]
      );

      // 7. Create batch if batch_number provided
      if (batch_number) {
        const [batchRows] = await conn.execute('SELECT id FROM batches WHERE batch_number = ?', [batch_number]);
        if (batchRows.length === 0) {
          await conn.execute(
            `INSERT INTO batches (batch_number, product_id, quantity, manufacture_date, status, warehouse_id)
             VALUES (?, ?, ?, CURDATE(), 'released', ?)`,
            [batch_number, wo.product_id, quantity, warehouse_id]
          );
        }
      }
    });

    res.json({ success: true, message: 'FG received into warehouse' });
  } catch (error: any) {
    console.error('Error receiving FG:', error);
    const msg = error.message || 'Failed to receive FG';
    const status = msg.includes('Cannot receive') || msg.includes('exceed') || msg.includes('Duplicate') ? 400 : 500;
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
             COALESCE(inv.total_qty, 0) AS stock_available,
             COALESCE(req.total_required, 0) AS total_required,
             GREATEST(COALESCE(req.total_required, 0) - COALESCE(inv.total_qty, 0), 0) AS total_shortage
      FROM products p
      LEFT JOIN uom u ON p.uom_id = u.id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS total_qty FROM inventory_stocks GROUP BY product_id) inv ON inv.product_id = p.id
      JOIN (
        SELECT bd.raw_material_id AS product_id, SUM(bd.quantity * wo.quantity) AS total_required
        FROM work_orders wo
        JOIN bom_details bd ON bd.bom_header_id = wo.bom_id
        WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
          AND wo.bom_id IS NOT NULL
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
             bd.quantity * wo.quantity AS required,
             COALESCE(inv.total_qty, 0) AS available,
             GREATEST(bd.quantity * wo.quantity - COALESCE(inv.total_qty, 0), 0) AS shortage
      FROM work_orders wo
      JOIN bom_details bd ON bd.bom_header_id = wo.bom_id
      JOIN products p ON p.id = bd.raw_material_id
      LEFT JOIN (SELECT product_id, SUM(quantity) AS total_qty FROM inventory_stocks GROUP BY product_id) inv ON inv.product_id = bd.raw_material_id
      WHERE YEAR(wo.scheduled_start) = ? AND wo.status NOT IN ('cancelled', 'completed', 'closed')
        AND wo.bom_id IS NOT NULL
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

export default router;
