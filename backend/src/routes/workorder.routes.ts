import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// ========================================
// WO STATE MACHINE
// ========================================
// Valid states and their allowed transitions
const WO_TRANSITIONS: Record<string, string[]> = {
  'draft':       ['approved', 'cancelled'],
  'pending':     ['approved', 'cancelled'],        // legacy alias for draft
  'planned':     ['approved', 'cancelled'],         // legacy alias for draft
  'approved':    ['released', 'draft', 'cancelled'],
  'released':    ['in_progress', 'approved', 'cancelled'],
  'in_progress': ['on_hold', 'completed', 'cancelled'],
  'in-progress': ['on_hold', 'completed', 'cancelled'], // legacy
  'on_hold':     ['in_progress', 'cancelled'],
  'completed':   ['closed'],
  'closed':      [],                                 // terminal state
  'cancelled':   [],                                 // terminal state
};

/**
 * Validate a WO status transition.
 * Returns { valid, error } — if invalid, error describes why.
 */
function validateTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  const normalized = currentStatus.toLowerCase();
  const allowed = WO_TRANSITIONS[normalized];
  if (!allowed) {
    return { valid: false, error: `Unknown current status '${currentStatus}'` };
  }
  if (!allowed.includes(newStatus.toLowerCase())) {
    return { valid: false, error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: [${allowed.join(', ')}]` };
  }
  return { valid: true };
}

// GET /api/workorders
router.get('/', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const workOrders = await dbAll(
      `SELECT w.*, p.name as product_name, p.sku,
              lp.name as line_process_name, lp.code as line_process_code,
              lp.capacity_per_hour, u.name as capacity_unit_name
       FROM work_orders w 
       JOIN products p ON w.product_id = p.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       ORDER BY w.created_at DESC`
    );
    res.json({ data: workOrders });
  } catch (error) {
    console.error('Error fetching work orders:', error);
    res.status(500).json({ error: 'Failed to fetch work orders' });
  }
});

// GET /api/workorders/:id
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const workOrder = await dbGet(
      `SELECT w.*, p.name as product_name, p.sku,
              lp.name as line_process_name, lp.code as line_process_code,
              lp.capacity_per_hour, u.name as capacity_unit_name
       FROM work_orders w 
       JOIN products p ON w.product_id = p.id
       LEFT JOIN line_processes lp ON w.line_process_id = lp.id
       LEFT JOIN uom u ON lp.capacity_unit_id = u.id
       WHERE w.id = ? `,
      [req.params.id]
    );

    if (!workOrder) {
      return res.status(404).json({ error: 'Work order not found' });
    }

    res.json({ data: workOrder });
  } catch (error) {
    console.error('Error fetching work order:', error);
    res.status(500).json({ error: 'Failed to fetch work order' });
  }
});

// POST /api/workorders — always creates in 'draft' status
router.post('/', authMiddleware, requirePermission('production.workorders', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, quantity, priority, scheduled_start, scheduled_end, line_process_id } = req.body;

    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'product_id and quantity are required' });
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

    const result = await dbRun(
      `INSERT INTO work_orders(wo_number, product_id, quantity, status, priority, scheduled_start, scheduled_end, line_process_id) 
       VALUES(?, ?, ?, 'draft', ?, ?, ?, ?)`,
      [woNumber, product_id, quantity, priority || 'normal', scheduled_start || null, scheduled_end || null, line_process_id || null]
    );

    res.status(201).json({
      message: 'Work order created successfully',
      data: { id: result.insertId, wo_number: woNumber, product_id, quantity, status: 'draft', priority },
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
      if (status === 'in_progress' || status === 'released') {
        // Must have line_process set
        const effectiveLine = line_process_id || current.line_process_id;
        if (!effectiveLine) {
          return res.status(400).json({ error: `Cannot ${status === 'released' ? 'release' : 'start'} WO without a line process assigned` });
        }
      }

      if (status === 'in_progress') {
        // Check material availability (soft warning — we allow starting with partial materials)
        const materials = await dbAll(
          'SELECT wm.*, p.name as product_name FROM wo_materials wm JOIN products p ON p.id = wm.product_id WHERE wm.wo_id = ?',
          [woId]
        );
        const unavailable = [];
        for (const mat of materials) {
          const stock = await dbGet(
            'SELECT COALESCE(SUM(quantity), 0) as total FROM inventory_stocks WHERE product_id = ?',
            [mat.product_id]
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

    res.json({ message: 'Work order updated successfully' });
  } catch (error) {
    console.error('Error updating work order:', error);
    res.status(500).json({ error: 'Failed to update work order' });
  }
});

// DELETE /api/workorders/:id — soft-delete for WOs with transactions
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

export default router;
