import { dbAll, dbGet, dbRun, dbTransaction } from '../config/database';

/**
 * Generate Purchase Request from MRP Net Requirements.
 * Transaction wraps PR header + all item inserts.
 * Server-side recalculation deducts scheduled PO receipts.
 * Duplicate protection: one PR-MRP per day.
 */
export async function generatePurchaseRequestFromMrp(opts: {
  materials: any[];
  year?: number;
  notes?: string;
  userId: number | null;
}): Promise<{ prId: number; prNumber: string; itemCount: number; neededBy: string }> {
  const { materials, year, notes, userId } = opts;

  if (!materials || !Array.isArray(materials) || materials.length === 0) {
    throw new Error('No materials provided. Select materials with net requirements > 0.');
  }

  const validMaterials = materials.filter((m: any) => Number(m.total_net_requirement) > 0);
  if (validMaterials.length === 0) {
    throw new Error('No materials have net requirements > 0.');
  }

  // P0-5: browser already calculates net requirements after incorporating PO scheduled receipts.
  // Deducting again here causes double-subtraction, understating procurement demand.
  // TODO (Option B): move entire MRP calculation server-side so browser only sends
  // material IDs + MRP planning horizon. Backend becomes sole calculator.

  // duplicate protection
  const today = new Date().toISOString().slice(0, 10);
  const recentPR = await dbGet(
    "SELECT id, pr_number FROM purchase_requests WHERE pr_number LIKE ? AND request_date = ?",
    [`PR-MRP-${today.replace(/-/g, '')}%`, today]
  ) as any;
  if (recentPR) {
    throw Object.assign(
      new Error(`An MRP Purchase Request was already generated today (${recentPR.pr_number}). Delete it first or wait until tomorrow.`),
      { statusCode: 409, existing_pr: recentPR.pr_number }
    );
  }

  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(100 + Math.random() * 900);
  const prNumber = `PR-MRP-${datePart}-${rand}`;

  const maxLeadTime = Math.max(...validMaterials.map((m: any) => Number(m.lead_time) || 2));
  const neededBy = new Date();
  neededBy.setDate(neededBy.getDate() + maxLeadTime * 7);

  // build JSON notes matching procurement parseNotes() contract
  const noteText = [
    notes || '',
    `[Auto-generated from MRP Year ${year || now.getFullYear()}]`,
    `Materials: ${validMaterials.length} items`,
    `Generated: ${now.toISOString().slice(0, 19).replace('T', ' ')}`
  ].filter(Boolean).join(' | ');
  const notesItems = validMaterials
    .filter((m: any) => Number(m.total_net_requirement) > 0)
    .map((m: any) => ({
      productId: m.material_id,
      productName: m.material_name || '',
      name: m.material_name || '',
      qty: Number(m.total_net_requirement),
      uom: m.uom_name || '-',
      specification: `MRP Net Req | Lead Time: ${m.lead_time || 2} weeks`,
    }));
  const prNotes = JSON.stringify({ noteText, items: notesItems, itemType: 'inventory' });

  // resolve MPS detail → material lineage
  const mrpYear = year || now.getFullYear();
  const mpsHeaders = await dbAll(
    `SELECT id FROM mps_headers WHERE status = 'Confirmed' AND period_year = ?`,
    [mrpYear]
  ) as any[];
  const headerIds = mpsHeaders.map((h: any) => h.id);

  const materialDetailMap: Record<number, number[]> = {};
  if (headerIds.length > 0) {
    const hPlaceholders = headerIds.map(() => '?').join(',');
    const allDetails = await dbAll(`
      SELECT d.id as detail_id, d.bom_id
      FROM mps_details d
      WHERE d.mps_header_id IN (${hPlaceholders}) AND d.bom_id IS NOT NULL
    `, headerIds) as any[];

    if (allDetails.length > 0) {
      const detailIds = allDetails.map((d: any) => d.detail_id);
      const dPlaceholders = detailIds.map(() => '?').join(',');

      const detailsWithProduction = await dbAll(`
        SELECT DISTINCT mps_detail_id
        FROM mps_week_data
        WHERE mps_detail_id IN (${dPlaceholders}) AND production_qty > 0
      `, detailIds) as any[];
      const activeDetailIds = new Set(detailsWithProduction.map((r: any) => r.mps_detail_id));

      const activeDetails = allDetails.filter((d: any) => activeDetailIds.has(d.detail_id));

      const bomIds = [...new Set(activeDetails.map((d: any) => d.bom_id))];
      if (bomIds.length > 0) {
        const bPlaceholders = bomIds.map(() => '?').join(',');
        const allBomItems = await dbAll(`
          SELECT bom_header_id, raw_material_id FROM bom_details
          WHERE bom_header_id IN (${bPlaceholders})
        `, bomIds) as any[];

        for (const mat of validMaterials) {
          const matId = mat.material_id;
          const contributingDetails = activeDetails.filter((d: any) =>
            allBomItems.some((b: any) => b.bom_header_id === d.bom_id && b.raw_material_id === matId)
          );
          materialDetailMap[matId] = contributingDetails.map((d: any) => d.detail_id);
        }
      }
    }
  }

  // transactional: PR header + all items
  const result = await dbTransaction(async (conn: any) => {
    const [prInsert] = await conn.execute(
      `INSERT INTO purchase_requests (pr_number, requestor_id, status, notes, request_date, needed_by, source_type) VALUES (?, ?, 'DRAFT', ?, ?, ?, 'MRP')`,
      [prNumber, userId, prNotes, now.toISOString().slice(0, 10), neededBy.toISOString().slice(0, 10)]
    );
    const prId = prInsert.insertId;

    let itemCount = 0;
    for (const mat of validMaterials) {
      const qty = Number(mat.total_net_requirement) || 0;
      if (qty <= 0) continue;
      const detailIds = materialDetailMap[mat.material_id] || [];
      const detailIdsJson = detailIds.length > 0 ? JSON.stringify(detailIds) : null;
      await conn.execute(
        `INSERT INTO purchase_request_items (purchase_request_id, product_id, quantity, notes, mps_detail_ids) VALUES (?, ?, ?, ?, ?)`,
        [prId, mat.material_id, qty, `MRP Net Req | Lead Time: ${mat.lead_time || 2} weeks | UOM: ${mat.uom_name || '-'}`, detailIdsJson]
      );
      itemCount++;
    }

    if (itemCount === 0) {
      throw new Error('No valid items to insert');
    }

    return { prId, itemCount };
  });

  console.log(`PR generated from MRP: ${prNumber} with ${result.itemCount} items (PR ID: ${result.prId})`);

  return {
    prId: result.prId,
    prNumber,
    itemCount: result.itemCount,
    neededBy: neededBy.toISOString().slice(0, 10)
  };
}
