#!/bin/bash
# Compare columns between dev and prod for shared tables
DB_USER="erp_user"
DB_PASS="ErpSecure2024!"
DEV_DB="erp_rheologi_dev"
PROD_DB="erp_rheologi"

for t in work_orders qc_tests qc_results qc_sampling_plans qc_ncr qc_ncr_actions qc_rework_orders bom_headers bom_details production_events production_tasks wo_materials wo_process_logs wo_results; do
  dev_cols=$(mysql -u "$DB_USER" -p"$DB_PASS" "$DEV_DB" -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='$DEV_DB' AND TABLE_NAME='$t' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  prod_cols=$(mysql -u "$DB_USER" -p"$DB_PASS" "$PROD_DB" -N -e "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='$PROD_DB' AND TABLE_NAME='$t' ORDER BY ORDINAL_POSITION" 2>/dev/null)
  missing=$(diff <(echo "$prod_cols") <(echo "$dev_cols") | grep '>' | sed 's/> //')
  if [ -n "$missing" ]; then
    echo "=== $t ==="
    echo "$missing"
  fi
done
echo "COLUMN_CHECK_DONE"
