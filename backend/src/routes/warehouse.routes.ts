import { Router, Request, Response } from 'express';
import db from '../config/database';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Warehouses
router.get('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const warehouses = db.prepare('SELECT * FROM warehouses ORDER BY name ASC').all();
    res.json({ data: warehouses });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    res.status(500).json({ error: 'Failed to fetch warehouses' });
  }
});

router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const warehouse = db.prepare('SELECT * FROM warehouses WHERE id = ?').get(req.params.id);
    if (!warehouse) return res.status(404).json({ error: 'Warehouse not found' });
    res.json({ data: warehouse });
  } catch (error) {
    console.error('Error fetching warehouse:', error);
    res.status(500).json({ error: 'Failed to fetch warehouse' });
  }
});

router.post('/', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, address } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const result = db.prepare('INSERT INTO warehouses (code, name, address) VALUES (?, ?, ?)').run(code, name, address || null);
    res.status(201).json({ message: 'Warehouse created', data: { id: result.lastInsertRowid, code, name } });
  } catch (error: any) {
    console.error('Error creating warehouse:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Warehouse code must be unique' });
    res.status(500).json({ error: 'Failed to create warehouse' });
  }
});

router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, name, address } = req.body;
    db.prepare('UPDATE warehouses SET code = ?, name = ?, address = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      code,
      name,
      address,
      req.params.id
    );
    res.json({ message: 'Warehouse updated' });
  } catch (error) {
    console.error('Error updating warehouse:', error);
    res.status(500).json({ error: 'Failed to update warehouse' });
  }
});

router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
    res.json({ message: 'Warehouse deleted' });
  } catch (error) {
    console.error('Error deleting warehouse:', error);
    res.status(500).json({ error: 'Failed to delete warehouse' });
  }
});

