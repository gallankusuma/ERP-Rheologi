import { Router, Request, Response } from 'express';
import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';

const router = Router();

// Helper: PPIC audit log
const ppicLog = async (req: Request, action: string, entityType: string, entityId: any, oldValues?: any, newValues?: any) => {
  try {
    const userId = (req as any).user?.userId || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    await dbRun(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, old_values, new_values, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId || null, oldValues ? JSON.stringify(oldValues) : null, newValues ? JSON.stringify(newValues) : null, ip]
    );
  } catch (e) {
    console.error('PPIC audit log error:', e);
  }
};

// ==========================================
// ITEM MASTER (FG, RM, PM)
// ==========================================
router.get('/items', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { type } = req.query;
        let query = `
            SELECT p.*, c.name as category_name, pt.name as type_name, u.name as uom_name
            FROM products p
            LEFT JOIN categories c ON p.category_id = c.id
            LEFT JOIN product_types pt ON p.product_type_id = pt.id
            LEFT JOIN uom u ON p.unit_of_measure_id = u.id
            WHERE p.active = 1
        `;
        const params: any[] = [];
        if (type) { query += ` AND pt.code = ?`; params.push(type); }
        query += ` ORDER BY p.name ASC`;
        const items = await dbAll(query, params);
        res.json({ data: items });
    } catch (error) {
        console.error('Error fetching PPIC items:', error);
        res.status(500).json({ error: 'Failed to fetch items' });
    }
});

// ==========================================
// BILL OF MATERIALS (BOM)
// ==========================================
router.get('/boms', authMiddleware, async (req: Request, res: Response) => {
    try {
        const boms = await dbAll(`
            SELECT b.*, p.name as product_name, p.sku as product_sku
            FROM bom_headers b LEFT JOIN products p ON b.product_id = p.id
            ORDER BY b.created_at DESC
        `);
        res.json({ data: boms });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch BOMs' }); }
});

router.get('/boms/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const bomId = req.params.id;
        const header = await dbGet(`
            SELECT b.*, p.name as product_name, p.sku as product_sku, u.name as uom_name
            FROM bom_headers b
            LEFT JOIN products p ON b.product_id = p.id
            LEFT JOIN uom u ON p.unit_of_measure_id = u.id
            WHERE b.id = ?
        `, [bomId]);
        if (!header) return res.status(404).json({ error: 'BOM not found' });
        const details = await dbAll(`
            SELECT bd.*, p.name as material_name, p.sku as material_sku, u.name as uom_name
            FROM bom_details bd
            LEFT JOIN products p ON bd.raw_material_id = p.id
            LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
            WHERE bd.bom_header_id = ? ORDER BY bd.sequence ASC
        `, [bomId]);
        res.json({ data: { header, details } });
    } catch (error) { res.status(500).json({ error: 'Failed to fetch BOM details' }); }
});

// ==========================================
// MPS — MASTER PRODUCTION SCHEDULE
// ==========================================

// Helper: get ISO week number
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper: get date range for ISO week
function getWeekDateRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
  return { start: fmt(monday), end: fmt(sunday) };
}

// Helper: get first ISO week for a given month
function getFirstWeekOfMonth(year: number, month: number): { week: number; year: number } {
  const firstDay = new Date(year, month - 1, 1);
  const week = getWeekNumber(firstDay);
  // ISO week year may differ (e.g. Jan 1 could be W52 of prev year)
  const weekYear = month === 1 && week > 50 ? year - 1 : year;
  return { week, year: weekYear };
}

// GET /mps - List MPS headers
router.get('/mps', authMiddleware, requirePermission('ppic.mps', 'view'), async (req: Request, res: Response) => {
  try {
    const { year, month, status } = req.query;
    let query = `
      SELECT m.*, u.full_name as created_by_name, cu.full_name as confirmed_by_name,
        (SELECT COUNT(*) FROM mps_details WHERE mps_header_id = m.id) as item_count
      FROM mps_headers m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN users cu ON m.confirmed_by = cu.id
      WHERE 1=1
    `;
    const params: any[] = [];
    if (year) { query += ' AND m.period_year = ?'; params.push(year); }
    if (month) { query += ' AND m.period_month = ?'; params.push(month); }
    if (status) { query += ' AND m.status = ?'; params.push(status); }
    query += ' ORDER BY m.period_year DESC, m.period_month DESC';
    const rows = await dbAll(query, params);
    res.json({ data: rows });
  } catch (error) {
    console.error('Error fetching MPS list:', error);
    res.status(500).json({ error: 'Failed to fetch MPS list' });
  }
});

// GET /mps/:id - Get MPS with details + weekly grid
router.get('/mps/:id', authMiddleware, requirePermission('ppic.mps', 'view'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const header = await dbGet(`
      SELECT m.*, u.full_name as created_by_name, cu.full_name as confirmed_by_name
      FROM mps_headers m
      LEFT JOIN users u ON m.created_by = u.id
      LEFT JOIN users cu ON m.confirmed_by = cu.id
      WHERE m.id = ?
    `, [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });

    const details = await dbAll(`
      SELECT d.*,
        p.name as product_name, p.sku as product_sku,
        um.name as uom_name,
        bh.product_name as bom_name, bh.version as bom_version,
        cp.project_number, cp.project_name, cp.status as project_status,
        c.name as client_name,
        wo.wo_number, wo.status as wo_status, wo.completed_quantity as wo_completed_qty,
        so.so_number, so.status as so_status
      FROM mps_details d
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN uom um ON p.unit_of_measure_id = um.id
      LEFT JOIN bom_headers bh ON d.bom_id = bh.id
      LEFT JOIN client_projects cp ON d.project_id = cp.id
      LEFT JOIN clients c ON cp.client_id = c.id
      LEFT JOIN work_orders wo ON d.wo_id = wo.id
      LEFT JOIN sales_orders so ON cp.so_id = so.id
      WHERE d.mps_header_id = ?
      ORDER BY d.id ASC
    `, [id]);

    // Load weekly grid data for all details
    const detailIds = (details as any[]).map((d: any) => d.id);
    let weekData: any[] = [];
    if (detailIds.length > 0) {
      const placeholders = detailIds.map(() => '?').join(',');
      weekData = await dbAll(`
        SELECT * FROM mps_week_data
        WHERE mps_detail_id IN (${placeholders})
        ORDER BY year, week_number
      `, detailIds) as any[];
    }

    // For each detail, enrich with: FG stock, capacity, material status
    const enrichedDetails = [];
    for (const d of (details as any[])) {
      const detail = { ...d, weeks: weekData.filter((w: any) => w.mps_detail_id === d.id) };

      // 1. FG Stock from inventory
      const fgStockRow = await dbGet(
        'SELECT COALESCE(SUM(quantity), 0) as total_stock FROM inventory_stocks WHERE product_id = ?',
        [d.product_id]
      ) as any;
      detail.fg_inventory_stock = Number(fgStockRow?.total_stock || 0);

      // 2. WO actual output (completed qty from all related WOs)
      const woOutput = await dbGet(
        "SELECT COALESCE(SUM(completed_quantity), 0) as total_completed FROM work_orders WHERE product_id = ? AND status IN ('COMPLETED', 'IN_PROGRESS')",
        [d.product_id]
      ) as any;
      detail.wo_actual_output = Number(woOutput?.total_completed || 0);

      // 3. Line capacity
      const lineInfo = await dbGet(`
        SELECT lp.id, lp.name as line_name, lp.capacity_per_hour, lp.capacity_unit, lp.working_hours_per_week
        FROM line_process_products lpp
        JOIN line_processes lp ON lpp.line_process_id = lp.id AND lp.active = 1
        WHERE lpp.product_id = ?
        LIMIT 1
      `, [d.product_id]) as any;
      detail.line_process_id = lineInfo?.id || null;
      detail.line_name = lineInfo?.line_name || null;
      detail.capacity_per_hour = Number(lineInfo?.capacity_per_hour || 0);
      const weeklyHours = Number(lineInfo?.working_hours_per_week || 40);
      detail.max_weekly_capacity = detail.capacity_per_hour > 0 ? detail.capacity_per_hour * weeklyHours : 0;

      // 4. BOM material availability
      if (d.bom_id) {
        const bomDetails = await dbAll(`
          SELECT bd.raw_material_id, bd.quantity as quantity_per_unit, bd.unit_of_measure_id,
            p.name as material_name, p.sku as material_sku,
            COALESCE((SELECT SUM(quantity) FROM inventory_stocks WHERE product_id = bd.raw_material_id), 0) as stock_qty
          FROM bom_details bd
          LEFT JOIN products p ON bd.raw_material_id = p.id
          WHERE bd.bom_header_id = ?
          ORDER BY bd.sequence ASC
        `, [d.bom_id]) as any[];
        detail.bom_materials = bomDetails.map((m: any) => ({
          material_id: m.raw_material_id,
          material_name: m.material_name,
          material_sku: m.material_sku,
          qty_per_unit: Number(m.quantity_per_unit || 0),
          stock_qty: Number(m.stock_qty || 0),
          // Max producible from this material alone
          max_producible: m.quantity_per_unit > 0 ? Math.floor(Number(m.stock_qty) / Number(m.quantity_per_unit)) : 999999
        }));
        // Material bottleneck = min of all max_producible
        detail.material_max_producible = detail.bom_materials.length > 0
          ? Math.min(...detail.bom_materials.map((m: any) => m.max_producible))
          : 0;
      } else {
        detail.bom_materials = [];
        detail.material_max_producible = 0;
      }

      enrichedDetails.push(detail);
    }

    // Generate week columns based on MPS period, not current date
    const numWeeks = 12;
    const periodStart = new Date(header.period_year, header.period_month - 1, 1);
    const startWeek = getWeekNumber(periodStart);
    const startYear = header.period_year;
    const weekColumns = [];
    for (let i = 0; i < numWeeks; i++) {
      let wk = startWeek + i;
      let yr = startYear;
      if (wk > 52) { wk -= 52; yr++; }
      const range = getWeekDateRange(yr, wk);
      weekColumns.push({ week: wk, year: yr, label: `W${wk}`, dateRange: `${range.start}-${range.end}` });
    }

    res.json({ data: { header, details: enrichedDetails, weekColumns } });
  } catch (error) {
    console.error('Error fetching MPS detail:', error);
    res.status(500).json({ error: 'Failed to fetch MPS detail' });
  }
});

