// account role resolution service
// resolves GL account from role code + optional scope dimensions
// uses effective dating and priority ordering

export interface ResolvedAccount {
  accountId: number;
  accountCode: string;
  accountName: string;
  roleCode: string;
}

interface RoleScope {
  productCategoryId?: number;
  warehouseId?: number;
  vendorClass?: string;
  customerClass?: string;
  taxCode?: string;
  projectId?: number;
  costCenterId?: number;
}

// resolve the GL account for a given role code and optional scope
// most-specific scope match with highest priority wins
export async function resolveAccountByRole(
  conn: any,
  roleCode: string,
  scope: RoleScope = {},
  asOfDate?: string,
  companyId: number = 1
): Promise<ResolvedAccount> {
  const effectiveDate = asOfDate || new Date().toISOString().slice(0, 10);

  const [rows] = await conn.execute(
    `SELECT ar.account_id, coa.account_code, coa.account_name, ar.role_code, ar.priority,
            ar.product_category_id, ar.warehouse_id, ar.vendor_class, ar.customer_class,
            ar.tax_code, ar.project_id, ar.cost_center_id
     FROM account_roles ar
     JOIN chart_of_accounts coa ON coa.id = ar.account_id
     WHERE ar.company_id = ?
       AND ar.role_code = ?
       AND ar.effective_from <= ?
       AND (ar.effective_to IS NULL OR ar.effective_to >= ?)
       AND coa.is_active = 1
       AND coa.is_postable = 1
     ORDER BY ar.priority DESC, ar.id ASC`,
    [companyId, roleCode, effectiveDate, effectiveDate]
  );

  const matches = rows as any[];
  if (matches.length === 0) {
    throw Object.assign(
      new Error(`No account mapping found for role ${roleCode} as of ${effectiveDate}`),
      { statusCode: 422, code: 'ACCOUNT_ROLE_NOT_FOUND' }
    );
  }

  // Every dimension the mapping constrains must equal the command context. A mapping scoped
  // to a warehouse is not a valid answer for a different warehouse, nor for a request that
  // names no warehouse at all: treating an absent dimension as "no opinion" is how a scoped
  // account gets chosen for a context it was never meant for.
  const candidates = matches
    .map((m: any) => {
      const pairs: Array<[unknown, unknown]> = [
        [m.product_category_id, scope.productCategoryId],
        [m.warehouse_id, scope.warehouseId],
        [m.vendor_class, scope.vendorClass],
        [m.customer_class, scope.customerClass],
        [m.tax_code, scope.taxCode],
        [m.project_id, scope.projectId],
        [m.cost_center_id, scope.costCenterId],
      ];

      let specificity = 0;
      for (const [mapped, requested] of pairs) {
        if (mapped === null || mapped === undefined || mapped === '') continue;
        if (requested === null || requested === undefined || requested === '') return null;
        if (String(mapped) !== String(requested)) return null;
        specificity++;
      }
      return { row: m, specificity };
    })
    .filter((c: any) => c !== null) as Array<{ row: any; specificity: number }>;

  if (candidates.length === 0) {
    throw Object.assign(
      new Error(`No account mapping for role ${roleCode} matches this scope as of ${effectiveDate}`),
      { statusCode: 422, code: 'ACCOUNT_ROLE_NOT_FOUND' }
    );
  }

  // most specific wins, then explicit priority. A genuine tie is a configuration error and
  // must not be settled by row order.
  const topSpecificity = Math.max(...candidates.map(c => c.specificity));
  const bySpecificity = candidates.filter(c => c.specificity === topSpecificity);
  const topPriority = Math.max(...bySpecificity.map(c => Number(c.row.priority ?? 0)));
  const finalists = bySpecificity.filter(c => Number(c.row.priority ?? 0) === topPriority);

  if (finalists.length > 1) {
    throw Object.assign(
      new Error(
        `Role ${roleCode} resolves to ${finalists.length} equally specific accounts (${finalists
          .map(f => f.row.account_code)
          .join(', ')}). Give one of them a higher priority.`
      ),
      { statusCode: 409, code: 'ACCOUNT_ROLE_AMBIGUOUS' }
    );
  }

  const best = finalists[0].row;

  return {
    accountId: best.account_id,
    accountCode: best.account_code,
    accountName: best.account_name,
    roleCode,
  };
}

// resolve multiple roles in one call (batch for posting)
export async function resolveRoles(
  conn: any,
  roleCodes: string[],
  scope: RoleScope = {},
  asOfDate?: string,
  companyId?: number
): Promise<Map<string, ResolvedAccount>> {
  const result = new Map<string, ResolvedAccount>();
  for (const code of roleCodes) {
    result.set(code, await resolveAccountByRole(conn, code, scope, asOfDate, companyId));
  }
  return result;
}
