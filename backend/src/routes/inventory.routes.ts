import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission, checkUserPermission } from '../middleware/permission';
import { queryStockCard } from '../services/inventory-ledger.service';

const router = Router();

const generateCode = (prefix: string) => {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${datePart}-${rand}`;
};

// ========================================
// NOTE: Specific routes are defined first.
// Generic inventory routes are declared later.
// ========================================

// ========================================
// STOCK TRANSFERS (Warehouse to Warehouse)
// ========================================

// GET /api/inventory/stock-transfers - List all stock transfers
router.get('/stock-transfers', authMiddleware, requirePermission('inventory.stock-transfer', 'view'), async (req: Request, res: Response) => {
  try {
    const transfers = await dbAll(`
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku,
        wh_from.name as from_warehouse_name,
        wh_to.name as to_warehouse_name,
        u.full_name as created_by_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN warehouses wh_from ON sm.from_warehouse_id = wh_from.id
      LEFT JOIN warehouses wh_to ON sm.to_warehouse_id = wh_to.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.movement_type = 'transfer'
      ORDER BY sm.moved_at DESC
    `, []);
    res.json({ data: transfers });
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    res.status(500).json({ error: 'Failed to fetch stock transfers' });
  }
});

// POST /api/inventory/stock-transfers - Create stock transfer
router.post('/stock-transfers', authMiddleware, requirePermission('inventory.stock-transfer', 'create'), async (req: Request, res: Response) => {
  try {
    const { 
      product_id, 
      from_warehouse_id, 
      to_warehouse_id, 
      from_location_id,
      to_location_id,
      batch_id,
      quantity, 
      uom, 
      notes 
    } = req.body;
    const userId = (req as any).user?.userId;

    if (!product_id || !from_warehouse_id || !to_warehouse_id || !quantity) {
      return res.status(400).json({ error: 'product_id, from_warehouse_id, to_warehouse_id, and quantity are required' });
    }

    if (from_warehouse_id === to_warehouse_id) {
      return res.status(400).json({ error: 'Source and destination warehouses must be different' });
    }

    const reference_id = generateCode('TRF');

    const result = await dbRun(`
      INSERT INTO stock_movements (
        product_id, warehouse_id, location_id, batch_id,
        movement_type, transfer_type, quantity, uom,
        from_warehouse_id, to_warehouse_id, from_location_id, to_location_id,
        reference_type, reference_id, notes, created_by,
        approval_status
      ) VALUES (?, ?, ?, ?, 'transfer', 'warehouse_transfer', ?, ?, ?, ?, ?, ?, 'stock_transfer', ?, ?, ?, 0)
    `, [
      product_id,
      from_warehouse_id,
      from_location_id || null,
      batch_id || null,
      quantity,
      uom || null,
      from_warehouse_id,
      to_warehouse_id,
      from_location_id || null,
      to_location_id || null,
      reference_id,
      notes || null,
      userId || null
    ]);

    res.status(201).json({
      message: 'Stock transfer created successfully (Pending Approval)',
      data: { 
        id: result.insertId, 
        reference_id,
        approval_status: 0 
      }
    });
  } catch (error) {
    console.error('Error creating stock transfer:', error);
    res.status(500).json({ error: 'Failed to create stock transfer' });
  }
});

// PUT /api/inventory/stock-transfers/:id - Update stock transfer (only if approval_status = 0)
router.put('/stock-transfers/:id', authMiddleware, requirePermission('inventory.stock-transfer', 'update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { quantity, notes } = req.body;

    // Check current approval status
    const current = await dbGet('SELECT approval_status FROM stock_movements WHERE id = ?', [id]) as any;
    if (!current) {
      return res.status(404).json({ error: 'Stock transfer not found' });
    }

    if (current.approval_status !== 0) {
      return res.status(400).json({ error: 'Cannot edit approved stock transfer' });
    }

    await dbRun(`
      UPDATE stock_movements 
      SET quantity = ?, notes = ?
      WHERE id = ?
    `, [quantity, notes, id]);

    res.json({ message: 'Stock transfer updated successfully' });
  } catch (error) {
    console.error('Error updating stock transfer:', error);
    res.status(500).json({ error: 'Failed to update stock transfer' });
  }
});

// DELETE /api/inventory/stock-transfers/:id - Delete stock transfer (only if approval_status = 0)
router.delete('/stock-transfers/:id', authMiddleware, requirePermission('inventory.stock-transfer', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const current = await dbGet('SELECT approval_status FROM stock_movements WHERE id = ?', [id]) as any;
    if (!current) {
      return res.status(404).json({ error: 'Stock transfer not found' });
    }

    if (current.approval_status !== 0) {
      return res.status(400).json({ error: 'Cannot delete approved stock transfer. Use reject instead.' });
    }

    await dbRun('DELETE FROM stock_movements WHERE id = ?', [id]);
    res.json({ message: 'Stock transfer deleted successfully' });
  } catch (error) {
    console.error('Error deleting stock transfer:', error);
    res.status(500).json({ error: 'Failed to delete stock transfer' });
  }
});

// POST /api/inventory/stock-transfers/:id/approve - Approve stock transfer
router.post('/stock-transfers/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const transfer = await dbGet('SELECT * FROM stock_movements WHERE id = ?', [id]) as any;
    if (!transfer) return res.status(404).json({ error: 'Stock transfer not found' });

    const currentStatus = transfer.approval_status || 0;
    const hasApprove = await checkUserPermission(userId, 'inventory.stock-transfer', 'approve');
    const hasApprove1 = await checkUserPermission(userId, 'inventory.stock-transfer', 'approve_1');
    const hasApprove2 = await checkUserPermission(userId, 'inventory.stock-transfer', 'approve_2');

    if (hasApprove && currentStatus < 2) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 2, approved_by_supervisor_id = ?, approved_by_manager_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, userId, id]
      );
      await executeStockTransfer(transfer);
      return res.json({ message: 'Stock transfer fully approved and executed', approval_status: 2 });
    }
    if (hasApprove1 && currentStatus === 0) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 1, approved_by_supervisor_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, id]
      );
      return res.json({ message: 'Stock transfer approved (1/2)', approval_status: 1 });
    }
    if (hasApprove2 && currentStatus === 1) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 2, approved_by_manager_id = ?, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, id]
      );
      await executeStockTransfer(transfer);
      return res.json({ message: 'Stock transfer fully approved and executed (2/2)', approval_status: 2 });
    }

    return res.status(403).json({ error: 'Insufficient permissions to approve at current status' });
  } catch (error) {
    console.error('Error approving stock transfer:', error);
    res.status(500).json({ error: 'Failed to approve stock transfer' });
  }
});

// POST /api/inventory/stock-transfers/:id/reject - Reject/Reset stock transfer
router.post('/stock-transfers/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const transfer = await dbGet('SELECT approval_status FROM stock_movements WHERE id = ?', [id]) as any;
    if (!transfer) return res.status(404).json({ error: 'Stock transfer not found' });

    const currentStatus = transfer.approval_status || 0;
    if (currentStatus === 0) return res.status(400).json({ error: 'Cannot reject pending item' });

    const canReject = await checkUserPermission(userId, 'inventory.stock-transfer', 'approve_1')
      || await checkUserPermission(userId, 'inventory.stock-transfer', 'approve_2')
      || await checkUserPermission(userId, 'inventory.stock-transfer', 'approve');
    if (!canReject) return res.status(403).json({ error: 'Insufficient permissions to reject' });

    await dbRun(
      'UPDATE stock_movements SET approval_status = 0, approved_by_supervisor_id = NULL, approved_by_manager_id = NULL, approved_at_supervisor = NULL, approved_at_manager = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'Stock transfer reset to pending (0/2)', approval_status: 0 });
  } catch (error) {
    console.error('Error rejecting stock transfer:', error);
    res.status(500).json({ error: 'Failed to reject stock transfer' });
  }
});

// helper: execute stock transfer atomically — rejects insufficient/missing source stock
async function executeStockTransfer(transfer: any) {
  await dbTransaction(async (conn) => {
    // lock source row (available only) — prevent concurrent deductions
    const [sourceRows] = await conn.execute(
      'SELECT id, quantity FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = ? FOR UPDATE',
      [transfer.product_id, transfer.from_warehouse_id, 'available']
    );
    const source = sourceRows[0];

    if (!source) {
      throw new Error(`No available stock found for product ${transfer.product_id} in warehouse ${transfer.from_warehouse_id}`);
    }

    const sourceQty = Number(source.quantity) || 0;
    if (sourceQty < transfer.quantity) {
      throw new Error(`Insufficient stock: available ${sourceQty}, requested ${transfer.quantity}`);
    }

    // deduct from source
    await conn.execute(
      'UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [transfer.quantity, source.id]
    );

    // add to destination (available only)
    const [destRows] = await conn.execute(
      'SELECT id FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = ? FOR UPDATE',
      [transfer.product_id, transfer.to_warehouse_id, 'available']
    );
    const dest = destRows[0];

    if (dest) {
      await conn.execute(
        'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [transfer.quantity, dest.id]
      );
    } else {
      await conn.execute(
        'INSERT INTO inventory_stocks (product_id, warehouse_id, quantity, status, last_updated) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [transfer.product_id, transfer.to_warehouse_id, transfer.quantity, 'available']
      );
    }

    // record stock movements for audit trail
    const transferLabel = transfer.transfer_number || `TRF-${transfer.id || 'manual'}`;
    await conn.execute(
      `INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, notes, created_at)
       VALUES (?, ?, ?, 'outbound', 'TRANSFER', ?, ?, CURRENT_TIMESTAMP)`,
      [transfer.product_id, transfer.from_warehouse_id, transfer.quantity, transfer.id || null, `${transferLabel} - Transfer out`]
    );
    await conn.execute(
      `INSERT INTO stock_movements (product_id, warehouse_id, quantity, movement_type, reference_type, reference_id, notes, created_at)
       VALUES (?, ?, ?, 'inbound', 'TRANSFER', ?, ?, CURRENT_TIMESTAMP)`,
      [transfer.product_id, transfer.to_warehouse_id, transfer.quantity, transfer.id || null, `${transferLabel} - Transfer in`]
    );

    console.log(`[StockTransfer] Transferred ${transfer.quantity} of product ${transfer.product_id}: WH ${transfer.from_warehouse_id} -> WH ${transfer.to_warehouse_id}`);
  });
}


// ========================================
// STOCK ADJUSTMENTS (Manual Corrections)
// ========================================

// GET /api/inventory/stock-adjustments - List all stock adjustments
router.get('/stock-adjustments', authMiddleware, requirePermission('inventory.stock-adjustment', 'view'), async (req: Request, res: Response) => {
  try {
    const adjustments = await dbAll(`
      SELECT 
        sm.*,
        p.name as product_name,
        p.sku,
        wh.name as warehouse_name,
        u.full_name as created_by_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN warehouses wh ON sm.warehouse_id = wh.id
      LEFT JOIN users u ON sm.created_by = u.id
      WHERE sm.movement_type = 'adjustment'
      ORDER BY sm.moved_at DESC
    `, []);
    res.json({ data: adjustments });
  } catch (error) {
    console.error('Error fetching stock adjustments:', error);
    res.status(500).json({ error: 'Failed to fetch stock adjustments' });
  }
});

// POST /api/inventory/stock-adjustments - Create stock adjustment
router.post('/stock-adjustments', authMiddleware, requirePermission('inventory.stock-adjustment', 'create'), async (req: Request, res: Response) => {
  try {
    const { 
      product_id, 
      warehouse_id, 
      location_id,
      batch_id,
      quantity, // Can be positive or negative
      uom,
      reason,
      notes 
    } = req.body;
    const userId = (req as any).user?.userId;

    if (!product_id || !warehouse_id || quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'product_id, warehouse_id, and quantity are required' });
    }

    const reference_id = generateCode('ADJ');
    const adjustmentType = quantity >= 0 ? 'increase' : 'decrease';

    const result = await dbRun(`
      INSERT INTO stock_movements (
        product_id, warehouse_id, location_id, batch_id,
        movement_type, transfer_type, quantity, uom,
        reference_type, reference_id, notes, created_by,
        approval_status
      ) VALUES (?, ?, ?, ?, 'adjustment', ?, ?, ?, 'stock_adjustment', ?, ?, ?, 0)
    `, [
      product_id,
      warehouse_id,
      location_id || null,
      batch_id || null,
      adjustmentType,
      quantity,
      uom || null,
      reference_id,
      reason ? `${reason} - ${notes || ''}` : notes || null,
      userId || null
    ]);

    res.status(201).json({
      message: 'Stock adjustment created successfully (Pending Approval)',
      data: { 
        id: result.insertId, 
        reference_id,
        approval_status: 0 
      }
    });
  } catch (error) {
    console.error('Error creating stock adjustment:', error);
    res.status(500).json({ error: 'Failed to create stock adjustment' });
  }
});

// DELETE /api/inventory/stock-adjustments/:id - Delete stock adjustment
router.delete('/stock-adjustments/:id', authMiddleware, requirePermission('inventory.stock-adjustment', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const current = await dbGet('SELECT approval_status FROM stock_movements WHERE id = ?', [id]) as any;
    if (!current) {
      return res.status(404).json({ error: 'Stock adjustment not found' });
    }

    if (current.approval_status !== 0) {
      return res.status(400).json({ error: 'Cannot delete approved stock adjustment. Use reject instead.' });
    }

    await dbRun('DELETE FROM stock_movements WHERE id = ?', [id]);
    res.json({ message: 'Stock adjustment deleted successfully' });
  } catch (error) {
    console.error('Error deleting stock adjustment:', error);
    res.status(500).json({ error: 'Failed to delete stock adjustment' });
  }
});

// POST /api/inventory/stock-adjustments/:id/approve - Approve stock adjustment
router.post('/stock-adjustments/:id/approve', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const adjustment = await dbGet('SELECT * FROM stock_movements WHERE id = ?', [id]) as any;
    if (!adjustment) return res.status(404).json({ error: 'Stock adjustment not found' });

    const currentStatus = adjustment.approval_status || 0;
    const hasApprove = await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve');
    const hasApprove1 = await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve_1');
    const hasApprove2 = await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve_2');

    if (hasApprove && currentStatus < 2) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 2, approved_by_supervisor_id = ?, approved_by_manager_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, userId, id]
      );
      await executeStockAdjustment(adjustment);
      return res.json({ message: 'Stock adjustment fully approved and executed', approval_status: 2 });
    }
    if (hasApprove1 && currentStatus === 0) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 1, approved_by_supervisor_id = ?, approved_at_supervisor = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, id]
      );
      return res.json({ message: 'Stock adjustment approved (1/2)', approval_status: 1 });
    }
    if (hasApprove2 && currentStatus === 1) {
      await dbRun(
        'UPDATE stock_movements SET approval_status = 2, approved_by_manager_id = ?, approved_at_manager = CURRENT_TIMESTAMP WHERE id = ?',
        [userId, id]
      );
      await executeStockAdjustment(adjustment);
      return res.json({ message: 'Stock adjustment fully approved and executed (2/2)', approval_status: 2 });
    }

    return res.status(403).json({ error: 'Insufficient permissions to approve at current status' });
  } catch (error) {
    console.error('Error approving stock adjustment:', error);
    res.status(500).json({ error: 'Failed to approve stock adjustment' });
  }
});

// POST /api/inventory/stock-adjustments/:id/reject - Reject stock adjustment
router.post('/stock-adjustments/:id/reject', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    const adjustment = await dbGet('SELECT approval_status FROM stock_movements WHERE id = ?', [id]) as any;
    if (!adjustment) return res.status(404).json({ error: 'Stock adjustment not found' });

    const currentStatus = adjustment.approval_status || 0;
    if (currentStatus === 0) return res.status(400).json({ error: 'Cannot reject pending item' });

    const canReject = await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve_1')
      || await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve_2')
      || await checkUserPermission(userId, 'inventory.stock-adjustment', 'approve');
    if (!canReject) return res.status(403).json({ error: 'Insufficient permissions to reject' });

    await dbRun(
      'UPDATE stock_movements SET approval_status = 0, approved_by_supervisor_id = NULL, approved_by_manager_id = NULL, approved_at_supervisor = NULL, approved_at_manager = NULL WHERE id = ?',
      [id]
    );

    res.json({ message: 'Stock adjustment reset to pending (0/2)', approval_status: 0 });
  } catch (error) {
    console.error('Error rejecting stock adjustment:', error);
    res.status(500).json({ error: 'Failed to reject stock adjustment' });
  }
});

// stock opname routes
router.get('/opname', authMiddleware, requirePermission('inventory.stock-opname', 'view'), async (req: Request, res: Response) => {
  try {
    const sessions = await dbAll(`
      SELECT so.*, w.name as warehouse_name, u.full_name as created_by_name,
        (SELECT COUNT(*) FROM stock_opname_items soi WHERE soi.opname_id = so.id) as item_count
      FROM stock_opname so
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      LEFT JOIN users u ON so.created_by = u.id
      ORDER BY so.created_at DESC
    `, []);
    res.json({ data: sessions });
  } catch (error) {
    console.error('Error fetching stock opname:', error);
    res.status(500).json({ error: 'Failed to fetch stock opname sessions' });
  }
});

router.post('/opname', authMiddleware, requirePermission('inventory.stock-opname', 'create'), async (req: Request, res: Response) => {
  try {
    const { warehouse_id, notes } = req.body;
    const userId = (req as any).user?.userId;
    const opnameNumber = generateCode('OPN');
    const result = await dbRun(
      `INSERT INTO stock_opname (opname_number, warehouse_id, notes, created_by) VALUES (?, ?, ?, ?)`,
      [opnameNumber, warehouse_id, notes || null, userId]
    ) as any;

    // lot-aware auto-populate: one item per inventory_stocks row with lot lineage
    await dbRun(`
      INSERT INTO stock_opname_items (opname_id, product_id, lot_id, inventory_stock_id, system_qty, status_snapshot, batch_number)
      SELECT ?, ist.product_id, ist.lot_id, ist.id, ist.quantity, ist.status, ist.batch_number
      FROM inventory_stocks ist
      WHERE ist.warehouse_id = ? AND ist.status = 'available'
      ORDER BY ist.product_id ASC, ist.lot_id ASC
    `, [result.insertId, warehouse_id]);

    res.json({ data: { id: result.insertId, opname_number: opnameNumber } });
  } catch (error) {
    console.error('Error creating stock opname:', error);
    res.status(500).json({ error: 'Failed to create stock opname' });
  }
});

router.get('/opname/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const session = await dbGet(`
      SELECT so.*, w.name as warehouse_name
      FROM stock_opname so
      LEFT JOIN warehouses w ON so.warehouse_id = w.id
      WHERE so.id = ?
    `, [req.params.id]);
    if (!session) return res.status(404).json({ error: 'Opname session not found' });

    const items = await dbAll(`
      SELECT soi.*, p.name as product_name, p.sku
      FROM stock_opname_items soi
      JOIN products p ON soi.product_id = p.id
      WHERE soi.opname_id = ?
      ORDER BY p.name
    `, [req.params.id]);

    res.json({ data: { ...(session as any), items } });
  } catch (error) {
    console.error('Error fetching opname detail:', error);
    res.status(500).json({ error: 'Failed to fetch opname detail' });
  }
});

router.put('/opname/:id/items', authMiddleware, requirePermission('inventory.stock-opname', 'update'), async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    for (const item of items) {
      await dbRun(
        `UPDATE stock_opname_items SET actual_qty = ?, notes = ? WHERE id = ?`,
        [item.actual_qty, item.notes || null, item.id]
      );
    }
    res.json({ message: 'Items updated' });
  } catch (error) {
    console.error('Error updating opname items:', error);
    res.status(500).json({ error: 'Failed to update opname items' });
  }
});

router.post('/opname/:id/post', authMiddleware, requirePermission('inventory.stock-opname', 'approve'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    await dbTransaction(async (conn: any) => {
      // lock the opname session
      const [sessionRows] = await conn.execute(
        'SELECT * FROM stock_opname WHERE id = ? FOR UPDATE', [req.params.id]
      );
      const session = (sessionRows as any[])[0];
      if (!session) throw new Error('Session not found');
      if (session.status !== 'draft') throw new Error('Only draft sessions can be posted');

      // set cutoff timestamp at post time
      const cutoffAt = new Date().toISOString().replace('T', ' ').substring(0, 19);

      // get all counted items, ordered by id for deterministic locking
      const [items] = await conn.execute(
        'SELECT * FROM stock_opname_items WHERE opname_id = ? AND actual_qty IS NOT NULL ORDER BY id ASC',
        [req.params.id]
      );

      for (const item of (items as any[])) {
        const diff = Number(item.actual_qty) - Number(item.system_qty);
        if (diff === 0) continue;

        // lock exact inventory row by id (lot-specific)
        if (item.inventory_stock_id) {
          const [stockRows] = await conn.execute(
            'SELECT * FROM inventory_stocks WHERE id = ? FOR UPDATE',
            [item.inventory_stock_id]
          );
          const stock = (stockRows as any[])[0];
          if (!stock) {
            throw new Error(`Inventory stock row ${item.inventory_stock_id} not found for product ${item.product_id}. Cannot apply opname adjustment.`);
          }

          const currentStockQty = Number(stock.quantity) || 0;
          if (currentStockQty + diff < 0) {
            throw new Error(`Opname adjustment would result in negative stock for product ${item.product_id} lot ${item.lot_id} (current: ${currentStockQty}, diff: ${diff})`);
          }

          await conn.execute(
            'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [diff, stock.id]
          );
        } else {
          // fallback for legacy items without inventory_stock_id
          const [stockRows] = await conn.execute(
            "SELECT * FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ? AND status = 'available' ORDER BY id ASC LIMIT 1 FOR UPDATE",
            [item.product_id, session.warehouse_id]
          );
          const stock = (stockRows as any[])[0];
          if (!stock) {
            throw new Error(`No available inventory row for product ${item.product_id} in warehouse ${session.warehouse_id}. Cannot apply opname adjustment.`);
          }

          const currentStockQty = Number(stock.quantity) || 0;
          if (currentStockQty + diff < 0) {
            throw new Error(`Opname adjustment would result in negative stock for product ${item.product_id} (current: ${currentStockQty}, diff: ${diff})`);
          }

          await conn.execute(
            'UPDATE inventory_stocks SET quantity = quantity + ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
            [diff, stock.id]
          );
        }

        // immutable movement record with lot reference
        await conn.execute(
          `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, lot_id, notes, created_by, moved_at)
           VALUES (?, ?, 'adjustment', ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [session.warehouse_id, item.product_id, diff, item.lot_id || null, `Stock opname: ${session.opname_number}`, userId]
        );
      }

      // mark session as posted with cutoff
      await conn.execute(
        'UPDATE stock_opname SET status = ?, posted_by = ?, posted_at = CURRENT_TIMESTAMP, cutoff_at = ? WHERE id = ?',
        ['posted', userId, cutoffAt, req.params.id]
      );
    });

    res.json({ message: 'Stock opname posted' });
  } catch (error: any) {
    console.error('Error posting opname:', error);
    if (error.message?.includes('No available inventory') || error.message?.includes('Only draft') || error.message?.includes('not found') || error.message?.includes('negative stock')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to post stock opname' });
  }
});

