import { money, moneyRound, toDbString } from '../lib/decimal';

// Every posted stock event must carry a financial effect. A missing or zero valuation is a
// business decision, never an implicit skip: it either fails closed, or it is permitted by an
// approved posting profile and recorded as a statistical accounting event.

export type ValuationErrorCode = 'VALUATION_REQUIRED' | 'COST_LAYER_REQUIRED';

export class ValuationError extends Error {
  public readonly code: ValuationErrorCode;
  public readonly httpStatus = 422;
  public readonly data?: Record<string, unknown>;

  constructor(code: ValuationErrorCode, message: string, data?: Record<string, unknown>) {
    super(message);
    this.name = 'ValuationError';
    this.code = code;
    this.data = data;
  }
}

const ZERO_VALUE_PROFILE = 'ZERO_VALUE_ALLOWED';

/**
 * True only when an approved, active, effective posting profile explicitly permits a
 * zero-value posting for this event type. Default is deny.
 */
export async function isZeroValueApproved(
  conn: any,
  sourceEventType: string,
  businessDate: string
): Promise<{ approved: boolean; profileId?: number; reason?: string }> {
  const [rows]: any = await conn.execute(
    `SELECT id, zero_value_reason
       FROM posting_profiles
      WHERE company_id = 1
        AND source_event_type = ?
        AND profile_name = ?
        AND is_active = 1
        AND approved_by IS NOT NULL
        AND approved_at IS NOT NULL
        AND effective_from <= ?
        AND (effective_to IS NULL OR effective_to >= ?)
      ORDER BY effective_from DESC
      LIMIT 1`,
    [sourceEventType, ZERO_VALUE_PROFILE, businessDate, businessDate]
  );

  if (!rows.length) return { approved: false };
  return { approved: true, profileId: rows[0].id, reason: rows[0].zero_value_reason || undefined };
}

export interface ValuationDecision {
  /** rounded amount as a decimal string, safe to hand to the posting service */
  amount: string;
  /** true when the amount is zero and an approved profile permits it */
  statistical: boolean;
  profileId?: number;
}

/**
 * Resolve the amount for a stock event and decide whether it may post.
 * Throws VALUATION_REQUIRED when the value is missing or zero and no profile approves it.
 */
export async function resolveValuation(
  conn: any,
  input: {
    sourceEventType: string;
    businessDate: string;
    quantity: string | number;
    unitCost: string | number | null | undefined;
    context: Record<string, unknown>;
  }
): Promise<ValuationDecision> {
  const { sourceEventType, businessDate, quantity, unitCost, context } = input;

  if (unitCost === null || unitCost === undefined || unitCost === '') {
    const zero = await isZeroValueApproved(conn, sourceEventType, businessDate);
    if (!zero.approved) {
      throw new ValuationError(
        'VALUATION_REQUIRED',
        `${sourceEventType} has no unit cost. Provide a cost, or approve a ${ZERO_VALUE_PROFILE} posting profile for this event type.`,
        context
      );
    }
    return { amount: '0', statistical: true, profileId: zero.profileId };
  }

  // decimal throughout: multiplying in JavaScript first would lose precision before rounding
  const amount = moneyRound(money(String(unitCost)).times(money(String(quantity))));

  if (amount.isNegative()) {
    throw new ValuationError('VALUATION_REQUIRED', `${sourceEventType} produced a negative value`, {
      ...context,
      amount: toDbString(amount),
    });
  }

  if (amount.isZero()) {
    const zero = await isZeroValueApproved(conn, sourceEventType, businessDate);
    if (!zero.approved) {
      throw new ValuationError(
        'VALUATION_REQUIRED',
        `${sourceEventType} values at zero. Provide a cost, or approve a ${ZERO_VALUE_PROFILE} posting profile for this event type.`,
        context
      );
    }
    return { amount: '0', statistical: true, profileId: zero.profileId };
  }

  return { amount: toDbString(amount), statistical: false };
}
