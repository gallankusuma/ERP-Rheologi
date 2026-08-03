#!/bin/bash
mysql -u erp_user -pErpSecure2024! erp_rheologi -e "SHOW COLUMNS FROM rnd_stability_studies WHERE Field='project_id'"