// POST /mps - Create new MPS header
router.post('/mps', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { period_year, period_month, scheme, notes } = req.body;
    const userId = (req as any).user?.userId || null;
    const existing = await dbGet(
      'SELECT id FROM mps_headers WHERE period_year = ? AND period_month = ? AND scheme = ?',
      [period_year, period_month, scheme || 'MTO']
    );
    if (existing) return res.status(400).json({ error: `MPS for ${period_year}-${String(period_month).padStart(2, '0')} already exists` });

    const mpsNumber = `MPS-${period_year}-${String(period_month).padStart(2, '0')}`;
    const result = await dbRun(
      `INSERT INTO mps_headers (mps_number, period_year, period_month, scheme, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [mpsNumber, period_year, period_month, scheme || 'MTO', notes || null, userId]
    );
    await ppicLog(req, 'CREATE', 'MPS', result.insertId, null, { mps_number: mpsNumber, period_year, period_month });
    res.status(201).json({ message: 'MPS created', data: { id: result.insertId, mps_number: mpsNumber } });
  } catch (error) {
    console.error('Error creating MPS:', error);
    res.status(500).json({ error: 'Failed to create MPS' });
  }
});

// POST /mps/:id/pull-orders - Pull demand from SO Items + Projects into MPS
router.post('/mps/:id/pull-orders', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Can only pull orders into Draft MPS' });

    const startDate = `${header.period_year}-${String(header.period_month).padStart(2, '0')}-01`;
    const endDate = `${header.period_year}-${String(header.period_month).padStart(2, '0')}-31`;

    // Source 1: Sales Order Items
    let soItems: any[] = [];
    soItems = await dbAll(`
      SELECT 'SO' as source_type, si.id as source_id, si.product_id, si.quantity,
        so.id as so_id, so.so_date as ref_date, CONCAT('SO-', so.so_number) as ref_label,
        p.name as product_name, p.sku as product_sku,
        bh.id as bom_id
      FROM so_items si
      JOIN sales_orders so ON si.so_id = so.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN bom_headers bh ON bh.product_id = si.product_id AND bh.status = 'ACTIVE'
      WHERE so.status IN ('OPEN', 'open', 'APPROVED', 'CONFIRMED', 'PROCESSING', 'DRAFT', 'confirmed')
        AND (so.so_date BETWEEN ? AND ? OR so.so_date <= ?)
        AND si.id NOT IN (
          SELECT COALESCE(so_item_id, 0) FROM mps_details WHERE so_item_id IS NOT NULL
        )
        AND si.id NOT IN (
          SELECT COALESCE(so_item_id, 0) FROM mps_detail_sources WHERE so_item_id IS NOT NULL
        )
    `, [startDate, endDate, endDate]) as any[];

    // Source 2: Client Projects (where product_id is linked)
    let projItems: any[] = [];
    projItems = await dbAll(`
      SELECT 'PROJECT' as source_type, cp.id as source_id, cp.product_id, cp.quantity,
        cp.so_id as linked_so_id,
        COALESCE(cp.start_date, cp.created_at) as ref_date,
        CONCAT('PRJ-', cp.project_number) as ref_label,
        p.name as product_name, p.sku as product_sku,
        bh.id as bom_id
      FROM client_projects cp
      JOIN products p ON cp.product_id = p.id
      LEFT JOIN bom_headers bh ON bh.product_id = cp.product_id AND bh.status = 'ACTIVE'
      WHERE cp.status IN ('open', 'in_progress')
        AND cp.product_id IS NOT NULL
        AND (
          cp.start_date BETWEEN ? AND ?
          OR cp.end_date BETWEEN ? AND ?
          OR (cp.start_date <= ? AND cp.end_date >= ?)
          OR cp.start_date IS NULL
        )
        AND cp.id NOT IN (
          SELECT COALESCE(project_id, 0) FROM mps_details WHERE project_id IS NOT NULL
        )
        AND cp.id NOT IN (
          SELECT COALESCE(project_id, 0) FROM mps_detail_sources WHERE project_id IS NOT NULL
        )
    `, [startDate, endDate, startDate, endDate, startDate, endDate]) as any[];

    // Deduplicate: If a Project was created from an SO, remove SO items from that same SO
    // Projects take priority (they represent committed demand)
    const projSoIds = new Set<number>();
    for (const proj of projItems) {
      if (proj.linked_so_id) projSoIds.add(proj.linked_so_id);
    }
    const dedupedSoItems = projSoIds.size > 0
      ? soItems.filter((si: any) => !projSoIds.has(si.so_id))
      : soItems;

    const allItems = [...dedupedSoItems, ...projItems];

    // Filter out products that already exist in this MPS
    const existingProducts = await dbAll(
      'SELECT DISTINCT product_id FROM mps_details WHERE mps_header_id = ?', [id]
    ) as any[];
    const existingProductIds = new Set(existingProducts.map((p: any) => p.product_id));
    const newItems = allItems.filter((item: any) => !existingProductIds.has(item.product_id));

    if (newItems.length === 0) {
      return res.json({ message: 'No new orders found. All products already in MPS.', pulled: 0 });
    }

    // derive grid start from MPS period, not current date
    const periodStart = getFirstWeekOfMonth(header.period_year, header.period_month);
    const currentWeek = periodStart.week;
    const currentYear = periodStart.year;

    // Group items by product_id — merge same products from different SOs
    const productMap = new Map<number, {
      product_id: number;
      bom_id: number | null;
      total_qty: number;
      so_numbers: string[];
      project_numbers: string[];
      sourceItems: { source_type: string; source_id: number; qty: number }[];
      weekQtyMap: Map<string, number>;
    }>();

    for (const item of newItems) {
      const pid = item.product_id;
      const qty = Number(item.quantity || 0);

      if (!productMap.has(pid)) {
        productMap.set(pid, {
          product_id: pid,
          bom_id: item.bom_id || null,
          total_qty: 0,
          so_numbers: [],
          project_numbers: [],
          sourceItems: [],
          weekQtyMap: new Map()
        });
      }
      const group = productMap.get(pid)!;
      group.total_qty += qty;

      // track individual source for lineage
      if (item.source_type === 'SO') {
        group.sourceItems.push({ source_type: 'SO_ITEM', source_id: item.source_id, qty });
        if (item.ref_label) group.so_numbers.push(item.ref_label);
      } else if (item.source_type === 'PROJECT') {
        group.sourceItems.push({ source_type: 'PROJECT', source_id: item.source_id, qty });
        if (item.ref_label) group.project_numbers.push(item.ref_label);
      }

      // Distribute qty to the correct week based on ref_date
      const refDate = item.ref_date ? new Date(item.ref_date) : new Date(header.period_year, header.period_month - 1, 1);
      const refWeek = getWeekNumber(refDate);
      const refYear = refDate.getFullYear();
      const weekKey = `${refWeek}:${refYear}`;
      group.weekQtyMap.set(weekKey, (group.weekQtyMap.get(weekKey) || 0) + qty);
    }

    let pulled = 0;
    for (const [, group] of productMap) {
      const soNumsStr = group.so_numbers.join(', ') || null;

      // Insert 1 MPS detail per product
      const detailResult = await dbRun(`
        INSERT INTO mps_details (mps_header_id, product_id, bom_id, so_numbers,
          demand_qty, current_stock, batch_no, batch_qty, lead_time_weeks, status)
        VALUES (?, ?, ?, ?, ?, 0, NULL, 0, 1, 'Pending')
      `, [id, group.product_id, group.bom_id, soNumsStr, group.total_qty]);

      const detailId = detailResult.insertId;

      // insert demand source lineage records
      for (const src of group.sourceItems) {
        try {
          await dbRun(
            `INSERT INTO mps_detail_sources (mps_detail_id, source_type, so_item_id, project_id, quantity)
             VALUES (?, ?, ?, ?, ?)`,
            [detailId, src.source_type,
             src.source_type === 'SO_ITEM' ? src.source_id : null,
             src.source_type === 'PROJECT' ? src.source_id : null,
             src.qty]
          );
        } catch (srcErr: any) {
          // UNIQUE violation = demand already pulled, skip
          if (!srcErr.message?.includes('Duplicate')) {
            console.error('Error inserting demand source:', srcErr);
          }
        }
      }

      // Create 12 weeks of grid data with distributed SO qty
      const firstWeekKey = `${currentWeek}:${currentYear}`;
      for (const [wKey, wQty] of group.weekQtyMap) {
        const [wStr, yStr] = wKey.split(':');
        const w = Number(wStr), y = Number(yStr);
        if (y < currentYear || (y === currentYear && w < currentWeek)) {
          group.weekQtyMap.set(firstWeekKey, (group.weekQtyMap.get(firstWeekKey) || 0) + wQty);
          group.weekQtyMap.delete(wKey);
        }
      }

      for (let i = 0; i < 12; i++) {
        let wk = currentWeek + i;
        let yr = currentYear;
        if (wk > 52) { wk -= 52; yr++; }

        const weekKey = `${wk}:${yr}`;
        const weekQty = group.weekQtyMap.get(weekKey) || 0;
        await dbRun(`
          INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty, production_qty)
          VALUES (?, ?, ?, 0, ?, 0, 0, 0)
        `, [detailId, wk, yr, weekQty]);
      }
      pulled++;
    }

    await ppicLog(req, 'PULL_ORDERS', 'MPS', id, null, { pulled, from_so: dedupedSoItems.length, from_projects: projItems.length });
    res.json({
      message: `${pulled} products pulled into MPS (from ${allItems.length} order lines)`,
      pulled,
      from_so: dedupedSoItems.length,
      from_projects: projItems.length
    });
  } catch (error) {
    console.error('Error pulling orders:', error);
    res.status(500).json({ error: 'Failed to pull orders' });
  }
});

// POST /mps/:id/add-item - Manually add an item to MPS (e.g. from forecast)
router.post('/mps/:id/add-item', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { product_id, bom_id: reqBomId, quantity, target_week, target_year, notes } = req.body;

    if (!product_id) return res.status(400).json({ error: 'product_id is required' });

    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Can only add items to Draft MPS' });

    // Get product info
    const product = await dbGet('SELECT id, name, sku FROM products WHERE id = ?', [product_id]) as any;
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Use provided bom_id or fallback to auto-lookup
    let bomId = reqBomId || null;
    if (!bomId) {
      const bom = await dbGet(
        "SELECT id FROM bom_headers WHERE product_id = ? AND status = 'ACTIVE' LIMIT 1",
        [product_id]
      ) as any;
      bomId = bom?.id || null;
    }

    const qty = Number(quantity || 0);

    // Insert MPS detail
    const detailResult = await dbRun(`
      INSERT INTO mps_details (mps_header_id, product_id, bom_id,
        demand_qty, current_stock, batch_no, batch_qty, lead_time_weeks, status)
      VALUES (?, ?, ?, ?, 0, NULL, 0, 1, 'Pending')
    `, [id, product_id, bomId, qty]);

    const detailId = detailResult.insertId;

    // Create 12 weeks of grid data using MPS period, not current date
    const periodStart = getFirstWeekOfMonth(header.period_year, header.period_month);
    const currentWeek = periodStart.week;
    const currentYear = periodStart.year;
    const tgtWeek = target_week ? Number(target_week) : null;
    const tgtYear = target_year ? Number(target_year) : currentYear;

    for (let i = 0; i < 12; i++) {
      let wk = currentWeek + i;
      let yr = currentYear;
      if (wk > 52) { wk -= 52; yr++; }

      const isTargetWeek = tgtWeek ? (wk === tgtWeek && yr === tgtYear) : (i === 0);
      await dbRun(`
        INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty)
        VALUES (?, ?, ?, ?, 0, 0, 0)
      `, [detailId, wk, yr, isTargetWeek ? qty : 0]);
    }

    await ppicLog(req, 'ADD_ITEM', 'MPS_DETAIL', detailId, null, { mps_id: id, product_name: product.name, quantity: qty });
    res.status(201).json({
      message: `Product "${product.name}" added to MPS`,
      data: { id: detailId, product_name: product.name, quantity: qty }
    });
  } catch (error) {
    console.error('Error adding item to MPS:', error);
    res.status(500).json({ error: 'Failed to add item to MPS' });
  }
});

// PUT /mps/:id/details/:detailId/remark - Update remark info (stock, batch, lead time)
router.put('/mps/:id/details/:detailId/remark', authMiddleware, requirePermission('ppic.mps', 'update'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const { current_stock, batch_no, batch_qty, lead_time_weeks } = req.body;

    const header = await dbGet('SELECT status FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Cannot modify Confirmed MPS. Revert to Draft first.' });

    await dbRun(`
      UPDATE mps_details SET
        current_stock = COALESCE(?, current_stock),
        batch_no = COALESCE(?, batch_no),
        batch_qty = COALESCE(?, batch_qty),
        lead_time_weeks = COALESCE(?, lead_time_weeks)
      WHERE id = ? AND mps_header_id = ?
    `, [current_stock, batch_no, batch_qty, lead_time_weeks, detailId, id]);

    res.json({ message: 'Remark updated' });
  } catch (error) {
    console.error('Error updating remark:', error);
    res.status(500).json({ error: 'Failed to update remark' });
  }
});

// PUT /mps/:id/week-data - Bulk update weekly grid cells
router.put('/mps/:id/week-data', authMiddleware, requirePermission('ppic.mps', 'update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { entries } = req.body; // [{ mps_detail_id, week_number, year, field, value }]

    const header = await dbGet('SELECT status FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Cannot modify Confirmed MPS. Revert to Draft first.' });

    for (const entry of (entries || [])) {
      const allowedFields = ['forecast_qty', 'so_qty', 'start_process_qty', 'fg_qty', 'production_qty'];
      if (!allowedFields.includes(entry.field)) continue;

      // Upsert
      const existing = await dbGet(
        'SELECT id FROM mps_week_data WHERE mps_detail_id = ? AND year = ? AND week_number = ?',
        [entry.mps_detail_id, entry.year, entry.week_number]
      );

      if (existing) {
        await dbRun(
          `UPDATE mps_week_data SET ${entry.field} = ? WHERE mps_detail_id = ? AND year = ? AND week_number = ?`,
          [entry.value || 0, entry.mps_detail_id, entry.year, entry.week_number]
        );
      } else {
        const insertObj: any = { forecast_qty: 0, so_qty: 0, start_process_qty: 0, fg_qty: 0, production_qty: 0 };
        insertObj[entry.field] = entry.value || 0;
        await dbRun(`
          INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty, production_qty)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [entry.mps_detail_id, entry.week_number, entry.year, insertObj.forecast_qty, insertObj.so_qty, insertObj.start_process_qty, insertObj.fg_qty, insertObj.production_qty]);
      }
    }

      await ppicLog(req, 'SAVE_WEEK_DATA', 'MPS', id, null, { entries_count: entries.length });
      res.json({ message: 'Week data updated' });
  } catch (error) {
    console.error('Error updating week data:', error);
    res.status(500).json({ error: 'Failed to update week data' });
  }
});

