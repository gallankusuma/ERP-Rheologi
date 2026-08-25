import { dbTransaction } from '../config/database';
import { postSystemJournal, postStatisticalEvent, JournalLineInput } from './accounting-posting.service';
import { resolveValuation } from './valuation-policy.service';
import { resolveAccountByRole } from './account-role.service';
import { allocateCostFromLayer, linkAllocationsToJournal } from './inventory-costing.service';
import { money, moneyRound, toDbString } from '../lib/decimal';

// Shipment posting: goods leaving the warehouse become cost of goods sold.
//
//   shipment   Dr Cost of Goods Sold   Cr Finished Goods Inventory
//
// The cost is whatever the shipped lot actually cost, drawn from its cost layer, so margin
// is measured against the real cost of the goods that left rather than an average.

export type ShipmentErrorCode =
  | 'DELIVERY_NOT_FOUND'
  | 'ALREADY_POSTED'
  | 'INVALID_LINE'
  | 'INSUFFICIENT_STOCK';

const STATUS: Record<ShipmentErrorCode, number> = {
  DELIVERY_NOT_FOUND: 404,
  ALREADY_POSTED: 409,
  INVALID_LINE: 422,
  INSUFFICIENT_STOCK: 409,
};

export class ShipmentError extends Error {
  public readonly code: ShipmentErrorCode;
  public readonly httpStatus: number;
  public readonly data?: Record<string, unknown>;

  constructor(code: ShipmentErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ShipmentError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.data = data;
  }
}

export interface ShipmentLineInput {
  soItemId?: number | null;
  productId: number;
  /** the exact lot leaving the warehouse */
  lotId: number;
  quantity: string | number;
}

export interface ShipmentInput {
  deliveryId: number;
  warehouseId: number;
  shipDate: string;
  lines: ShipmentLineInput[];
  idempotencyKey: string;
  userId: number;
}

/**
 * Post a shipment: relieve the exact lots, record the movement, and recognise cost of sales.
 */
