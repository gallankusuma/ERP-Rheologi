// Chart of accounts rules.
//
// Financial statements group historical journal lines by the attributes an account carries
// right now. Changing how an account is classified therefore rewrites how already-closed
// periods read, without touching a single journal. Once an account carries posted entries,
// those attributes are frozen.

export class CoaInUseError extends Error {
  public readonly code = 'COA_IN_USE';
  public readonly httpStatus = 409;
  public readonly data: Record<string, unknown>;

  constructor(message: string, data: Record<string, unknown>) {
    super(message);
    this.name = 'CoaInUseError';
    this.data = data;
  }
}

/** attributes that decide where an account lands in a financial statement */
const CLASSIFYING_FIELDS = ['account_type', 'normal_balance', 'is_header', 'parent_id'] as const;

export interface CoaUpdateRequest {
  account_type?: string;
  normal_balance?: string;
  is_header?: number | boolean;
  parent_id?: number | null;
}

function differs(field: string, requested: any, current: any): boolean {
  if (requested === undefined) return false;
  if (field === 'is_header') return Number(requested ? 1 : 0) !== Number(current ? 1 : 0);
  if (field === 'parent_id') return Number(requested ?? 0) !== Number(current ?? 0);
  return String(requested) !== String(current);
}

export async function countPostedLines(conn: any, accountId: number): Promise<number> {
  const [rows]: any = await conn.query(
    `SELECT COUNT(*) AS cnt FROM journal_lines jl
       JOIN journal_entries je ON je.id = jl.journal_entry_id AND je.status = 'posted'
      WHERE jl.account_id = ?`,
    [accountId]
  );
  return Number(rows[0]?.cnt || 0);
}

/**
 * Throw when an update would reclassify an account that already carries posted entries.
 * Renaming and describing stay allowed; only presentation-affecting attributes are frozen.
 */
export async function assertClassificationEditable(
  conn: any,
  account: any,
  requested: CoaUpdateRequest
): Promise<void> {
  const changed = CLASSIFYING_FIELDS.filter(f => differs(f, (requested as any)[f], account[f]));
  if (changed.length === 0) return;

  const postedLines = await countPostedLines(conn, account.id);
  if (postedLines === 0) return;

  throw new CoaInUseError(
    `Account ${account.account_code} carries ${postedLines} posted journal line(s); ${changed.join(', ')} cannot be changed. Create a new account instead.`,
    { accountId: account.id, postedLines, frozenFields: changed }
  );
}