// batch tracking routes
router.get('/batch-tracking', authMiddleware, requirePermission('inventory.batch-tracking', 'view'), async (req: Request, res: Response) => {
  try {
    const { search, product_id, status } = req.query;
    let sql = `
      SELECT b.*, p.name as product_name, p.sku, w.name as warehouse_name
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ` AND (b.batch_number LIKE ? OR p.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (product_id) { sql += ` AND b.product_id = ?`; params.push(product_id); }
    if (status) { sql += ` AND b.status = ?`; params.push(status); }
    sql += ` ORDER BY b.created_at DESC`;

    const batches = await dbAll(sql, params);
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

router.get('/batch-tracking/:batchNumber/movements', authMiddleware, async (req: Request, res: Response) => {
  try {
    const movements = await dbAll(`
      SELECT sm.*, p.name as product_name, w.name as warehouse_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      LEFT JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.batch_number = ?
      ORDER BY sm.moved_at DESC
    `, [req.params.batchNumber]);
    res.json({ data: movements });
  } catch (error) {
    console.error('Error fetching batch movements:', error);
    res.status(500).json({ error: 'Failed to fetch batch movements' });
  }
});

// expiry monitoring route
router.get('/expiry', authMiddleware, requirePermission('inventory.expiry-monitoring', 'view'), async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const batches = await dbAll(`
      SELECT b.*, p.name as product_name, p.sku, w.name as warehouse_name,
        DATEDIFF(b.expiry_date, CURDATE()) as days_until_expiry
      FROM batches b
      JOIN products p ON b.product_id = p.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.expiry_date IS NOT NULL
        AND b.expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND b.status = 'ACTIVE'
        AND b.quantity > 0
      ORDER BY b.expiry_date ASC
    `, [days]);
    res.json({ data: batches });
  } catch (error) {
    console.error('Error fetching expiry data:', error);
    res.status(500).json({ error: 'Failed to fetch expiry data' });
  }
});

// GET /api/inventory - List all inventory
router.get('/', authMiddleware, requirePermission('inventory.dashboard', 'view'), async (req: Request, res: Response) => {
  try {
    const warehouseId = req.query.warehouse_id as string;
    const showAll = req.query.all === '1';
    
    let query = `SELECT i.id,
              i.warehouse_id,
              i.product_id,
              p.name as product_name,
              p.sku,
              i.quantity as quantity_on_hand,
              0 as quantity_reserved,
              i.quantity as quantity_available,
              i.reorder_point,
              w.name as warehouse_name,
              w.name as location,
              i.last_updated as created_at
       FROM inventory_stocks i
       JOIN products p ON i.product_id = p.id
       JOIN warehouses w ON i.warehouse_id = w.id`;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (warehouseId) {
      conditions.push('i.warehouse_id = ?');
      params.push(warehouseId);
    }
    if (!showAll) {
      conditions.push('i.quantity > 0');
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY p.name ASC';
    
    const inventory = await dbAll(query, params);
    res.json({ data: inventory });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// GET /api/inventory/stock-card - Authoritative stock card from InventoryLedgerQueryService
router.get('/stock-card', authMiddleware, requirePermission('inventory.stock-card', 'view'), async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id, from, to, limit, cursor_moved_at, cursor_id } = req.query;

    if (!product_id) {
      return res.status(422).json({ error: 'product_id is required', code: 'VALIDATION_ERROR' });
    }

    const cursor = (cursor_moved_at && cursor_id)
      ? { movedAt: cursor_moved_at as string, id: Number(cursor_id) }
      : undefined;

    const result = await queryStockCard({
      productId: Number(product_id),
      warehouseId: warehouse_id ? Number(warehouse_id) : undefined,
      from: from as string | undefined,
      to: to as string | undefined,
      limit: limit ? Number(limit) : undefined,
      cursor,
    });

    res.json({
      data: result.movements,
      opening_quantity: result.opening_quantity,
      closing_quantity: result.closing_quantity,
      as_of: result.as_of,
      product_id: result.product_id,
      warehouse_id: result.warehouse_id,
    });
  } catch (error) {
    console.error('Error fetching stock card:', error);
    res.status(500).json({ error: 'Failed to fetch stock card' });
  }
});

// GET /api/inventory/:id - Get single inventory item
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const item = await dbGet(`
      SELECT i.*, p.name as product_name, p.sku 
      FROM inventory_stocks i 
      JOIN products p ON i.product_id = p.id 
      WHERE i.id = ?
    `, [req.params.id]);
    
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    res.json({ data: item });
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

// POST /api/inventory - Create inventory entry
router.post('/', authMiddleware, requirePermission('inventory.dashboard', 'create'), async (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id, quantity } = req.body;

    if (!product_id || !warehouse_id) {
      return res.status(400).json({ error: 'product_id and warehouse_id are required' });
    }

    // Check if inventory already exists for this product/warehouse combo
    const existing = await dbGet(
      'SELECT * FROM inventory_stocks WHERE product_id = ? AND warehouse_id = ?',
      [product_id, warehouse_id]
    );
    if (existing) {
      return res.status(400).json({ error: 'Inventory already exists for this product-warehouse combination' });
    }

    const result = await dbRun(`
      INSERT INTO inventory_stocks (product_id, warehouse_id, quantity, last_updated) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `, [product_id, warehouse_id, quantity || 0]);

    res.status(201).json({
      message: 'Inventory created successfully',
      data: { id: result.insertId, product_id, warehouse_id, quantity: quantity || 0 },
    });
  } catch (error) {
    console.error('Error creating inventory:', error);
    res.status(500).json({ error: 'Failed to create inventory' });
  }
});

// PUT /api/inventory/:id - Update inventory
router.put('/:id', authMiddleware, requirePermission('inventory.dashboard', 'update'), async (req: Request, res: Response) => {
  try {
    // P0-6: block direct quantity overwrite — all balance changes must go through stock movements
    if (req.body.quantity !== undefined) {
      return res.status(400).json({
        error: 'Direct quantity update is not allowed. Use stock adjustment or stock opname to change inventory quantities.'
      });
    }

    const { reorder_point } = req.body;
    await dbRun(
      'UPDATE inventory_stocks SET reorder_point = ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
      [reorder_point, req.params.id]
    );

    res.json({ message: 'Inventory updated successfully' });
  } catch (error) {
    console.error('Error updating inventory:', error);
    res.status(500).json({ error: 'Failed to update inventory' });
  }
});

// POST /api/inventory/:id/transaction - Record inventory transaction
router.post('/:id/transaction', authMiddleware, requirePermission('inventory.stock-card', 'create'), async (req: Request, res: Response) => {
  try {
    const { transaction_type, quantity, reference_type, reference_id, notes } = req.body;

    if (!transaction_type || !quantity) {
      return res.status(400).json({ error: 'transaction_type and quantity are required' });
    }

    const result = await dbRun(`
      INSERT INTO stock_movements (product_id, warehouse_id, movement_type, quantity, reference_type, reference_id, notes, created_by) 
      SELECT product_id, warehouse_id, ?, ?, ?, ?, ?, NULL FROM inventory_stocks WHERE id = ?
    `, [transaction_type, quantity, reference_type || null, reference_id || null, notes || null, req.params.id]);

    res.status(201).json({
      message: 'Transaction recorded successfully',
      data: { id: result.insertId },
    });
  } catch (error) {
    console.error('Error recording transaction:', error);
    res.status(500).json({ error: 'Failed to record transaction' });
  }
});


// GET /api/inventory/transactions/:productId - List transactions by product
router.get('/transactions/:productId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const productId = Number(req.params.productId);
    if (!productId) {
      return res.status(400).json({ error: 'Invalid productId' });
    }

    const rows = await dbAll(`
      SELECT 
        sm.id,
        sm.product_id,
        sm.warehouse_id,
        sm.movement_type as transaction_type,
        sm.quantity,
        sm.reference_type,
        sm.reference_id,
        sm.notes,
        sm.moved_at AS transaction_date
      FROM stock_movements sm
      WHERE sm.product_id = ?
      ORDER BY sm.moved_at DESC
    `, [productId]);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching inventory transactions:', error);
    res.status(500).json({ error: 'Failed to fetch inventory transactions' });
  }
});

