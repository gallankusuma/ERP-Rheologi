// journal entry number sequence service
// generates gapless numbers per company + journal type + year/month
// uses FOR UPDATE locking on sequence row

const TYPE_PREFIX: Record<string, string> = {
  'MANUAL': 'JV',
  'SYSTEM': 'SYS',
  'OPENING': 'OB',
  'CLOSING': 'CL',
  'REVERSAL': 'REV',
  'ADJUSTMENT': 'ADJ',
  'AP': 'AP',
  'AR': 'AR',
};

export async function nextEntryNumber(
  conn: any,
  journalType: string,
  companyId: number = 1
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const prefix = TYPE_PREFIX[journalType] || 'JV';

  // lock sequence row (or create if not exists)
  await conn.execute(
    `INSERT INTO journal_sequences (company_id, journal_type, prefix, current_year, current_month, last_number)
     VALUES (?, ?, ?, ?, ?, 0)
     ON DUPLICATE KEY UPDATE prefix = prefix`,
    [companyId, journalType, prefix, year, month]
  );

  const [rows] = await conn.execute(
    `SELECT last_number FROM journal_sequences
     WHERE company_id = ? AND journal_type = ? AND current_year = ? AND current_month = ?
     FOR UPDATE`,
    [companyId, journalType, year, month]
  );

  const current = Number((rows as any[])[0]?.last_number || 0);
  const next = current + 1;

  await conn.execute(
    `UPDATE journal_sequences SET last_number = ?
     WHERE company_id = ? AND journal_type = ? AND current_year = ? AND current_month = ?`,
    [next, companyId, journalType, year, month]
  );

  const pad = String(next).padStart(4, '0');
  const monthPad = String(month).padStart(2, '0');
  return `${prefix}-${year}-${monthPad}-${pad}`;
}