// Locations
router.get('/:warehouseId/locations', authMiddleware, (req: Request, res: Response) => {
  try {
    const locations = db
      .prepare('SELECT * FROM warehouse_locations WHERE warehouse_id = ? ORDER BY code ASC')
      .all(req.params.warehouseId);
    res.json({ data: locations });
  } catch (error) {
    console.error('Error fetching locations:', error);
    res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

router.post('/:warehouseId/locations', authMiddleware, (req: Request, res: Response) => {
  try {
    const { code, description, location_code, rack, row, bin, capacity } = req.body;
    if (!location_code && !code) return res.status(400).json({ error: 'location_code is required' });

    const locCode = location_code || code;
    const result = db
      .prepare(`
        INSERT INTO warehouse_locations (warehouse_id, location_code, rack, row, bin, capacity, description) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        req.params.warehouseId, 
        locCode, 
        rack || null,
        row || null,
        bin || null,
        capacity || null,
        description || null
      );

    res.status(201).json({ message: 'Location created', data: { id: result.lastInsertRowid, location_code: locCode } });
  } catch (error: any) {
    console.error('Error creating location:', error);
    if (error.message?.includes('UNIQUE')) return res.status(400).json({ error: 'Location code must be unique per warehouse' });
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// GET /api/warehouses/:warehouseId/locations/:id
router.get('/:warehouseId/locations/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const location = db.prepare(`
      SELECT wl.*, 
             COUNT(DISTINCT i.batch_id) as batch_count,
             SUM(i.quantity) as total_quantity
      FROM warehouse_locations wl
      LEFT JOIN inventory i ON i.location_id = wl.id
      WHERE wl.warehouse_id = ? AND wl.id = ?
      GROUP BY wl.id
    `).get(req.params.warehouseId, req.params.id);
    
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    
    res.json({ data: location });
  } catch (error) {
    console.error('Error fetching location:', error);
    res.status(500).json({ error: 'Failed to fetch location' });
  }
});

// PUT /api/warehouses/:warehouseId/locations/:id
router.put('/:warehouseId/locations/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { location_code, rack, row, bin, capacity, description } = req.body;

    db.prepare(`
      UPDATE warehouse_locations 
      SET location_code = ?, rack = ?, row = ?, bin = ?, 
          capacity = ?, description = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND warehouse_id = ?
    `).run(
      location_code,
      rack || null,
      row || null,
      bin || null,
      capacity || null,
      description || null,
      req.params.id,
      req.params.warehouseId
    );

    res.json({ message: 'Location updated' });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// DELETE /api/warehouses/:warehouseId/locations/:id
router.delete('/:warehouseId/locations/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    db.prepare(`
      DELETE FROM warehouse_locations 
      WHERE id = ? AND warehouse_id = ?
    `).run(req.params.id, req.params.warehouseId);

    res.json({ message: 'Location deleted' });
  } catch (error) {
    console.error('Error deleting location:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Stock movements with inventory adjustments
router.get('/stock-movements', authMiddleware, (req: Request, res: Response) => {
  try {
    const movements = db
      .prepare(
        `SELECT sm.*, p.sku, p.name as product_name, w.name as warehouse_name, wl.code as location_code
         FROM stock_movements sm
         JOIN products p ON sm.product_id = p.id
         JOIN warehouses w ON sm.warehouse_id = w.id
         LEFT JOIN warehouse_locations wl ON sm.location_id = wl.id
         ORDER BY sm.moved_at DESC`
      )
      .all();
    res.json({ data: movements });
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

router.post('/stock-movements', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, warehouse_id, location_id, batch_id, movement_type, quantity, uom, reference_type, reference_id, notes } = req.body;
    if (!product_id || !warehouse_id || !movement_type || quantity === undefined) {
      return res.status(400).json({ error: 'product_id, warehouse_id, movement_type, and quantity are required' });
    }

    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) return res.status(400).json({ error: 'quantity must be a positive number' });

    const insertMovement = db.prepare(
      'INSERT INTO stock_movements (product_id, warehouse_id, location_id, batch_id, movement_type, quantity, uom, reference_type, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    const getInventory = db.prepare('SELECT id, quantity_on_hand, quantity_reserved FROM inventory WHERE product_id = ?');
    const insertInventory = db.prepare(
      'INSERT INTO inventory (product_id, quantity_on_hand, quantity_reserved, quantity_available, location) VALUES (?, ?, ?, ?, ?)'
    );
    const updateInventory = db.prepare(
      'UPDATE inventory SET quantity_on_hand = ?, quantity_reserved = ?, quantity_available = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );

    const tx = db.transaction(() => {
      const inv = getInventory.get(product_id) as { id: number; quantity_on_hand: number; quantity_reserved: number } | undefined;
      const movementId = insertMovement.run(
        product_id,
        warehouse_id,
        location_id || null,
        batch_id || null,
        movement_type,
        qty,
        uom || null,
        reference_type || null,
        reference_id || null,
        notes || null
      ).lastInsertRowid;

      if (!inv) {
        const onHand = movement_type === 'OUT' ? -qty : qty;
        if (onHand < 0) throw new Error('Cannot create negative stock');
        insertInventory.run(product_id, onHand, 0, onHand, null);
      } else {
        let onHand = inv.quantity_on_hand || 0;
        if (movement_type === 'IN') onHand += qty;
        if (movement_type === 'OUT') onHand -= qty;
        if (movement_type === 'TRANSFER') onHand = onHand; // net zero but record movement
        if (onHand < 0) throw new Error('Insufficient stock');
        const reserved = inv.quantity_reserved || 0;
        updateInventory.run(onHand, reserved, onHand - reserved, inv.id);
      }

      return movementId;
    });

    const movementId = tx();
    res.status(201).json({ message: 'Stock movement recorded', data: { id: movementId } });
  } catch (error: any) {
    console.error('Error recording stock movement:', error);
    const msg = error.message?.includes('Insufficient') || error.message?.includes('negative') ? error.message : 'Failed to record stock movement';
    res.status(400).json({ error: msg });
  }
});

// ============ FIFO/FEFO STOCK ALLOCATION ============

/**
 * GET /api/warehouses/allocate-stock
 * Allocate stock for a sales order or work order using FIFO (First In First Out) or FEFO (First Expired First Out)
 * Query params:
 * - product_id: Product to allocate
 * - quantity: Quantity needed
 * - method: 'FIFO' or 'FEFO' (default: FEFO for safety)
 * - warehouse_id: Optional, specific warehouse
 */
router.get('/allocate-stock', authMiddleware, (req: Request, res: Response) => {
  try {
    const { product_id, quantity, method = 'FEFO', warehouse_id } = req.query;
    
    if (!product_id || !quantity) {
      return res.status(400).json({ error: 'product_id and quantity are required' });
    }

    const qtyNeeded = parseFloat(quantity as string);
    const pickMethod = (method as string).toUpperCase();

    // Build query based on picking method
    let query = `
      SELECT i.id, i.batch_id, i.location_id, i.quantity, i.uom,
             b.batch_number, b.exp_date, b.mfg_date,
             wl.location_code, wl.rack, wl.row, wl.bin,
             w.id as warehouse_id, w.name as warehouse_name
      FROM inventory i
      JOIN batches b ON i.batch_id = b.id
      JOIN warehouse_locations wl ON i.location_id = wl.id
      JOIN warehouses w ON wl.warehouse_id = w.id
      WHERE i.product_id = ? 
        AND i.quantity > 0
        AND b.status IN ('released', 'open')
    `;

    const params: any[] = [product_id];

    if (warehouse_id) {
      query += ` AND w.id = ?`;
      params.push(warehouse_id);
    }

    // Order by expiry date (FEFO) or manufacturing date (FIFO)
    if (pickMethod === 'FEFO') {
      query += ` ORDER BY 
        CASE WHEN b.exp_date IS NULL THEN 1 ELSE 0 END,
        b.exp_date ASC,
        b.mfg_date ASC`;
    } else {
      // FIFO
      query += ` ORDER BY b.mfg_date ASC, b.batch_number ASC`;
    }

    const stmt = db.prepare(query);
    const batches = stmt.all(...params) as any[];

    // Calculate allocation
    const allocation = [];
    let remainingQty = qtyNeeded;

    for (const batch of batches) {
      if (remainingQty <= 0) break;

      const allocQty = Math.min(remainingQty, batch.quantity);
      allocation.push({
        batch_id: batch.batch_id,
        batch_number: batch.batch_number,
        location_id: batch.location_id,
        location_code: batch.location_code,
        rack: batch.rack,
        row: batch.row,
        bin: batch.bin,
        warehouse_id: batch.warehouse_id,
        warehouse: batch.warehouse_name,
        allocated_qty: allocQty,
        available_qty: batch.quantity,
        uom: batch.uom,
        exp_date: batch.exp_date,
        mfg_date: batch.mfg_date,
      });

      remainingQty -= allocQty;
    }

    const canFulfill = remainingQty <= 0;

    res.json({
      data: {
        product_id,
        quantity_needed: qtyNeeded,
        quantity_allocated: qtyNeeded - remainingQty,
        quantity_short: remainingQty > 0 ? remainingQty : 0,
        can_fulfill: canFulfill,
        method: pickMethod,
        allocation_count: allocation.length,
        allocation,
      },
    });
  } catch (error) {
    console.error('Error allocating stock:', error);
    res.status(500).json({ error: 'Failed to allocate stock' });
  }
});

/**
 * GET /api/warehouses/:warehouseId/stock-health
 * Get inventory health dashboard for a warehouse
 */
router.get('/:warehouseId/stock-health', authMiddleware, (req: Request, res: Response) => {
  try {

    // Get low stock items
    const lowStockStmt = db.prepare(`
      SELECT p.id, p.sku, p.name, 
             SUM(i.quantity) as current_qty,
             MAX(i.minimum_quantity) as min_qty,
             MAX(i.maximum_quantity) as max_qty
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN warehouse_locations wl ON i.location_id = wl.id
      WHERE wl.warehouse_id = ?
      GROUP BY p.id
      HAVING current_qty <= min_qty
      ORDER BY current_qty ASC
    `);
    const lowStock = lowStockStmt.all(req.params.warehouseId);

    // Get overstock items
    const overstockStmt = db.prepare(`
      SELECT p.id, p.sku, p.name, 
             SUM(i.quantity) as current_qty,
             MAX(i.maximum_quantity) as max_qty
      FROM inventory i
      JOIN products p ON i.product_id = p.id
      JOIN warehouse_locations wl ON i.location_id = wl.id
      WHERE wl.warehouse_id = ?
      GROUP BY p.id
      HAVING current_qty > max_qty
      ORDER BY current_qty DESC
    `);
    const overstock = overstockStmt.all(req.params.warehouseId);

    // Get expiring batches
    const expiringStmt = db.prepare(`
      SELECT b.id, b.batch_number, b.exp_date, p.name as product_name,
             SUM(i.quantity) as quantity,
             CAST((julianday(b.exp_date) - julianday('now')) AS INTEGER) as days_to_expiry
      FROM inventory i
      JOIN batches b ON i.batch_id = b.id
      JOIN products p ON b.product_id = p.id
      JOIN warehouse_locations wl ON i.location_id = wl.id
      WHERE wl.warehouse_id = ?
        AND b.exp_date IS NOT NULL
        AND b.status IN ('open', 'released')
        AND julianday(b.exp_date) - julianday('now') <= 30
        AND julianday(b.exp_date) - julianday('now') > 0
      GROUP BY b.id
      ORDER BY b.exp_date ASC
    `);
    const expiring = expiringStmt.all(req.params.warehouseId);

    // Get location utilization
    const utilizationStmt = db.prepare(`
      SELECT wl.id, wl.location_code, wl.rack, wl.row, wl.bin,
             wl.capacity,
             SUM(i.quantity) as current_qty,
             CASE 
               WHEN wl.capacity IS NULL THEN NULL
               ELSE ROUND(100.0 * SUM(i.quantity) / wl.capacity, 2)
             END as capacity_percent
      FROM warehouse_locations wl
      LEFT JOIN inventory i ON i.location_id = wl.id
      WHERE wl.warehouse_id = ?
      GROUP BY wl.id
      ORDER BY capacity_percent DESC
    `);
    const utilization = utilizationStmt.all(req.params.warehouseId);

    res.json({
      data: {
        low_stock: lowStock,
        overstock: overstock,
        expiring_batches: expiring,
        location_utilization: utilization,
      },
    });
  } catch (error) {
    console.error('Error fetching warehouse stock health:', error);
    res.status(500).json({ error: 'Failed to fetch stock health' });
  }
});

export default router;
