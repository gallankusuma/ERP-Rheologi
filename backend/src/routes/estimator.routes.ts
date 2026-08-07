import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { requirePermission } from '../middleware/permission';
import { dbAll, dbGet, dbRun } from '../config/database';

const router = Router();

// ============================================
// MASTER DATA ENDPOINTS
// ============================================

// Get all disciplines
router.get('/disciplines', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (_req: Request, res: Response) => {
  try {
    const disciplines = await dbAll(
      `SELECT id, code, name, order_no, is_active 
       FROM master_disciplines 
       WHERE is_active = 1
       ORDER BY order_no ASC`
    );
    res.json(disciplines);
  } catch (error) {
    console.error('Error fetching disciplines:', error);
    res.status(500).json({ error: 'Failed to fetch disciplines' });
  }
});

// Get sub-disciplines by discipline
router.get('/disciplines/:disciplineId/sub-disciplines', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (req: Request, res: Response) => {
  try {
    const subDisciplines = await dbAll(
      `SELECT id, discipline_id, code, name, order_no, is_active
       FROM master_sub_disciplines
       WHERE discipline_id = ? AND is_active = 1
       ORDER BY order_no ASC`,
      [req.params.disciplineId]
    );
    res.json(subDisciplines);
  } catch (error) {
    console.error('Error fetching sub-disciplines:', error);
    res.status(500).json({ error: 'Failed to fetch sub-disciplines' });
  }
});

// Create sub-discipline
router.post('/disciplines/:disciplineId/sub-disciplines', authMiddleware, requirePermission('estimator.ahsp', 'create'), async (req: Request, res: Response) => {
  try {
    const { disciplineId } = req.params;
    const { code, name } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'code and name are required' });
    }

    // Check if code exists within discipline
    const existing = await dbGet(
      'SELECT id FROM master_sub_disciplines WHERE code = ? AND discipline_id = ?',
      [code, disciplineId]
    );

    if (existing) {
      return res.status(409).json({ error: 'Sub-discipline code already exists in this discipline' });
    }

    // Get max order_no
    const maxOrder = await dbGet(
      'SELECT MAX(order_no) as maxOrderId FROM master_sub_disciplines WHERE discipline_id = ?',
      [disciplineId]
    );
    const nextOrder = (maxOrder?.maxOrderId || 0) + 1;

    const result = await dbRun(
      'INSERT INTO master_sub_disciplines (discipline_id, code, name, order_no, is_active) VALUES (?, ?, ?, ?, 1)',
      [disciplineId, code, name, nextOrder]
    );

    res.status(201).json({ id: result.insertId, code, name, discipline_id: Number(disciplineId) });
  } catch (error) {
    console.error('Error creating sub-discipline:', error);
    res.status(500).json({ error: 'Failed to create sub-discipline' });
  }
});

// Get all labor
router.get('/masters/labor', authMiddleware, requirePermission('estimator.masters', 'view'), async (_req: Request, res: Response) => {
  try {
    const labor = await dbAll(
      `SELECT id, code, name, satuan, harga, is_active
       FROM master_labor
       WHERE is_active = 1
       ORDER BY name ASC`
    );
    res.json(labor);
  } catch (error) {
    console.error('Error fetching labor:', error);
    res.status(500).json({ error: 'Failed to fetch labor' });
  }
});

// Create labor
router.post('/masters/labor', authMiddleware, requirePermission('estimator.masters', 'create'), async (req: Request, res: Response) => {
  try {
    const { code, name, satuan, harga } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_labor WHERE code = ?', [code]);
    if (existing) {
      return res.status(409).json({ error: 'Labor code already exists' });
    }

    const result = await dbRun(
      'INSERT INTO master_labor (code, name, satuan, harga, is_active) VALUES (?, ?, ?, ?, 1)',
      [code, name, satuan, harga || 0]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error creating labor:', error);
    res.status(500).json({ error: 'Failed to create labor' });
  }
});

// Update labor
router.put('/masters/labor/:id', authMiddleware, requirePermission('estimator.masters', 'update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, satuan, harga } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_labor WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Labor not found' });
    }

    const duplicate = await dbGet('SELECT id FROM master_labor WHERE code = ? AND id != ?', [code, id]);
    if (duplicate) {
      return res.status(409).json({ error: 'Labor code already exists' });
    }

    await dbRun(
      'UPDATE master_labor SET code = ?, name = ?, satuan = ?, harga = ? WHERE id = ?',
      [code, name, satuan, harga || 0, id]
    );

    res.json({ message: 'Labor updated' });
  } catch (error) {
    console.error('Error updating labor:', error);
    res.status(500).json({ error: 'Failed to update labor' });
  }
});

// Delete labor (soft delete)
router.delete('/masters/labor/:id', authMiddleware, requirePermission('estimator.masters', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet('SELECT id FROM master_labor WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Labor not found' });
    }

    await dbRun('UPDATE master_labor SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Labor deleted' });
  } catch (error) {
    console.error('Error deleting labor:', error);
    res.status(500).json({ error: 'Failed to delete labor' });
  }
});