// POST /mps/:id/confirm
router.post('/mps/:id/confirm', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId || null;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Only Draft MPS can be confirmed' });

    const detailCount = await dbGet('SELECT COUNT(*) as cnt FROM mps_details WHERE mps_header_id = ?', [id]) as any;
    if (!detailCount || detailCount.cnt === 0) return res.status(400).json({ error: 'Cannot confirm empty MPS' });

    await dbRun('UPDATE mps_headers SET status = ?, confirmed_by = ?, confirmed_at = NOW() WHERE id = ?', ['Confirmed', userId, id]);
    await dbRun('UPDATE mps_details SET status = ? WHERE mps_header_id = ? AND status = ?', ['Scheduled', id, 'Pending']);
    await ppicLog(req, 'CONFIRM', 'MPS', id, { status: 'Draft' }, { status: 'Confirmed' });
    res.json({ message: 'MPS confirmed' });
  } catch (error) { res.status(500).json({ error: 'Failed to confirm MPS' }); }
});

// POST /mps/:id/revert - Revert Confirmed MPS back to Draft
router.post('/mps/:id/revert', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Confirmed') return res.status(400).json({ error: 'Only Confirmed MPS can be reverted to Draft' });

    await dbRun('UPDATE mps_headers SET status = ?, confirmed_by = NULL, confirmed_at = NULL WHERE id = ?', ['Draft', id]);
    await dbRun("UPDATE mps_details SET status = 'Pending' WHERE mps_header_id = ? AND status = 'Scheduled'", [id]);
    await ppicLog(req, 'REVERT', 'MPS', id, { status: 'Confirmed' }, { status: 'Draft' });
    res.json({ message: 'MPS reverted to Draft' });
  } catch (error) {
    console.error('Error reverting MPS:', error);
    res.status(500).json({ error: 'Failed to revert MPS' });
  }
});

// GET /mps/:id/details/:detailId/generate-wo/preview - WO preview
router.get('/mps/:id/details/:detailId/generate-wo/preview', authMiddleware, requirePermission('ppic.mps', 'view'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });

    const detail = await dbGet('SELECT * FROM mps_details WHERE id = ? AND mps_header_id = ?', [detailId, id]) as any;
    if (!detail) return res.status(404).json({ error: 'MPS detail not found' });

    // get weekly production data
    const weekData = await dbAll(
      'SELECT * FROM mps_week_data WHERE mps_detail_id = ? ORDER BY year, week_number', [detailId]
    ) as any[];

    // get existing WOs for this detail
    const existingWOs = await dbAll(
      'SELECT id, wo_number, week_number, quantity, status FROM work_orders WHERE mps_detail_id = ? ORDER BY week_number', [detailId]
    ) as any[];

    const previewWeeks = weekData
      .filter((w: any) => Number(w.production_qty) > 0)
      .map((w: any) => {
        const existingWO = existingWOs.find((wo: any) => wo.week_number === w.week_number);
        // compute scheduled dates for this week
        const jan4 = new Date(w.year, 0, 4);
        const dayOfWeek = jan4.getDay() || 7;
        const monday = new Date(jan4);
        monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w.week_number - 1) * 7);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return {
          week_number: w.week_number,
          year: w.year,
          production_qty: Number(w.production_qty),
          wo_exists: !!existingWO,
          already_exists: !!existingWO,
          wo_number: existingWO?.wo_number || null,
          wo_status: existingWO?.status || null,
          wo_id: existingWO?.id || null,
          scheduled_start: monday.toISOString().slice(0, 10),
          scheduled_end: sunday.toISOString().slice(0, 10),
          line_name: null,
        };
      });

    // existing WOs for display
    const existingWosList = existingWOs.map((wo: any) => ({
      wo_number: wo.wo_number,
      week_number: wo.week_number,
      quantity: Number(wo.quantity),
      status: wo.status,
    }));

    res.json({ data: {
      product_id: detail.product_id,
      bom_id: detail.bom_id,
      mps_number: header.mps_number,
      preview_weeks: previewWeeks,
      existing_wos: existingWosList,
      total_production: previewWeeks.reduce((s: number, w: any) => s + w.production_qty, 0),
      existing_wo_count: existingWOs.length,
    }});
  } catch (error) {
    console.error('Error generating WO preview:', error);
    res.status(500).json({ error: 'Failed to generate WO preview' });
  }
});

// POST /mps/:id/details/:detailId/generate-wo - Generate WO per selected weeks
router.post('/mps/:id/details/:detailId/generate-wo', authMiddleware, requirePermission('ppic.mps', 'create'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const { selected_weeks, weeks: weeksAlt } = req.body;
    const weeks = selected_weeks || weeksAlt; // frontend sends selected_weeks
    const userId = (req as any).user?.userId || null;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Confirmed') return res.status(400).json({ error: 'MPS must be Confirmed' });

    const detail = await dbGet('SELECT * FROM mps_details WHERE id = ? AND mps_header_id = ?', [detailId, id]) as any;
    if (!detail) return res.status(404).json({ error: 'MPS detail not found' });

    // get weekly data with production_qty > 0
    let weekData = await dbAll(
      'SELECT * FROM mps_week_data WHERE mps_detail_id = ? AND production_qty > 0 ORDER BY year, week_number', [detailId]
    ) as any[];

    // filter to selected weeks if provided
    if (weeks && Array.isArray(weeks) && weeks.length > 0) {
      weekData = weekData.filter((w: any) =>
        weeks.some((sel: any) => sel.week_number === w.week_number && sel.year === w.year)
      );
    }

    if (weekData.length === 0) return res.status(400).json({ error: 'No production weeks to generate WO' });

    const created: any[] = [];
    const skipped: any[] = [];

    for (const w of weekData) {
      // duplicate check: existing WO for same detail + week
      const existingWO = await dbGet(
        'SELECT id, wo_number, status FROM work_orders WHERE mps_detail_id = ? AND week_number = ?',
        [detailId, w.week_number]
      ) as any;
      if (existingWO) {
        skipped.push({ week: w.week_number, wo_number: existingWO.wo_number, reason: 'already exists' });
        continue;
      }

      const qty = Number(w.production_qty);
      if (qty <= 0) continue;

      const woCount = await dbGet('SELECT COUNT(*) as cnt FROM work_orders') as any;
      const woNumber = `WO-${String((woCount?.cnt || 0) + 1).padStart(5, '0')}`;

      // schedule: week start/end
      const jan4 = new Date(w.year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w.week_number - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      await dbRun(`
        INSERT INTO work_orders (wo_number, product_id, bom_id, quantity, status, scheduled_start, scheduled_end, mps_detail_id, week_number, created_by, notes)
        VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
      `, [woNumber, detail.product_id, detail.bom_id, qty, fmt(monday), fmt(sunday), detail.id, w.week_number, userId, `MPS ${header.mps_number} W${w.week_number}`]);

      created.push({ week_number: w.week_number, wo_number: woNumber, quantity: qty });
    }

    await ppicLog(req, 'GENERATE_WO', 'WORK_ORDER', detailId, null, { created: created.length, skipped: skipped.length });
    res.json({
      message: `${created.length} WO(s) generated` + (skipped.length > 0 ? `, ${skipped.length} skipped (duplicate)` : ''),
      data: { created, skipped }
    });
  } catch (error) {
    console.error('Error generating WOs:', error);
    res.status(500).json({ error: 'Failed to generate WOs' });
  }
});

// POST /mps/:id/details/:detailId/sync-wo - Sync DRAFT WO quantities from MPS
router.post('/mps/:id/details/:detailId/sync-wo', authMiddleware, requirePermission('ppic.mps', 'update'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });

    const detail = await dbGet('SELECT * FROM mps_details WHERE id = ? AND mps_header_id = ?', [detailId, id]) as any;
    if (!detail) return res.status(404).json({ error: 'MPS detail not found' });

    // only sync DRAFT WOs
    const draftWOs = await dbAll(
      "SELECT wo.id, wo.wo_number, wo.week_number FROM work_orders wo WHERE wo.mps_detail_id = ? AND wo.status = 'DRAFT'",
      [detailId]
    ) as any[];

    const updated: any[] = [];
    const skipped: any[] = [];
    for (const wo of draftWOs) {
      const weekData = await dbGet(
        'SELECT production_qty FROM mps_week_data WHERE mps_detail_id = ? AND week_number = ?',
        [detailId, wo.week_number]
      ) as any;
      const newQty = Number(weekData?.production_qty || 0);
      await dbRun('UPDATE work_orders SET quantity = ? WHERE id = ?', [newQty, wo.id]);
      updated.push({ wo_number: wo.wo_number, week: wo.week_number, qty: newQty });
    }

    await ppicLog(req, 'SYNC_WO', 'WORK_ORDER', detailId, null, { updated: updated.length });
    res.json({ message: `${updated.length} DRAFT WO(s) synced`, data: { updated, skipped, synced: updated.length } });
  } catch (error) {
    console.error('Error syncing WOs:', error);
    res.status(500).json({ error: 'Failed to sync WOs' });
  }
});