export async function postShipment(input: ShipmentInput): Promise<any> {
  if (!input.idempotencyKey) {
    throw new ShipmentError('INVALID_LINE', 'A shipment requires an idempotency key.');
  }
  if (!input.lines?.length) {
    throw new ShipmentError('INVALID_LINE', 'A shipment must have at least one line.');
  }

  return dbTransaction(async (conn: any) => {
    // lock order: delivery, then each lot balance in ascending lot order
    const [delRows] = await conn.execute(
      'SELECT id, do_number, so_id, posted_at, journal_entry_id FROM deliveries WHERE id = ? FOR UPDATE',
      [input.deliveryId]
    );
    const delivery = (delRows as any[])[0];
    if (!delivery) throw new ShipmentError('DELIVERY_NOT_FOUND', `Delivery ${input.deliveryId} not found.`);

    if (delivery.posted_at) {
      return { delivery_id: delivery.id, journal_id: delivery.journal_entry_id, replay: true };
    }

    const sorted = [...input.lines].sort((a, b) => Number(a.lotId) - Number(b.lotId));

    let totalCost = money('0');
    const allocationIds: number[] = [];
    const shipped: Array<{ productId: number; lotId: number; qty: string; unitCost: string; totalCost: string }> = [];

    for (const line of sorted) {
      const qty = money(String(line.quantity));
      if (qty.lessThanOrEqualTo(0)) {
        throw new ShipmentError('INVALID_LINE', `Shipment line for product ${line.productId} has no positive quantity.`);
      }
      if (!line.lotId) {
        throw new ShipmentError(
          'INVALID_LINE',
          `Shipment line for product ${line.productId} has no lot; the exact lot leaving stock must be identified.`
        );
      }

      const [stockRows] = await conn.execute(
        `SELECT id, quantity FROM inventory_stocks
          WHERE lot_id = ? AND warehouse_id = ? AND product_id = ? AND status = 'available'
          FOR UPDATE`,
        [line.lotId, input.warehouseId, line.productId]
      );
      const stock = (stockRows as any[])[0];
      if (!stock) {
        throw new ShipmentError(
          'INSUFFICIENT_STOCK',
          `Lot ${line.lotId} is not available stock for product ${line.productId} in warehouse ${input.warehouseId}.`,
          { lotId: line.lotId, productId: line.productId }
        );
      }

      const available = money(String(stock.quantity));
      if (qty.greaterThan(available)) {
        throw new ShipmentError(
          'INSUFFICIENT_STOCK',
          `Lot ${line.lotId} holds ${toDbString(available)} but ${toDbString(qty)} was shipped.`,
          { lotId: line.lotId, available: toDbString(available) }
        );
      }

      await conn.execute(
        'UPDATE inventory_stocks SET quantity = quantity - ?, last_updated = CURRENT_TIMESTAMP WHERE id = ?',
        [toDbString(qty), stock.id]
      );

      const [movement] = await conn.execute(
        `INSERT INTO stock_movements (warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, lot_id, notes, created_by)
         VALUES (?, ?, 'out', ?, 'delivery', ?, ?, ?, ?)`,
        [
          input.warehouseId, line.productId, toDbString(qty), input.deliveryId, line.lotId,
          `Shipped on ${delivery.do_number || 'DO-' + input.deliveryId}`, input.userId,
        ]
      );

      const alloc = await allocateCostFromLayer(conn, {
        lotId: line.lotId,
        productId: line.productId,
        quantity: toDbString(qty),
        movementType: 'shipment',
        movementId: movement.insertId,
      });

      await conn.execute(
        `INSERT INTO delivery_items
         (delivery_id, so_item_id, product_id, quantity_delivered, lot_id, warehouse_id, unit_cost, total_cost, cost_layer_id, stock_movement_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.deliveryId, line.soItemId || null, line.productId, toDbString(qty), line.lotId,
          input.warehouseId, alloc.unitCost, alloc.totalCost, alloc.costLayerId, movement.insertId,
        ]
      );

      allocationIds.push(...alloc.allocationIds);
      totalCost = totalCost.plus(money(alloc.totalCost));
      shipped.push({
        productId: line.productId,
        lotId: line.lotId,
        qty: toDbString(qty),
        unitCost: alloc.unitCost,
        totalCost: alloc.totalCost,
      });
    }

    totalCost = moneyRound(totalCost);

    // stock left the building; the cost of it is not optional
    const valuation = await resolveValuation(conn, {
      sourceEventType: 'SHIPMENT_POSTED',
      businessDate: input.shipDate,
      quantity: '1',
      unitCost: toDbString(totalCost),
      context: { deliveryId: input.deliveryId, warehouseId: input.warehouseId },
    });

    let journalId: number | null = null;

    if (valuation.statistical) {
      await postStatisticalEvent(conn, {
        sourceModule: 'SALES',
        sourceType: 'delivery',
        sourceId: input.deliveryId,
        sourceEventType: 'SHIPMENT_POSTED',
        businessDate: input.shipDate,
        description: `Shipment ${delivery.do_number || input.deliveryId} - zero-value`,
        postingProfileId: valuation.profileId,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      });
    } else {
      const cogsAccount = await resolveAccountByRole(conn, 'COGS_PRODUCT', {}, input.shipDate);
      const fgAccount = await resolveAccountByRole(conn, 'INVENTORY_FG_AVAILABLE', { warehouseId: input.warehouseId }, input.shipDate);

      const lines: JournalLineInput[] = [
        {
          accountId: cogsAccount.accountId,
          description: `Cost of goods shipped on ${delivery.do_number || 'DO-' + input.deliveryId}`,
          debit: valuation.amount,
          credit: '0',
          warehouseId: input.warehouseId,
        },
        {
          accountId: fgAccount.accountId,
          description: `Finished goods released on ${delivery.do_number || 'DO-' + input.deliveryId}`,
          debit: '0',
          credit: valuation.amount,
          warehouseId: input.warehouseId,
        },
      ];

      const journal = await postSystemJournal(conn, {
        sourceModule: 'SALES',
        sourceType: 'delivery',
        sourceId: input.deliveryId,
        sourceEventType: 'SHIPMENT_POSTED',
        businessDate: input.shipDate,
        description: `Shipment ${delivery.do_number || input.deliveryId}`,
        lines,
        idempotencyKey: input.idempotencyKey,
        userId: input.userId,
      });
      journalId = journal.journal_id;
      await linkAllocationsToJournal(conn, allocationIds, journalId as number);
    }

    await conn.execute(
      "UPDATE deliveries SET status = 'shipped', shipped_at = COALESCE(shipped_at, ?), posted_at = NOW(), journal_entry_id = ?, idempotency_key = ? WHERE id = ?",
      [input.shipDate, journalId, input.idempotencyKey, input.deliveryId]
    );

    return { delivery_id: input.deliveryId, journal_id: journalId, total_cost: toDbString(totalCost), lines: shipped };
  });
}
