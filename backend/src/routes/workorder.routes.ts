import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { validateTransition } from '../utils/wo-transitions';

const router = Router();

// GET /api/workorders — enriched with MPS provenance, supports month/year/status filters
router.get('/', authMiddleware, requirePermission('production.workorders', 'view'), async (req: Request, res: Response) => {
  try {
    const { month, year, status } = req.query;
    const conditions: string[] = [];
    const params: any[] = [];

    if (month && year) {
      conditions.push('(MONTH(w.scheduled_start) = ? AND YEAR(w.scheduled_start) = ?) OR (MONTH(w.scheduled_end) = ? AND YEAR(w.scheduled_end) = ?)');
      params.push(Number(month), Number(year), Number(month), Number(year));
    }
    if (status) {
      conditions.push('w.status = ?');
      params.push(String(status));
    }

    const whereClause = conditions.length ? 'WHERE ' + conditions.map(c => `(${c})`).join(' AND ') : '';

    const workOrders = await dbAll(
      `SELECT w.*, p.name as product_name, p.sku,
              lp.name as line_process_name, lp.code as line_process_code,
              lp.capacity_per_hour, u.name as capacity_unit_name,
              mh.mps_number, w.week_number as mps_week_number,
              COALESCE(cu.full_name, cu.username) as created_by_name,
              (SELECT COUNT(*) FROM wo_materials wm WHERE wm.wo_id = w.id) as materials_total,
              (SELECT COUNT(*) FROM wo_materials wm WHERE wm.wo_id = w.id AND wm.quantity_issued >= wm.quantity_required) as materials_ready
       FROM work_orders w 
       JOIN products p ON w.product_id = p.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       LEFT JOIN mps_details md ON w.mps_detail_id = md.id
       LEFT JOIN mps_headers mh ON md.mps_header_id = mh.id
       LEFT JOIN users cu ON w.created_by = cu.id
       ${whereClause}
       ORDER BY w.created_at DESC`,
      params
    );
    res.json({ data: workOrders });
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// GET /summary - WO status summary for dashboard (must be before /:id)
router.get('/summary', authMiddleware, requirePermission('production.workorders', 'view'), async (_req: Request, res: Response) => {
  try {
    const summary = await dbAll(`
      SELECT status, COUNT(*) as count
      FROM work_orders
      GROUP BY status
    `, []);
    res.json({ data: summary });
  } catch (error) {
    console.error('Error fetching WO summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// GET /api/workorders/:id — enriched with MPS provenance + demand sources
router.get('/:id', authMiddleware, requirePermission('production.workorders', 'view'), async (req: Request, res: Response) => {
  try {
    const workOrder = await dbGet(
      `SELECT w.*, p.name as product_name, p.sku,
              lp.name as line_process_name, lp.code as line_process_code,
              lp.capacity_per_hour, u.name as capacity_unit_name,
              mh.mps_number, mh.period_year as mps_year, mh.period_month as mps_month,
              COALESCE(cu.full_name, cu.username) as created_by_name
       FROM work_orders w 
       JOIN products p ON w.product_id = p.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       LEFT JOIN mps_details md ON w.mps_detail_id = md.id
       LEFT JOIN mps_headers mh ON md.mps_header_id = mh.id
       LEFT JOIN users cu ON w.created_by = cu.id
       WHERE w.id = ?`,
      [req.params.id]
    );

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    // load demand sources if MPS-linked
    if (workOrder.mps_detail_id) {
      workOrder.demand_sources = await dbAll(
        `SELECT ds.source_type, ds.quantity,
                si.id as so_item_id, so.so_number, c.name as customer_name,
                cp.id as project_id, CONCAT('PRJ-', cp.project_number) as project_ref, cp.project_name
         FROM mps_detail_sources ds
         LEFT JOIN so_items si ON ds.so_item_id = si.id
         LEFT JOIN sales_orders so ON si.so_id = so.id
         LEFT JOIN customers c ON so.customer_id = c.id
         LEFT JOIN client_projects cp ON ds.project_id = cp.id
         WHERE ds.mps_detail_id = ?`,
        [workOrder.mps_detail_id]
      );
    }

    res.json({ data: workOrder });
  } catch (error) {
    console.error('Error fetching work order:', error);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// POST /api/workorders — manual creation, requires source_reason
router.post('/', authMiddleware, requirePermission('production.workorders', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, quantity, priority, scheduled_start, scheduled_end, line_process_id, source_reason } = req.body;
    const userId = (req as any).user?.userId || null;

    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'product_id and quantity are required' });
    }

    // manual WO must have a reason explaining why it exists
    if (!source_reason || !String(source_reason).trim()) {
      return res.status(400).json({ error: 'source_reason is required for manual WO creation' });
    }

    // Auto-generate wo_number: WO-YYYYMMDD-NNN
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const existing = await dbGet(
      `SELECT COUNT(*) as cnt FROM work_orders WHERE wo_number LIKE ?`,
      [`WO-${dateStr}-%`]
    ) as any;
    const seq = String((existing?.cnt || 0) + 1).padStart(3, '0');
    const woNumber = `WO-${dateStr}-${seq}`;

    // auto-pin BOM at creation
    const bom = await dbGet(
      `SELECT id FROM bom_headers WHERE product_id = ? AND status = 'ACTIVE' AND approval_status = 2 ORDER BY id DESC LIMIT 1`,
      [product_id]
    ) as any;
    const bomId = bom?.id || null;

    const result = await dbRun(
      `INSERT INTO work_orders(wo_number, product_id, bom_id, quantity, status, priority, scheduled_start, scheduled_end, line_process_id, source_type, source_reason, created_by) 
       VALUES(?, ?, ?, ?, 'draft', ?, ?, ?, ?, 'MANUAL', ?, ?)`,
      [woNumber, product_id, bomId, quantity, priority || 'normal', scheduled_start || null, scheduled_end || null, line_process_id || null, String(source_reason).trim(), userId]
    );

    res.status(201).json({
      message: 'Work order created successfully',
      data: { id: result.insertId, wo_number: woNumber, product_id, bom_id: bomId, quantity, status: 'draft', priority, source_type: 'MANUAL' },
    });
  } catch (error) {
    console.error('Error creating work order:', error);
    res.status(500).json({ error: 'Failed to create work order' });
  }
});

// PUT /api/workorders/:id — update with state machine validation
router.put('/:id', authMiddleware, requirePermission('production.workorders', 'update'), async (req: Request, res: Response) => {
  try {
    const { quantity, status, priority, scheduled_start, scheduled_end, actual_start, actual_end, line_process_id } = req.body;
    const woId = req.params.id;

    // Fetch current WO
    const current = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]);
    if (!current) return res.status(404).json({ error: 'Work order not found' });

    // If status is changing, validate the transition
    if (status && status !== current.status) {
      const transition = validateTransition(current.status, status);
      if (!transition.valid) {
        return res.status(400).json({ error: transition.error });
      }

      // Prerequisites for specific transitions
      if (status === 'released') {
        // Must have line_process set
        const effectiveLine = line_process_id || current.line_process_id;
        if (!effectiveLine) {
          return res.status(400).json({ error: 'Cannot release WO without a line process assigned' });
        }
        // Must have an active, fully-approved BOM
        const effectiveBom = current.bom_id;
        if (!effectiveBom) {
          return res.status(400).json({ error: 'Cannot release WO without a BOM assigned. Create or import a BOM first.' });
        }
        const bomCheck = await dbGet(
          'SELECT id, status, approval_status, product_id FROM bom_headers WHERE id = ?',
          [effectiveBom]
        ) as any;
        if (!bomCheck) {
          return res.status(400).json({ error: 'Cannot release WO: assigned BOM no longer exists' });
        }
        if (bomCheck.product_id !== current.product_id) {
          return res.status(400).json({ error: 'Cannot release WO: BOM product does not match WO product' });
        }
        if (bomCheck.status !== 'ACTIVE') {
          return res.status(400).json({ error: `Cannot release WO: BOM status is '${bomCheck.status}', must be ACTIVE` });
        }
        if (Number(bomCheck.approval_status) !== 2) {
          return res.status(400).json({ error: 'Cannot release WO without a fully-approved BOM (approval_status must be 2/2)' });
        }
      }

      if (status === 'in_progress') {
        // Must have line_process set
        const effectiveLine = line_process_id || current.line_process_id;
        if (!effectiveLine) {
          return res.status(400).json({ error: 'Cannot start WO without a line process assigned' });
        }
        // Check material availability (soft warning — we allow starting with partial materials)
        const materials = await dbAll(
          'SELECT wm.*, p.name as product_name FROM wo_materials wm JOIN products p ON p.id = wm.product_id WHERE wm.wo_id = ?',
          [woId]
        );
        const unavailable = [];
        for (const mat of materials) {
          const stock = await dbGet(
            'SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_stocks WHERE product_id = ? AND status = ?',
            [mat.product_id, 'available']
          );
          if ((stock?.total || 0) < mat.quantity_required) {
            unavailable.push(`${mat.product_name}: need ${mat.quantity_required}, have ${stock?.total || 0}`);
          }
        }
        // Log warning but don't block — per our review response
        if (unavailable.length > 0) {
          console.warn(`WO ${woId} starting with insufficient materials:`, unavailable);
        }
      }

      // mandatory QC gate — same check as /production/execution/:woId/complete
      if (status === 'completed') {
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
      }
    }

    // Build dynamic update
    const updates: string[] = [];
    const params: any[] = [];

    if (quantity !== undefined) { updates.push('quantity = ?'); params.push(quantity); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (priority) { updates.push('priority = ?'); params.push(priority); }
    if (scheduled_start !== undefined) { updates.push('scheduled_start = ?'); params.push(scheduled_start); }
    if (scheduled_end !== undefined) { updates.push('scheduled_end = ?'); params.push(scheduled_end); }
    if (actual_start !== undefined) { updates.push('actual_start = ?'); params.push(actual_start); }
    if (actual_end !== undefined) { updates.push('actual_end = ?'); params.push(actual_end); }
    if (line_process_id !== undefined) { updates.push('line_process_id = ?'); params.push(line_process_id || null); }
    
    // Auto-set timestamps on state changes
    if (status === 'in_progress' && !actual_start) {
      updates.push('actual_start = NOW()');
    }
    if (status === 'completed' && !actual_end) {
      updates.push('actual_end = NOW()');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(woId);

    await dbRun(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, params);

    // auto-generate process logs from line_process_steps template when starting production
    if (status === 'in_progress') {
      const effectiveLine = line_process_id || current.line_process_id;
      if (effectiveLine) {
        // check if logs already exist (avoid duplicates on resume)
        const existingLogs = await dbAll(
          'SELECT id FROM wo_process_logs WHERE wo_id = ? LIMIT 1', [woId]
        );
        if (!(existingLogs as any[]).length) {
          const templateSteps = await dbAll(
            'SELECT * FROM line_process_steps WHERE line_process_id = ? ORDER BY step_order ASC',
            [effectiveLine]
          );
          const userId = (req as any).user?.userId || null;
          for (const step of templateSteps as any[]) {
            await dbRun(
              `INSERT INTO wo_process_logs (wo_id, process_name, status, notes, recorded_by)
               VALUES (?, ?, 'pending', ?, ?)`,
              [woId, step.process_name, step.description || null, userId]
            );
            // auto-create QC checkpoint for QC steps
            if (step.is_qc_checkpoint) {
              const existsQC = await dbGet(
                'SELECT id FROM wo_qc_checkpoints WHERE wo_id = ? AND process_stage = ?',
                [woId, step.process_name]
              );
              if (!existsQC) {
                await dbRun(
                  `INSERT INTO wo_qc_checkpoints (wo_id, process_stage, is_mandatory, qc_type) VALUES (?, ?, 1, 'LP')`,
                  [woId, step.process_name]
                );
              }
            }
          }
        }
      }
    }

    res.json({ message: 'Work order updated successfully' });
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

// PATCH /api/workorders/:id/status — lightweight status-only update
router.patch('/:id/status', authMiddleware, requirePermission('production.workorders', 'update'), async (req: Request, res: Response) => {
  try {
    const woId = req.params.id;
    const { status, actual_start, actual_end } = req.body;
    if (!status) return res.status(400).json({ error: 'status is required' });

    const current = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]) as any;
    if (!current) return res.status(404).json({ error: 'Work order not found' });

    if (status === current.status) return res.json({ message: 'No change' });

    const transition = validateTransition(current.status, status);
    if (!transition.valid) return res.status(400).json({ error: transition.error });

    // prerequisite checks
    if (status === 'released') {
      if (!current.line_process_id) return res.status(400).json({ error: 'Cannot release WO without a line process assigned' });
      if (!current.bom_id) return res.status(400).json({ error: 'Cannot release WO without a BOM assigned' });
      const bomCheck = await dbGet('SELECT id, status, approval_status, product_id FROM bom_headers WHERE id = ?', [current.bom_id]) as any;
      if (!bomCheck || bomCheck.status !== 'ACTIVE' || Number(bomCheck.approval_status) !== 2) {
        return res.status(400).json({ error: 'Cannot release WO: BOM must be ACTIVE and fully approved' });
      }
    }
    if (status === 'in_progress' && !current.line_process_id) {
      return res.status(400).json({ error: 'Cannot start WO without a line process assigned' });
    }
    if (status === 'completed') {
      const pendingQC = await dbAll(
        `SELECT id, process_stage, status FROM wo_qc_checkpoints WHERE wo_id = ? AND is_mandatory = 1 AND status NOT IN ('passed')`,
        [woId]
      ) as any[];
      if (pendingQC.length > 0) {
        return res.status(400).json({ error: `Cannot complete WO: ${pendingQC.length} mandatory QC checkpoint(s) not passed` });
      }
    }

    const updates: string[] = ['status = ?'];
    const params: any[] = [status];
    if (status === 'in_progress' && !actual_start && !current.actual_start) { updates.push('actual_start = NOW()'); }
    if (status === 'completed' && !actual_end && !current.actual_end) { updates.push('actual_end = NOW()'); }
    if (actual_start) { updates.push('actual_start = ?'); params.push(actual_start); }
    if (actual_end) { updates.push('actual_end = ?'); params.push(actual_end); }
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(woId);

    await dbRun(`UPDATE work_orders SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ message: `Status updated to ${status}` });
  } catch (error) {
    console.error('Error updating WO status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /api/workorders/:id — soft-delete for WOs with transactions
// PUT /api/workorders/:id/reschedule — move WO to different week
router.put('/:id/reschedule', authMiddleware, requirePermission('production.workorders', 'update'), async (req: Request, res: Response) => {
  try {
    const woId = Number(req.params.id);
    const userId = (req as any).user?.userId || null;
    const { new_week_number, new_year, new_quantity, reason } = req.body;

    if (!new_week_number || !new_year) {
      return res.status(400).json({ error: 'new_week_number and new_year are required' });
    }
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: 'Reason is required for reschedule' });
    }

    const wo = await dbGet('SELECT * FROM work_orders WHERE id = ?', [woId]) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    // status-based reschedule rules
    const status = (wo.status || '').toLowerCase();
    const terminalStatuses = ['in_progress', 'in-progress', 'completed', 'closed', 'cancelled', 'on_hold'];
    if (terminalStatuses.includes(status)) {
      return res.status(422).json({
        error: `Cannot reschedule WO in status "${wo.status}". Only DRAFT, APPROVED, or RELEASED WOs can be rescheduled.`,
        code: 'STATUS_LOCKED'
      });
    }

    // qty change only for draft/approved
    const qtyChangeAllowed = ['draft', 'pending', 'planned', 'approved'].includes(status);
    const finalQty = (new_quantity && qtyChangeAllowed) ? Number(new_quantity) : Number(wo.quantity);

    // calculate new scheduled dates from week number
    const jan4 = new Date(new_year, 0, 4);
    const dayOfWeek = jan4.getDay() || 7;
    const monday = new Date(jan4);
    monday.setDate(jan4.getDate() - dayOfWeek + 1 + (new_week_number - 1) * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const newStart = fmt(monday);
    const newEnd = fmt(sunday);

    // skip if nothing changed
    if (wo.week_number === new_week_number && wo.year === new_year && Number(wo.quantity) === finalQty) {
      return res.json({ message: 'No change needed', changed: false });
    }

    await dbTransaction(async (conn: any) => {
      // log the reschedule
      await conn.execute(
        `INSERT INTO wo_reschedule_log (wo_id, old_week_number, old_year, old_scheduled_start, old_scheduled_end, old_quantity, new_week_number, new_year, new_scheduled_start, new_scheduled_end, new_quantity, reason, rescheduled_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [woId, wo.week_number, wo.year, wo.scheduled_start, wo.scheduled_end, wo.quantity,
         new_week_number, new_year, newStart, newEnd, finalQty, reason.trim(), userId]
      );

      // update the WO
      await conn.execute(
        `UPDATE work_orders SET week_number = ?, year = ?, scheduled_start = ?, scheduled_end = ?, quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [new_week_number, new_year, newStart, newEnd, finalQty, woId]
      );
    });

    res.json({
      message: `WO ${wo.wo_number} rescheduled from W${wo.week_number} to W${new_week_number}`,
      changed: true,
      old: { week: wo.week_number, year: wo.year, qty: Number(wo.quantity) },
      new: { week: new_week_number, year: new_year, qty: finalQty, start: newStart, end: newEnd }
    });
  } catch (error) {
    console.error('Error rescheduling WO:', error);
    res.status(500).json({ error: 'Failed to reschedule work order' });
  }
});

// GET /api/workorders/:id/reschedule-log — reschedule history
router.get('/:id/reschedule-log', authMiddleware, requirePermission('production.workorders', 'view'), async (req: Request, res: Response) => {
  try {
    const logs = await dbAll(
      `SELECT rl.*, u.full_name as rescheduled_by_name
       FROM wo_reschedule_log rl
       LEFT JOIN users u ON rl.rescheduled_by = u.id
       WHERE rl.wo_id = ?
       ORDER BY rl.created_at DESC`,
      [req.params.id]
    );
    res.json({ data: logs });
  } catch (error) {
    console.error('Error fetching reschedule log:', error);
    res.status(500).json({ error: 'Failed to fetch reschedule log' });
  }
});

router.delete('/:id', authMiddleware, requirePermission('production.workorders', 'delete'), async (req: Request, res: Response) => {
  try {
    const woId = req.params.id;
    
    // Check if WO has any transactions (materials issued, stock movements, etc.)
    const hasTransactions = await dbGet(
      `SELECT 
         (SELECT COUNT(*) FROM wo_materials WHERE wo_id = ? AND quantity_issued > 0) +
         (SELECT COUNT(*) FROM stock_movements WHERE reference_id = ? AND reference_type IN ('work_order', 'fg_receipt'))
       as tx_count`,
      [woId, woId]
    );

    if (hasTransactions && hasTransactions.tx_count > 0) {
      // Soft-delete: set status to cancelled instead of deleting
      const current = await dbGet('SELECT status FROM work_orders WHERE id = ?', [woId]);
      if (current && ['completed', 'closed'].includes(current.status)) {
        return res.status(400).json({ error: `Cannot delete a ${current.status} work order with transactions. Use void/cancellation instead.` });
      }
      
      await dbRun(
        'UPDATE work_orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['cancelled', woId]
      );
      return res.json({ message: 'Work order cancelled (has transactions, cannot hard-delete)' });
    }

    // No transactions — safe to hard-delete
    await dbRun('DELETE FROM wo_materials WHERE wo_id = ?', [woId]);
    await dbRun('DELETE FROM work_orders WHERE id = ?', [woId]);
    res.json({ message: 'Work order deleted successfully' });
  } catch (error) {
    console.error('Error deleting work order:', error);
    res.status(500).json({ error: 'Failed to delete work order' });
  }
});

// GET /api/workorders/:id/trace — full demand lineage for a WO
router.get('/:id/trace', authMiddleware, requirePermission('production.workorders', 'view'), async (req: Request, res: Response) => {
  try {
    const wo = await dbGet(
      `SELECT w.id, w.wo_number, w.source_type, w.mps_detail_id, w.week_number, w.notes, w.source_reason,
              COALESCE(cu.full_name, cu.username) as created_by_name, w.created_at
       FROM work_orders w
       LEFT JOIN users cu ON w.created_by = cu.id
       WHERE w.id = ?`,
      [req.params.id]
    ) as any;
    if (!wo) return res.status(404).json({ error: 'Work order not found' });

    const trace: any = {
      wo: { id: wo.id, wo_number: wo.wo_number, source_type: wo.source_type || 'LEGACY_UNKNOWN' }
    };

    if (wo.source_type === 'MPS' && wo.mps_detail_id) {
      // MPS lineage
      const mpsDetail = await dbGet(
        `SELECT md.id, md.mps_header_id, md.product_id,
                mh.mps_number, mh.period_year, mh.period_month
         FROM mps_details md
         JOIN mps_headers mh ON md.mps_header_id = mh.id
         WHERE md.id = ?`,
        [wo.mps_detail_id]
      ) as any;

      if (mpsDetail) {
        trace.mps = {
          mps_number: mpsDetail.mps_number,
          period: `${mpsDetail.period_year}-${String(mpsDetail.period_month).padStart(2, '0')}`,
          week_number: wo.week_number
        };

        // demand sources from mps_detail_sources
        const sources = await dbAll(
          `SELECT ds.source_type, ds.quantity,
                  si.id as so_item_id, so.so_number, c.name as customer_name,
                  soi_p.name as so_product_name, si.quantity as so_qty,
                  cp.id as project_id, CONCAT('PRJ-', cp.project_number) as project_ref,
                  cp.project_name, cp.quantity as project_qty,
                  fh.forecast_number, fh.period_year as forecast_year, fh.period_month as forecast_month,
                  ds.week_number as forecast_week, ds.year as forecast_source_year
           FROM mps_detail_sources ds
           LEFT JOIN so_items si ON ds.so_item_id = si.id
           LEFT JOIN sales_orders so ON si.so_id = so.id
           LEFT JOIN customers c ON so.customer_id = c.id
           LEFT JOIN products soi_p ON si.product_id = soi_p.id
           LEFT JOIN client_projects cp ON ds.project_id = cp.id
           LEFT JOIN forecast_headers fh ON ds.forecast_header_id = fh.id
           WHERE ds.mps_detail_id = ?`,
          [wo.mps_detail_id]
        ) as any[];

        trace.demand_sources = sources.map((s: any) => {
          if (s.source_type === 'SO_ITEM') {
            return { type: 'SO_ITEM', ref: s.so_number, customer: s.customer_name, product: s.so_product_name, quantity: s.quantity || s.so_qty };
          } else if (s.source_type === 'PROJECT') {
            return { type: 'PROJECT', ref: s.project_ref, name: s.project_name, quantity: s.quantity || s.project_qty };
          } else if (s.source_type === 'FORECAST') {
            return { type: 'FORECAST', ref: s.forecast_number, period: `${s.forecast_year}-${String(s.forecast_month).padStart(2, '0')}`, week: s.forecast_week, year: s.forecast_source_year, quantity: s.quantity };
          }
          return { type: s.source_type, quantity: s.quantity };
        });
      }
    } else if (wo.source_type === 'MANUAL') {
      trace.manual = {
        source_reason: wo.source_reason || wo.notes,
        created_by: wo.created_by_name,
        created_at: wo.created_at
      };
    } else {
      trace.note = 'Provenance not available — created before lineage tracking was implemented';
    }

    res.json({ data: trace });
  } catch (error) {
    console.error('Error fetching WO trace:', error);
    res.status(500).json({ error: 'Failed to fetch WO trace' });
  }
});

export default router;
