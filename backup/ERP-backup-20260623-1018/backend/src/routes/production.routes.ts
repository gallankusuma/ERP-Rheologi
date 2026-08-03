import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { dbAll, dbGet, dbRun } from '../config/database';

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

router.post('/events', authMiddleware, async (req: Request, res: Response) => {
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

router.put('/events/:id', authMiddleware, async (req: Request, res: Response) => {
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

router.delete('/events/:id', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/tasks', authMiddleware, async (req: Request, res: Response) => {
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

router.put('/tasks/:id/status', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/planning', authMiddleware, async (_req: Request, res: Response) => {
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

router.get('/planning/summary', authMiddleware, async (_req: Request, res: Response) => {
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
router.get('/planning/weekly', authMiddleware, async (req: Request, res: Response) => {
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

// ============================================================
// MRP — Material Requirement Planning
// ============================================================
router.get('/mrp', authMiddleware, async (_req: Request, res: Response) => {
  try {
    // Get all pending/planned WOs and explode BOM to find material requirements
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
       JOIN bom_headers bh ON bh.product_id = p.id AND bh.status = 'approved'
       JOIN bom_details bd ON bd.bom_header_id = bh.id
       JOIN products rm ON rm.id = bd.raw_material_id
       LEFT JOIN inventory_stocks inv ON inv.product_id = bd.raw_material_id
       WHERE w.status IN ('pending', 'planned', 'in_progress', 'in-progress')
       ORDER BY w.scheduled_start ASC, rm.name ASC`
    );
    res.json({ success: true, data: requirements });
  } catch (error) {
    console.error('Error fetching MRP data:', error);
    res.status(500).json({ error: 'Failed to calculate MRP' });
  }
});

router.get('/mrp/shortage', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const shortages = await dbAll(
      `SELECT rm.id AS product_id, rm.name AS material_name, rm.sku AS material_sku,
              SUM(bd.quantity * w.quantity) AS total_required,
              COALESCE(MAX(inv.quantity), 0) AS stock_available,
              GREATEST(SUM(bd.quantity * w.quantity) - COALESCE(MAX(inv.quantity), 0), 0) AS shortage
       FROM work_orders w
       JOIN bom_headers bh ON bh.product_id = w.product_id AND bh.status = 'approved'
       JOIN bom_details bd ON bd.bom_header_id = bh.id
       JOIN products rm ON rm.id = bd.raw_material_id
       LEFT JOIN inventory_stocks inv ON inv.product_id = bd.raw_material_id
       WHERE w.status IN ('pending', 'planned', 'in_progress', 'in-progress')
       GROUP BY rm.id, rm.name, rm.sku
       HAVING shortage > 0
       ORDER BY shortage DESC`
    );
    res.json({ success: true, data: shortages });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate shortages' });
  }
});

// ============================================================
// Issue Material — pick materials from warehouse for WO
// ============================================================
router.get('/issue-material', authMiddleware, async (_req: Request, res: Response) => {
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

router.get('/issue-material/wo/:woId', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/issue-material', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { wo_material_id, quantity, warehouse_id, batch_number } = req.body;
    if (!wo_material_id || !quantity) {
      return res.status(400).json({ error: 'wo_material_id and quantity are required' });
    }

    const mat = await dbGet('SELECT * FROM wo_materials WHERE id = ?', [wo_material_id]);
    if (!mat) return res.status(404).json({ error: 'WO material not found' });

    const newIssued = (mat.quantity_issued || 0) + quantity;
    if (newIssued > mat.quantity_required) {
      return res.status(400).json({ error: 'Issue quantity exceeds required quantity' });
    }

    const userId = (req as any).user?.userId;
    await dbRun(
      `UPDATE wo_materials SET quantity_issued=?, warehouse_id=?, batch_number=?, issued_at=CURRENT_TIMESTAMP, issued_by=? WHERE id=?`,
      [newIssued, warehouse_id || mat.warehouse_id, batch_number || null, userId, wo_material_id]
    );

    // Record stock movement
    await dbRun(
      `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, ?, 'out', ?, 'work_order', ?, 'Material issued to WO', ?)`,
      [warehouse_id || mat.warehouse_id, mat.product_id, batch_number || null, quantity, mat.wo_id, userId]
    );

    // Reduce inventory stock
    await dbRun(
      `UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP
       WHERE product_id = ? AND warehouse_id = ?`,
      [quantity, mat.product_id, warehouse_id || mat.warehouse_id]
    );

    res.json({ success: true, message: 'Material issued successfully' });
  } catch (error) {
    console.error('Error issuing material:', error);
    res.status(500).json({ error: 'Failed to issue material' });
  }
});

// Auto-generate WO material list from BOM
router.post('/issue-material/generate/:woId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [req.params.woId]);
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const bom = await dbGet(
      `SELECT bh.id FROM bom_headers bh WHERE bh.product_id = ? AND bh.status = 'approved' ORDER BY bh.version DESC LIMIT 1`,
      [wo.product_id]
    );
    if (!bom) return res.status(404).json({ error: 'No approved BOM found for this product' });

    const bomDetails = await dbAll('SELECT * FROM bom_details WHERE bom_header_id = ?', [bom.id]);

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
router.get('/execution', authMiddleware, async (_req: Request, res: Response) => {
  try {
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
       WHERE w.status IN ('in_progress', 'in-progress', 'pending', 'planned')
       ORDER BY w.actual_start DESC, w.scheduled_start ASC`
    );
    res.json({ success: true, data: active });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch execution data' });
  }
});

router.post('/execution/:woId/start', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun(
      `UPDATE work_orders SET status='in_progress', actual_start=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start work order' });
  }
});

router.post('/execution/:woId/pause', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun(
      `UPDATE work_orders SET status='on_hold', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order paused' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to pause work order' });
  }
});

router.post('/execution/:woId/resume', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun(
      `UPDATE work_orders SET status='in_progress', updated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [req.params.woId]
    );
    res.json({ success: true, message: 'Work order resumed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to resume work order' });
  }
});

router.post('/execution/:woId/complete', authMiddleware, async (req: Request, res: Response) => {
  try {
    const woId = req.params.woId;

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
router.get('/execution/:woId/logs', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/execution/:woId/logs', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/execution/:woId/qc-checkpoints', authMiddleware, async (req: Request, res: Response) => {
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

router.delete('/execution/:woId/qc-checkpoints/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM wo_qc_checkpoints WHERE id = ? AND wo_id = ?', [req.params.id, req.params.woId]);
    res.json({ success: true, message: 'Checkpoint deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete checkpoint' });
  }
});

// Manual trigger QC for a checkpoint
router.post('/execution/:woId/trigger-qc/:checkpointId', authMiddleware, async (req: Request, res: Response) => {
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
router.get('/yield', authMiddleware, async (_req: Request, res: Response) => {
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

router.get('/yield/wo/:woId', authMiddleware, async (req: Request, res: Response) => {
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

router.post('/yield', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { wo_id, output_quantity, loss_quantity, batch_number, qc_status, notes } = req.body;
    if (!wo_id || output_quantity === undefined) {
      return res.status(400).json({ error: 'wo_id and output_quantity are required' });
    }

    const userId = (req as any).user?.userId;
    const totalOutput = Number(output_quantity) + Number(loss_quantity || 0);
    const lossPct = totalOutput > 0 ? ((Number(loss_quantity || 0) / totalOutput) * 100).toFixed(2) : '0.00';

    const result = await dbRun(
      `INSERT INTO wo_results (wo_id, output_quantity, loss_quantity, loss_percentage, batch_number, qc_status, completed_by, completed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)`,
      [wo_id, output_quantity, loss_quantity || 0, lossPct, batch_number || null, qc_status || 'pending', userId, notes || null]
    );
    res.status(201).json({ success: true, message: 'Yield recorded', id: result.insertId });
  } catch (error) {
    console.error('Error recording yield:', error);
    res.status(500).json({ error: 'Failed to record yield' });
  }
});

router.put('/yield/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { output_quantity, loss_quantity, batch_number, qc_status, notes } = req.body;
    const totalOutput = Number(output_quantity) + Number(loss_quantity || 0);
    const lossPct = totalOutput > 0 ? ((Number(loss_quantity || 0) / totalOutput) * 100).toFixed(2) : '0.00';

    await dbRun(
      `UPDATE wo_results SET output_quantity=?, loss_quantity=?, loss_percentage=?, batch_number=?, qc_status=?, notes=? WHERE id=?`,
      [output_quantity, loss_quantity || 0, lossPct, batch_number || null, qc_status || 'pending', notes || null, req.params.id]
    );
    res.json({ success: true, message: 'Yield updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update yield' });
  }
});

// ============================================================
// FG Receipt — receive finished goods into warehouse
// ============================================================
router.get('/fg-receipt', authMiddleware, async (_req: Request, res: Response) => {
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

router.post('/fg-receipt', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { wo_id, warehouse_id, quantity, batch_number } = req.body;
    if (!wo_id || !warehouse_id || !quantity) {
      return res.status(400).json({ error: 'wo_id, warehouse_id, and quantity are required' });
    }

    const wo = await dbGet(
      `SELECT w.*, p.name AS product_name FROM work_orders w JOIN products p ON p.id = w.product_id WHERE w.id = ?`, [wo_id]
    );
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const userId = (req as any).user?.userId;

    // Add to inventory
    const existing = await dbGet(
      'SELECT id, quantity FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ?',
      [wo.product_id, warehouse_id]
    );
    if (existing) {
      await dbRun('UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [quantity, existing.id]);
    } else {
      await dbRun('INSERT INTO inventory_stocks (warehouse_id, product_id, quantity) VALUES (?, ?, ?)',
        [warehouse_id, wo.product_id, quantity]);
    }

    // Record stock movement
    await dbRun(
      `INSERT INTO stock_movements (warehouse_id, product_id, batch_number, movement_type, quantity, reference_type, reference_id, notes, created_by)
       VALUES (?, ?, ?, 'in', ?, 'fg_receipt', ?, ?, ?)`,
      [warehouse_id, wo.product_id, batch_number || null, quantity, wo_id, `FG receipt from ${wo.wo_number || 'WO-' + wo_id}`, userId]
    );

    // Create batch if batch_number provided
    if (batch_number) {
      const batchExists = await dbGet('SELECT id FROM batches WHERE batch_number = ?', [batch_number]);
      if (!batchExists) {
        await dbRun(
          `INSERT INTO batches (batch_number, product_id, quantity, manufacture_date, status, warehouse_id)
           VALUES (?, ?, ?, CURDATE(), 'released', ?)`,
          [batch_number, wo.product_id, quantity, warehouse_id]
        );
      }
    }

    res.json({ success: true, message: 'FG received into warehouse' });
  } catch (error) {
    console.error('Error receiving FG:', error);
    res.status(500).json({ error: 'Failed to receive FG' });
  }
});

// ============================================================
// Production History — all WOs with full detail
// ============================================================
router.get('/history', authMiddleware, async (req: Request, res: Response) => {
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

router.get('/history/stats', authMiddleware, async (_req: Request, res: Response) => {
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

export default router;