// POST /mps/:id/details/:detailId/reset-wo - Delete DRAFT WOs + regenerate from production
router.post('/mps/:id/details/:detailId/reset-wo', authMiddleware, requirePermission('ppic.mps', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const userId = (req as any).user?.userId || null;
    const header = await dbGet('SELECT * FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });

    const detail = await dbGet('SELECT * FROM mps_details WHERE id = ? AND mps_header_id = ?', [detailId, id]) as any;
    if (!detail) return res.status(404).json({ error: 'MPS detail not found' });

    // collect DRAFT WOs to report what was deleted
    const draftWOs = await dbAll(
      "SELECT wo_number, week_number FROM work_orders WHERE mps_detail_id = ? AND status = 'DRAFT'", [detailId]
    ) as any[];
    const deleted = draftWOs.map((wo: any) => ({ wo_number: wo.wo_number, week: wo.week_number }));

    // delete DRAFT WOs only
    await dbRun("DELETE FROM work_orders WHERE mps_detail_id = ? AND status = 'DRAFT'", [detailId]);

    // regenerate from current production_qty > 0 weeks
    const weekData = await dbAll(
      'SELECT * FROM mps_week_data WHERE mps_detail_id = ? AND production_qty > 0 ORDER BY year, week_number', [detailId]
    ) as any[];

    const created: any[] = [];
    for (const w of weekData) {
      // skip if non-DRAFT WO already exists for this week
      const existing = await dbGet(
        'SELECT id FROM work_orders WHERE mps_detail_id = ? AND week_number = ?', [detailId, w.week_number]
      ) as any;
      if (existing) continue;

      const qty = Number(w.production_qty);
      if (qty <= 0) continue;

      const woCount = await dbGet('SELECT COUNT(*) as cnt FROM work_orders') as any;
      const woNumber = `WO-${String((woCount?.cnt || 0) + 1).padStart(5, '0')}`;

      const jan4 = new Date(w.year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const monday = new Date(jan4);
      monday.setDate(jan4.getDate() - dayOfWeek + 1 + (w.week_number - 1) * 7);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      await dbRun(`
        INSERT INTO work_orders (wo_number, product_id, bom_id, quantity, status, scheduled_start, scheduled_end, mps_detail_id, week_number, created_by, notes)
        VALUES (?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?)
      `, [woNumber, detail.product_id, detail.bom_id, qty, fmt(monday), fmt(sunday), detail.id, w.week_number, userId, `MPS ${header.mps_number} W${w.week_number} (reset)`]);

      created.push({ wo_number: woNumber, week_number: w.week_number, quantity: qty });
    }

    // update detail status
    const remaining = await dbGet(
      'SELECT COUNT(*) as cnt FROM work_orders WHERE mps_detail_id = ?', [detailId]
    ) as any;
    if (!remaining || remaining.cnt === 0) {
      await dbRun("UPDATE mps_details SET wo_id = NULL, status = 'Scheduled' WHERE id = ?", [detailId]);
    }

    await ppicLog(req, 'RESET_WO', 'WORK_ORDER', detailId, null, { deleted: deleted.length, created: created.length });
    res.json({
      message: `${deleted.length} DRAFT WO(s) deleted, ${created.length} new WO(s) created`,
      data: { deleted, created }
    });
  } catch (error) {
    console.error('Error resetting WOs:', error);
    res.status(500).json({ error: 'Failed to reset WOs' });
  }
});

// DELETE /mps/:id
router.delete('/mps/:id', authMiddleware, requirePermission('ppic.mps', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const header = await dbGet('SELECT status FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header) return res.status(404).json({ error: 'MPS not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Only Draft can be deleted' });
    // Delete week data first (cascade should handle, but be safe)
    const detailIds = await dbAll('SELECT id FROM mps_details WHERE mps_header_id = ?', [id]) as any[];
    for (const d of detailIds) {
      await dbRun('DELETE FROM mps_week_data WHERE mps_detail_id = ?', [d.id]);
    }
    await dbRun('DELETE FROM mps_details WHERE mps_header_id = ?', [id]);
    await dbRun('DELETE FROM mps_headers WHERE id = ?', [id]);
    await ppicLog(req, 'DELETE', 'MPS', req.params.id, null, null);
    res.json({ message: 'MPS deleted' });
  } catch (error) { res.status(500).json({ error: 'Failed to delete MPS' }); }
});

// DELETE /mps/:id/details/:detailId
router.delete('/mps/:id/details/:detailId', authMiddleware, requirePermission('ppic.mps', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const header = await dbGet('SELECT status FROM mps_headers WHERE id = ?', [id]) as any;
    if (!header || header.status !== 'Draft') return res.status(400).json({ error: 'Cannot remove' });
    await dbRun('DELETE FROM mps_week_data WHERE mps_detail_id = ?', [detailId]);
    await dbRun('DELETE FROM mps_details WHERE id = ? AND mps_header_id = ?', [detailId, id]);
    await ppicLog(req, 'DELETE_ITEM', 'MPS_DETAIL', detailId, null, { mps_id: id });
    res.json({ message: 'Item removed from MPS' });
  } catch (error) { res.status(500).json({ error: 'Failed to remove' }); }
});

// GET /pending-orders
router.get('/pending-orders', authMiddleware, async (req: Request, res: Response) => {
  try {
    const soItems = await dbAll(`
      SELECT si.id as so_item_id, si.so_id, si.product_id, si.quantity,
        so.so_number, so.so_date, p.name as product_name, p.sku as product_sku, c.name as customer_name
      FROM so_items si
      JOIN sales_orders so ON si.so_id = so.id
      JOIN products p ON si.product_id = p.id
      LEFT JOIN customers c ON so.customer_id = c.id
      WHERE so.status IN ('OPEN', 'open', 'confirmed', 'CONFIRMED', 'approved', 'APPROVED')
        AND si.id NOT IN (SELECT COALESCE(so_item_id, 0) FROM mps_details WHERE so_item_id IS NOT NULL)
      ORDER BY so.so_date ASC
    `);
    res.json({ data: soItems });
  } catch (error) { res.status(500).json({ error: 'Failed to fetch pending orders' }); }
});
// ==========================================
// MRP — MATERIAL REQUIREMENT PLANNING
// ==========================================

// GET /mps/:id/details/:detailId/mrp - Explode BOM → MRP breakdown
router.get('/mps/:id/details/:detailId/mrp', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    
    // Get MPS detail + BOM info
    const detail = await dbGet(`
      SELECT d.*, p.name as product_name, p.sku as product_sku, bh.id as bom_id
      FROM mps_details d
      LEFT JOIN products p ON d.product_id = p.id
      LEFT JOIN bom_headers bh ON d.bom_id = bh.id
      WHERE d.id = ? AND d.mps_header_id = ?
    `, [detailId, id]) as any;
    
    if (!detail) return res.status(404).json({ error: 'MPS detail not found' });
    if (!detail.bom_id) return res.status(400).json({ error: 'No BOM linked to this product' });

    // Get BOM raw materials
    const bomItems = await dbAll(`
      SELECT bd.raw_material_id, bd.quantity as qty_per_unit, bd.unit_of_measure_id,
        p.name as material_name, p.sku as material_sku,
        u.name as uom_name,
        pt.code as product_type_code
      FROM bom_details bd
      JOIN products p ON bd.raw_material_id = p.id
      LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
      LEFT JOIN product_types pt ON p.product_type_id = pt.id
      WHERE bd.bom_header_id = ?
      ORDER BY bd.sequence ASC
    `, [detail.bom_id]) as any[];

    // Get MPS weekly production data (fg_qty drives gross requirements)
    const mpsWeeks = await dbAll(`
      SELECT * FROM mps_week_data WHERE mps_detail_id = ? ORDER BY year, week_number
    `, [detailId]) as any[];

    // Get saved MRP planned receipts
    const mrpData = await dbAll(`
      SELECT * FROM mrp_week_data WHERE mps_detail_id = ?
    `, [detailId]) as any[];

    // Generate week columns based on MPS period
    const mpsHeader = await dbGet('SELECT period_year, period_month FROM mps_headers WHERE id = ?', [id]) as any;
    const numWeeks = 12;
    const periodStart = new Date(mpsHeader?.period_year || new Date().getFullYear(), (mpsHeader?.period_month || new Date().getMonth() + 1) - 1, 1);
    const startWeek = getWeekNumber(periodStart);
    const startYear = mpsHeader?.period_year || new Date().getFullYear();
    const weekColumns: any[] = [];
    for (let i = 0; i < numWeeks; i++) {
      let wk = startWeek + i;
      let yr = startYear;
      if (wk > 52) { wk -= 52; yr++; }
      const range = getWeekDateRange(yr, wk);
      weekColumns.push({ week: wk, year: yr, label: `W${wk}`, dateRange: `${range.start}-${range.end}` });
    }

    // For each BOM material, calculate MRP with actual data
    const materials = [];
    for (const bom of bomItems) {
      const matId = bom.raw_material_id;
      const qtyPerUnit = Number(bom.qty_per_unit) || 0;

      // load actual inventory and saved settings
      const invRow = await dbGet(
        'SELECT COALESCE(SUM(quantity),0) as total FROM inventory_stocks WHERE product_id = ?', [matId]
      ) as any;
      const matSettings = await dbGet(
        'SELECT lead_time, first_stock, order_quantity FROM mrp_material_settings WHERE material_id = ?', [matId]
      ) as any;
      const actualStock = Number(invRow?.total || 0);
      const leadTime = matSettings ? Number(matSettings.lead_time) : 2;
      const firstStock = matSettings ? Number(matSettings.first_stock) : actualStock;
      const orderQty = matSettings ? Number(matSettings.order_quantity) : 0;

      // Calculate per-week data
      const weeks = weekColumns.map((wc: any) => {
        // Gross requirement = MPS production_qty × BOM qty_per_unit
        const mpsWeek = mpsWeeks.find((w: any) => w.week_number === wc.week && w.year === wc.year);
        const prodQty = Number(mpsWeek?.production_qty || 0);
        const grossReq = prodQty * qtyPerUnit;

        // Planned order receipt (from saved data or 0)
        const mrpWeek = mrpData.find((m: any) => m.material_id === matId && m.week_number === wc.week && m.year === wc.year);
        const plannedReceipt = Number(mrpWeek?.planned_order_receipt || 0);

        return {
          week_number: wc.week,
          year: wc.year,
          gross_requirements: Math.round(grossReq * 100) / 100,
          planned_order_receipt: plannedReceipt,
        };
      });

      materials.push({
        material_id: matId,
        material_name: bom.material_name,
        material_sku: bom.material_sku,
        uom_name: bom.uom_name,
        product_type_code: bom.product_type_code,
        qty_per_unit: qtyPerUnit,
        lead_time: leadTime,
        first_stock: firstStock,
        order_quantity: orderQty,
        inventory_actual: actualStock,
        weeks
      });
    }

    res.json({
      data: {
        product: { id: detail.product_id, name: detail.product_name, sku: detail.product_sku },
        bom_id: detail.bom_id,
        materials,
        weekColumns
      }
    });
  } catch (error) {
    console.error('Error fetching MRP:', error);
    res.status(500).json({ error: 'Failed to fetch MRP data' });
  }
});

// PUT /mps/:id/details/:detailId/mrp - Save MRP planned order receipts + material settings
router.put('/mps/:id/details/:detailId/mrp', authMiddleware, requirePermission('ppic.mps', 'update'), async (req: Request, res: Response) => {
  try {
    const { detailId } = req.params;
    const { entries, material_settings } = req.body;

    // save planned_order_receipt per week
    for (const entry of (entries || [])) {
      const existing = await dbGet(
        'SELECT id FROM mrp_week_data WHERE mps_detail_id = ? AND material_id = ? AND year = ? AND week_number = ?',
        [detailId, entry.material_id, entry.year, entry.week_number]
      );
      if (existing) {
        await dbRun(
          'UPDATE mrp_week_data SET planned_order_receipt = ? WHERE mps_detail_id = ? AND material_id = ? AND year = ? AND week_number = ?',
          [entry.planned_order_receipt || 0, detailId, entry.material_id, entry.year, entry.week_number]
        );
      } else {
        await dbRun(
          'INSERT INTO mrp_week_data (mps_detail_id, material_id, week_number, year, planned_order_receipt) VALUES (?, ?, ?, ?, ?)',
          [detailId, entry.material_id, entry.week_number, entry.year, entry.planned_order_receipt || 0]
        );
      }
    }

    // persist per-material settings (lead_time, first_stock, order_quantity)
    for (const ms of (material_settings || [])) {
      if (!ms.material_id) continue;
      const existing = await dbGet(
        'SELECT id FROM mrp_material_settings WHERE material_id = ?', [ms.material_id]
      );
      if (existing) {
        await dbRun(
          'UPDATE mrp_material_settings SET lead_time = ?, first_stock = ?, order_quantity = ? WHERE material_id = ?',
          [ms.lead_time ?? 2, ms.first_stock ?? 0, ms.order_quantity ?? 0, ms.material_id]
        );
      } else {
        await dbRun(
          'INSERT INTO mrp_material_settings (material_id, lead_time, first_stock, order_quantity) VALUES (?, ?, ?, ?)',
          [ms.material_id, ms.lead_time ?? 2, ms.first_stock ?? 0, ms.order_quantity ?? 0]
        );
      }
    }

    res.json({ message: 'MRP data saved' });
  } catch (error) {
    console.error('Error saving MRP:', error);
    res.status(500).json({ error: 'Failed to save MRP data' });
  }
});

