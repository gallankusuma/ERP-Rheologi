import { dbTransaction, dbGet, dbAll, dbRun } from '../config/database';

// deterministic lot number from source event (no random suffix)
function generateLotNumber(sourceType: string, sourceDocumentId: number, sourceLineId: number): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = sourceType === 'grn_item' ? 'GRN' : sourceType === 'fg_receipt' ? 'FG' : 'ADJ';
  return `LOT-${prefix}-${datePart}-${sourceDocumentId}-${sourceLineId}`;
}

export interface CreateLotParams {
  productId: number;
  sourceType: 'grn_item' | 'fg_receipt' | 'adjustment' | 'opening';
  sourceDocumentId: number;
  sourceLineId: number;
  batchNumber?: string | null;
  supplierId?: number | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  qcPolicy: 'REQUIRED' | 'NOT_REQUIRED';
  conn: any; // transaction connection required
}

/**
 * Idempotent lot creation using database unique source tuple as race arbiter.
 * Attempt insert; on duplicate, validate consistency of immutable payload.
 */
export async function createLot(params: CreateLotParams): Promise<{ lotId: number; lotNumber: string }> {
  const lotNumber = generateLotNumber(params.sourceType, params.sourceDocumentId, params.sourceLineId);

  try {
    const [result] = await params.conn.execute(
      `INSERT INTO inventory_lots
       (lot_number, product_id, source_type, source_document_id, source_line_id,
        batch_number, supplier_id, manufacture_date, expiry_date, qc_policy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        lotNumber,
        params.productId,
        params.sourceType,
        params.sourceDocumentId,
        params.sourceLineId,
        params.batchNumber || null,
        params.supplierId || null,
        params.manufactureDate || null,
        params.expiryDate || null,
        params.qcPolicy
      ]
    );
    return { lotId: result.insertId, lotNumber };
  } catch (err: any) {
    // duplicate key on source tuple = concurrent insert won the race
    if (err.code === 'ER_DUP_ENTRY') {
      const existing = await findLotBySource(
        params.sourceType, params.sourceDocumentId, params.sourceLineId, params.conn
      );
      if (!existing) {
        throw new Error('LOT_SOURCE_CONFLICT: duplicate detected but lot not found after insert race.');
      }

      // validate immutable payload consistency
      const [lots] = await params.conn.execute(
        'SELECT product_id, batch_number, supplier_id FROM inventory_lots WHERE id = ? FOR UPDATE',
        [existing.lotId]
      );
      const lot = lots[0];
      if (lot) {
        if (lot.product_id !== params.productId) {
          throw new Error(`LOT_SOURCE_CONFLICT: existing lot ${existing.lotId} has product ${lot.product_id}, request has ${params.productId}.`);
        }
        if ((lot.batch_number || null) !== (params.batchNumber || null)) {
          throw new Error(`LOT_SOURCE_CONFLICT: existing lot ${existing.lotId} has batch '${lot.batch_number}', request has '${params.batchNumber}'.`);
        }
      }

      return existing;
    }
    throw err;
  }
}

/**
 * Find existing lot by immutable source lineage.
 * Returns the lot if one exists for this exact source event.
 */
export async function findLotBySource(
  sourceType: string,
  sourceDocumentId: number,
  sourceLineId: number,
  conn?: any
): Promise<{ lotId: number; lotNumber: string } | null> {
  let lot: any;
  if (conn) {
    const [rows] = await conn.execute(
      'SELECT id, lot_number FROM inventory_lots WHERE source_type = ? AND source_document_id = ? AND source_line_id = ?',
      [sourceType, sourceDocumentId, sourceLineId]
    );
    lot = rows[0] || null;
  } else {
    lot = await dbGet(
      'SELECT id, lot_number FROM inventory_lots WHERE source_type = ? AND source_document_id = ? AND source_line_id = ?',
      [sourceType, sourceDocumentId, sourceLineId]
    );
  }

  if (!lot) return null;
  return { lotId: lot.id, lotNumber: lot.lot_number };
}

/**
 * Resolve product QC policy. qc_policy is NOT NULL after migration 019.
 * Missing product or unresolved policy = typed 422 error.
 */
export async function resolveQcPolicy(
  productId: number,
  qcType: string,
  conn?: any
): Promise<'REQUIRED' | 'NOT_REQUIRED'> {
  let product: any;
  if (conn) {
    const [rows] = await conn.execute(
      'SELECT qc_policy FROM products WHERE id = ?',
      [productId]
    );
    product = rows[0] || null;
  } else {
    product = await dbGet('SELECT qc_policy FROM products WHERE id = ?', [productId]);
  }

  if (!product) {
    const err: any = new Error(`QC_POLICY_REQUIRED: product ${productId} not found`);
    err.statusCode = 422;
    err.code = 'QC_POLICY_REQUIRED';
    throw err;
  }

  if (product.qc_policy === 'NOT_REQUIRED') {
    return 'NOT_REQUIRED';
  }
  if (product.qc_policy === 'REQUIRED') {
    return 'REQUIRED';
  }

  // null or unknown value — reject, never infer
  const err: any = new Error(`QC_POLICY_REQUIRED: product ${productId} has unresolved qc_policy '${product.qc_policy}'`);
  err.statusCode = 422;
  err.code = 'QC_POLICY_REQUIRED';
  throw err;
}
