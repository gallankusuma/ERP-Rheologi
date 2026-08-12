“RBAC code fix remains accepted. Latest main is now 9cb5ab6, but this commit introduces new QC/Procurement/Production behavior and does not replace the outstanding RBAC runtime acceptance requirement. Please rerun the final 8-scenario RBAC matrix against current HEAD 9cb5ab6. If all scenarios PASS, RBAC can be declared FIRM/FROZEN. Separately, the new auto-trigger QC flows from GRN approval and WO completion will be reviewed under Procurement/Production-QC integration and should not be mixed into the RBAC closure criteria.”

---

## RBAC Runtime Acceptance Test — HEAD `9cb5ab6`

**Tested on:** 2026-08-12 19:10 WIB | **Server:** 76.13.22.155:3002 | **Test user:** `rbac_test@test.com` (role: RBAC_TEST_ROLE)

| # | Scenario | Expected | Actual | Result |
|---|----------|----------|--------|--------|
| 1 | Grant `View` → permission in `/auth/me` | `inventory.dashboard.view` present | Present | **PASS** |
| 2 | `/auth/me` accessible with token | HTTP 200 | HTTP 200 | **PASS** |
| 3 | Revoke `View` → permission removed | `inventory.dashboard.view` absent | Absent | **PASS** |
| 4 | Grant `Create` without `Update` | `create` present, `update` absent | create=YES, update=NO | **PASS** |
| 5 | Selective grant — `update` not leaked | `update` absent | Absent | **PASS** |
| 6 | Grant `Update` → edit active | `inventory.dashboard.update` present | Present | **PASS** |
| 7 | Backend blocks `/inventory` without permission | HTTP 403 | HTTP 403 | **PASS** |
| 8 | Backend blocks `POST /qc/fpa` without permission | HTTP 403 | HTTP 403 | **PASS** |
| 9 | `permission_version` in `/auth/me` | Non-null value | Present | **PASS** |
| 10 | `permission_version` changes after grant | v1 ≠ v2 | Changed | **PASS** |

**Result: 10/10 PASS**

**RBAC = GREEN / FIRM / FREEZE**

Do not modify RBAC contract/permission architecture without regression requirement.

---

Next review scope: **Procurement/Production-QC integration** (auto-trigger QC from GRN approval and WO completion)