// POST /mps/:id/details/:detailId/mrp/generate-pr - Embedded MRP → PR from MPS detail
router.post('/mps/:id/details/:detailId/mrp/generate-pr', authMiddleware, requirePermission('ppic.mrp', 'create'), async (req: Request, res: Response) => {
  try {
    const { id, detailId } = req.params;
    const { material_net_reqs, needed_by_week, needed_by_year } = req.body;

    if (!material_net_reqs || !Array.isArray(material_net_reqs) || material_net_reqs.length === 0) {
      return res.status(400).json({ error: 'No materials with net requirements provided.' });
    }

    const validMaterials = material_net_reqs.filter((m: any) => Number(m.net_req_qty) > 0);
    if (validMaterials.length === 0) {
      return res.status(400).json({ error: 'No materials have net requirements > 0.' });
    }

    const header = await dbGet('SELECT mps_number, period_year, period_month FROM mps_headers WHERE id = ?', [id]) as any;
    const userId = (req as any).user?.userId || null;

    // duplicate safety: check if a PR was already generated from this MPS detail
    const existingPr = await dbGet(
      `SELECT pr.id, pr.pr_number FROM purchase_requests pr
       WHERE pr.notes LIKE ? AND pr.status != 'CANCELLED'
       ORDER BY pr.id DESC LIMIT 1`,
      [`%Detail #${detailId}]%`]
    ) as any;
    if (existingPr) {
      return res.status(409).json({
        error: `PR sudah pernah dibuat untuk MPS detail ini: ${existingPr.pr_number}. Batalkan PR lama terlebih dahulu jika ingin membuat ulang.`,
        existing_pr: existingPr.pr_number,
      });
    }

    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const prNumber = `PR-MRP-${datePart}-${rand}`;

    // compute needed_by from week/year if provided
    let neededByDate: string;
    if (needed_by_week && needed_by_year) {
      const jan4 = new Date(needed_by_year, 0, 4);
      const dayOfWeek = jan4.getDay() || 7;
      const friday = new Date(jan4);
      friday.setDate(jan4.getDate() - dayOfWeek + 5 + (needed_by_week - 1) * 7);
      neededByDate = friday.toISOString().slice(0, 10);
    } else {
      const maxLead = Math.max(...validMaterials.map((m: any) => 2)); // default lead
      const nb = new Date();
      nb.setDate(nb.getDate() + maxLead * 7);
      neededByDate = nb.toISOString().slice(0, 10);
    }

    const prNotes = [
      `[Auto-generated from MRP for MPS ${header?.mps_number || id}, Detail #${detailId}]`,
      `Materials: ${validMaterials.length} items`,
      `Generated: ${now.toISOString().slice(0, 19).replace('T', ' ')}`
    ].join('\n');

    const result = await dbTransaction(async (conn: any) => {
      const [prInsert] = await conn.execute(
        `INSERT INTO purchase_requests (pr_number, requestor_id, status, notes, request_date, needed_by) VALUES (?, ?, 'DRAFT', ?, ?, ?)`,
        [prNumber, userId, prNotes, now.toISOString().slice(0, 10), neededByDate]
      );
      const prId = prInsert.insertId;

      let itemCount = 0;
      for (const mat of validMaterials) {
        const qty = Number(mat.net_req_qty) || 0;
        if (qty <= 0) continue;
        await conn.execute(
          `INSERT INTO purchase_request_items (purchase_request_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)`,
          [prId, mat.material_id, qty, `MRP Net Req | ${mat.material_name || ''} | UOM: ${mat.uom_name || '-'}`]
        );
        itemCount++;
      }
      if (itemCount === 0) throw new Error('No valid items to insert');
      return { prId, itemCount };
    });

    console.log(`Embedded PR generated: ${prNumber} with ${result.itemCount} items (MPS detail ${detailId})`);
    await ppicLog(req, 'GENERATE_PR', 'MRP', result.prId, null, { pr_number: prNumber, item_count: result.itemCount, mps_detail_id: detailId });

    res.status(201).json({
      pr_number: prNumber,
      pr_id: result.prId,
      items_created: result.itemCount,
      needed_by: neededByDate,
    });
  } catch (error: any) {
    console.error('Error generating embedded PR:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'PR number conflict. Please try again.' });
    }
    res.status(500).json({ error: 'Failed to generate Purchase Request from embedded MRP' });
  }
});

// ==========================================
// STANDALONE MRP — Aggregated across ALL confirmed MPS
// ==========================================

// GET /mrp - Standalone MRP: aggregate gross requirements per unique raw material across all confirmed MPS
router.get('/mrp', authMiddleware, requirePermission('ppic.mrp', 'view'), async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const year = Number(req.query.year) || now.getFullYear();
    const month = Number(req.query.month) || (now.getMonth() + 1);

    // derive grid start from requested period
    const periodStart = getFirstWeekOfMonth(year, month);
    const startWeek = periodStart.week;
    const startYear = periodStart.year;

    // Generate 12 week columns from period start
    const numWeeks = 12;
    const weekColumns: any[] = [];
    for (let i = 0; i < numWeeks; i++) {
      let wk = startWeek + i;
      let yr = startYear;
      if (wk > 52) { wk -= 52; yr++; }
      const range = getWeekDateRange(yr, wk);
      weekColumns.push({ week: wk, year: yr, label: `W${wk}`, dateRange: `${range.start}-${range.end}` });
    }

    // 1. Get ALL MPS headers (Draft + Confirmed) for the requested year
    const mpsHeaders = await dbAll(
      `SELECT id FROM mps_headers WHERE status IN ('Draft', 'Confirmed') AND period_year = ?`,
      [year]
    ) as any[];

    if (mpsHeaders.length === 0) {
      return res.json({ data: { materials: [], weekColumns } });
    }

    const headerIds = mpsHeaders.map((h: any) => h.id);
    const headerPlaceholders = headerIds.map(() => '?').join(',');

    // 2. Get ALL MPS details for those headers (with BOM info)
    const allDetails = await dbAll(`
      SELECT d.id as detail_id, d.product_id, d.bom_id
      FROM mps_details d
      WHERE d.mps_header_id IN (${headerPlaceholders}) AND d.bom_id IS NOT NULL
    `, headerIds) as any[];

    if (allDetails.length === 0) {
      return res.json({ data: { materials: [], weekColumns } });
    }

    const detailIds = allDetails.map((d: any) => d.detail_id);
    const detailPlaceholders = detailIds.map(() => '?').join(',');

    // 3. Get ALL MPS weekly production data for those details
    const allMpsWeeks = await dbAll(`
      SELECT * FROM mps_week_data WHERE mps_detail_id IN (${detailPlaceholders}) ORDER BY year, week_number
    `, detailIds) as any[];

    // 4. Get ALL unique BOM IDs, then load BOM details (raw materials)
    const bomIds = [...new Set(allDetails.map((d: any) => d.bom_id))];
    const bomPlaceholders = bomIds.map(() => '?').join(',');

    const allBomItems = await dbAll(`
      SELECT bd.bom_header_id, bd.raw_material_id, bd.quantity as qty_per_unit, bd.unit_of_measure_id,
        p.name as material_name, p.sku as material_sku,
        u.name as uom_name,
        pt.code as product_type_code
      FROM bom_details bd
      JOIN products p ON bd.raw_material_id = p.id
      LEFT JOIN uom u ON bd.unit_of_measure_id = u.id
      LEFT JOIN product_types pt ON p.product_type_id = pt.id
      WHERE bd.bom_header_id IN (${bomPlaceholders})
      ORDER BY bd.sequence ASC
    `, bomIds) as any[];

    // 5. Load saved standalone MRP data (mps_detail_id = 0 for global)
    const savedMrpData = await dbAll(`
      SELECT * FROM mrp_week_data WHERE mps_detail_id = 0
    `) as any[];

    // 6. Also load per-detail MRP data to aggregate
    const perDetailMrpData = await dbAll(`
      SELECT * FROM mrp_week_data WHERE mps_detail_id IN (${detailPlaceholders})
    `, detailIds) as any[];

    // 7. Aggregate gross requirements per unique raw material per week
    // Map: material_id -> { info, weekMap: { "wk-yr" -> gross_req } }
    const materialMap: Record<number, {
      material_id: number;
      material_name: string;
      material_sku: string;
      uom_name: string;
      product_type_code: string;
      weekGross: Record<string, number>;
    }> = {};

    for (const detail of allDetails) {
      const bomItems = allBomItems.filter((b: any) => b.bom_header_id === detail.bom_id);
      const detailWeeks = allMpsWeeks.filter((w: any) => w.mps_detail_id === detail.detail_id);

      for (const bom of bomItems) {
        const matId = bom.raw_material_id;
        const qtyPerUnit = Number(bom.qty_per_unit) || 0;

        if (!materialMap[matId]) {
          materialMap[matId] = {
            material_id: matId,
            material_name: bom.material_name,
            material_sku: bom.material_sku,
            uom_name: bom.uom_name,
            product_type_code: bom.product_type_code,
            weekGross: {}
          };
        }

        // For each week column, add this detail's contribution to gross requirements
        for (const wc of weekColumns) {
          const key = `${wc.week}-${wc.year}`;
          const mpsWeek = detailWeeks.find((w: any) => w.week_number === wc.week && w.year === wc.year);
          const prodQty = Number(mpsWeek?.production_qty || 0);
          const grossReq = prodQty * qtyPerUnit;

          if (!materialMap[matId].weekGross[key]) {
            materialMap[matId].weekGross[key] = 0;
          }
          materialMap[matId].weekGross[key] += grossReq;
        }
      }
    }

    // 8. Load all material settings + inventory for enrichment
    const allMatIds = Object.keys(materialMap).map(Number);
    const matSettingsMap: Record<number, any> = {};
    const matInventoryMap: Record<number, number> = {};
    for (const mid of allMatIds) {
      const settings = await dbGet(
        'SELECT lead_time, first_stock, order_quantity FROM mrp_material_settings WHERE material_id = ?', [mid]
      ) as any;
      const inv = await dbGet(
        'SELECT COALESCE(SUM(quantity),0) as total FROM inventory_stocks WHERE product_id = ?', [mid]
      ) as any;
      matSettingsMap[mid] = settings || null;
      matInventoryMap[mid] = Number(inv?.total || 0);
    }

    // 9. Build final materials array with weekly data
    const materials = Object.values(materialMap).map((mat) => {
      const weeks = weekColumns.map((wc) => {
        const key = `${wc.week}-${wc.year}`;
        const grossReq = mat.weekGross[key] || 0;

        // Check standalone saved data first (mps_detail_id=0), fallback to 0
        const savedWeek = savedMrpData.find(
          (m: any) => m.material_id === mat.material_id && m.week_number === wc.week && m.year === wc.year
        );

        const plannedReceipt = Number(savedWeek?.planned_order_receipt || 0);
        const plannedRelease = Number(savedWeek?.planned_order_release || 0);

        return {
          week_number: wc.week,
          year: wc.year,
          gross_requirements: Math.round(grossReq * 100) / 100,
          planned_order_receipt: plannedReceipt,
          planned_order_release: plannedRelease
        };
      });

      const settings = matSettingsMap[mat.material_id];
      const actualStock = matInventoryMap[mat.material_id] || 0;

      return {
        material_id: mat.material_id,
        material_name: mat.material_name,
        material_sku: mat.material_sku,
        uom_name: mat.uom_name,
        product_type_code: mat.product_type_code,
        lead_time: settings ? Number(settings.lead_time) : 2,
        first_stock: settings ? Number(settings.first_stock) : actualStock,
        order_quantity: settings ? Number(settings.order_quantity) : 0,
        inventory_actual: actualStock,
        weeks
      };
    });

    res.json({ data: { materials, weekColumns } });
  } catch (error) {
    console.error('Error fetching standalone MRP:', error);
    res.status(500).json({ error: 'Failed to fetch standalone MRP data' });
  }
});