// Get all materials
router.get('/masters/materials', authMiddleware, requirePermission('estimator.masters', 'view'), async (_req: Request, res: Response) => {
  try {
    const materials = await dbAll(
      `SELECT m.id, m.code, m.jenis, m.name, m.satuan, m.harga, m.vendor_id, v.name as vendor_name, m.is_active
       FROM master_materials m
       LEFT JOIN vendors v ON m.vendor_id = v.id
       WHERE m.is_active = 1
       ORDER BY m.jenis ASC, m.name ASC`
    );
    res.json(materials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Create material
router.post('/masters/materials', authMiddleware, requirePermission('estimator.masters', 'create'), async (req: Request, res: Response) => {
  try {
    const { code, jenis, name, satuan, harga, vendor_id } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_materials WHERE code = ?', [code]);
    if (existing) {
      return res.status(409).json({ error: 'Material code already exists' });
    }

    const result = await dbRun(
      'INSERT INTO master_materials (code, jenis, name, satuan, harga, vendor_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [code, jenis || null, name, satuan, harga || 0, vendor_id || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error creating material:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material
router.put('/masters/materials/:id', authMiddleware, requirePermission('estimator.masters', 'update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, jenis, name, satuan, harga, vendor_id } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_materials WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const duplicate = await dbGet('SELECT id FROM master_materials WHERE code = ? AND id != ?', [code, id]);
    if (duplicate) {
      return res.status(409).json({ error: 'Material code already exists' });
    }

    await dbRun(
      'UPDATE master_materials SET code = ?, jenis = ?, name = ?, satuan = ?, harga = ?, vendor_id = ? WHERE id = ?',
      [code, jenis || null, name, satuan, harga || 0, vendor_id || null, id]
    );

    res.json({ message: 'Material updated' });
  } catch (error) {
    console.error('Error updating material:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Delete material (soft delete)
router.delete('/masters/materials/:id', authMiddleware, requirePermission('estimator.masters', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet('SELECT id FROM master_materials WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Material not found' });
    }

    await dbRun('UPDATE master_materials SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Material deleted' });
  } catch (error) {
    console.error('Error deleting material:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// Get all equipment
router.get('/masters/equipment', authMiddleware, requirePermission('estimator.masters', 'view'), async (_req: Request, res: Response) => {
  try {
    const equipment = await dbAll(
      `SELECT e.id, e.code, e.name, e.satuan, e.harga, e.vendor_id, v.name as vendor_name, e.is_active
       FROM master_equipment e
       LEFT JOIN vendors v ON e.vendor_id = v.id
       WHERE e.is_active = 1
       ORDER BY e.name ASC`
    );
    res.json(equipment);
  } catch (error) {
    console.error('Error fetching equipment:', error);
    res.status(500).json({ error: 'Failed to fetch equipment' });
  }
});

// Create equipment
router.post('/masters/equipment', authMiddleware, requirePermission('estimator.masters', 'create'), async (req: Request, res: Response) => {
  try {
    const { code, name, satuan, harga, vendor_id } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_equipment WHERE code = ?', [code]);
    if (existing) {
      return res.status(409).json({ error: 'Equipment code already exists' });
    }

    const result = await dbRun(
      'INSERT INTO master_equipment (code, name, satuan, harga, vendor_id, is_active) VALUES (?, ?, ?, ?, ?, 1)',
      [code, name, satuan, harga || 0, vendor_id || null]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    console.error('Error creating equipment:', error);
    res.status(500).json({ error: 'Failed to create equipment' });
  }
});

// Update equipment
router.put('/masters/equipment/:id', authMiddleware, requirePermission('estimator.masters', 'update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { code, name, satuan, harga, vendor_id } = req.body;

    if (!code || !name || !satuan) {
      return res.status(400).json({ error: 'code, name, and satuan are required' });
    }

    const existing = await dbGet('SELECT id FROM master_equipment WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    const duplicate = await dbGet('SELECT id FROM master_equipment WHERE code = ? AND id != ?', [code, id]);
    if (duplicate) {
      return res.status(409).json({ error: 'Equipment code already exists' });
    }

    await dbRun(
      'UPDATE master_equipment SET code = ?, name = ?, satuan = ?, harga = ?, vendor_id = ? WHERE id = ?',
      [code, name, satuan, harga || 0, vendor_id || null, id]
    );

    res.json({ message: 'Equipment updated' });
  } catch (error) {
    console.error('Error updating equipment:', error);
    res.status(500).json({ error: 'Failed to update equipment' });
  }
});

// Delete equipment (soft delete)
router.delete('/masters/equipment/:id', authMiddleware, requirePermission('estimator.masters', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await dbGet('SELECT id FROM master_equipment WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Equipment not found' });
    }

    await dbRun('UPDATE master_equipment SET is_active = 0 WHERE id = ?', [id]);
    res.json({ message: 'Equipment deleted' });
  } catch (error) {
    console.error('Error deleting equipment:', error);
    res.status(500).json({ error: 'Failed to delete equipment' });
  }
});

// ============================================
// AHSP ENDPOINTS
// ============================================

// Get next AHSP code
router.get('/ahsp/next-code', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (req: Request, res: Response) => {
  try {
    const { sub_discipline_id, discipline_id } = req.query;
    
    // Base query to find the last code
    let query = `
      SELECT h.kode 
      FROM ahsp_headers h
      LEFT JOIN ahsp_sub_discipline_map m ON h.id = m.ahsp_id
      WHERE h.status != 'inactive'
    `;
    
    const params: any[] = [];

    if (sub_discipline_id) {
      query += ` AND m.sub_discipline_id = ?`;
      params.push(sub_discipline_id);
    } else if (discipline_id) {
      query += ` AND h.discipline_id = ?`;
      params.push(discipline_id);
    }

    query += ` ORDER BY h.id DESC LIMIT 1`;

    const last = await dbGet(query, params);
    
    if (!last || !last.kode) {
      return res.json({ nextCode: '' });
    }

    // Simple increment logic: look for the last number and increment it
    const parts = last.kode.split('.');
    const lastPart = parts[parts.length - 1];
    
    if (!isNaN(parseInt(lastPart))) {
      parts[parts.length - 1] = (parseInt(lastPart) + 1).toString();
      return res.json({ nextCode: parts.join('.') });
    }

    res.json({ nextCode: last.kode });
  } catch (error) {
    console.error('Error generating next code:', error);
    res.status(500).json({ error: 'Failed to generate next code' });
  }
});

// Delete AHSP (Soft Delete)
router.delete('/ahsp/:id', authMiddleware, requirePermission('estimator.ahsp', 'delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    console.log(`Attempting to delete AHSP with id: ${id}`);
    await dbRun("UPDATE ahsp_headers SET status = 'inactive' WHERE id = ?", [id]);
    console.log(`AHSP ${id} deleted successfully`);
    res.json({ message: 'AHSP deleted successfully' });
  } catch (error) {
    console.error('Error deleting AHSP:', error);
    res.status(500).json({ error: 'Failed to delete AHSP' });
  }
});

// Get AHSP list (with optional filtering by sub-discipline)
router.get('/ahsp', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (req: Request, res: Response) => {
  try {
    const { sub_discipline_id, search } = req.query;
    
    let query = `
      SELECT DISTINCT 
        h.id, h.kode, h.name, h.satuan, h.version, h.status, h.harga_satuan,
        d.name as discipline_name,
        s.name as sub_discipline_name
      FROM ahsp_headers h
      LEFT JOIN ahsp_sub_discipline_map m ON h.id = m.ahsp_id
      LEFT JOIN master_sub_disciplines s ON m.sub_discipline_id = s.id
      LEFT JOIN master_disciplines d ON s.discipline_id = d.id
    `;
    
    const params: any[] = [];
    const conditions: string[] = [];
    
    if (sub_discipline_id) {
      conditions.push('m.sub_discipline_id = ?');
      params.push(sub_discipline_id);
    }
    
    conditions.push("h.status = 'active'");
    
    if (search) {
      conditions.push('(h.kode LIKE ? OR h.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY h.kode ASC`;
    
    const ahsp = await dbAll(query, params);
    res.json(ahsp);
  } catch (error) {
    console.error('Error fetching AHSP:', error);
    res.status(500).json({ error: 'Failed to fetch AHSP' });
  }
});

// Get AHSP detail with items breakdown
router.get('/ahsp/:id', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (req: Request, res: Response) => {
  try {
    const ahsp = await dbGet(
      `SELECT h.*, sdm.sub_discipline_id
       FROM ahsp_headers h
       LEFT JOIN ahsp_sub_discipline_map sdm ON h.id = sdm.ahsp_id
       WHERE h.id = ?`,
      [req.params.id]
    );
    
    if (!ahsp) {
      return res.status(404).json({ error: 'AHSP not found' });
    }
    
    const items = await dbAll(
      `SELECT * FROM ahsp_items WHERE ahsp_id = ? ORDER BY section ASC, id ASC`,
      [req.params.id]
    );
    
    res.json({ ...ahsp, items });
  } catch (error) {
    console.error('Error fetching AHSP detail:', error);
    res.status(500).json({ error: 'Failed to fetch AHSP detail' });
  }
});

// Create AHSP
router.post('/ahsp', authMiddleware, requirePermission('estimator.ahsp', 'create'), async (req: Request, res: Response) => {
  try {
    const { kode, name, satuan, version, status, items, discipline_id, sub_discipline_id } = req.body;
    
    if (!kode || !name || !satuan) {
      return res.status(400).json({ error: 'kode, name, and satuan are required' });
    }
    
    // Insert header
    const result = await dbRun(
      `INSERT INTO ahsp_headers (kode, name, satuan, version, status, discipline_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [kode, name, satuan, version || '2024', status || 'draft', discipline_id || 1]
    );
    
    const ahspId = result.insertId;

    // Insert sub-discipline mapping
    if (sub_discipline_id) {
      await dbRun(
        'INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id) VALUES (?, ?)',
        [ahspId, sub_discipline_id]
      );
    }
    
    // Items and Calculation
    let hargaTenaga = 0;
    let hargaBahan = 0;
    let hargaAlat = 0;

    // Insert items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const jumlahHarga = (item.koefisien || 0) * (item.resource_harga || 0);
        
        await dbRun(
          `INSERT INTO ahsp_items (ahsp_id, section, resource_type, resource_id, koefisien, resource_name, resource_satuan, resource_harga, jumlah_harga)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ahspId, 
            item.section, 
            item.resource_type || 'material', 
            item.resource_id || 0, 
            item.koefisien || 0, 
            item.resource_name, 
            item.resource_satuan, 
            item.resource_harga || 0,
            jumlahHarga
          ]
        );

        if (item.section === 'A') hargaTenaga += jumlahHarga;
        else if (item.section === 'B') hargaBahan += jumlahHarga;
        else if (item.section === 'C') hargaAlat += jumlahHarga;
      }
    }

    // Update Header Totals
    const hargaLangsung = hargaTenaga + hargaBahan + hargaAlat;
    const overheadProfit = hargaLangsung * 0.1;
    const hargaSatuan = hargaLangsung + overheadProfit;
    
    await dbRun(
      `UPDATE ahsp_headers
       SET harga_tenaga = ?, harga_bahan = ?, harga_alat = ?, 
           harga_langsung = ?, overhead_profit = ?, harga_satuan = ?
       WHERE id = ?`,
      [hargaTenaga, hargaBahan, hargaAlat, hargaLangsung, overheadProfit, hargaSatuan, ahspId]
    );
    
    res.status(201).json({ message: 'AHSP created', id: ahspId });
  } catch (error) {
    console.error('Error creating AHSP:', error);
    res.status(500).json({ error: 'Failed to create AHSP' });
  }
});

// Update AHSP
router.put('/ahsp/:id', authMiddleware, requirePermission('estimator.ahsp', 'update'), async (req: Request, res: Response) => {
  try {
    const ahspId = req.params.id;
    const { kode, name, satuan, version, status, discipline_id, sub_discipline_id, items } = req.body;
    
    // Check if AHSP exists
    const existing = await dbGet('SELECT id FROM ahsp_headers WHERE id = ?', [ahspId]);
    if (!existing) {
      return res.status(404).json({ error: 'AHSP not found' });
    }
    
    // Update header
    await dbRun(
      `UPDATE ahsp_headers 
       SET kode = ?, name = ?, satuan = ?, version = ?, status = ?, discipline_id = ?
       WHERE id = ?`,
      [kode, name, satuan, version || '2024', status || 'active', discipline_id || 1, ahspId]
    );
    
    // Update sub-discipline mapping
    // Delete old mapping
    await dbRun('DELETE FROM ahsp_sub_discipline_map WHERE ahsp_id = ?', [ahspId]);
    
    // Insert new mapping if sub_discipline_id provided
    if (sub_discipline_id) {
      await dbRun(
        'INSERT INTO ahsp_sub_discipline_map (ahsp_id, sub_discipline_id) VALUES (?, ?)',
        [ahspId, sub_discipline_id]
      );
    }
    
    // Delete old items
    await dbRun('DELETE FROM ahsp_items WHERE ahsp_id = ?', [ahspId]);
    
    // Insert new items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        const jumlahHarga = (item.koefisien || 0) * (item.resource_harga || 0);
        await dbRun(
          `INSERT INTO ahsp_items (ahsp_id, section, resource_type, resource_id, koefisien, resource_name, resource_satuan, resource_harga, jumlah_harga)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            ahspId, 
            item.section, 
            item.resource_type || 'material', 
            item.resource_id || 0, 
            item.koefisien || 0, 
            item.resource_name, 
            item.resource_satuan, 
            item.resource_harga || 0,
            jumlahHarga
          ]
        );
      }
    }
    
    // Recalculate totals
    const allItems = await dbAll(
      'SELECT section, koefisien, resource_harga FROM ahsp_items WHERE ahsp_id = ?',
      [ahspId]
    );
    
    let hargaTenaga = 0;
    let hargaBahan = 0;
    let hargaAlat = 0;
    
    allItems.forEach((item: any) => {
      const jumlah = parseFloat(item.koefisien) * parseFloat(item.resource_harga);
      if (item.section === 'A') hargaTenaga += jumlah;
      else if (item.section === 'B') hargaBahan += jumlah;
      else if (item.section === 'C') hargaAlat += jumlah;
    });
    
    const hargaLangsung = hargaTenaga + hargaBahan + hargaAlat;
    const overheadProfit = hargaLangsung * 0.1;
    const hargaSatuan = hargaLangsung + overheadProfit;
    
    await dbRun(
      `UPDATE ahsp_headers
       SET harga_tenaga = ?, harga_bahan = ?, harga_alat = ?, 
           harga_langsung = ?, overhead_profit = ?, harga_satuan = ?
       WHERE id = ?`,
      [hargaTenaga, hargaBahan, hargaAlat, hargaLangsung, overheadProfit, hargaSatuan, ahspId]
    );
    
    res.json({ message: 'AHSP updated successfully', id: ahspId });
  } catch (error) {
    console.error('Error updating AHSP:', error);
    res.status(500).json({ error: 'Failed to update AHSP' });
  }
});

// Calculate AHSP unit price (recalculate from items)
router.post('/ahsp/:id/calculate', authMiddleware, requirePermission('estimator.ahsp', 'view'), async (req: Request, res: Response) => {
  try {
    const ahspId = req.params.id;
    
    // Get all items
    const items = await dbAll(
      `SELECT section, koefisien, resource_harga FROM ahsp_items WHERE ahsp_id = ?`,
      [ahspId]
    );
    
    let harga_tenaga = 0;
    let harga_bahan = 0;
    let harga_alat = 0;
    
    items.forEach((item: any) => {
      const jumlah = parseFloat(item.koefisien) * parseFloat(item.resource_harga);
      
      if (item.section === 'A') harga_tenaga += jumlah;
      else if (item.section === 'B') harga_bahan += jumlah;
      else if (item.section === 'C') harga_alat += jumlah;
    });
    
    const harga_langsung = harga_tenaga + harga_bahan + harga_alat; // D
    const overhead_profit = harga_langsung * 0.10; // E = 10% of D
    const harga_satuan = harga_langsung + overhead_profit; // F = D + E
    
    // Update header
    await dbRun(
      `UPDATE ahsp_headers 
       SET harga_tenaga = ?, harga_bahan = ?, harga_alat = ?,
           harga_langsung = ?, overhead_profit = ?, harga_satuan = ?
       WHERE id = ?`,
      [harga_tenaga, harga_bahan, harga_alat, harga_langsung, overhead_profit, harga_satuan, ahspId]
    );
    
    res.json({
      message: 'AHSP calculated',
      calculation: {
        harga_tenaga,
        harga_bahan,
        harga_alat,
        harga_langsung,
        overhead_profit,
        harga_satuan
      }
    });
  } catch (error) {
    console.error('Error calculating AHSP:', error);
    res.status(500).json({ error: 'Failed to calculate AHSP' });
  }
});

// ============================================
// PROPOSAL ENDPOINTS
// ============================================

// Get all proposals
router.get('/proposals', authMiddleware, requirePermission('estimator.proposals', 'view'), async (_req: Request, res: Response) => {
  try {
    const proposals = await dbAll(
      `SELECT p.*, u.username as created_by_name
       FROM proposals p
       LEFT JOIN users u ON p.created_by = u.id
       ORDER BY p.created_at DESC`
    );
    res.json(proposals);
  } catch (error) {
    console.error('Error fetching proposals:', error);
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// Get proposal detail
router.get('/proposals/:id', authMiddleware, requirePermission('estimator.proposals', 'view'), async (req: Request, res: Response) => {
  try {
    const proposal = await dbGet(
      `SELECT p.*, u.username as created_by_name
       FROM proposals p
       LEFT JOIN users u ON p.created_by = u.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    res.json(proposal);
  } catch (error) {
    console.error('Error fetching proposal:', error);
    res.status(500).json({ error: 'Failed to fetch proposal' });
  }
});

// Get proposal items (grouped by discipline & sub-discipline)
router.get('/proposals/:id/items', authMiddleware, requirePermission('estimator.proposals', 'view'), async (req: Request, res: Response) => {
  try {
    const items = await dbAll(
      `SELECT 
        pi.*,
        d.code as discipline_code, d.name as discipline_name,
        sd.code as sub_discipline_code, sd.name as sub_discipline_name
       FROM proposal_items pi
       LEFT JOIN master_disciplines d ON pi.discipline_id = d.id
       LEFT JOIN master_sub_disciplines sd ON pi.sub_discipline_id = sd.id
       WHERE pi.proposal_id = ?
       ORDER BY pi.order_no ASC, pi.id ASC`,
      [req.params.id]
    );
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching proposal items:', error);
    res.status(500).json({ error: 'Failed to fetch proposal items' });
  }
});

// Create proposal
router.post('/proposals', authMiddleware, requirePermission('estimator.proposals', 'create'), async (req: Request, res: Response) => {
  try {
    const { project_name, client, client_id, lokasi, revision, proposal_type, design_params, template_sections } = req.body;
    const userId = (req as any).user?.user_id || 1;
    
    if (!project_name) {
      return res.status(400).json({ error: 'project_name is required' });
    }
    
    // Generate proposal number
    const year = new Date().getFullYear();
    const count = await dbGet(`SELECT COUNT(*) as total FROM proposals WHERE YEAR(created_at) = ?`, [year]);
    const proposalNumber = `PROP/${year}/${String((count as any).total + 1).padStart(4, '0')}`;
    
    const result = await dbRun(
      `INSERT INTO proposals (proposal_number, project_name, client, client_id, lokasi, revision, proposal_type, design_params, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`,
      [proposalNumber, project_name, client || null, client_id || null, lokasi || null, revision || 'Rev-0', 
       proposal_type || null, design_params ? JSON.stringify(design_params) : null, userId]
    );
    
    const proposalId = result.insertId;
    
    // Auto-create section headers and sub-items from template
    if (template_sections && Array.isArray(template_sections) && template_sections.length > 0) {
      // Map proposal_type to AHSP code prefix
      const typePrefix: Record<string, string> = {
        civil_building: 'CB', civil_structure: 'CS', piping: 'PP',
        electrical: 'EL', mechanical: 'ME'
      };
      const prefix = typePrefix[proposal_type as string] || '';

      // Pre-fetch all template AHSP entries for this work type
      let ahspLookup: Record<string, any> = {};
      if (prefix) {
        const ahspRows = await dbAll(
          `SELECT id, kode, name, satuan, harga_satuan FROM ahsp_headers WHERE kode LIKE ? AND status='active'`,
          [`${prefix}.%`]
        );
        for (const row of ahspRows as any[]) {
          ahspLookup[row.name] = row;
        }
      }

      let orderNo = 1;
      for (let i = 0; i < template_sections.length; i++) {
        const section = template_sections[i];
        // Insert section header row
        await dbRun(
          `INSERT INTO proposal_items 
           (proposal_id, ahsp_code_snapshot, ahsp_name_snapshot, unit_snapshot, unit_price_snapshot,
            description, qty, total_price, order_no, section_label, is_section, section_order)
           VALUES (?, ?, ?, '', 0, ?, 0, 0, ?, ?, 1, ?)`,
          [proposalId, section.code || '', section.name, section.description || null, orderNo, section.name, i + 1]
        );
        orderNo++;

        // Insert sub-items (children) as regular proposal items
        if (section.children && Array.isArray(section.children)) {
          for (const child of section.children) {
            // Try auto-assign AHSP by exact name match
            const matched = ahspLookup[child.name];
            const ahspId = matched ? matched.id : null;
            const ahspCode = matched ? matched.kode : `${section.code}.${child.num}`.replace(/\.$/, '');
            const ahspName = matched ? matched.name : child.name;
            const ahspUnit = matched ? matched.satuan : '';
            const ahspPrice = matched ? parseFloat(matched.harga_satuan) || 0 : 0;

            await dbRun(
              `INSERT INTO proposal_items 
               (proposal_id, ahsp_id, ahsp_code_snapshot, ahsp_name_snapshot, unit_snapshot, unit_price_snapshot,
                description, qty, total_price, order_no, section_label, is_section, section_order)
               VALUES (?, ?, ?, ?, ?, ?, NULL, 0, 0, ?, NULL, 0, ?)`,
              [proposalId, ahspId, ahspCode, ahspName, ahspUnit, ahspPrice, orderNo, i + 1]
            );
            orderNo++;
          }
        }
      }
    }
    
    res.status(201).json({ 
      message: 'Proposal created', 
      id: proposalId,
      proposal_number: proposalNumber 
    });
  } catch (error) {
    console.error('Error creating proposal:', error);
    res.status(500).json({ error: 'Failed to create proposal' });
  }
});

// Update proposal
router.put('/proposals/:id', authMiddleware, requirePermission('estimator.proposals', 'update'), async (req: Request, res: Response) => {
  try {
    const { project_name, client, client_id, lokasi, revision, status } = req.body;
    
    await dbRun(
      `UPDATE proposals
       SET project_name = ?, client = ?, client_id = ?, lokasi = ?, revision = ?, status = ?
       WHERE id = ?`,
      [project_name, client, client_id || null, lokasi, revision, status, req.params.id]
    );
    
    res.json({ message: 'Proposal updated' });
  } catch (error) {
    console.error('Error updating proposal:', error);
    res.status(500).json({ error: 'Failed to update proposal' });
  }
});

// Delete proposal
router.delete('/proposals/:id', authMiddleware, requirePermission('estimator.proposals', 'delete'), async (req: Request, res: Response) => {
  try {
    await dbRun('DELETE FROM proposals WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proposal deleted' });
  } catch (error) {
    console.error('Error deleting proposal:', error);
    res.status(500).json({ error: 'Failed to delete proposal' });
  }
});

// ============================================
// PROPOSAL ITEMS ENDPOINTS
// ============================================

// Add item to proposal
router.post('/proposals/:proposalId/items', authMiddleware, requirePermission('estimator.proposals', 'create'), async (req: Request, res: Response) => {
  try {
    const { ahsp_id, qty, discipline_id, sub_discipline_id } = req.body;
    const proposalId = req.params.proposalId;
    
    if (!ahsp_id) {
      return res.status(400).json({ error: 'ahsp_id is required' });
    }
    
    // Get AHSP data for snapshot
    const ahsp = await dbGet(
      `SELECT kode, name, satuan, harga_satuan FROM ahsp_headers WHERE id = ?`,
      [ahsp_id]
    );
    
    if (!ahsp) {
      return res.status(404).json({ error: 'AHSP not found' });
    }
    
    // Get next order_no
    const lastOrder = await dbGet(
      `SELECT MAX(order_no) as max_order FROM proposal_items WHERE proposal_id = ?`,
      [proposalId]
    );
    const orderNo = ((lastOrder as any)?.max_order || 0) + 1;
    
    const qtyValue = qty || 0;
    const unitPrice = parseFloat(ahsp.harga_satuan as any) || 0;
    const totalPrice = qtyValue * unitPrice;
    
    const result = await dbRun(
      `INSERT INTO proposal_items 
       (proposal_id, discipline_id, sub_discipline_id, ahsp_id, 
        ahsp_code_snapshot, ahsp_name_snapshot, unit_snapshot, unit_price_snapshot,
        qty, total_price, order_no)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [proposalId, discipline_id, sub_discipline_id, ahsp_id,
       ahsp.kode, ahsp.name, ahsp.satuan, unitPrice,
       qtyValue, totalPrice, orderNo]
    );
    
    // Recalculate proposal totals
    await recalculateProposal(proposalId as string);

    res.status(201).json({ message: 'Item added', id: result.insertId });
  } catch (error) {
    console.error('Error adding proposal item:', error);
    res.status(500).json({ error: 'Failed to add proposal item' });
  }
});

// Update proposal item (qty)
router.put('/proposals/:proposalId/items/:itemId', authMiddleware, requirePermission('estimator.proposals', 'update'), async (req: Request, res: Response) => {
  try {
    const { qty, description, ahsp_id } = req.body;
    const { proposalId, itemId } = req.params;
    
    // Get current item to recalculate
    const item = await dbGet(
      `SELECT unit_price_snapshot FROM proposal_items WHERE id = ?`,
      [itemId]
    );
    
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    // Build update query dynamically
    const updates: string[] = [];
    const values: any[] = [];

    // Assign AHSP to an existing item (from wizard sub-items)
    if (ahsp_id !== undefined) {
      const ahsp: any = await dbGet(
        `SELECT id, kode, name, satuan, harga_satuan FROM ahsp_headers WHERE id = ? AND status = 'active'`,
        [ahsp_id]
      );
      if (!ahsp) {
        return res.status(404).json({ error: 'AHSP not found' });
      }
      updates.push('ahsp_id = ?', 'ahsp_code_snapshot = ?', 'ahsp_name_snapshot = ?', 'unit_snapshot = ?', 'unit_price_snapshot = ?');
      values.push(ahsp.id, ahsp.kode, ahsp.name, ahsp.satuan, ahsp.harga_satuan);
      
      // Also recalculate total_price with new unit price
      const currentItem: any = await dbGet(`SELECT qty FROM proposal_items WHERE id = ?`, [itemId]);
      const currentQty = parseFloat(currentItem?.qty) || 0;
      updates.push('total_price = ?');
      values.push(currentQty * parseFloat(ahsp.harga_satuan));
    }
    
    if (qty !== undefined) {
      const qtyValue = parseFloat(qty) || 0;
      // Use new unit price if ahsp was also assigned, otherwise use existing
      let unitPrice: number;
      if (ahsp_id !== undefined) {
        const ahsp: any = await dbGet(`SELECT harga_satuan FROM ahsp_headers WHERE id = ?`, [ahsp_id]);
        unitPrice = parseFloat(ahsp?.harga_satuan) || 0;
      } else {
        unitPrice = parseFloat((item as any).unit_price_snapshot) || 0;
      }
      const totalPrice = qtyValue * unitPrice;
      updates.push('qty = ?', 'total_price = ?');
      values.push(qtyValue, totalPrice);
    }
    
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(itemId);
    
    await dbRun(
      `UPDATE proposal_items SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    
    // Recalculate proposal totals
    await recalculateProposal(proposalId as string);

    res.json({ message: 'Item updated' });
  } catch (error) {
    console.error('Error updating proposal item:', error);
    res.status(500).json({ error: 'Failed to update proposal item' });
  }
});

// Delete proposal item
router.delete('/proposals/:proposalId/items/:itemId', authMiddleware, requirePermission('estimator.proposals', 'delete'), async (req: Request, res: Response) => {
  try {
    const { proposalId, itemId } = req.params;
    
    await dbRun('DELETE FROM proposal_items WHERE id = ?', [itemId]);
    
    // Recalculate proposal totals
    await recalculateProposal(proposalId as string);

    res.json({ message: 'Item deleted' });
  } catch (error) {
    console.error('Error deleting proposal item:', error);
    res.status(500).json({ error: 'Failed to delete proposal item' });
  }
});

// Get proposal summary/calculations
router.get('/proposals/:id/summary', authMiddleware, requirePermission('estimator.proposals', 'view'), async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    
    // Get subtotals by discipline
    const disciplineTotals = await dbAll(
      `SELECT 
        d.id, d.code, d.name,
        SUM(pi.total_price) as total
       FROM proposal_items pi
       INNER JOIN master_disciplines d ON pi.discipline_id = d.id
       WHERE pi.proposal_id = ?
       GROUP BY d.id, d.code, d.name
       ORDER BY d.order_no ASC`,
      [proposalId]
    );
    
    // Get subtotals by sub-discipline
    const subDisciplineTotals = await dbAll(
      `SELECT 
        sd.id, sd.code, sd.name, sd.discipline_id,
        SUM(pi.total_price) as total
       FROM proposal_items pi
       INNER JOIN master_sub_disciplines sd ON pi.sub_discipline_id = sd.id
       WHERE pi.proposal_id = ?
       GROUP BY sd.id, sd.code, sd.name, sd.discipline_id
       ORDER BY sd.order_no ASC`,
      [proposalId]
    );
    
    // Get proposal totals
    const proposal = await dbGet(
      `SELECT direct_cost, overhead, risk_contingency, total_project
       FROM proposals WHERE id = ?`,
      [proposalId]
    );
    
    res.json({
      discipline_totals: disciplineTotals,
      sub_discipline_totals: subDisciplineTotals,
      proposal_totals: proposal
    });
  } catch (error) {
    console.error('Error fetching proposal summary:', error);
    res.status(500).json({ error: 'Failed to fetch proposal summary' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function recalculateProposal(proposalId: string | number) {
  try {
    // Calculate direct cost (sum of all items)
    const result = await dbGet(
      `SELECT COALESCE(SUM(total_price), 0) as direct_cost FROM proposal_items WHERE proposal_id = ?`,
      [proposalId]
    );
    
    const directCost = parseFloat((result as any)?.direct_cost || 0);
    const overhead = 0; // Can be set manually or calculated
    const riskContingency = 0; // Can be set manually or calculated
    const totalProject = directCost + overhead + riskContingency;
    
    await dbRun(
      `UPDATE proposals 
       SET direct_cost = ?, overhead = ?, risk_contingency = ?, total_project = ?
       WHERE id = ?`,
      [directCost, overhead, riskContingency, totalProject, proposalId]
    );
  } catch (error) {
    console.error('Error recalculating proposal:', error);
  }
}

// ============================================
// RAB (RENCANA ANGGARAN BIAYA) ENDPOINTS
// ============================================

// Get RAB Report Data (grouped by discipline and sub-discipline with calculations)
router.get('/proposals/:id/rab', authMiddleware, requirePermission('estimator.proposals', 'view'), async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;
    
    // Get proposal details
    const proposal = await dbGet(
      `SELECT * FROM proposals WHERE id = ?`,
      [proposalId]
    );
    
    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    
    // Get all items grouped and structured
    const items = await dbAll(
      `SELECT 
        pi.id,
        pi.order_no,
        pi.qty,
        pi.total_price,
        pi.ahsp_code_snapshot as ahsp_code,
        pi.ahsp_name_snapshot as ahsp_name,
        pi.unit_snapshot as unit,
        pi.unit_price_snapshot as unit_price,
        d.id as discipline_id,
        d.code as discipline_code,
        d.name as discipline_name,
        d.order_no as discipline_order,
        sd.id as sub_discipline_id,
        sd.code as sub_discipline_code,
        sd.name as sub_discipline_name,
        sd.order_no as sub_discipline_order
       FROM proposal_items pi
       LEFT JOIN master_disciplines d ON pi.discipline_id = d.id
       LEFT JOIN master_sub_disciplines sd ON pi.sub_discipline_id = sd.id
       WHERE pi.proposal_id = ?
       ORDER BY d.order_no ASC, sd.order_no ASC, pi.order_no ASC`,
      [proposalId]
    );
    
    // Structure data: discipline > sub-discipline > items
    const structuredData: any = {};
    let rowNumber = 1;
    
    items.forEach((item: any) => {
      const disciplineKey = item.discipline_id || 'unassigned';
      
      if (!structuredData[disciplineKey]) {
        structuredData[disciplineKey] = {
          id: item.discipline_id,
          code: item.discipline_code,
          name: item.discipline_name,
          order: item.discipline_order,
          subDisciplines: {},
          totalAmount: 0
        };
      }
      
      const subDisciplineKey = item.sub_discipline_id || 'unassigned';
      
      if (!structuredData[disciplineKey].subDisciplines[subDisciplineKey]) {
        structuredData[disciplineKey].subDisciplines[subDisciplineKey] = {
          id: item.sub_discipline_id,
          code: item.sub_discipline_code,
          name: item.sub_discipline_name,
          order: item.sub_discipline_order,
          items: [],
          subtotal: 0
        };
      }
      
      structuredData[disciplineKey].subDisciplines[subDisciplineKey].items.push({
        rowNo: rowNumber++,
        ahspCode: item.ahsp_code,
        ahspName: item.ahsp_name,
        unit: item.unit,
        qty: item.qty,
        unitPrice: item.unit_price,
        totalPrice: item.total_price
      });
      
      structuredData[disciplineKey].subDisciplines[subDisciplineKey].subtotal += item.total_price || 0;
      structuredData[disciplineKey].totalAmount += item.total_price || 0;
    });
    
    // Convert to array format for easier frontend iteration
    const rabSections = Object.values(structuredData).map((discipline: any) => ({
      ...discipline,
      subDisciplines: Object.values(discipline.subDisciplines)
    })) as any[];
    
    // Calculate grand total
    const grandTotal = rabSections.reduce((sum, section) => sum + section.totalAmount, 0);
    
    res.json({
      proposal: {
        id: proposal.id,
        proposalNumber: proposal.proposal_number,
        projectName: proposal.project_name,
        client: proposal.client,
        lokasi: proposal.lokasi,
        revision: proposal.revision
      },
      sections: rabSections,
      summary: {
        directCost: proposal.direct_cost || 0,
        overhead: proposal.overhead || 0,
        riskContingency: proposal.risk_contingency || 0,
        totalProject: proposal.total_project || grandTotal
      }
    });
  } catch (error) {
    console.error('Error generating RAB report:', error);
    res.status(500).json({ error: 'Failed to generate RAB report' });
  }
});

// ============================================
// PROPOSAL STATUS TRANSITIONS
// draft → review → submitted → deal / no_deal
// ============================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['review'],
  review: ['draft', 'submitted'],
  submitted: ['review', 'deal', 'no_deal'],
  no_deal: ['draft'],  // can re-open as draft
  deal: [],            // final state
};

router.put('/proposals/:id/status', authMiddleware, requirePermission('estimator.proposals', 'update'), async (req: Request, res: Response) => {
  try {
    const { status: newStatus, notes } = req.body;
    const userId = (req as any).userId || 1;
    const proposalId = req.params.id;

    // Get current proposal
    const proposal = await dbGet(
      `SELECT p.*, c.id as resolved_client_id FROM proposals p LEFT JOIN clients c ON c.name COLLATE utf8mb4_unicode_ci = p.client COLLATE utf8mb4_unicode_ci WHERE p.id = ?`,
      [proposalId]
    ) as any;

    if (!proposal) {
      return res.status(404).json({ error: 'Proposal not found' });
    }

    // Validate transition
    const allowed = VALID_TRANSITIONS[proposal.status] || [];
    if (!allowed.includes(newStatus)) {
      return res.status(400).json({ 
        error: `Cannot change status from '${proposal.status}' to '${newStatus}'`,
        allowed_transitions: allowed
      });
    }

    // Build update fields
    const updates: string[] = ['status = ?'];
    const params: any[] = [newStatus];

    if (newStatus === 'review') {
      // no extra fields
    } else if (newStatus === 'submitted') {
      updates.push('submitted_at = NOW()');
    } else if (newStatus === 'deal') {
      updates.push('deal_at = NOW()');
      updates.push('approved_by = ?');
      updates.push('approved_at = NOW()');
      params.push(userId);
    }

    params.push(proposalId);
    await dbRun(`UPDATE proposals SET ${updates.join(', ')} WHERE id = ?`, params);

    let projectId = null;
    let prId = null;
    let prNumber_out = null;

    // If deal → auto-create project
    if (newStatus === 'deal') {
      const clientId = proposal.client_id || proposal.resolved_client_id;

      // Generate project number: PRJ-YYYY-XXXX
      const year = new Date().getFullYear();
      const countResult = await dbGet(
        `SELECT COUNT(*) as total FROM client_projects WHERE YEAR(created_at) = ?`,
        [year]
      ) as any;
      const seq = String((countResult?.total || 0) + 1).padStart(4, '0');
      const projectNumber = `PRJ-${year}-${seq}`;

      const result = await dbRun(
        `INSERT INTO client_projects (
          client_id, proposal_id, project_number, project_name, description,
          budget, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
        [
          clientId || null,
          proposalId,
          projectNumber,
          proposal.project_name,
          `Auto-created from proposal ${proposal.proposal_number}. Lokasi: ${proposal.lokasi || '-'}`,
          proposal.total_project || 0,
          userId
        ]
      );

      projectId = result.insertId;

      // Link back to proposal
      await dbRun('UPDATE proposals SET project_id = ? WHERE id = ?', [projectId, proposalId]);

      // === Auto-create Purchase Request from proposal materials ===
      try {
        // Get all proposal items with their AHSP ids
        const proposalItems = await dbAll(
          `SELECT pi.ahsp_id, pi.qty, pi.ahsp_name_snapshot, pi.unit_snapshot
           FROM proposal_items pi
           WHERE pi.proposal_id = ? AND pi.ahsp_id IS NOT NULL`,
          [proposalId]
        ) as any[];

        if (proposalItems.length > 0) {
          // Get all materials (section B) from the AHSPs used in this proposal
          const ahspIds = proposalItems.map((pi: any) => pi.ahsp_id);
          const placeholders = ahspIds.map(() => '?').join(',');
          const ahspMaterials = await dbAll(
            `SELECT ai.ahsp_id, ai.resource_id, ai.resource_name, ai.resource_satuan, 
                    ai.koefisien, ai.resource_harga
             FROM ahsp_items ai
             WHERE ai.ahsp_id IN (${placeholders}) AND ai.section = 'B'
             ORDER BY ai.resource_name`,
            ahspIds
          ) as any[];

          // Build a qty lookup: ahsp_id → proposal qty
          const qtyMap: Record<number, number> = {};
          for (const pi of proposalItems) {
            qtyMap[pi.ahsp_id] = (qtyMap[pi.ahsp_id] || 0) + Number(pi.qty);
          }

          // Aggregate materials: group by resource_id, sum (koefisien × proposal_qty)
          const materialMap: Record<number, { name: string; satuan: string; harga: number; totalQty: number }> = {};
          for (const mat of ahspMaterials) {
            const proposalQty = qtyMap[mat.ahsp_id] || 0;
            const neededQty = Number(mat.koefisien) * proposalQty;
            if (neededQty <= 0) continue;

            const rid = mat.resource_id;
            if (!materialMap[rid]) {
              materialMap[rid] = {
                name: mat.resource_name,
                satuan: mat.resource_satuan,
                harga: Number(mat.resource_harga) || 0,
                totalQty: 0
              };
            }
            materialMap[rid].totalQty += neededQty;
          }

          const materialList = Object.entries(materialMap).map(([rid, m]) => ({
            productId: null,
            productName: '',
            name: m.name,
            qty: Math.ceil(m.totalQty * 1000) / 1000, // round up to 3 decimals
            uom: m.satuan,
            specification: `Resource ID: ${rid}`,
            price: m.harga
          }));

          if (materialList.length > 0) {
            // Generate PR number
            const now = new Date();
            const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
            const rand = Math.floor(1000 + Math.random() * 9000);
            const prNumber = `PR-${datePart}-${rand}`;

            const estimatedTotal = materialList.reduce((sum, item) => sum + (item.qty * item.price), 0);

            const prResult = await dbRun(
              `INSERT INTO purchase_requests (pr_number, requestor_id, project_id, status, notes)
               VALUES (?, ?, ?, 'DRAFT', ?)`,
              [
                prNumber,
                userId,
                projectId,
                JSON.stringify({
                  noteText: `Auto-generated from proposal ${proposal.proposal_number} - ${proposal.project_name}`,
                  itemType: 'non-inventory',
                  items: materialList,
                  estimatedTotal
                })
              ]
            );

            prId = prResult.insertId;
            prNumber_out = prNumber;
            console.log(`✅ Auto-created PR ${prNumber} with ${materialList.length} materials for project ${projectNumber}`);
          }
        }
      } catch (prError) {
        console.error('⚠️ Failed to auto-create PR (project still created):', prError);
      }
    }

    res.json({ 
      message: `Status updated to ${newStatus}`,
      status: newStatus,
      project_id: projectId,
      pr_id: prId || null,
      pr_number: prNumber_out || null
    });
  } catch (error) {
    console.error('Error updating proposal status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ============================================
// PROPOSAL RESUME (Resource Summary)
// ============================================
router.get('/proposals/:id/resume', authMiddleware, requirePermission('estimator.proposals', 'view'), async (req: Request, res: Response) => {
  try {
    const proposalId = req.params.id;

    // Get proposal info
    const proposal = await dbGet(
      `SELECT p.*, u.username as created_by_name FROM proposals p LEFT JOIN users u ON p.created_by = u.id WHERE p.id = ?`,
      [proposalId]
    );
    if (!proposal) return res.status(404).json({ error: 'Proposal not found' });

    // Get all proposal items with their AHSP details
    const proposalItems = await dbAll(
      `SELECT pi.id, pi.qty, pi.ahsp_id, pi.ahsp_code_snapshot, pi.ahsp_name_snapshot,
              pi.unit_snapshot, pi.unit_price_snapshot, pi.total_price,
              d.name as discipline_name, sd.name as sub_discipline_name
       FROM proposal_items pi
       LEFT JOIN master_disciplines d ON pi.discipline_id = d.id
       LEFT JOIN master_sub_disciplines sd ON pi.sub_discipline_id = sd.id
       WHERE pi.proposal_id = ?
       ORDER BY d.order_no, sd.order_no, pi.order_no`,
      [proposalId]
    );

    // For each proposal item, get AHSP items and multiply koefisien by qty
    const materials: any[] = [];
    const labor: any[] = [];
    const equipment: any[] = [];

    for (const pi of proposalItems as any[]) {
      const ahspItems = await dbAll(
        `SELECT section, resource_type, resource_id, resource_name, resource_satuan, 
                resource_harga, koefisien, jumlah_harga
         FROM ahsp_items WHERE ahsp_id = ? ORDER BY section, id`,
        [pi.ahsp_id]
      );

      for (const ai of ahspItems as any[]) {
        const totalQty = (ai.koefisien || 0) * (pi.qty || 0);
        const totalCost = totalQty * (ai.resource_harga || 0);
        const entry = {
          resource_id: ai.resource_id,
          resource_name: ai.resource_name,
          resource_satuan: ai.resource_satuan,
          resource_harga: ai.resource_harga,
          koefisien: ai.koefisien,
          item_qty: pi.qty,
          total_qty: totalQty,
          total_cost: totalCost,
          from_ahsp: pi.ahsp_name_snapshot,
          from_ahsp_code: pi.ahsp_code_snapshot,
          discipline: pi.discipline_name,
          sub_discipline: pi.sub_discipline_name,
        };

        if (ai.section === 'A') labor.push(entry);
        else if (ai.section === 'B') materials.push(entry);
        else if (ai.section === 'C') equipment.push(entry);
      }
    }

    // Aggregate by resource_name + resource_satuan
    const aggregate = (list: any[]) => {
      const map = new Map<string, any>();
      for (const item of list) {
        const key = `${item.resource_name}||${item.resource_satuan}`;
        if (map.has(key)) {
          const existing = map.get(key);
          existing.total_qty += item.total_qty;
          existing.total_cost += item.total_cost;
          if (!existing.sources.includes(item.from_ahsp_code)) {
            existing.sources.push(item.from_ahsp_code);
          }
        } else {
          map.set(key, {
            resource_id: item.resource_id,
            resource_name: item.resource_name,
            resource_satuan: item.resource_satuan,
            resource_harga: item.resource_harga,
            total_qty: item.total_qty,
            total_cost: item.total_cost,
            sources: [item.from_ahsp_code],
          });
        }
      }
      return Array.from(map.values()).sort((a, b) => b.total_cost - a.total_cost);
    };

    // Schedule items: each proposal item as a work package
    const scheduleItems = (proposalItems as any[]).map((pi: any, idx: number) => ({
      id: pi.id,
      order: idx + 1,
      name: pi.ahsp_name_snapshot,
      code: pi.ahsp_code_snapshot,
      unit: pi.unit_snapshot,
      qty: pi.qty,
      cost: pi.total_price,
      discipline: pi.discipline_name,
      sub_discipline: pi.sub_discipline_name,
      duration_days: 0, // default, frontend can edit
      start_offset: 0,  // default, frontend can edit
    }));

    res.json({
      proposal,
      materials: aggregate(materials),
      labor: aggregate(labor),
      equipment: aggregate(equipment),
      materials_detail: materials,
      labor_detail: labor,
      equipment_detail: equipment,
      schedule_items: scheduleItems,
      totals: {
        material_cost: materials.reduce((s, m) => s + m.total_cost, 0),
        labor_cost: labor.reduce((s, l) => s + l.total_cost, 0),
        equipment_cost: equipment.reduce((s, e) => s + e.total_cost, 0),
      },
    });
  } catch (error) {
    console.error('Error fetching proposal resume:', error);
    res.status(500).json({ error: 'Failed to fetch proposal resume' });
  }
});

export default router;
