// fiscal period service
// manages period lifecycle: open, soft-close, close, reopen
// all financial postings must reference an open period

export interface FiscalPeriod {
  id: number;
  period_name: string;
  start_date: string;
  end_date: string;
  fiscal_year: number;
  period_number: number;
  status: 'open' | 'soft_closed' | 'closed';
  version: number;
}

// get the open period for a given date, fail if no open period
export async function getOpenPeriod(conn: any, date: string): Promise<FiscalPeriod> {
  const [rows] = await conn.execute(
    `SELECT id, period_name, start_date, end_date, fiscal_year, period_number, status, version
     FROM fiscal_periods
     WHERE ? BETWEEN start_date AND end_date
     LIMIT 1`,
    [date]
  );
  const period = (rows as any[])[0] as FiscalPeriod | undefined;

  if (!period) {
    throw Object.assign(
      new Error(`No fiscal period found for date ${date}. Create a fiscal period first.`),
      { statusCode: 404, code: 'PERIOD_NOT_FOUND' }
    );
  }

  if (period.status === 'closed') {
    throw Object.assign(
      new Error(`Fiscal period ${period.period_name} is closed. Cannot post to a closed period.`),
      { statusCode: 409, code: 'PERIOD_CLOSED' }
    );
  }

  return period;
}

// lock period for posting (FOR UPDATE)
export async function lockPeriod(conn: any, periodId: number): Promise<FiscalPeriod> {
  const [rows] = await conn.execute(
    `SELECT id, period_name, start_date, end_date, fiscal_year, period_number, status, version
     FROM fiscal_periods WHERE id = ? FOR UPDATE`,
    [periodId]
  );
  const period = (rows as any[])[0] as FiscalPeriod | undefined;
  if (!period) {
    throw Object.assign(
      new Error(`Fiscal period ${periodId} not found`),
      { statusCode: 404, code: 'PERIOD_NOT_FOUND' }
    );
  }
  return period;
}

// soft-close: blocks new manual journals, allows system postings and corrections
export async function softClosePeriod(
  conn: any, periodId: number, userId: number
): Promise<void> {
  const period = await lockPeriod(conn, periodId);
  if (period.status !== 'open') {
    throw Object.assign(
      new Error(`Period ${period.period_name} is ${period.status}, expected open for soft-close`),
      { statusCode: 409, code: 'INVALID_PERIOD_TRANSITION' }
    );
  }
  await conn.execute(
    `UPDATE fiscal_periods SET status = 'soft_closed', closed_by = ?, closed_at = NOW(), version = version + 1
     WHERE id = ? AND version = ?`,
    [userId, periodId, period.version]
  );
}

// hard-close: no postings allowed
export async function closePeriod(
  conn: any, periodId: number, userId: number
): Promise<void> {
  const period = await lockPeriod(conn, periodId);
  if (period.status !== 'soft_closed') {
    throw Object.assign(
      new Error(`Period ${period.period_name} must be soft-closed before hard-close (current: ${period.status})`),
      { statusCode: 409, code: 'INVALID_PERIOD_TRANSITION' }
    );
  }
  await conn.execute(
    `UPDATE fiscal_periods SET status = 'closed', closed_by = ?, closed_at = NOW(), version = version + 1
     WHERE id = ? AND version = ?`,
    [userId, periodId, period.version]
  );
}

// reopen: only Finance Manager/Controller, requires reason
export async function reopenPeriod(
  conn: any, periodId: number, userId: number, reason: string
): Promise<void> {
  if (!reason || reason.trim().length < 10) {
    throw Object.assign(
      new Error('Reopen reason must be at least 10 characters'),
      { statusCode: 422, code: 'MISSING_REOPEN_REASON' }
    );
  }
  const period = await lockPeriod(conn, periodId);
  if (period.status !== 'closed') {
    throw Object.assign(
      new Error(`Period ${period.period_name} is ${period.status}, only closed periods can be reopened`),
      { statusCode: 409, code: 'INVALID_PERIOD_TRANSITION' }
    );
  }
  await conn.execute(
    `UPDATE fiscal_periods SET status = 'open', reopened_by = ?, reopened_at = NOW(),
     reopen_reason = ?, version = version + 1
     WHERE id = ? AND version = ?`,
    [userId, reason, periodId, period.version]
  );
}