// PUT /mrp - Save standalone MRP planned_order_release & planned_order_receipt (global, mps_detail_id=0)
router.put('/mrp', authMiddleware, requirePermission('ppic.mrp', 'update'), async (req: Request, res: Response) => {
  try {
    const { entries, materialSettings } = req.body;

    for (const entry of (entries || [])) {
      const existing = await dbGet(
        'SELECT id FROM mrp_week_data WHERE mps_detail_id = 0 AND material_id = ? AND year = ? AND week_number = ?',
        [entry.material_id, entry.year, entry.week_number]
      );

      if (existing) {
        await dbRun(
          'UPDATE mrp_week_data SET planned_order_receipt = ?, planned_order_release = ? WHERE mps_detail_id = 0 AND material_id = ? AND year = ? AND week_number = ?',
          [entry.planned_order_receipt || 0, entry.planned_order_release || 0, entry.material_id, entry.year, entry.week_number]
        );
      } else {
        await dbRun(
          'INSERT INTO mrp_week_data (mps_detail_id, material_id, week_number, year, planned_order_receipt, planned_order_release) VALUES (0, ?, ?, ?, ?, ?)',
          [entry.material_id, entry.week_number, entry.year, entry.planned_order_receipt || 0, entry.planned_order_release || 0]
        );
      }
    }

    // persist material settings (lead_time, first_stock, order_quantity)
    for (const ms of (materialSettings || [])) {
      if (!ms.material_id) continue;
      const existSetting = await dbGet(
        'SELECT id FROM mrp_material_settings WHERE material_id = ?', [ms.material_id]
      );
      if (existSetting) {
        await dbRun(
          'UPDATE mrp_material_settings SET lead_time = ?, first_stock = ?, order_quantity = ? WHERE material_id = ?',
          [ms.lead_time ?? 2, ms.first_stock ?? 0, ms.order_quantity ?? 0, ms.material_id]
        );
      } else {
        await dbRun(
          'INSERT INTO mrp_material_settings (material_id, lead_time, first_stock, order_quantity) VALUES (?, ?, ?, ?)',
          [ms.material_id, ms.lead_time ?? 2, ms.first_stock ?? 0, ms.order_quantity ?? 0]
        );
      }
    }

    await ppicLog(req, 'SAVE', 'MRP', null, null, { entries_count: (entries || []).length, settings_count: (materialSettings || []).length });
    res.json({ message: 'Standalone MRP data saved' });
  } catch (error) {
    console.error('Error saving standalone MRP:', error);
    res.status(500).json({ error: 'Failed to save standalone MRP data' });
  }
});

// POST /mrp/generate-pr - Generate Purchase Request from MRP Net Requirements
router.post('/mrp/generate-pr', authMiddleware, requirePermission('ppic.mrp', 'create'), async (req: Request, res: Response) => {
  try {
    const { materials, year, notes } = req.body;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({ error: 'No materials provided. Select materials with net requirements > 0.' });
    }

    const validMaterials = materials.filter((m: any) => Number(m.total_net_requirement) > 0);
    if (validMaterials.length === 0) {
      return res.status(400).json({ error: 'No materials have net requirements > 0.' });
    }

    // duplicate protection: check if a PR-MRP was generated today for same year
    const today = new Date().toISOString().slice(0, 10);
    const recentPR = await dbGet(
      "SELECT id, pr_number FROM purchase_requests WHERE pr_number LIKE ? AND request_date = ?",
      [`PR-MRP-${today.replace(/-/g, '')}%`, today]
    ) as any;
    if (recentPR) {
      return res.status(409).json({
        error: `An MRP Purchase Request was already generated today (${recentPR.pr_number}). Delete it first or wait until tomorrow.`,
        existing_pr: recentPR.pr_number
      });
    }

    const userId = (req as any).user?.userId || null;
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(100 + Math.random() * 900);
    const prNumber = `PR-MRP-${datePart}-${rand}`;

    const maxLeadTime = Math.max(...validMaterials.map((m: any) => Number(m.lead_time) || 2));
    const neededBy = new Date();
    neededBy.setDate(neededBy.getDate() + maxLeadTime * 7);

    const prNotes = [
      notes || '',
      `[Auto-generated from MRP Year ${year || now.getFullYear()}]`,
      `Materials: ${validMaterials.length} items`,
      `Generated: ${now.toISOString().slice(0, 19).replace('T', ' ')}`
    ].filter(Boolean).join('\n');

    // transactional: PR header + all items, rollback if any item fails
    const result = await dbTransaction(async (conn: any) => {
      const [prInsert] = await conn.execute(
        `INSERT INTO purchase_requests (pr_number, requestor_id, status, notes, request_date, needed_by) VALUES (?, ?, 'DRAFT', ?, ?, ?)`,
        [prNumber, userId, prNotes, now.toISOString().slice(0, 10), neededBy.toISOString().slice(0, 10)]
      );
      const prId = prInsert.insertId;

      let itemCount = 0;
      for (const mat of validMaterials) {
        const qty = Number(mat.total_net_requirement) || 0;
        if (qty <= 0) continue;
        await conn.execute(
          `INSERT INTO purchase_request_items (purchase_request_id, product_id, quantity, notes) VALUES (?, ?, ?, ?)`,
          [prId, mat.material_id, qty, `MRP Net Req | Lead Time: ${mat.lead_time || 2} weeks | UOM: ${mat.uom_name || '-'}`]
        );
        itemCount++;
      }

      if (itemCount === 0) {
        throw new Error('No valid items to insert');
      }

      return { prId, itemCount };
    });

    console.log(`PR generated from MRP: ${prNumber} with ${result.itemCount} items (PR ID: ${result.prId})`);

    await ppicLog(req, 'GENERATE_PR', 'MRP', result.prId, null, { pr_number: prNumber, item_count: result.itemCount });
    res.status(201).json({
      success: true,
      message: `Purchase Request ${prNumber} created with ${result.itemCount} materials`,
      data: {
        pr_id: result.prId,
        pr_number: prNumber,
        item_count: result.itemCount,
        needed_by: neededBy.toISOString().slice(0, 10),
      }
    });
  } catch (error: any) {
    console.error('Error generating PR from MRP:', error);
    if (error.message?.includes('UNIQUE')) {
      return res.status(400).json({ error: 'PR number conflict. Please try again.' });
    }
    if (error.message === 'No valid items to insert') {
      return res.status(400).json({ error: 'No valid items to create PR. All quantities were 0.' });
    }
    res.status(500).json({ error: 'Failed to generate Purchase Request from MRP' });
  }
});

// ============================================================
// SALES FORECAST — Sister Company C2509 Integration
// ============================================================

// GET /forecast-brands - List all brands
router.get('/forecast-brands', authMiddleware, async (_req: Request, res: Response) => {
  try {
    const brands = await dbAll(`
      SELECT fb.*, p.name as product_name, p.sku as product_sku
      FROM forecast_brands fb
      LEFT JOIN products p ON fb.product_id = p.id
      ORDER BY fb.brand_name ASC
    `);
    res.json(brands);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forecast brands' });
  }
});

// POST /forecast-brands - Create brand
router.post('/forecast-brands', authMiddleware, requirePermission('master_data.forecast-brands', 'create'), async (req: Request, res: Response) => {
  try {
    const { brand_name, type, product_id, conversion_rate, conversion_uom, notes } = req.body;
    if (!brand_name) return res.status(400).json({ error: 'Brand name is required' });
    if (!product_id) return res.status(400).json({ error: 'Product is required' });
    const result = await dbRun(
      'INSERT INTO forecast_brands (brand_name, type, product_id, conversion_rate, conversion_uom, notes) VALUES (?, ?, ?, ?, ?, ?)',
      [brand_name, type || 'Brand', product_id, conversion_rate || 1, conversion_uom || 'ltr', notes || null]
    );
    res.json({ id: result.insertId, message: 'Brand created' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create brand' });
  }
});

// PUT /forecast-brands/:id - Update brand
router.put('/forecast-brands/:id', authMiddleware, requirePermission('master_data.forecast-brands', 'update'), async (req: Request, res: Response) => {
  try {
    const { brand_name, type, product_id, conversion_rate, conversion_uom, notes, is_active } = req.body;
    await dbRun(
      'UPDATE forecast_brands SET brand_name=?, type=?, product_id=?, conversion_rate=?, conversion_uom=?, notes=?, is_active=? WHERE id=?',
      [brand_name, type || 'Brand', product_id, conversion_rate, conversion_uom || 'ltr', notes, is_active ?? true, req.params.id]
    );
    res.json({ message: 'Brand updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update brand' });
  }
});

// DELETE /forecast-brands/:id
router.delete('/forecast-brands/:id', authMiddleware, requirePermission('master_data.forecast-brands', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM forecast_brands WHERE id = ?', [req.params.id]);
    res.json({ message: 'Brand deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete brand' });
  }
});

// GET /forecasts - List forecast headers
router.get('/forecasts', authMiddleware, requirePermission('ppic.forecast', 'view'), async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    let sql = 'SELECT * FROM forecast_headers';
    const params: any[] = [];
    if (year && month) {
      sql += ' WHERE period_year = ? AND period_month = ?';
      params.push(year, month);
    }
    sql += ' ORDER BY period_year DESC, period_month DESC';
    const headers = await dbAll(sql, params);
    res.json(headers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch forecasts' });
  }
});

// POST /forecasts - Create new forecast
router.post('/forecasts', authMiddleware, requirePermission('ppic.forecast', 'create'), async (req: Request, res: Response) => {
  try {
    const { period_year, period_month, notes } = req.body;
    // Check duplicate
    const existing = await dbGet(
      'SELECT id FROM forecast_headers WHERE period_year = ? AND period_month = ?',
      [period_year, period_month]
    );
    if (existing) return res.status(400).json({ error: 'Forecast for this period already exists' });

    const fcNum = `FC-${period_year}-${String(period_month).padStart(2, '0')}`;
    const result = await dbRun(
      'INSERT INTO forecast_headers (forecast_number, period_year, period_month, notes) VALUES (?, ?, ?, ?)',
      [fcNum, period_year, period_month, notes || null]
    );
    await ppicLog(req, 'CREATE', 'FORECAST', result.insertId, null, { forecast_number: fcNum, period_year, period_month });
    res.json({ id: result.insertId, forecast_number: fcNum });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create forecast' });
  }
});

// GET /forecasts/:id - Get forecast with grid data
router.get('/forecasts/:id', authMiddleware, requirePermission('ppic.forecast', 'view'), async (req: Request, res: Response) => {
  try {
    const header = await dbGet('SELECT * FROM forecast_headers WHERE id = ?', [req.params.id]);
    if (!header) return res.status(404).json({ error: 'Forecast not found' });

    const brands = await dbAll(`
      SELECT fb.*, p.name as product_name, p.sku as product_sku
      FROM forecast_brands fb
      LEFT JOIN products p ON fb.product_id = p.id
      WHERE fb.is_active = 1
      ORDER BY fb.brand_name ASC
    `) as any[];

    const weekData = await dbAll(
      'SELECT * FROM forecast_week_data WHERE forecast_header_id = ?',
      [req.params.id]
    ) as any[];

    // Build week columns (12 weeks from period start)
    const h = header as any;
    const periodStart = getFirstWeekOfMonth(h.period_year, h.period_month);
    const startWeek = periodStart.week;
    const startYear = periodStart.year;
    const weekColumns: { week: number; year: number; start: string; end: string }[] = [];
    for (let i = 0; i < 12; i++) {
      let wk = startWeek + i;
      let yr = startYear;
      if (wk > 52) { wk -= 52; yr++; }
      const range = getWeekDateRange(yr, wk);
      weekColumns.push({ week: wk, year: yr, start: range.start, end: range.end });
    }

    // Organize week data by brand
    const brandData = brands.map((brand: any) => {
      const weeks: any = {};
      for (const wc of weekColumns) {
        const k = `${wc.week}:${wc.year}`;
        const wData = weekData.find(
          (w: any) => w.brand_id === brand.id && w.week_number === wc.week && w.year === wc.year
        );
        weeks[k] = {
          forecast_qty: Number(wData?.forecast_qty || 0),
          product_qty: Number(wData?.product_qty || 0)
        };
      }
      return { ...brand, weeks };
    });

    res.json({ header, brands: brandData, weekColumns });
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast' });
  }
});