// Helper function to execute stock adjustment
async function executeStockAdjustment(adjustment: any) {
  try {
    console.log('📊 Executing stock adjustment:', adjustment);

    const inv = await dbGet(`
      SELECT * FROM inventory_stocks 
      WHERE product_id = ? AND warehouse_id = ?
    `, [adjustment.product_id, adjustment.warehouse_id]) as any;

    if (inv) {
      const newQty = (inv.quantity || 0) + adjustment.quantity; // quantity can be negative
      await dbRun(`
        UPDATE inventory_stocks 
        SET quantity = ?, last_updated = CURRENT_TIMESTAMP 
        WHERE id = ?
      `, [newQty, inv.id]);
      console.log(`✅ Adjusted inventory by ${adjustment.quantity} (new qty: ${newQty})`);
    } else {
      // Create new inventory record if positive adjustment
      if (adjustment.quantity > 0) {
        await dbRun(`
          INSERT INTO inventory_stocks (product_id, warehouse_id, quantity, last_updated)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [adjustment.product_id, adjustment.warehouse_id, adjustment.quantity]);
        console.log(`✅ Created new inventory record with quantity ${adjustment.quantity}`);
      }
    }

    console.log('✅ Stock adjustment execution completed');
  } catch (error) {
    console.error('❌ Error executing stock adjustment:', error);
    throw error;
  }
}

export default router;
