import { dbAll } from '../config/database';

/**
 * Canonical BOM explosion function.
 * Used by both MRP (PPIC) and WO material generation (Production).
 *
 * Calculates material requirements using:
 *   production_qty / bom_batch_qty × component_qty
 *
 * When bom_batch_qty is null/0, falls back to simple multiplication
 * (component_qty × production_qty) for backward compatibility.
 */

interface MaterialRequirement {
  rawMaterialId: number;
  quantity: number;
  unitOfMeasureId: number | null;
  sequence: number | null;
}

export async function explodeBom(opts: {
  bomId: number;
  productionQty: number;
}): Promise<MaterialRequirement[]> {
  const { bomId, productionQty } = opts;

  if (!bomId || !Number.isFinite(productionQty) || productionQty <= 0) {
    throw new Error('bomId and a positive productionQty are required for BOM explosion');
  }

  // fetch BOM header for batch qty
  const bomHeader = await dbAll(
    'SELECT qty, unit FROM bom_headers WHERE id = ?',
    [bomId]
  ) as any[];

  if (!bomHeader?.[0]) {
    throw new Error(`BOM_NOT_FOUND: BOM ${bomId} does not exist`);
  }

  const batchQty = Number(bomHeader[0].qty || 0);

  // explicit basis check: missing/zero batch qty = error, not silent per-unit fallback
  if (batchQty <= 0) {
    throw new Error(`BOM_BASIS_REQUIRED: BOM ${bomId} has no batch quantity defined. Set bom_headers.qty before using.`);
  }

  // fetch BOM details (components)
  const components = await dbAll(
    'SELECT raw_material_id, quantity, unit_of_measure_id, sequence FROM bom_details WHERE bom_header_id = ? ORDER BY sequence',
    [bomId]
  ) as any[];

  // calculate multiplier: production_qty / bom_batch_qty
  // batchQty is guaranteed > 0 by validation above
  const multiplier = productionQty / batchQty;

  return components.map((c: any) => ({
    rawMaterialId: c.raw_material_id,
    quantity: Number(c.quantity) * multiplier,
    unitOfMeasureId: c.unit_of_measure_id || null,
    sequence: c.sequence || null,
  }));
}