// POST /forecasts/:id/generate-grid - Generate 12-week grid for all active brands
router.post('/forecasts/:id/generate-grid', authMiddleware, requirePermission('ppic.forecast', 'create'), async (req: Request, res: Response) => {
  try {
    const header = await dbGet('SELECT * FROM forecast_headers WHERE id = ?', [req.params.id]) as any;
    if (!header) return res.status(404).json({ error: 'Forecast not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Can only generate grid for Draft forecasts' });

    const brands = await dbAll('SELECT * FROM forecast_brands WHERE is_active = 1') as any[];
    if (brands.length === 0) return res.status(400).json({ error: 'No active brands found. Please add brands first.' });

    // Check if grid already exists
    const existing = await dbGet('SELECT COUNT(*) as cnt FROM forecast_week_data WHERE forecast_header_id = ?', [req.params.id]) as any;
    if (existing.cnt > 0) return res.status(400).json({ error: 'Grid already generated. Delete existing data first or use save.' });

    const periodStart = getFirstWeekOfMonth(header.period_year, header.period_month);
    const startWeek = periodStart.week;
    const startYear = periodStart.year;

    for (const brand of brands) {
      for (let i = 0; i < 12; i++) {
        let wk = startWeek + i;
        let yr = startYear;
        if (wk > 52) { wk -= 52; yr++; }
        await dbRun(
          'INSERT INTO forecast_week_data (forecast_header_id, brand_id, week_number, year, forecast_qty, product_qty) VALUES (?, ?, ?, ?, 0, 0)',
          [req.params.id, brand.id, wk, yr]
        );
      }
    }

    res.json({ message: `Grid generated for ${brands.length} brands × 12 weeks` });
  } catch (error) {
    console.error('Error generating forecast grid:', error);
    res.status(500).json({ error: 'Failed to generate grid' });
  }
});

// PUT /forecasts/:id/week-data - Save weekly forecast data (batch)
router.put('/forecasts/:id/week-data', authMiddleware, requirePermission('ppic.forecast', 'update'), async (req: Request, res: Response) => {
  try {
    const header = await dbGet('SELECT * FROM forecast_headers WHERE id = ?', [req.params.id]) as any;
    if (!header) return res.status(404).json({ error: 'Forecast not found' });
    if (header.status !== 'Draft') return res.status(400).json({ error: 'Cannot edit confirmed forecast' });

    const { data } = req.body; // Array of { brand_id, week_number, year, forecast_qty }
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Data must be an array' });

    // Get brand conversion rates
    const brands = await dbAll('SELECT id, conversion_rate FROM forecast_brands') as any[];
    const rateMap = new Map(brands.map((b: any) => [b.id, Number(b.conversion_rate)]));

    for (const item of data) {
      const rate = rateMap.get(item.brand_id) || 1;
      const productQty = Math.round(Number(item.forecast_qty) * rate * 100) / 100;

      await dbRun(`
        INSERT INTO forecast_week_data (forecast_header_id, brand_id, week_number, year, forecast_qty, product_qty)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE forecast_qty = VALUES(forecast_qty), product_qty = VALUES(product_qty)
      `, [req.params.id, item.brand_id, item.week_number, item.year, item.forecast_qty, productQty]);
    }

    await ppicLog(req, 'SAVE_WEEK_DATA', 'FORECAST', req.params.id, null, { entries_count: data.length });
    res.json({ message: 'Forecast data saved' });
  } catch (error) {
    console.error('Error saving forecast data:', error);
    res.status(500).json({ error: 'Failed to save forecast data' });
  }
});

// PUT /forecasts/:id/status - Change status
router.put('/forecasts/:id/status', authMiddleware, requirePermission('ppic.forecast', 'update'), async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['Draft', 'Confirmed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    await dbRun('UPDATE forecast_headers SET status = ? WHERE id = ?', [status, req.params.id]);
    await ppicLog(req, status === 'Confirmed' ? 'CONFIRM' : 'REVERT', 'FORECAST', req.params.id, null, { status });
    res.json({ message: `Forecast status changed to ${status}` });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// DELETE /forecasts/:id
router.delete('/forecasts/:id', authMiddleware, requirePermission('ppic.forecast', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM forecast_headers WHERE id = ?', [req.params.id]);
    await ppicLog(req, 'DELETE', 'FORECAST', req.params.id, null, null);
  res.json({ message: 'Forecast deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete forecast' });
  }
});

// POST /forecasts/:id/push-to-mps - Push forecast data into MPS forecast_qty row
router.post('/forecasts/:id/push-to-mps', authMiddleware, requirePermission('ppic.forecast', 'create'), async (req: Request, res: Response) => {
  try {
    const forecast = await dbGet('SELECT * FROM forecast_headers WHERE id = ?', [req.params.id]) as any;
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });

    // Get all forecast week data grouped by product_id and week
    const forecastData = await dbAll(`
      SELECT fb.product_id, fw.week_number, fw.year, SUM(fw.product_qty) as total_qty
      FROM forecast_week_data fw
      JOIN forecast_brands fb ON fw.brand_id = fb.id
      WHERE fw.forecast_header_id = ? AND fb.product_id IS NOT NULL
      GROUP BY fb.product_id, fw.week_number, fw.year
    `, [req.params.id]) as any[];

    if (forecastData.length === 0) return res.status(400).json({ error: 'No forecast data to push' });

    // Find active MPS (Draft preferred, then any) for the same period
    let mps = await dbGet(
      `SELECT * FROM mps_headers WHERE period_year = ? AND period_month = ? AND status = 'Draft' ORDER BY id DESC LIMIT 1`,
      [forecast.period_year, forecast.period_month]
    ) as any;
    if (!mps) {
      mps = await dbGet(
        `SELECT * FROM mps_headers WHERE status = 'Draft' ORDER BY id DESC LIMIT 1`
      ) as any;
    }
    if (!mps) return res.status(400).json({ error: 'No Draft MPS found. Create an MPS first.' });

    // Get unique product_ids from forecast
    const productIds = [...new Set(forecastData.map((f: any) => f.product_id))];
    let updated = 0;
    let created = 0;

    for (const productId of productIds) {
      // Find or create MPS detail for this product
      let mpsDetail = await dbGet(
        'SELECT id FROM mps_details WHERE mps_header_id = ? AND product_id = ?',
        [mps.id, productId]
      ) as any;

      if (!mpsDetail) {
        // Auto-create MPS detail for this product
        const product = await dbGet('SELECT id, name FROM products WHERE id = ?', [productId]) as any;
        if (!product) continue;

        const bom = await dbGet(
          "SELECT id FROM bom_headers WHERE product_id = ? AND status = 'ACTIVE' LIMIT 1",
          [productId]
        ) as any;

        const result = await dbRun(
          'INSERT INTO mps_details (mps_header_id, product_id, bom_id, so_qty) VALUES (?, ?, ?, 0)',
          [mps.id, productId, bom?.id || null]
        );
        mpsDetail = { id: result.insertId };
        created++;
      }

      // Update forecast_qty for matching weeks
      const productWeeks = forecastData.filter((f: any) => f.product_id === productId);
      for (const pw of productWeeks) {
        const existingWeek = await dbGet(
          'SELECT id FROM mps_week_data WHERE mps_detail_id = ? AND year = ? AND week_number = ?',
          [mpsDetail.id, pw.year, pw.week_number]
        ) as any;

        if (existingWeek) {
          await dbRun(
            'UPDATE mps_week_data SET forecast_qty = ? WHERE id = ?',
            [pw.total_qty, existingWeek.id]
          );
        } else {
          await dbRun(
            'INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty, production_qty) VALUES (?, ?, ?, ?, 0, 0, 0, 0)',
            [mpsDetail.id, pw.week_number, pw.year, pw.total_qty]
          );
        }
        updated++;
      }
    }

    await ppicLog(req, 'PUSH_TO_MPS', 'FORECAST', req.params.id, null, { mps_number: mps.mps_number, products_matched: productIds.length, weeks_updated: updated });
    res.json({
      message: `Forecast pushed to MPS ${mps.mps_number}`,
      mps_id: mps.id,
      mps_number: mps.mps_number,
      products_matched: productIds.length,
      products_created: created,
      weeks_updated: updated
    });
  } catch (error) {
    console.error('Error pushing forecast to MPS:', error);
    res.status(500).json({ error: 'Failed to push forecast to MPS' });
  }
});

// GET /forecast-monthly - Get monthly forecast data for a year
router.get('/forecast-monthly', authMiddleware, async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const brands = await dbAll(`
      SELECT fb.id, fb.brand_name, fb.type, fb.product_id, fb.conversion_rate, fb.conversion_uom,
             p.name as product_name, p.sku as product_sku
      FROM forecast_brands fb
      LEFT JOIN products p ON fb.product_id = p.id
      WHERE fb.is_active = 1
      ORDER BY fb.brand_name
    `) as any[];

    const monthlyData = await dbAll(
      'SELECT * FROM forecast_monthly_data WHERE year = ?',
      [year]
    ) as any[];

    // attach monthly data to brands
    for (const brand of brands) {
      brand.months = {};
      for (let m = 1; m <= 12; m++) {
        const md = monthlyData.find((d: any) => d.brand_id === brand.id && d.month === m);
        brand.months[m] = {
          forecast_qty: md ? Number(md.forecast_qty) : 0,
          product_qty: md ? Number(md.product_qty) : 0,
        };
      }
    }

    res.json({ data: { brands, year } });
  } catch (error) {
    console.error('Error fetching monthly forecast:', error);
    res.status(500).json({ error: 'Failed to fetch monthly forecast' });
  }
});

// PUT /forecast-monthly - Save monthly forecast data
router.put('/forecast-monthly', authMiddleware, requirePermission('ppic.forecast', 'update'), async (req: Request, res: Response) => {
  try {
    const { year, data } = req.body;
    if (!year || !Array.isArray(data)) {
      return res.status(400).json({ error: 'year and data[] are required' });
    }

    for (const entry of data) {
      const { brand_id, month, forecast_qty } = entry;
      // get brand conversion
      const brand = await dbGet('SELECT conversion_rate FROM forecast_brands WHERE id = ?', [brand_id]) as any;
      const rate = brand ? Number(brand.conversion_rate || 1) : 1;
      const product_qty = Number(forecast_qty) * rate;

      const existing = await dbGet(
        'SELECT id FROM forecast_monthly_data WHERE year = ? AND brand_id = ? AND month = ?',
        [year, brand_id, month]
      );
      if (existing) {
        await dbRun(
          'UPDATE forecast_monthly_data SET forecast_qty = ?, product_qty = ? WHERE year = ? AND brand_id = ? AND month = ?',
          [forecast_qty, product_qty, year, brand_id, month]
        );
      } else {
        await dbRun(
          'INSERT INTO forecast_monthly_data (year, brand_id, month, forecast_qty, product_qty) VALUES (?, ?, ?, ?, ?)',
          [year, brand_id, month, forecast_qty, product_qty]
        );
      }
    }

    // clear months not in payload
    const brandMonthPairs = data.map((d: any) => `${d.brand_id}_${d.month}`);
    const allData = await dbAll(
      'SELECT id, brand_id, month FROM forecast_monthly_data WHERE year = ?',
      [year]
    ) as any[];
    for (const row of allData) {
      if (!brandMonthPairs.includes(`${row.brand_id}_${row.month}`)) {
        await dbRun('DELETE FROM forecast_monthly_data WHERE id = ?', [row.id]);
      }
    }

    res.json({ message: 'Monthly forecast saved' });
  } catch (error) {
    console.error('Error saving monthly forecast:', error);
    res.status(500).json({ error: 'Failed to save monthly forecast' });
  }
});

