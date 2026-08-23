import Decimal from 'decimal.js';

// configure decimal.js for financial calculations
Decimal.set({
  precision: 30,
  rounding: Decimal.ROUND_HALF_UP,
});

// standard money precision: 4 decimal places for IDR/USD
const MONEY_DP = 4;
const RATE_DP = 10;
const QTY_DP = 6;
const COST_DP = 8;

export function money(value: string | number): Decimal {
  return new Decimal(value);
}

export function moneyRound(value: Decimal): Decimal {
  return value.toDecimalPlaces(MONEY_DP, Decimal.ROUND_HALF_UP);
}

export function rateRound(value: Decimal): Decimal {
  return value.toDecimalPlaces(RATE_DP, Decimal.ROUND_HALF_UP);
}

export function qtyRound(value: Decimal): Decimal {
  return value.toDecimalPlaces(QTY_DP, Decimal.ROUND_HALF_UP);
}

export function costRound(value: Decimal): Decimal {
  return value.toDecimalPlaces(COST_DP, Decimal.ROUND_HALF_UP);
}

// validate that debit sum equals credit sum exactly
export function assertBalanced(totalDebit: Decimal, totalCredit: Decimal): void {
  const diff = totalDebit.minus(totalCredit).abs();
  if (!diff.isZero()) {
    throw Object.assign(
      new Error(`Journal is unbalanced: debit=${totalDebit.toFixed(MONEY_DP)}, credit=${totalCredit.toFixed(MONEY_DP)}, diff=${diff.toFixed(MONEY_DP)}`),
      { statusCode: 422, code: 'JOURNAL_UNBALANCED' }
    );
  }
}

// convert foreign amount to base currency
export function toBase(foreignAmount: Decimal, rate: Decimal): Decimal {
  return moneyRound(foreignAmount.times(rate));
}

// format for DB storage
export function toDbString(value: Decimal, dp: number = MONEY_DP): string {
  return value.toFixed(dp);
}

// parse from DB (may be string or number)
export function fromDb(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

export { Decimal };
