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

  // find best scope match
  let best = matches[0]; // fallback to highest priority with no scope

  for (const m of matches) {
    let scopeScore = 0;
    let scopeMismatch = false;

    if (m.product_category_id && scope.productCategoryId) {
      if (m.product_category_id === scope.productCategoryId) scopeScore++;
      else scopeMismatch = true;
    }
    if (m.warehouse_id && scope.warehouseId) {
      if (m.warehouse_id === scope.warehouseId) scopeScore++;
      else scopeMismatch = true;
    }
    if (m.vendor_class && scope.vendorClass) {
      if (m.vendor_class === scope.vendorClass) scopeScore++;
      else scopeMismatch = true;
    }
    if (m.customer_class && scope.customerClass) {
      if (m.customer_class === scope.customerClass) scopeScore++;
      else scopeMismatch = true;
    }
    if (m.tax_code && scope.taxCode) {
      if (m.tax_code === scope.taxCode) scopeScore++;
      else scopeMismatch = true;
    }

    if (!scopeMismatch && scopeScore > 0) {
      best = m;
      break; // most specific match wins
    }
  }

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