// POST /forecast-monthly/distribute - Distribute monthly to weekly
router.post('/forecast-monthly/distribute', authMiddleware, requirePermission('ppic.forecast', 'create'), async (req: Request, res: Response) => {
  try {
    const { year } = req.body;
    if (!year) return res.status(400).json({ error: 'year is required' });

    const monthlyData = await dbAll(
      'SELECT * FROM forecast_monthly_data WHERE year = ? AND forecast_qty > 0',
      [year]
    ) as any[];

    if (monthlyData.length === 0) {
      return res.status(400).json({ error: 'No monthly forecast data to distribute' });
    }

    let created = 0;
    let updated = 0;

    for (const md of monthlyData) {
      // find weeks in this month
      const weeksInMonth = getWeeksInMonth(md.month, year);
      const weeklyQty = Number(md.forecast_qty) / weeksInMonth.length;
      const brand = await dbGet('SELECT conversion_rate FROM forecast_brands WHERE id = ?', [md.brand_id]) as any;
      const rate = brand ? Number(brand.conversion_rate || 1) : 1;
      const weeklyProductQty = weeklyQty * rate;

      // find or create forecast header for this month
      let header = await dbGet(
        'SELECT id FROM forecast_headers WHERE period_year = ? AND period_month = ?',
        [year, md.month]
      ) as any;

      if (!header) {
        const fcNum = `FC-${year}-${String(md.month).padStart(2, '0')}`;
        const result = await dbRun(
          'INSERT INTO forecast_headers (forecast_number, period_year, period_month, status) VALUES (?, ?, ?, ?)',
          [fcNum, year, md.month, 'Draft']
        );
        header = { id: result.insertId };
        created++;
      }

      for (const w of weeksInMonth) {
        const existing = await dbGet(
          'SELECT id FROM forecast_week_data WHERE forecast_header_id = ? AND brand_id = ? AND week_number = ? AND year = ?',
          [header.id, md.brand_id, w, year]
        ) as any;

        if (existing) {
          await dbRun(
            'UPDATE forecast_week_data SET forecast_qty = ?, product_qty = ? WHERE id = ?',
            [weeklyQty.toFixed(2), weeklyProductQty.toFixed(2), existing.id]
          );
        } else {
          await dbRun(
            'INSERT INTO forecast_week_data (forecast_header_id, brand_id, week_number, year, forecast_qty, product_qty) VALUES (?, ?, ?, ?, ?, ?)',
            [header.id, md.brand_id, w, year, weeklyQty.toFixed(2), weeklyProductQty.toFixed(2)]
          );
        }
        updated++;
      }
    }

    res.json({ message: `Distributed to ${updated} weekly cells, ${created} new forecast headers created` });
  } catch (error) {
    console.error('Error distributing forecast:', error);
    res.status(500).json({ error: 'Failed to distribute forecast' });
  }
});

// helper: get ISO week numbers for a given month
function getWeeksInMonth(month: number, year: number): number[] {
  const weeks = new Set<number>();
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const week = getISOWeek(date);
    weeks.add(week);
  }
  return Array.from(weeks).sort((a, b) => a - b);
}

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// POST /forecast-monthly/push-to-mps - Push monthly forecast to MPS
router.post('/forecast-monthly/push-to-mps', authMiddleware, requirePermission('ppic.mps', 'update'), async (req: Request, res: Response) => {
  try {
    const { year } = req.body;
    if (!year) return res.status(400).json({ error: 'year is required' });

    // find active Draft MPS
    const mps = await dbGet("SELECT * FROM mps_headers WHERE status = 'Draft' ORDER BY id DESC LIMIT 1") as any;
    if (!mps) return res.status(400).json({ error: 'No active Draft MPS found' });

    const monthlyData = await dbAll(
      'SELECT fmd.*, fb.product_id, fb.conversion_rate FROM forecast_monthly_data fmd JOIN forecast_brands fb ON fmd.brand_id = fb.id WHERE fmd.year = ? AND fmd.forecast_qty > 0 AND fb.product_id IS NOT NULL',
      [year]
    ) as any[];

    let matched = 0;
    let createdDetails = 0;
    let updatedWeeks = 0;

    // group by product_id
    const productMap: Record<number, any[]> = {};
    for (const md of monthlyData) {
      if (!productMap[md.product_id]) productMap[md.product_id] = [];
      productMap[md.product_id].push(md);
    }

    for (const [productId, entries] of Object.entries(productMap)) {
      // find or create mps_detail
      let detail = await dbGet(
        'SELECT id FROM mps_details WHERE mps_header_id = ? AND product_id = ?',
        [mps.id, productId]
      ) as any;

      if (!detail) {
        const result = await dbRun(
          'INSERT INTO mps_details (mps_header_id, product_id) VALUES (?, ?)',
          [mps.id, productId]
        );
        detail = { id: result.insertId };
        createdDetails++;
      }
      matched++;

      // distribute each month entry to its weeks
      for (const md of entries) {
        const weeksInMonth = getWeeksInMonth(md.month, year);
        const rate = Number(md.conversion_rate || 1);
        const weeklyForecast = (Number(md.forecast_qty) * rate) / weeksInMonth.length;

        for (const w of weeksInMonth) {
          const existing = await dbGet(
            'SELECT id FROM mps_week_data WHERE mps_detail_id = ? AND week_number = ? AND year = ?',
            [detail.id, w, year]
          ) as any;

          if (existing) {
            await dbRun(
              'UPDATE mps_week_data SET forecast_qty = ? WHERE id = ?',
              [weeklyForecast.toFixed(2), existing.id]
            );
          } else {
            await dbRun(
              'INSERT INTO mps_week_data (mps_detail_id, week_number, year, forecast_qty, so_qty, start_process_qty, fg_qty, production_qty) VALUES (?, ?, ?, ?, 0, 0, 0, 0)',
              [detail.id, w, year, weeklyForecast.toFixed(2)]
            );
          }
          updatedWeeks++;
        }
      }
    }

    res.json({
      message: `Forecast pushed to MPS ${mps.mps_number}`,
      mps_id: mps.id,
      mps_number: mps.mps_number,
      products_matched: matched,
      products_created: createdDetails,
      weeks_updated: updatedWeeks
    });
  } catch (error) {
    console.error('Error pushing monthly forecast to MPS:', error);
    res.status(500).json({ error: 'Failed to push forecast to MPS' });
  }
});

// GET /capacity-planning - Capacity load from MPS production plan
router.get('/capacity-planning', authMiddleware, async (req: Request, res: Response) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth() + 1;

    // get all active line processes
    const lines = await dbAll(`
      SELECT lp.id, lp.name, lp.code, lp.capacity_per_hour, lp.capacity_unit,
        lp.working_hours_per_week, lp.shifts_per_day, lp.hours_per_shift, lp.machine_type
      FROM line_processes lp WHERE lp.active = 1 ORDER BY lp.name
    `) as any[];

    // get confirmed MPS for requested period
    const mpsHeaders = await dbAll(
      "SELECT id FROM mps_headers WHERE period_year = ? AND period_month = ? AND status = 'Confirmed'",
      [year, month]
    ) as any[];

    const headerIds = mpsHeaders.map((h: any) => h.id);

    // compute required hours per line from MPS production data
    const lineResults = [];
    for (const line of lines) {
      const weeklyHours = Number(line.working_hours_per_week || 40);
      const availableHours = weeklyHours * 4; // monthly (4 weeks)

      let requiredHours = 0;
      if (headerIds.length > 0) {
        const placeholders = headerIds.map(() => '?').join(',');
        // get all products assigned to this line with their total production_qty
        const prodData = await dbAll(`
          SELECT SUM(mw.production_qty) as total_qty
          FROM mps_details md
          JOIN mps_week_data mw ON mw.mps_detail_id = md.id
          JOIN line_process_products lpp ON lpp.product_id = md.product_id AND lpp.line_process_id = ?
          WHERE md.mps_header_id IN (${placeholders})
        `, [line.id, ...headerIds]) as any[];

        const totalQty = Number(prodData[0]?.total_qty || 0);
        const capPerHour = Number(line.capacity_per_hour || 0);
        requiredHours = capPerHour > 0 ? totalQty / capPerHour : 0;
      }

      const utilization = availableHours > 0 ? Math.round((requiredHours / availableHours) * 1000) / 10 : 0;

      lineResults.push({
        id: line.id,
        name: line.name,
        code: line.code,
        machine_type: line.machine_type,
        capacity_per_hour: Number(line.capacity_per_hour || 0),
        available_hours: Math.round(availableHours * 10) / 10,
        required_hours: Math.round(requiredHours * 10) / 10,
        utilization,
      });
    }

    const totalLines = lineResults.length;
    const overloaded = lineResults.filter(l => l.utilization > 100).length;
    const avgUtil = totalLines > 0
      ? Math.round(lineResults.reduce((s, l) => s + l.utilization, 0) / totalLines * 10) / 10
      : 0;

    res.json({ data: { lines: lineResults, summary: { total: totalLines, overloaded, avg_utilization: avgUtil } } });
  } catch (error) {
    console.error('Error fetching capacity planning:', error);
    res.status(500).json({ error: 'Failed to fetch capacity planning data' });
  }
});

// GET /stock-reports - PPIC stock reports from actual data
router.get('/stock-reports', authMiddleware, async (req: Request, res: Response) => {
  try {
    const tab = req.query.tab as string || 'onhand';

    let data: any[] = [];

    if (tab === 'onhand' || tab === 'monthly') {
      // inventory on hand
      data = await dbAll(`
        SELECT p.id as product_id, p.sku, p.name as item,
          COALESCE(SUM(inv.quantity), 0) as qty,
          u.name as uom
        FROM products p
        LEFT JOIN inventory_stocks inv ON inv.product_id = p.id
        LEFT JOIN uom u ON p.unit_of_measure_id = u.id
        WHERE p.active = 1
        GROUP BY p.id, p.sku, p.name, u.name
        HAVING qty > 0
        ORDER BY p.name
      `) as any[];
    } else if (tab === 'wip') {
      // work in progress
      data = await dbAll(`
        SELECT p.id as product_id, p.sku, p.name as item,
          COALESCE(SUM(wo.quantity), 0) as qty,
          u.name as uom,
          COUNT(wo.id) as wo_count
        FROM work_orders wo
        JOIN products p ON wo.product_id = p.id
        LEFT JOIN uom u ON p.unit_of_measure_id = u.id
        WHERE wo.status IN ('IN_PROGRESS', 'RELEASED')
        GROUP BY p.id, p.sku, p.name, u.name
        ORDER BY p.name
      `) as any[];
    } else if (tab === 'used') {
      // materials issued to production
      data = await dbAll(`
        SELECT p.id as product_id, p.sku, p.name as item,
          COALESCE(SUM(wmi.quantity_issued), 0) as qty,
          u.name as uom
        FROM wo_material_issues wmi
        JOIN products p ON wmi.product_id = p.id
        LEFT JOIN uom u ON p.unit_of_measure_id = u.id
        GROUP BY p.id, p.sku, p.name, u.name
        HAVING qty > 0
        ORDER BY p.name
      `) as any[];
    }

    res.json({ data });
  } catch (error) {
    console.error('Error fetching stock reports:', error);
    res.status(500).json({ error: 'Failed to fetch stock reports' });
  }
});

export default router;
