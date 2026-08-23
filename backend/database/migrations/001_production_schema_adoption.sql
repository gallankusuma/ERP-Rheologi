-- Adoption of the live erp_rheologi schema, captured from production 21 Aug 2026.
-- Everything here already exists in production; this file makes it reproducible
-- from an empty database and converges deployments that drifted apart.
--
-- Two normalisations keep one stream valid on both engines:
--   utf8mb4_0900_ai_ci -> utf8mb4_unicode_ci  (the former is MySQL 8 only)
--   AUTO_INCREMENT counters dropped           (environment state, not schema)
--
-- Tables are created in foreign-key order. Checks are suspended for the file so a
-- residual forward reference cannot leave the schema half-built.

SET @erp_fk_checks = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `ahsp_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `kode` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `satuan` varchar(50) NOT NULL,
  `version` varchar(20) DEFAULT '2024',
  `status` varchar(20) DEFAULT 'active',
  `harga_tenaga` decimal(15,2) DEFAULT '0.00',
  `harga_bahan` decimal(15,2) DEFAULT '0.00',
  `harga_alat` decimal(15,2) DEFAULT '0.00',
  `harga_langsung` decimal(15,2) DEFAULT '0.00',
  `overhead_profit` decimal(15,2) DEFAULT '0.00',
  `harga_satuan` decimal(15,2) DEFAULT '0.00',
  `approved_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kode` (`kode`),
  KEY `idx_kode` (`kode`),
  KEY `idx_status` (`status`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `step_order` int NOT NULL,
  `approver_id` int DEFAULT NULL,
  `action` varchar(50) NOT NULL,
  `comments` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_actions_request` (`request_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_delegations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_user_id` int NOT NULL,
  `to_user_id` int NOT NULL,
  `module` varchar(100) DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `reason` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `from_user_id` (`from_user_id`),
  KEY `to_user_id` (`to_user_id`),
  CONSTRAINT `approval_delegations_ibfk_1` FOREIGN KEY (`from_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `approval_delegations_ibfk_2` FOREIGN KEY (`to_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_escalations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module` varchar(100) NOT NULL,
  `hours_threshold` int NOT NULL DEFAULT '24',
  `escalate_to_user_id` int DEFAULT NULL,
  `escalate_to_role_id` int DEFAULT NULL,
  `notify_requester` tinyint(1) DEFAULT '1',
  `notify_admin` tinyint(1) DEFAULT '1',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `escalate_to_user_id` (`escalate_to_user_id`),
  KEY `escalate_to_role_id` (`escalate_to_role_id`),
  CONSTRAINT `approval_escalations_ibfk_1` FOREIGN KEY (`escalate_to_user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `approval_escalations_ibfk_2` FOREIGN KEY (`escalate_to_role_id`) REFERENCES `roles` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(100) NOT NULL,
  `module` varchar(100) NOT NULL,
  `entity_type` varchar(100) NOT NULL,
  `entity_id` int NOT NULL,
  `requester_id` int DEFAULT NULL,
  `current_step` int DEFAULT '1',
  `status` varchar(50) DEFAULT 'pending',
  `submitted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`),
  KEY `idx_approval_requests_module_status` (`module`,`status`),
  KEY `idx_approval_requests_entity` (`entity_type`,`entity_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `module` varchar(100) NOT NULL,
  `name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_rules_module` (`module`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `chart_of_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_code` varchar(20) NOT NULL,
  `account_name` varchar(200) NOT NULL,
  `account_type` enum('asset','liability','equity','revenue','cogs','expense','other_income','tax') NOT NULL,
  `parent_id` int DEFAULT NULL,
  `level` int DEFAULT '1',
  `is_header` tinyint(1) DEFAULT '0' COMMENT 'Header accounts cannot have journal entries',
  `is_active` tinyint(1) DEFAULT '1',
  `normal_balance` enum('debit','credit') NOT NULL,
  `description` text,
  `opening_balance` decimal(18,2) DEFAULT '0.00',
  `current_balance` decimal(18,2) DEFAULT '0.00',
  `currency` varchar(3) DEFAULT 'IDR',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `account_code` (`account_code`),
  KEY `idx_coa_type` (`account_type`),
  KEY `idx_coa_parent` (`parent_id`),
  KEY `idx_coa_code` (`account_code`),
  CONSTRAINT `chart_of_accounts_ibfk_1` FOREIGN KEY (`parent_id`) REFERENCES `chart_of_accounts` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(10) NOT NULL,
  `description` varchar(255) DEFAULT NULL,
  `color` varchar(20) DEFAULT '#3B82F6',
  `sort_order` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `color` varchar(20) DEFAULT 'gray',
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `color` varchar(20) DEFAULT 'blue',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `crm_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) DEFAULT NULL,
  `content` text NOT NULL,
  `color` varchar(20) DEFAULT 'yellow',
  `is_pinned` tinyint DEFAULT '0',
  `category` varchar(50) DEFAULT 'general',
  `linked_type` varchar(50) DEFAULT NULL,
  `linked_id` int DEFAULT NULL,
  `linked_name` varchar(255) DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_pinned` (`is_pinned`),
  KEY `idx_linked` (`linked_type`,`linked_id`),
  KEY `idx_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `document_control` (
  `id` int NOT NULL AUTO_INCREMENT,
  `document_name` varchar(255) NOT NULL,
  `document_number` varchar(100) DEFAULT NULL,
  `document_type` varchar(50) DEFAULT NULL,
  `issued_by` varchar(255) DEFAULT NULL,
  `issue_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `reminder_days` int DEFAULT '30',
  `file_path` varchar(255) DEFAULT NULL,
  `file_name` varchar(255) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `mime_type` varchar(100) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Active',
  `notes` text,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `document_control_ibfk_1` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `email_accounts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `email_address` varchar(255) NOT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `imap_host` varchar(255) DEFAULT 'imap.gmail.com',
  `imap_port` int DEFAULT '993',
  `smtp_host` varchar(255) DEFAULT 'smtp.gmail.com',
  `smtp_port` int DEFAULT '465',
  `password_encrypted` text NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `last_synced_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_email_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `engineering_inputs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `element_type` varchar(50) NOT NULL,
  `element_name` varchar(100) NOT NULL,
  `parameters` json DEFAULT NULL,
  `quantities` json DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `event_types` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `color` varchar(20) DEFAULT 'blue',
  `icon` varchar(50) DEFAULT NULL,
  `is_system` tinyint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fiscal_periods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `period_name` varchar(50) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `fiscal_year` int NOT NULL,
  `period_number` int NOT NULL COMMENT '1-12 for monthly',
  `status` enum('open','closing','closed') DEFAULT 'open',
  `closed_by` int DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_fiscal_period` (`fiscal_year`,`period_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `forecast_brands` (
  `id` int NOT NULL AUTO_INCREMENT,
  `brand_name` varchar(100) NOT NULL,
  `type` varchar(20) DEFAULT 'Brand',
  `product_id` int DEFAULT NULL,
  `conversion_rate` decimal(15,4) NOT NULL DEFAULT '1.0000',
  `conversion_uom` varchar(20) DEFAULT 'ltr',
  `notes` text,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `forecast_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `forecast_number` varchar(30) NOT NULL,
  `period_year` int NOT NULL,
  `period_month` int NOT NULL,
  `status` varchar(20) DEFAULT 'Draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fund_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(100) NOT NULL,
  `request_date` date NOT NULL,
  `po_id` int DEFAULT NULL,
  `po_schedule_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `amount` decimal(15,2) NOT NULL,
  `needed_date` date NOT NULL,
  `purpose` text NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'draft',
  `requester_id` int DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `cash_account` varchar(255) DEFAULT NULL,
  `cash_account_note` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`),
  KEY `idx_fund_requests_status` (`status`),
  KEY `idx_fund_requests_needed_date` (`needed_date`),
  KEY `idx_fund_requests_po` (`po_id`),
  KEY `idx_fund_requests_schedule` (`po_schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inbox_notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(50) NOT NULL DEFAULT 'system',
  `title` varchar(255) NOT NULL,
  `message` text,
  `link` varchar(255) DEFAULT NULL,
  `ref_id` int DEFAULT NULL,
  `ref_type` varchar(50) DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_read` (`user_id`,`is_read`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `inbox_notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory_lots` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lot_number` varchar(100) NOT NULL,
  `product_id` int NOT NULL,
  `source_type` varchar(50) NOT NULL,
  `source_document_id` int NOT NULL,
  `source_line_id` int NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `manufacture_date` date DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `qc_policy` varchar(50) NOT NULL DEFAULT 'NOT_REQUIRED',
  `status` varchar(50) NOT NULL DEFAULT 'available',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `lot_number` (`lot_number`),
  UNIQUE KEY `idx_lot_source` (`source_type`,`source_document_id`,`source_line_id`),
  KEY `idx_lot_product` (`product_id`),
  KEY `idx_lot_batch` (`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_labels` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) NOT NULL DEFAULT '#3b82f6',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_stages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `color` varchar(50) DEFAULT '#6b7280',
  `sort_order` int DEFAULT '0',
  `is_default` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_system` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `leads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `company` varchar(200) NOT NULL,
  `contact_name` varchar(200) DEFAULT NULL,
  `email` varchar(200) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `stage` varchar(50) DEFAULT 'New',
  `value` decimal(15,2) DEFAULT '0.00',
  `probability` int DEFAULT '10',
  `source` varchar(100) DEFAULT NULL,
  `color` varchar(20) DEFAULT NULL,
  `notes` text,
  `assigned_to` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `client_id` int DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `description` text,
  `cover_image` varchar(255) DEFAULT NULL,
  `is_archived` tinyint(1) DEFAULT '0',
  `contact_title` varchar(150) DEFAULT NULL,
  `industry` varchar(100) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `temperature` varchar(20) DEFAULT NULL,
  `interest` text,
  `next_follow_up` date DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'IDR',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `line_processes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `code` varchar(50) DEFAULT NULL,
  `description` text,
  `capacity_per_hour` decimal(15,2) DEFAULT NULL,
  `capacity_unit_id` int DEFAULT NULL,
  `capacity_unit` varchar(50) DEFAULT NULL,
  `active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `working_hours_per_week` decimal(5,2) NOT NULL DEFAULT '40.00',
  `shifts_per_day` int NOT NULL DEFAULT '1',
  `hours_per_shift` decimal(5,2) NOT NULL DEFAULT '8.00',
  `machine_type` varchar(100) DEFAULT NULL,
  `manufacturer` varchar(255) DEFAULT NULL,
  `installation_year` int DEFAULT NULL,
  `power_kw` decimal(10,2) DEFAULT NULL,
  `energy_notes` text,
  `utilities` text,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `master_disciplines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `order_no` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_code` (`code`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `master_equipment` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `satuan` varchar(50) NOT NULL,
  `harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `vendor` varchar(255) DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_vendor` (`vendor`),
  CONSTRAINT `master_equipment_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `master_labor` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) DEFAULT NULL,
  `name` varchar(150) NOT NULL,
  `satuan` varchar(50) NOT NULL,
  `harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `master_materials` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) DEFAULT NULL,
  `jenis` varchar(100) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `satuan` varchar(50) NOT NULL,
  `harga` decimal(15,2) NOT NULL DEFAULT '0.00',
  `vendor` varchar(255) DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jenis` (`jenis`),
  KEY `idx_name` (`name`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_vendor` (`vendor`),
  CONSTRAINT `master_materials_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `material_vendor_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `vendor_id` int DEFAULT NULL,
  `vendor_name` varchar(255) NOT NULL,
  `source` varchar(255) DEFAULT 'offline',
  `price` decimal(15,2) NOT NULL,
  `currency` varchar(10) DEFAULT 'IDR',
  `unit` varchar(50) DEFAULT NULL,
  `url` text,
  `rating` decimal(3,1) DEFAULT NULL,
  `contact` varchar(255) DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `min_order_qty` int DEFAULT NULL,
  `lead_time_days` int DEFAULT NULL,
  `notes` text,
  `quoted_at` datetime DEFAULT NULL,
  `valid_until` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `is_selected` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mps_detail_sources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mps_detail_id` int NOT NULL,
  `source_type` enum('SO_ITEM','PROJECT','FORECAST') NOT NULL,
  `so_item_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `forecast_header_id` int DEFAULT NULL,
  `week_number` int DEFAULT NULL,
  `year` int DEFAULT NULL,
  `quantity` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_so_item` (`so_item_id`),
  UNIQUE KEY `uq_project` (`project_id`),
  KEY `idx_detail` (`mps_detail_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mps_headers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mps_number` varchar(50) NOT NULL,
  `period_year` int NOT NULL,
  `period_month` int NOT NULL,
  `scheme` varchar(10) DEFAULT 'MTO',
  `status` varchar(20) DEFAULT 'Draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `confirmed_by` int DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mps_number` (`mps_number`),
  UNIQUE KEY `uq_period` (`period_year`,`period_month`,`scheme`),
  KEY `created_by` (`created_by`),
  KEY `confirmed_by` (`confirmed_by`),
  CONSTRAINT `mps_headers_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `mps_headers_ibfk_2` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mrp_material_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `lead_time` int NOT NULL DEFAULT '2' COMMENT 'weeks',
  `first_stock` decimal(15,2) DEFAULT '0.00',
  `order_quantity` decimal(15,2) DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `material_id` (`material_id`),
  CONSTRAINT `mrp_material_settings_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mrp_planned_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `material_id` int NOT NULL,
  `week_number` int NOT NULL,
  `year` int NOT NULL,
  `planned_order_release` decimal(15,2) DEFAULT '0.00',
  `planned_order_receipt` decimal(15,2) DEFAULT '0.00',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mrp_planned` (`material_id`,`week_number`,`year`),
  CONSTRAINT `mrp_planned_orders_ibfk_1` FOREIGN KEY (`material_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payroll_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(50) NOT NULL,
  `period_month` int NOT NULL,
  `period_year` int NOT NULL,
  `due_date` date DEFAULT NULL,
  `total_amount` decimal(15,2) DEFAULT '0.00',
  `employee_count` int DEFAULT '0',
  `purpose` varchar(255) DEFAULT NULL,
  `notes` text,
  `status` varchar(30) DEFAULT 'draft',
  `approval_status` int DEFAULT '0',
  `requester_id` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payslip_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `period_month` int NOT NULL,
  `period_year` int NOT NULL,
  `project_id` int DEFAULT NULL,
  `total_days` decimal(5,2) DEFAULT '0.00',
  `total_ot_hours` decimal(6,2) DEFAULT '0.00',
  `basic_salary` decimal(12,2) DEFAULT '0.00',
  `tunjangan` decimal(12,2) DEFAULT '0.00',
  `ot_pay` decimal(12,2) DEFAULT '0.00',
  `gross_salary` decimal(12,2) DEFAULT '0.00',
  `advance_1` decimal(12,2) DEFAULT '0.00',
  `advance_2` decimal(12,2) DEFAULT '0.00',
  `reimbursement` decimal(12,2) DEFAULT '0.00',
  `bpjs_kes` decimal(12,2) DEFAULT '0.00',
  `bpjs_tk` decimal(12,2) DEFAULT '0.00',
  `pph21` decimal(12,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT '0.00',
  `net_salary` decimal(12,2) DEFAULT '0.00',
  `notes` text,
  `status` varchar(10) DEFAULT 'draft',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `payslip_records_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `position_rates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `position_code` varchar(30) NOT NULL,
  `position_name` varchar(100) NOT NULL,
  `grade` varchar(30) DEFAULT NULL,
  `salary_type` varchar(10) NOT NULL DEFAULT 'daily',
  `basic_rate` decimal(12,2) NOT NULL DEFAULT '0.00',
  `tunjangan_rate` decimal(12,2) NOT NULL DEFAULT '0.00',
  `ot_rate` decimal(12,2) NOT NULL DEFAULT '0.00',
  `description` text,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `position_code` (`position_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pr_bids` (
  `id` int NOT NULL AUTO_INCREMENT,
  `pr_id` int NOT NULL,
  `vendor_id` int DEFAULT NULL,
  `vendor_name` varchar(255) NOT NULL,
  `contact_person` varchar(255) DEFAULT NULL,
  `phone` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `bid_date` date DEFAULT NULL,
  `total_amount` decimal(18,2) DEFAULT '0.00',
  `status` enum('active','selected','rejected') DEFAULT 'active',
  `delivery_time_days` int DEFAULT NULL,
  `notes` text,
  `quotation_file` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `pr_id` (`pr_id`),
  KEY `vendor_id` (`vendor_id`),
  CONSTRAINT `pr_bids_ibfk_1` FOREIGN KEY (`pr_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `pr_bids_ibfk_2` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_document_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `color` varchar(20) DEFAULT '#3b82f6',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prospects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `company_name` varchar(255) NOT NULL,
  `contact_name` varchar(255) DEFAULT NULL,
  `contact_title` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `industry` varchar(150) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT 'Indonesia',
  `source` varchar(50) DEFAULT 'other',
  `temperature` varchar(20) DEFAULT 'cold',
  `status` varchar(50) DEFAULT 'new',
  `interest` text,
  `estimated_value` decimal(15,2) DEFAULT '0.00',
  `next_follow_up` date DEFAULT NULL,
  `last_contacted_at` timestamp NULL DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `notes` text,
  `converted_to_client_id` int DEFAULT NULL,
  `converted_to_lead_id` int DEFAULT NULL,
  `converted_at` timestamp NULL DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_archived` tinyint(1) DEFAULT '0',
  `currency` varchar(10) NOT NULL DEFAULT 'IDR',
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  UNIQUE KEY `uq_prospects_code` (`code`),
  KEY `idx_temperature` (`temperature`),
  KEY `idx_status` (`status`),
  KEY `idx_source` (`source`),
  KEY `idx_next_follow_up` (`next_follow_up`),
  KEY `idx_assigned_to` (`assigned_to`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `purchase_order_payment_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `po_id` int NOT NULL,
  `schedule_no` int NOT NULL,
  `label` varchar(100) NOT NULL,
  `trigger_type` varchar(50) NOT NULL DEFAULT 'manual',
  `percentage` decimal(7,2) NOT NULL DEFAULT '0.00',
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `due_date` date DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'open',
  `paid_amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `ap_id` int DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_po_schedule_no` (`po_id`,`schedule_no`),
  KEY `idx_po_schedule_due_date` (`due_date`),
  KEY `idx_po_schedule_status` (`status`),
  CONSTRAINT `fk_po_schedule_po` FOREIGN KEY (`po_id`) REFERENCES `purchase_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fpa_id` int NOT NULL,
  `event_type` varchar(50) NOT NULL,
  `actor_id` int DEFAULT NULL,
  `payload` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_fpa_audit` (`fpa_id`),
  KEY `idx_type_audit` (`event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_instruments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `calibration_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_methods` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_ncr` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ncr_number` varchar(50) DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `batch_id` int DEFAULT NULL,
  `category` varchar(50) DEFAULT 'product',
  `severity` varchar(20) DEFAULT 'minor',
  `description` text NOT NULL,
  `root_cause` text,
  `corrective_action` text,
  `preventive_action` text,
  `status` varchar(30) DEFAULT 'open',
  `reported_by` int DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `source_fpa_id` int DEFAULT NULL,
  `source_type` varchar(30) DEFAULT 'manual',
  PRIMARY KEY (`id`),
  UNIQUE KEY `ncr_number` (`ncr_number`),
  KEY `product_id` (`product_id`),
  KEY `batch_id` (`batch_id`),
  KEY `reported_by` (`reported_by`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `qc_ncr_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `qc_ncr_ibfk_2` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`),
  CONSTRAINT `qc_ncr_ibfk_3` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`),
  CONSTRAINT `qc_ncr_ibfk_4` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `param_type` varchar(20) DEFAULT 'quantitative',
  `code` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_sampling_areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_sampling_plans` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int DEFAULT NULL,
  `test_id` int DEFAULT NULL,
  `sample_size` int DEFAULT '1',
  `frequency` varchar(50) DEFAULT 'per_batch',
  `aql_level` varchar(20) DEFAULT '1.0',
  `inspection_level` varchar(50) DEFAULT 'normal',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `test_id` (`test_id`),
  CONSTRAINT `qc_sampling_plans_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `qc_sampling_plans_ibfk_2` FOREIGN KEY (`test_id`) REFERENCES `qc_tests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_test_definitions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `test_id` int NOT NULL,
  `min_value` float DEFAULT NULL,
  `max_value` float DEFAULT NULL,
  `target_value` varchar(255) DEFAULT NULL,
  `is_required` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `test_id` (`test_id`),
  CONSTRAINT `qc_test_definitions_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `qc_test_definitions_ibfk_2` FOREIGN KEY (`test_id`) REFERENCES `qc_tests` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_user_areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `area_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_user_area` (`user_id`,`area_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `project_type` enum('new_product','reformulation','cost_reduction','process_improvement','raw_material_evaluation','custom_request','regulatory','other') DEFAULT 'new_product',
  `category` enum('chemical','polymer','coating','adhesive','additive','surfactant','agrochemical','pharmaceutical','other') DEFAULT 'chemical',
  `regulatory_requirements` varchar(255) DEFAULT NULL,
  `target_market` varchar(255) DEFAULT NULL,
  `target_product` varchar(255) DEFAULT NULL,
  `expected_output` text,
  `risk_level` enum('low','medium','high') DEFAULT 'medium',
  `confidentiality` enum('public','internal','confidential','highly_confidential') DEFAULT 'internal',
  `team_members` text,
  `tags` varchar(500) DEFAULT NULL,
  `description` text,
  `objectives` text,
  `status` enum('draft','active','on_hold','completed','cancelled') DEFAULT 'draft',
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `project_leader_id` int DEFAULT NULL,
  `department_id` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `target_end_date` date DEFAULT NULL,
  `actual_end_date` date DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT '0.00',
  `spent` decimal(15,2) DEFAULT '0.00',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_code` (`project_code`),
  KEY `project_leader_id` (`project_leader_id`),
  KEY `department_id` (`department_id`),
  CONSTRAINT `rnd_projects_ibfk_1` FOREIGN KEY (`project_leader_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_projects_ibfk_2` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_specifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fbox_id` int DEFAULT NULL,
  `doc_number` varchar(50) DEFAULT NULL,
  `doc_date` date DEFAULT NULL,
  `process_type` varchar(100) DEFAULT NULL,
  `process_type_code` varchar(10) DEFAULT NULL,
  `sample_name` text,
  `sample_type` varchar(100) DEFAULT NULL,
  `sample_type_code` varchar(20) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `notes` text,
  `revision` tinyint(1) DEFAULT '0',
  `revision_no` int DEFAULT '0',
  `revision_by` varchar(100) DEFAULT NULL,
  `revision_date` datetime DEFAULT NULL,
  `approve_1` tinyint(1) DEFAULT '0',
  `approve_1_by` varchar(100) DEFAULT NULL,
  `approve_1_date` datetime DEFAULT NULL,
  `source` varchar(20) DEFAULT 'FBOX',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `fbox_id` (`fbox_id`),
  KEY `idx_doc_number` (`doc_number`),
  KEY `idx_process_type_code` (`process_type_code`),
  KEY `idx_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `salary_advances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `employee_id` int NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT '0.00',
  `remaining` decimal(12,2) NOT NULL DEFAULT '0.00',
  `description` text,
  `advance_date` date DEFAULT NULL,
  `period_month` int DEFAULT NULL,
  `period_year` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `kasbon_request_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `employee_id` (`employee_id`),
  CONSTRAINT `salary_advances_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sample_request_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_request_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sr_comments_sr` (`sample_request_id`),
  KEY `idx_sr_comments_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sample_request_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_request_id` int NOT NULL,
  `category` enum('foto','tanda_terima','coa') NOT NULL DEFAULT 'foto',
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) NOT NULL,
  `file_size` int DEFAULT '0',
  `mime_type` varchar(100) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sr_files_sr` (`sample_request_id`),
  KEY `idx_sr_files_cat` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `sample_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_number` varchar(50) NOT NULL,
  `client_id` int NOT NULL,
  `sales_user_id` int NOT NULL,
  `rnd_user_id` int DEFAULT NULL,
  `product_name` varchar(255) NOT NULL,
  `specifications` text,
  `quantity` int NOT NULL DEFAULT '1',
  `unit` varchar(50) DEFAULT 'pcs',
  `request_date` datetime DEFAULT CURRENT_TIMESTAMP,
  `target_delivery_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Requested',
  `delivery_tracking` varchar(255) DEFAULT NULL,
  `client_feedback` text,
  `feedback_date` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `request_number` (`request_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_opname` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opname_number` varchar(50) NOT NULL,
  `warehouse_id` int NOT NULL,
  `status` enum('draft','posted','cancelled') DEFAULT 'draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `posted_by` int DEFAULT NULL,
  `posted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `opname_number` (`opname_number`),
  KEY `warehouse_id` (`warehouse_id`),
  KEY `created_by` (`created_by`),
  KEY `posted_by` (`posted_by`),
  CONSTRAINT `stock_opname_ibfk_1` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `stock_opname_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `stock_opname_ibfk_3` FOREIGN KEY (`posted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_transfers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `transfer_number` varchar(50) DEFAULT NULL,
  `product_id` int NOT NULL,
  `from_warehouse_id` int NOT NULL,
  `to_warehouse_id` int NOT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `transfer_number` (`transfer_number`),
  KEY `product_id` (`product_id`),
  KEY `from_warehouse_id` (`from_warehouse_id`),
  KEY `to_warehouse_id` (`to_warehouse_id`),
  CONSTRAINT `stock_transfers_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `stock_transfers_ibfk_2` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `stock_transfers_ibfk_3` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `vendor_prices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `vendor_id` int NOT NULL,
  `product_id` int NOT NULL,
  `price` decimal(18,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) DEFAULT 'IDR',
  `effective_date` date NOT NULL,
  `valid_until` date DEFAULT NULL,
  `min_order_qty` decimal(18,2) DEFAULT '0.00',
  `lead_time_days` int DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `idx_vendor_product` (`vendor_id`,`product_id`),
  CONSTRAINT `vendor_prices_ibfk_1` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vendor_prices_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wo_daily_schedule` (
  `id` int NOT NULL AUTO_INCREMENT,
  `wo_id` int NOT NULL,
  `schedule_date` date NOT NULL,
  `planned_qty` decimal(15,2) NOT NULL DEFAULT '0.00',
  `actual_qty` decimal(15,2) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_wo_day` (`wo_id`,`schedule_date`),
  KEY `idx_schedule_date` (`schedule_date`),
  CONSTRAINT `fk_wo_daily_schedule_wo` FOREIGN KEY (`wo_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wo_material_issues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `wo_material_id` int NOT NULL,
  `wo_id` int NOT NULL,
  `product_id` int NOT NULL,
  `warehouse_id` int NOT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `quantity` decimal(15,4) NOT NULL,
  `issued_by` int DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reversal_of` int DEFAULT NULL COMMENT 'If this is a reversal, reference the original issue ID',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wmi_wo_material` (`wo_material_id`),
  KEY `idx_wmi_wo` (`wo_id`),
  KEY `idx_wmi_product` (`product_id`),
  KEY `idx_wmi_warehouse` (`warehouse_id`),
  KEY `idx_wmi_batch` (`batch_number`),
  KEY `fk_wmi_issued_by` (`issued_by`),
  CONSTRAINT `fk_wmi_issued_by` FOREIGN KEY (`issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_wmi_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `fk_wmi_warehouse` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`),
  CONSTRAINT `fk_wmi_wo` FOREIGN KEY (`wo_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wmi_wo_material` FOREIGN KEY (`wo_material_id`) REFERENCES `wo_materials` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wo_qc_checkpoints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `wo_id` int NOT NULL,
  `process_stage` varchar(100) NOT NULL,
  `is_mandatory` tinyint(1) DEFAULT '1',
  `qc_type` varchar(50) DEFAULT 'LP',
  `status` varchar(50) DEFAULT 'pending',
  `fpa_id` int DEFAULT NULL,
  `triggered_at` timestamp NULL DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wo_id` (`wo_id`),
  CONSTRAINT `wo_qc_checkpoints_ibfk_1` FOREIGN KEY (`wo_id`) REFERENCES `work_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `wo_reschedule_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `wo_id` int NOT NULL,
  `old_week_number` tinyint DEFAULT NULL,
  `old_year` int DEFAULT NULL,
  `old_scheduled_start` date DEFAULT NULL,
  `old_scheduled_end` date DEFAULT NULL,
  `old_quantity` decimal(15,4) DEFAULT NULL,
  `new_week_number` tinyint DEFAULT NULL,
  `new_year` int DEFAULT NULL,
  `new_scheduled_start` date DEFAULT NULL,
  `new_scheduled_end` date DEFAULT NULL,
  `new_quantity` decimal(15,4) DEFAULT NULL,
  `reason` text NOT NULL,
  `rescheduled_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_wo_id` (`wo_id`),
  CONSTRAINT `wo_reschedule_log_ibfk_1` FOREIGN KEY (`wo_id`) REFERENCES `work_orders` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_conversations` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` varchar(30) NOT NULL DEFAULT 'group',
  `name` varchar(255) DEFAULT NULL,
  `description` text,
  `entity_type` varchar(80) DEFAULT NULL,
  `entity_id` varchar(100) DEFAULT NULL,
  `entity_label` varchar(255) DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  `last_message_id` bigint DEFAULT NULL,
  `last_message_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workhub_entity` (`entity_type`,`entity_id`),
  KEY `idx_workhub_conversation_type` (`type`),
  KEY `idx_workhub_conversation_last_message` (`last_message_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_device_tokens` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `user_id` bigint NOT NULL,
  `token` varchar(500) NOT NULL,
  `platform` varchar(30) DEFAULT NULL,
  `device_name` varchar(120) DEFAULT NULL,
  `last_seen_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workhub_device_token` (`token`(191)),
  KEY `idx_workhub_device_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ahsp_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ahsp_id` int NOT NULL,
  `section` char(1) NOT NULL,
  `resource_type` varchar(20) NOT NULL,
  `resource_id` int NOT NULL,
  `koefisien` decimal(10,4) NOT NULL DEFAULT '0.0000',
  `resource_name` varchar(255) DEFAULT NULL,
  `resource_satuan` varchar(50) DEFAULT NULL,
  `resource_harga` decimal(15,2) DEFAULT NULL,
  `jumlah_harga` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ahsp` (`ahsp_id`),
  KEY `idx_section` (`section`),
  KEY `idx_resource` (`resource_type`,`resource_id`),
  CONSTRAINT `ahsp_items_ibfk_1` FOREIGN KEY (`ahsp_id`) REFERENCES `ahsp_headers` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `approval_rule_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rule_id` int NOT NULL,
  `step_order` int NOT NULL,
  `approver_user_id` int DEFAULT NULL,
  `approver_role_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_approval_rule_steps_rule` (`rule_id`),
  CONSTRAINT `fk_ars_rule` FOREIGN KEY (`rule_id`) REFERENCES `approval_rules` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `clients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `organization` varchar(255) DEFAULT NULL,
  `address` text,
  `city` varchar(100) DEFAULT NULL,
  `province` varchar(100) DEFAULT NULL,
  `postal_code` varchar(20) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `website` varchar(255) DEFAULT NULL,
  `client_group_id` int DEFAULT NULL,
  `primary_contact_id` int DEFAULT NULL,
  `total_invoiced` decimal(15,2) DEFAULT '0.00',
  `payment_received` decimal(15,2) DEFAULT '0.00',
  `due_amount` decimal(15,2) DEFAULT '0.00',
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `industry` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`),
  KEY `idx_clients_code` (`code`),
  KEY `idx_clients_name` (`name`),
  KEY `idx_clients_group` (`client_group_id`),
  KEY `idx_clients_active` (`is_active`),
  CONSTRAINT `clients_ibfk_1` FOREIGN KEY (`client_group_id`) REFERENCES `client_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `forecast_monthly_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `year` int NOT NULL,
  `brand_id` int NOT NULL,
  `month` int NOT NULL,
  `forecast_qty` decimal(15,2) DEFAULT '0.00',
  `product_qty` decimal(15,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_yearly_brand_month` (`year`,`brand_id`,`month`),
  KEY `brand_id` (`brand_id`),
  CONSTRAINT `forecast_monthly_data_ibfk_1` FOREIGN KEY (`brand_id`) REFERENCES `forecast_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `forecast_week_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `forecast_header_id` int NOT NULL,
  `brand_id` int NOT NULL,
  `week_number` int NOT NULL,
  `year` int NOT NULL,
  `forecast_qty` decimal(15,2) DEFAULT '0.00',
  `product_qty` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_forecast_brand_week` (`forecast_header_id`,`brand_id`,`week_number`,`year`),
  KEY `brand_id` (`brand_id`),
  CONSTRAINT `forecast_week_data_ibfk_1` FOREIGN KEY (`forecast_header_id`) REFERENCES `forecast_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `forecast_week_data_ibfk_2` FOREIGN KEY (`brand_id`) REFERENCES `forecast_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `fund_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fund_request_id` int NOT NULL,
  `po_id` int DEFAULT NULL,
  `po_schedule_id` int DEFAULT NULL,
  `vendor_id` int DEFAULT NULL,
  `description` text,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `status` varchar(30) NOT NULL DEFAULT 'pending',
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `ap_id` int DEFAULT NULL,
  `payment_recorded_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fri_fr` (`fund_request_id`),
  KEY `idx_fri_po` (`po_id`),
  KEY `idx_fri_schedule` (`po_schedule_id`),
  KEY `idx_fri_status` (`status`),
  CONSTRAINT `fk_fri_fr` FOREIGN KEY (`fund_request_id`) REFERENCES `fund_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `gl_balances` (
  `id` int NOT NULL AUTO_INCREMENT,
  `account_id` int NOT NULL,
  `fiscal_period_id` int NOT NULL,
  `opening_balance` decimal(18,2) DEFAULT '0.00',
  `debit_total` decimal(18,2) DEFAULT '0.00',
  `credit_total` decimal(18,2) DEFAULT '0.00',
  `closing_balance` decimal(18,2) DEFAULT '0.00',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_gl_balance` (`account_id`,`fiscal_period_id`),
  KEY `fiscal_period_id` (`fiscal_period_id`),
  CONSTRAINT `gl_balances_ibfk_1` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`),
  CONSTRAINT `gl_balances_ibfk_2` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `journal_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entry_number` varchar(30) NOT NULL,
  `entry_date` date NOT NULL,
  `fiscal_period_id` int DEFAULT NULL,
  `description` text NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL COMMENT 'invoice, payment, adjustment, etc.',
  `reference_id` int DEFAULT NULL COMMENT 'ID of the source document',
  `reference_number` varchar(50) DEFAULT NULL,
  `total_debit` decimal(18,2) DEFAULT '0.00',
  `total_credit` decimal(18,2) DEFAULT '0.00',
  `status` enum('draft','posted','voided') DEFAULT 'draft',
  `is_auto_generated` tinyint(1) DEFAULT '0',
  `posted_by` int DEFAULT NULL,
  `posted_at` timestamp NULL DEFAULT NULL,
  `voided_by` int DEFAULT NULL,
  `voided_at` timestamp NULL DEFAULT NULL,
  `void_reason` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `entry_number` (`entry_number`),
  KEY `fiscal_period_id` (`fiscal_period_id`),
  KEY `idx_je_date` (`entry_date`),
  KEY `idx_je_status` (`status`),
  KEY `idx_je_ref` (`reference_type`,`reference_id`),
  CONSTRAINT `journal_entries_ibfk_1` FOREIGN KEY (`fiscal_period_id`) REFERENCES `fiscal_periods` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `lead_activities_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_assignees` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `user_id` int NOT NULL,
  `assigned_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `assigned_by` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lead_user` (`lead_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `lead_assignees_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_assignees_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_attachments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `lead_attachments_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_attachments_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_checklists` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `title` varchar(255) NOT NULL DEFAULT 'Checklist',
  `position` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  CONSTRAINT `lead_checklists_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `lead_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lead_id` (`lead_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `lead_comments_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_label_assignments` (
  `lead_id` int NOT NULL,
  `label_id` int NOT NULL,
  PRIMARY KEY (`lead_id`,`label_id`),
  KEY `label_id` (`label_id`),
  CONSTRAINT `lead_label_assignments_ibfk_1` FOREIGN KEY (`lead_id`) REFERENCES `leads` (`id`) ON DELETE CASCADE,
  CONSTRAINT `lead_label_assignments_ibfk_2` FOREIGN KEY (`label_id`) REFERENCES `lead_labels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `line_process_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_process_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `doc_type` enum('manual','certificate','sop','spec','drawing','other') DEFAULT 'other',
  `file_url` varchar(500) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `line_process_id` (`line_process_id`),
  CONSTRAINT `line_process_documents_ibfk_1` FOREIGN KEY (`line_process_id`) REFERENCES `line_processes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `line_process_products` (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_process_id` int NOT NULL,
  `product_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_line_product` (`line_process_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `line_process_products_ibfk_1` FOREIGN KEY (`line_process_id`) REFERENCES `line_processes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `line_process_products_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `line_process_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `line_process_id` int NOT NULL,
  `step_order` int NOT NULL DEFAULT '1',
  `process_name` varchar(100) NOT NULL,
  `description` text,
  `standard_duration_minutes` int DEFAULT NULL,
  `is_qc_checkpoint` tinyint DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `line_process_id` (`line_process_id`),
  CONSTRAINT `line_process_steps_ibfk_1` FOREIGN KEY (`line_process_id`) REFERENCES `line_processes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `master_sub_disciplines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `discipline_id` int NOT NULL,
  `code` varchar(50) NOT NULL,
  `name` varchar(150) NOT NULL,
  `order_no` int DEFAULT '0',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_discipline` (`discipline_id`),
  KEY `idx_code` (`code`),
  KEY `idx_active` (`is_active`),
  CONSTRAINT `master_sub_disciplines_ibfk_1` FOREIGN KEY (`discipline_id`) REFERENCES `master_disciplines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mps_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mps_header_id` int NOT NULL,
  `product_id` int NOT NULL,
  `bom_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `so_id` int DEFAULT NULL,
  `so_item_id` int DEFAULT NULL,
  `demand_qty` decimal(15,2) DEFAULT '0.00',
  `demand_w1` decimal(15,2) DEFAULT '0.00',
  `demand_w2` decimal(15,2) DEFAULT '0.00',
  `demand_w3` decimal(15,2) DEFAULT '0.00',
  `demand_w4` decimal(15,2) DEFAULT '0.00',
  `production_w1` decimal(15,2) DEFAULT '0.00',
  `production_w2` decimal(15,2) DEFAULT '0.00',
  `production_w3` decimal(15,2) DEFAULT '0.00',
  `production_w4` decimal(15,2) DEFAULT '0.00',
  `beginning_inv` decimal(15,2) DEFAULT '0.00',
  `ending_inv` decimal(15,2) DEFAULT '0.00',
  `wo_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Pending',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `current_stock` decimal(15,2) DEFAULT '0.00',
  `batch_no` varchar(50) DEFAULT NULL,
  `batch_qty` decimal(15,2) DEFAULT '0.00',
  `lead_time_weeks` int DEFAULT '1',
  `buffer_stock` decimal(15,2) DEFAULT '0.00',
  `so_numbers` text,
  PRIMARY KEY (`id`),
  KEY `mps_header_id` (`mps_header_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `mps_details_ibfk_1` FOREIGN KEY (`mps_header_id`) REFERENCES `mps_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mps_details_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payroll_request_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `payroll_request_id` int NOT NULL,
  `payslip_record_id` int DEFAULT NULL,
  `employee_id` int NOT NULL,
  `employee_name` varchar(150) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `gross_salary` decimal(12,2) DEFAULT '0.00',
  `total_deductions` decimal(12,2) DEFAULT '0.00',
  `net_salary` decimal(12,2) DEFAULT '0.00',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `payroll_request_id` (`payroll_request_id`),
  CONSTRAINT `payroll_request_items_ibfk_1` FOREIGN KEY (`payroll_request_id`) REFERENCES `payroll_requests` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `pr_bid_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `bid_id` int NOT NULL,
  `item_index` int NOT NULL DEFAULT '0',
  `item_name` varchar(255) DEFAULT NULL,
  `quantity` decimal(18,4) DEFAULT '0.0000',
  `uom` varchar(50) DEFAULT NULL,
  `unit_price` decimal(18,2) DEFAULT '0.00',
  `total_price` decimal(18,2) DEFAULT '0.00',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_winner` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `bid_id` (`bid_id`),
  CONSTRAINT `pr_bid_items_ibfk_1` FOREIGN KEY (`bid_id`) REFERENCES `pr_bids` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `prospect_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `prospect_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action` varchar(100) NOT NULL,
  `details` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_pa_prospect` (`prospect_id`),
  KEY `idx_pa_user` (`user_id`),
  CONSTRAINT `fk_pa_prospect` FOREIGN KEY (`prospect_id`) REFERENCES `prospects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_analysis_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fpa_number` varchar(100) NOT NULL,
  `type` varchar(50) DEFAULT 'LP',
  `reference_id` int DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `product_id` int NOT NULL,
  `sampling_area_id` int DEFAULT NULL,
  `batch_no` varchar(100) DEFAULT NULL,
  `quantity` decimal(15,4) DEFAULT NULL,
  `supplier_id` int DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `result` varchar(50) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `review_notes` text,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sampling_run` int DEFAULT '1',
  `parent_fpa_id` int DEFAULT NULL,
  `approved_by_1` int DEFAULT NULL,
  `approved_at_1` timestamp NULL DEFAULT NULL,
  `approved_by_2` int DEFAULT NULL,
  `approved_at_2` timestamp NULL DEFAULT NULL,
  `needs_resampling` tinyint DEFAULT '0',
  `disposition` varchar(50) DEFAULT NULL,
  `data_complete` tinyint DEFAULT '0',
  `analysis_notes` text,
  `wo_id` int DEFAULT NULL,
  `specification_doc` varchar(100) DEFAULT NULL,
  `sampling_point` varchar(255) DEFAULT NULL,
  `sampling_qty` decimal(15,4) DEFAULT NULL,
  `sampling_unit` varchar(50) DEFAULT NULL,
  `process_type` varchar(100) DEFAULT NULL,
  `sample_type` varchar(100) DEFAULT NULL,
  `process_date` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `sampling_area_id` (`sampling_area_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `qc_analysis_requests_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_analysis_requests_ibfk_2` FOREIGN KEY (`sampling_area_id`) REFERENCES `qc_sampling_areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `qc_analysis_requests_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_ncr_actions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `ncr_id` int NOT NULL,
  `action_type` varchar(30) DEFAULT 'corrective',
  `description` text,
  `due_date` date DEFAULT NULL,
  `status` varchar(20) DEFAULT 'open',
  `action_by` int DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ncr_id` (`ncr_id`),
  KEY `action_by` (`action_by`),
  CONSTRAINT `qc_ncr_actions_ibfk_1` FOREIGN KEY (`ncr_id`) REFERENCES `qc_ncr` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_ncr_actions_ibfk_2` FOREIGN KEY (`action_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_rework_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `rework_number` varchar(50) DEFAULT NULL,
  `ncr_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `batch_id` int DEFAULT NULL,
  `wo_id` int DEFAULT NULL,
  `quantity` decimal(12,2) DEFAULT '0.00',
  `description` text,
  `instructions` text,
  `status` varchar(30) DEFAULT 'pending',
  `created_by` int DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `retest_fpa_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `rework_number` (`rework_number`),
  KEY `ncr_id` (`ncr_id`),
  KEY `product_id` (`product_id`),
  KEY `batch_id` (`batch_id`),
  KEY `wo_id` (`wo_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `qc_rework_orders_ibfk_1` FOREIGN KEY (`ncr_id`) REFERENCES `qc_ncr` (`id`),
  CONSTRAINT `qc_rework_orders_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`),
  CONSTRAINT `qc_rework_orders_ibfk_3` FOREIGN KEY (`batch_id`) REFERENCES `batches` (`id`),
  CONSTRAINT `qc_rework_orders_ibfk_4` FOREIGN KEY (`wo_id`) REFERENCES `work_orders` (`id`),
  CONSTRAINT `qc_rework_orders_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_specifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `product_id` int NOT NULL,
  `qc_type` varchar(30) DEFAULT 'Incoming',
  `parameter_id` int NOT NULL,
  `method_id` int DEFAULT NULL,
  `standard_value` varchar(255) DEFAULT NULL,
  `min_value` float DEFAULT NULL,
  `max_value` float DEFAULT NULL,
  `uom` varchar(50) DEFAULT NULL,
  `is_required` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`),
  KEY `parameter_id` (`parameter_id`),
  KEY `method_id` (`method_id`),
  CONSTRAINT `qc_specifications_ibfk_1` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_specifications_ibfk_2` FOREIGN KEY (`parameter_id`) REFERENCES `qc_parameters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_specifications_ibfk_3` FOREIGN KEY (`method_id`) REFERENCES `qc_methods` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_document_folders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `color` varchar(7) DEFAULT '#3B82F6',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `rnd_document_folders_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_formulations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `formula_code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `version` varchar(20) DEFAULT '1.0',
  `project_id` int DEFAULT NULL,
  `product_type_id` int DEFAULT NULL,
  `status` enum('draft','testing','approved','revision','obsolete') DEFAULT 'draft',
  `target_specs` text,
  `description` text,
  `notes` text,
  `approved_by` int DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `formula_code` (`formula_code`),
  KEY `project_id` (`project_id`),
  KEY `approved_by` (`approved_by`),
  CONSTRAINT `rnd_formulations_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_formulations_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_milestones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `phase` varchar(50) DEFAULT 'formulation_design',
  `status` varchar(20) DEFAULT 'pending',
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `deliverables` text,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `rnd_milestones_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_milestones_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_project_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'todo',
  `priority` enum('low','medium','high','critical') DEFAULT 'medium',
  `assigned_to` int DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `completed_date` date DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `rnd_project_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_project_tasks_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_spec_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `spec_id` int NOT NULL,
  `item_code` varchar(50) DEFAULT NULL,
  `item_description` text,
  `unit` varchar(50) DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_spec_id` (`spec_id`),
  KEY `idx_item_code` (`item_code`),
  CONSTRAINT `rnd_spec_items_ibfk_1` FOREIGN KEY (`spec_id`) REFERENCES `rnd_specifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_spec_samples` (
  `id` int NOT NULL AUTO_INCREMENT,
  `spec_id` int NOT NULL,
  `sample_code` varchar(50) DEFAULT NULL,
  `sample_name` text,
  `brand` varchar(200) DEFAULT NULL,
  `sample_point` varchar(200) DEFAULT NULL,
  `sample_type` varchar(50) DEFAULT NULL,
  `status_spek` varchar(20) DEFAULT NULL,
  `status_off_spek` varchar(50) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_spec_id` (`spec_id`),
  KEY `idx_sample_code` (`sample_code`),
  CONSTRAINT `rnd_spec_samples_ibfk_1` FOREIGN KEY (`spec_id`) REFERENCES `rnd_specifications` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `stock_opname_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `opname_id` int NOT NULL,
  `product_id` int NOT NULL,
  `system_qty` decimal(15,4) DEFAULT '0.0000',
  `actual_qty` decimal(15,4) DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_opname_product` (`opname_id`,`product_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `stock_opname_items_ibfk_1` FOREIGN KEY (`opname_id`) REFERENCES `stock_opname` (`id`) ON DELETE CASCADE,
  CONSTRAINT `stock_opname_items_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_conversation_members` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `role` varchar(30) NOT NULL DEFAULT 'member',
  `last_read_message_id` bigint DEFAULT NULL,
  `last_read_at` timestamp NULL DEFAULT NULL,
  `muted_until` timestamp NULL DEFAULT NULL,
  `archived_at` timestamp NULL DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workhub_conversation_member` (`conversation_id`,`user_id`),
  KEY `idx_workhub_member_user` (`user_id`,`archived_at`),
  CONSTRAINT `fk_workhub_member_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `workhub_conversations` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_messages` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `conversation_id` bigint NOT NULL,
  `sender_id` bigint DEFAULT NULL,
  `type` varchar(30) NOT NULL DEFAULT 'text',
  `body` text,
  `reply_to_id` bigint DEFAULT NULL,
  `client_id` varchar(100) DEFAULT NULL,
  `metadata` longtext,
  `edited_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_workhub_message_client` (`conversation_id`,`sender_id`,`client_id`),
  KEY `idx_workhub_message_conversation` (`conversation_id`,`id`),
  KEY `idx_workhub_message_sender` (`sender_id`,`created_at`),
  KEY `fk_workhub_message_reply` (`reply_to_id`),
  CONSTRAINT `fk_workhub_message_conversation` FOREIGN KEY (`conversation_id`) REFERENCES `workhub_conversations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_workhub_message_reply` FOREIGN KEY (`reply_to_id`) REFERENCES `workhub_messages` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `ahsp_sub_discipline_map` (
  `ahsp_id` int NOT NULL,
  `sub_discipline_id` int NOT NULL,
  PRIMARY KEY (`ahsp_id`,`sub_discipline_id`),
  KEY `sub_discipline_id` (`sub_discipline_id`),
  CONSTRAINT `ahsp_sub_discipline_map_ibfk_1` FOREIGN KEY (`ahsp_id`) REFERENCES `ahsp_headers` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ahsp_sub_discipline_map_ibfk_2` FOREIGN KEY (`sub_discipline_id`) REFERENCES `master_sub_disciplines` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_estimates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `estimate_number` varchar(50) NOT NULL,
  `estimate_date` date NOT NULL,
  `valid_until` date DEFAULT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `status` enum('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `estimate_number` (`estimate_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_estimates_client` (`client_id`),
  KEY `idx_estimates_status` (`status`),
  CONSTRAINT `client_estimates_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_estimates_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_label_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `label_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_client_label` (`client_id`,`label_id`),
  KEY `label_id` (`label_id`),
  CONSTRAINT `client_label_map_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_label_map_ibfk_2` FOREIGN KEY (`label_id`) REFERENCES `client_labels` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_orders` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `order_number` varchar(50) NOT NULL,
  `order_date` date NOT NULL,
  `total_amount` decimal(15,2) NOT NULL,
  `status` enum('draft','confirmed','processing','shipped','delivered','canceled') DEFAULT 'draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `order_number` (`order_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_orders_client` (`client_id`),
  KEY `idx_orders_status` (`status`),
  CONSTRAINT `client_orders_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_orders_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `proposal_number` varchar(50) NOT NULL,
  `title` varchar(255) NOT NULL,
  `proposal_date` date NOT NULL,
  `total_amount` decimal(15,2) DEFAULT NULL,
  `status` enum('draft','sent','accepted','rejected','in_progress') DEFAULT 'draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `proposal_number` (`proposal_number`),
  KEY `created_by` (`created_by`),
  KEY `idx_proposals_client` (`client_id`),
  KEY `idx_proposals_status` (`status`),
  CONSTRAINT `client_proposals_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_proposals_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `contacts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `job_title` varchar(100) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `mobile` varchar(50) DEFAULT NULL,
  `is_primary` tinyint DEFAULT '0',
  `avatar_url` varchar(255) DEFAULT NULL,
  `last_login` timestamp NULL DEFAULT NULL,
  `is_active` tinyint DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_contacts_client` (`client_id`),
  KEY `idx_contacts_email` (`email`),
  KEY `idx_contacts_primary` (`is_primary`),
  CONSTRAINT `contacts_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `journal_lines` (
  `id` int NOT NULL AUTO_INCREMENT,
  `journal_entry_id` int NOT NULL,
  `account_id` int NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `debit` decimal(18,2) DEFAULT '0.00',
  `credit` decimal(18,2) DEFAULT '0.00',
  `currency` varchar(3) DEFAULT 'IDR',
  `exchange_rate` decimal(12,6) DEFAULT '1.000000',
  `base_debit` decimal(18,2) DEFAULT '0.00' COMMENT 'Debit in base currency (IDR)',
  `base_credit` decimal(18,2) DEFAULT '0.00' COMMENT 'Credit in base currency (IDR)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_jl_entry` (`journal_entry_id`),
  KEY `idx_jl_account` (`account_id`),
  CONSTRAINT `journal_lines_ibfk_1` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries` (`id`) ON DELETE CASCADE,
  CONSTRAINT `journal_lines_ibfk_2` FOREIGN KEY (`account_id`) REFERENCES `chart_of_accounts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `lead_checklist_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `checklist_id` int NOT NULL,
  `text` varchar(500) NOT NULL,
  `is_checked` tinyint(1) DEFAULT '0',
  `position` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `checklist_id` (`checklist_id`),
  CONSTRAINT `lead_checklist_items_ibfk_1` FOREIGN KEY (`checklist_id`) REFERENCES `lead_checklists` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mps_week_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mps_detail_id` int NOT NULL,
  `week_number` int NOT NULL,
  `year` int NOT NULL,
  `forecast_qty` decimal(15,2) DEFAULT '0.00',
  `so_qty` decimal(15,2) DEFAULT '0.00',
  `start_process_qty` decimal(15,2) DEFAULT '0.00',
  `fg_qty` decimal(15,2) DEFAULT '0.00',
  `production_qty` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_detail_week` (`mps_detail_id`,`year`,`week_number`),
  CONSTRAINT `mps_week_data_ibfk_1` FOREIGN KEY (`mps_detail_id`) REFERENCES `mps_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `mrp_week_data` (
  `id` int NOT NULL AUTO_INCREMENT,
  `mps_detail_id` int NOT NULL,
  `material_id` int NOT NULL,
  `week_number` int NOT NULL,
  `year` int NOT NULL,
  `planned_order_receipt` decimal(15,2) DEFAULT '0.00',
  `planned_order_release` decimal(15,2) DEFAULT '0.00',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mrp_week` (`mps_detail_id`,`material_id`,`year`,`week_number`),
  CONSTRAINT `mrp_week_data_ibfk_1` FOREIGN KEY (`mps_detail_id`) REFERENCES `mps_details` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `qc_analysis_results` (
  `id` int NOT NULL AUTO_INCREMENT,
  `fpa_id` int NOT NULL,
  `parameter_id` int NOT NULL,
  `instrument_id` int DEFAULT NULL,
  `actual_value` varchar(255) DEFAULT NULL,
  `is_pass` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `saplo` float DEFAULT NULL,
  `duplo` float DEFAULT NULL,
  `analyst_id` int DEFAULT NULL,
  `notes` text,
  `method_id` int DEFAULT NULL,
  `standard_value` varchar(255) DEFAULT NULL,
  `min_value` float DEFAULT NULL,
  `max_value` float DEFAULT NULL,
  `uom` varchar(50) DEFAULT NULL,
  `qc_type` varchar(30) DEFAULT NULL,
  `specification_id` int DEFAULT NULL,
  `is_required` tinyint DEFAULT '1',
  `param_type` varchar(20) DEFAULT 'quantitative',
  PRIMARY KEY (`id`),
  KEY `fpa_id` (`fpa_id`),
  KEY `parameter_id` (`parameter_id`),
  KEY `instrument_id` (`instrument_id`),
  CONSTRAINT `qc_analysis_results_ibfk_1` FOREIGN KEY (`fpa_id`) REFERENCES `qc_analysis_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_analysis_results_ibfk_2` FOREIGN KEY (`parameter_id`) REFERENCES `qc_parameters` (`id`) ON DELETE CASCADE,
  CONSTRAINT `qc_analysis_results_ibfk_3` FOREIGN KEY (`instrument_id`) REFERENCES `qc_instruments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_formulation_ingredients` (
  `id` int NOT NULL AUTO_INCREMENT,
  `formulation_id` int NOT NULL,
  `product_id` int DEFAULT NULL,
  `ingredient_name` varchar(255) NOT NULL,
  `quantity` decimal(15,4) NOT NULL DEFAULT '0.0000',
  `unit` varchar(50) DEFAULT 'kg',
  `percentage` decimal(8,4) DEFAULT NULL,
  `function_role` varchar(100) DEFAULT NULL,
  `notes` text,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `formulation_id` (`formulation_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `rnd_formulation_ingredients_ibfk_1` FOREIGN KEY (`formulation_id`) REFERENCES `rnd_formulations` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_formulation_ingredients_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_lab_tests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `test_code` varchar(50) NOT NULL,
  `test_name` varchar(255) NOT NULL,
  `formulation_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `test_type` enum('physical','chemical','microbiological','stability','performance','other') DEFAULT 'chemical',
  `method` varchar(255) DEFAULT NULL,
  `equipment` varchar(255) DEFAULT NULL,
  `status` enum('scheduled','in_progress','completed','failed','cancelled') DEFAULT 'scheduled',
  `test_date` date DEFAULT NULL,
  `tested_by` int DEFAULT NULL,
  `parameters` text,
  `results` text,
  `conclusion` enum('pass','fail','conditional','pending') DEFAULT 'pending',
  `attachments` text,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `test_code` (`test_code`),
  KEY `formulation_id` (`formulation_id`),
  KEY `project_id` (`project_id`),
  KEY `tested_by` (`tested_by`),
  CONSTRAINT `rnd_lab_tests_ibfk_1` FOREIGN KEY (`formulation_id`) REFERENCES `rnd_formulations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_lab_tests_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_lab_tests_ibfk_3` FOREIGN KEY (`tested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_spec_parameters` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sample_id` int NOT NULL,
  `parameter_name` varchar(200) DEFAULT NULL,
  `method` varchar(200) DEFAULT NULL,
  `unit` varchar(50) DEFAULT NULL,
  `specification` text,
  `frequency` varchar(100) DEFAULT NULL,
  `setup_type` varchar(100) DEFAULT NULL,
  `active` tinyint(1) DEFAULT '1',
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_sample_id` (`sample_id`),
  CONSTRAINT `rnd_spec_parameters_ibfk_1` FOREIGN KEY (`sample_id`) REFERENCES `rnd_spec_samples` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_stability_studies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `study_code` varchar(50) NOT NULL,
  `name` varchar(255) NOT NULL,
  `formulation_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `batch_number` varchar(100) DEFAULT NULL,
  `status` enum('planned','active','completed','cancelled') DEFAULT 'planned',
  `storage_condition` varchar(255) DEFAULT '25°C / 60% RH',
  `duration_months` int DEFAULT '12',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `protocol` text,
  `conclusion` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `study_code` (`study_code`),
  KEY `formulation_id` (`formulation_id`),
  KEY `idx_stability_project` (`project_id`),
  CONSTRAINT `rnd_stability_studies_ibfk_1` FOREIGN KEY (`formulation_id`) REFERENCES `rnd_formulations` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_message_attachments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `message_id` bigint DEFAULT NULL,
  `uploaded_by` bigint DEFAULT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `url` varchar(500) NOT NULL,
  `mime_type` varchar(150) DEFAULT NULL,
  `size_bytes` bigint NOT NULL DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_workhub_attachment_message` (`message_id`),
  CONSTRAINT `fk_workhub_attachment_message` FOREIGN KEY (`message_id`) REFERENCES `workhub_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_message_mentions` (
  `message_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`,`user_id`),
  KEY `idx_workhub_mention_user` (`user_id`,`created_at`),
  CONSTRAINT `fk_workhub_mention_message` FOREIGN KEY (`message_id`) REFERENCES `workhub_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `workhub_message_reactions` (
  `message_id` bigint NOT NULL,
  `user_id` bigint NOT NULL,
  `emoji` varchar(30) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`,`user_id`,`emoji`),
  CONSTRAINT `fk_workhub_reaction_message` FOREIGN KEY (`message_id`) REFERENCES `workhub_messages` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_tickets` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `contact_id` int DEFAULT NULL,
  `ticket_number` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `description` text,
  `priority` enum('low','normal','high','urgent') DEFAULT 'normal',
  `status` enum('open','in_progress','waiting','closed') DEFAULT 'open',
  `assigned_to` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ticket_number` (`ticket_number`),
  KEY `contact_id` (`contact_id`),
  KEY `assigned_to` (`assigned_to`),
  KEY `created_by` (`created_by`),
  KEY `idx_tickets_client` (`client_id`),
  KEY `idx_tickets_status` (`status`),
  CONSTRAINT `client_tickets_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_tickets_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_tickets_ibfk_3` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_tickets_ibfk_4` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_documents` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int DEFAULT NULL,
  `formulation_id` int DEFAULT NULL,
  `lab_test_id` int DEFAULT NULL,
  `stability_study_id` int DEFAULT NULL,
  `doc_type` varchar(50) DEFAULT 'other',
  `title` varchar(255) NOT NULL,
  `description` text,
  `file_name` varchar(255) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` int DEFAULT '0',
  `mime_type` varchar(100) DEFAULT NULL,
  `version` varchar(20) DEFAULT '1.0',
  `uploaded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `folder_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `formulation_id` (`formulation_id`),
  KEY `lab_test_id` (`lab_test_id`),
  KEY `stability_study_id` (`stability_study_id`),
  KEY `uploaded_by` (`uploaded_by`),
  KEY `folder_id` (`folder_id`),
  CONSTRAINT `rnd_documents_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `rnd_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_documents_ibfk_2` FOREIGN KEY (`formulation_id`) REFERENCES `rnd_formulations` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_documents_ibfk_3` FOREIGN KEY (`lab_test_id`) REFERENCES `rnd_lab_tests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_documents_ibfk_4` FOREIGN KEY (`stability_study_id`) REFERENCES `rnd_stability_studies` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_documents_ibfk_5` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `rnd_documents_ibfk_6` FOREIGN KEY (`folder_id`) REFERENCES `rnd_document_folders` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_stability_checkpoints` (
  `id` int NOT NULL AUTO_INCREMENT,
  `study_id` int NOT NULL,
  `checkpoint_month` int NOT NULL DEFAULT '0',
  `label` varchar(20) DEFAULT NULL,
  `scheduled_date` date DEFAULT NULL,
  `actual_date` date DEFAULT NULL,
  `status` enum('pending','completed','skipped') DEFAULT 'pending',
  `parameters` text,
  `results` text,
  `pass_fail` enum('pass','fail','pending') DEFAULT 'pending',
  `tested_by` int DEFAULT NULL,
  `notes` text,
  PRIMARY KEY (`id`),
  KEY `study_id` (`study_id`),
  KEY `tested_by` (`tested_by`),
  CONSTRAINT `rnd_stability_checkpoints_ibfk_1` FOREIGN KEY (`study_id`) REFERENCES `rnd_stability_studies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_stability_checkpoints_ibfk_2` FOREIGN KEY (`tested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_stability_params` (
  `id` int NOT NULL AUTO_INCREMENT,
  `study_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `spec` varchar(100) DEFAULT NULL,
  `sort_order` int DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `study_id` (`study_id`),
  CONSTRAINT `rnd_stability_params_ibfk_1` FOREIGN KEY (`study_id`) REFERENCES `rnd_stability_studies` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `rnd_stability_readings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `study_id` int NOT NULL,
  `param_id` int NOT NULL,
  `checkpoint_id` int NOT NULL,
  `value` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_reading` (`param_id`,`checkpoint_id`),
  KEY `study_id` (`study_id`),
  KEY `checkpoint_id` (`checkpoint_id`),
  CONSTRAINT `rnd_stability_readings_ibfk_1` FOREIGN KEY (`study_id`) REFERENCES `rnd_stability_studies` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_stability_readings_ibfk_2` FOREIGN KEY (`param_id`) REFERENCES `rnd_stability_params` (`id`) ON DELETE CASCADE,
  CONSTRAINT `rnd_stability_readings_ibfk_3` FOREIGN KEY (`checkpoint_id`) REFERENCES `rnd_stability_checkpoints` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int DEFAULT NULL,
  `contact_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `event_type_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `event_date` date NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `location` varchar(255) DEFAULT NULL,
  `attendees` text,
  `reminder_minutes` int DEFAULT '0',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `visibility` varchar(20) DEFAULT 'public',
  PRIMARY KEY (`id`),
  KEY `contact_id` (`contact_id`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_events_client` (`client_id`),
  KEY `idx_events_date` (`event_date`),
  KEY `idx_events_type` (`event_type_id`),
  CONSTRAINT `client_events_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_events_ibfk_2` FOREIGN KEY (`contact_id`) REFERENCES `contacts` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_events_ibfk_3` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_events_ibfk_4` FOREIGN KEY (`event_type_id`) REFERENCES `event_types` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_events_ibfk_5` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_invoices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `invoice_number` varchar(50) NOT NULL,
  `project_id` int DEFAULT NULL,
  `invoice_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `subtotal` decimal(15,2) NOT NULL,
  `tax_amount` decimal(15,2) DEFAULT '0.00',
  `total_amount` decimal(15,2) NOT NULL,
  `paid_amount` decimal(15,2) DEFAULT '0.00',
  `status` enum('draft','sent','partial','paid','overdue','canceled') DEFAULT 'draft',
  `payment_terms` varchar(100) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `invoice_number` (`invoice_number`),
  KEY `project_id` (`project_id`),
  KEY `created_by` (`created_by`),
  KEY `idx_invoices_client` (`client_id`),
  KEY `idx_invoices_status` (`status`),
  KEY `idx_invoices_dates` (`invoice_date`,`due_date`),
  CONSTRAINT `client_invoices_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_invoices_ibfk_2` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_invoices_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `invoice_id` int DEFAULT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `reference_number` varchar(100) DEFAULT NULL,
  `notes` text,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `client_id` (`client_id`),
  KEY `invoice_id` (`invoice_id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `client_payments_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_payments_ibfk_2` FOREIGN KEY (`invoice_id`) REFERENCES `client_invoices` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_payments_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `client_projects` (
  `id` int NOT NULL AUTO_INCREMENT,
  `client_id` int NOT NULL,
  `proposal_id` int DEFAULT NULL,
  `project_number` varchar(50) NOT NULL,
  `project_name` varchar(255) NOT NULL,
  `description` text,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `budget` decimal(15,2) DEFAULT NULL,
  `actual_cost` decimal(15,2) DEFAULT '0.00',
  `status` enum('draft','open','in_progress','completed','hold','canceled') DEFAULT 'open',
  `progress_percentage` tinyint DEFAULT '0',
  `assigned_to` int DEFAULT NULL,
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `product_id` int DEFAULT NULL,
  `quantity` decimal(15,4) DEFAULT '0.0000',
  `uom` varchar(50) DEFAULT NULL,
  `so_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `project_number` (`project_number`),
  KEY `assigned_to` (`assigned_to`),
  KEY `created_by` (`created_by`),
  KEY `idx_projects_client` (`client_id`),
  KEY `idx_projects_status` (`status`),
  KEY `idx_projects_dates` (`start_date`,`end_date`),
  KEY `idx_project_proposal` (`proposal_id`),
  CONSTRAINT `client_projects_ibfk_1` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE CASCADE,
  CONSTRAINT `client_projects_ibfk_2` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `client_projects_ibfk_3` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_project_proposal` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `event_shared_users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `event_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_event_user` (`event_id`,`user_id`),
  KEY `idx_user` (`user_id`),
  CONSTRAINT `event_shared_users_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `client_events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `event_shared_users_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_activities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action_type` varchar(50) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_activities_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_activities_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_comments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_comments_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `expense_number` varchar(50) NOT NULL,
  `category` enum('material','labor','equipment','subcontractor','overhead','transport','other') NOT NULL DEFAULT 'other',
  `description` varchar(500) NOT NULL,
  `amount` decimal(15,2) NOT NULL DEFAULT '0.00',
  `expense_date` date NOT NULL,
  `vendor_id` int DEFAULT NULL,
  `receipt_number` varchar(100) DEFAULT NULL,
  `status` enum('draft','submitted','approved','rejected','paid') DEFAULT 'draft',
  `notes` text,
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `expense_number` (`expense_number`),
  KEY `idx_expense_project` (`project_id`),
  KEY `idx_expense_date` (`expense_date`),
  KEY `idx_expense_category` (`category`),
  KEY `fk_expense_vendor` (`vendor_id`),
  KEY `fk_expense_creator` (`created_by`),
  KEY `fk_expense_approver` (`approved_by`),
  CONSTRAINT `fk_expense_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expense_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_expense_project` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_expense_vendor` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_files` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(255) NOT NULL,
  `file_type` varchar(50) DEFAULT NULL,
  `file_size` int DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `folder_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `project_files_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_files_ibfk_2` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_members` (
  `project_id` int NOT NULL,
  `user_id` int NOT NULL,
  `role` varchar(50) DEFAULT 'Member',
  `joined_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`project_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `project_members_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_members_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_milestones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `due_date` date DEFAULT NULL,
  `status` varchar(50) DEFAULT 'Pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_milestones_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_notes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `content` text,
  `color` varchar(20) DEFAULT 'yellow',
  `created_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  CONSTRAINT `project_notes_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `project_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `project_id` int NOT NULL,
  `milestone_id` int DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `status` varchar(50) DEFAULT 'To Do',
  `priority` varchar(50) DEFAULT 'Medium',
  `start_date` date DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `assigned_to` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `project_id` (`project_id`),
  KEY `milestone_id` (`milestone_id`),
  KEY `assigned_to` (`assigned_to`),
  CONSTRAINT `project_tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE CASCADE,
  CONSTRAINT `project_tasks_ibfk_2` FOREIGN KEY (`milestone_id`) REFERENCES `project_milestones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `project_tasks_ibfk_3` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `proposal_audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_id` int NOT NULL,
  `user_id` int NOT NULL,
  `action` varchar(50) DEFAULT NULL,
  `field_name` varchar(100) DEFAULT NULL,
  `before_value` text,
  `after_value` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_proposal` (`proposal_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_created` (`created_at`),
  CONSTRAINT `proposal_audit_logs_ibfk_1` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `proposal_audit_logs_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `proposal_items` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_id` int NOT NULL,
  `discipline_id` int DEFAULT NULL,
  `sub_discipline_id` int DEFAULT NULL,
  `ahsp_id` int DEFAULT NULL,
  `ahsp_code_snapshot` varchar(50) DEFAULT NULL,
  `ahsp_name_snapshot` varchar(255) DEFAULT NULL,
  `unit_snapshot` varchar(50) DEFAULT NULL,
  `unit_price_snapshot` decimal(15,2) DEFAULT '0.00',
  `description` text,
  `qty` decimal(12,3) DEFAULT '0.000',
  `total_price` decimal(18,2) DEFAULT '0.00',
  `order_no` int DEFAULT '0',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `ahsp_id` (`ahsp_id`),
  KEY `idx_proposal` (`proposal_id`),
  KEY `idx_discipline` (`discipline_id`),
  KEY `idx_sub_discipline` (`sub_discipline_id`),
  KEY `idx_order` (`proposal_id`,`order_no`),
  CONSTRAINT `proposal_items_ibfk_1` FOREIGN KEY (`proposal_id`) REFERENCES `proposals` (`id`) ON DELETE CASCADE,
  CONSTRAINT `proposal_items_ibfk_2` FOREIGN KEY (`discipline_id`) REFERENCES `master_disciplines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proposal_items_ibfk_3` FOREIGN KEY (`sub_discipline_id`) REFERENCES `master_sub_disciplines` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proposal_items_ibfk_4` FOREIGN KEY (`ahsp_id`) REFERENCES `ahsp_headers` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `proposals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `proposal_number` varchar(50) DEFAULT NULL,
  `project_name` varchar(255) NOT NULL,
  `client` varchar(255) DEFAULT NULL,
  `client_id` int DEFAULT NULL,
  `project_id` int DEFAULT NULL,
  `lokasi` varchar(255) DEFAULT NULL,
  `revision` varchar(20) DEFAULT 'Rev-0',
  `status` varchar(20) DEFAULT 'draft',
  `direct_cost` decimal(18,2) DEFAULT '0.00',
  `overhead` decimal(18,2) DEFAULT '0.00',
  `risk_contingency` decimal(18,2) DEFAULT '0.00',
  `total_project` decimal(18,2) DEFAULT '0.00',
  `created_by` int DEFAULT NULL,
  `approved_by` int DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `deal_at` timestamp NULL DEFAULT NULL,
  `locked_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `proposal_number` (`proposal_number`),
  KEY `created_by` (`created_by`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_status` (`status`),
  KEY `idx_number` (`proposal_number`),
  KEY `idx_project` (`project_name`),
  KEY `fk_proposal_client` (`client_id`),
  KEY `fk_proposal_project` (`project_id`),
  CONSTRAINT `fk_proposal_client` FOREIGN KEY (`client_id`) REFERENCES `clients` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_proposal_project` FOREIGN KEY (`project_id`) REFERENCES `client_projects` (`id`) ON DELETE SET NULL,
  CONSTRAINT `proposals_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `proposals_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- columns and indexes that production has but the baseline definition does not

ALTER TABLE `departments`
  ADD COLUMN IF NOT EXISTS `code` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `head_user_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `active` tinyint(1) NOT NULL DEFAULT '1',
  ADD UNIQUE INDEX IF NOT EXISTS `name` (`name`);

ALTER TABLE `roles`
  ADD COLUMN IF NOT EXISTS `code` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `level` int DEFAULT '0',
  ADD COLUMN IF NOT EXISTS `active` tinyint(1) DEFAULT '1',
  ADD COLUMN IF NOT EXISTS `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD UNIQUE INDEX IF NOT EXISTS `name` (`name`);

ALTER TABLE `permissions`
  ADD COLUMN IF NOT EXISTS `module` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `name` varchar(200) DEFAULT NULL;

ALTER TABLE `role_permissions`
  ADD INDEX IF NOT EXISTS `permission_id` (`permission_id`);

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `user_level` int NOT NULL DEFAULT '1',
  ADD COLUMN IF NOT EXISTS `phone` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `address` text,
  ADD UNIQUE INDEX IF NOT EXISTS `username` (`username`),
  ADD UNIQUE INDEX IF NOT EXISTS `email` (`email`),
  ADD INDEX IF NOT EXISTS `role_id` (`role_id`),
  ADD INDEX IF NOT EXISTS `department_id` (`department_id`);

ALTER TABLE `categories`
  ADD COLUMN IF NOT EXISTS `code` varchar(10) DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `name` (`name`);

ALTER TABLE `uom`
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`);

ALTER TABLE `product_types`
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`);

ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `lead_time_days` int DEFAULT '0',
  ADD COLUMN IF NOT EXISTS `selling_price` decimal(15,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `name_normalized` varchar(200) GENERATED ALWAYS AS (lower(trim(replace(replace(replace(`name`,_utf8mb4'  ',_utf8mb4' '),_utf8mb4'  ',_utf8mb4' '),_utf8mb4'  ',_utf8mb4' ')))) STORED,
  ADD COLUMN IF NOT EXISTS `qc_policy` varchar(50) NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD UNIQUE INDEX IF NOT EXISTS `sku` (`sku`),
  ADD UNIQUE INDEX IF NOT EXISTS `idx_products_name_normalized` (`name_normalized`),
  ADD INDEX IF NOT EXISTS `product_type_id` (`product_type_id`),
  ADD INDEX IF NOT EXISTS `unit_of_measure_id` (`unit_of_measure_id`);

ALTER TABLE `bom_headers`
  ADD COLUMN IF NOT EXISTS `approval_status` tinyint DEFAULT '0' COMMENT '0=pending, 1=supervisor, 2=fully approved, -1=rejected',
  ADD COLUMN IF NOT EXISTS `approved_by_supervisor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_by_manager_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_supervisor` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_manager` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `jbox_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `bom_code` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `process_type` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `production_line` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source` varchar(50) DEFAULT 'ERP',
  ADD UNIQUE INDEX IF NOT EXISTS `idx_jbox_id` (`jbox_id`);

ALTER TABLE `bom_details`
  ADD COLUMN IF NOT EXISTS `item_code` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `item_description` varchar(500) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `unit` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `use_tolerance` varchar(10) DEFAULT 'No',
  ADD COLUMN IF NOT EXISTS `pct_tolerance` decimal(10,4) DEFAULT '0.0000',
  ADD COLUMN IF NOT EXISTS `tolerance_value` decimal(10,4) DEFAULT '0.0000',
  ADD COLUMN IF NOT EXISTS `remark` text,
  ADD INDEX IF NOT EXISTS `raw_material_id` (`raw_material_id`),
  ADD INDEX IF NOT EXISTS `unit_of_measure_id` (`unit_of_measure_id`);

ALTER TABLE `warehouses`
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`);

ALTER TABLE `inventory_stocks`
  ADD COLUMN IF NOT EXISTS `lot_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `batch_number` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source_type` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source_id` int DEFAULT NULL;

ALTER TABLE `stock_movements`
  ADD COLUMN IF NOT EXISTS `idempotency_key` varchar(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `moved_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS `approval_status` int DEFAULT '0',
  ADD COLUMN IF NOT EXISTS `approved_by_supervisor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_by_manager_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_supervisor` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_manager` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source_warehouse_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `destination_warehouse_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `uom` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `reason` text,
  ADD COLUMN IF NOT EXISTS `from_warehouse_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `to_warehouse_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `from_location_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `to_location_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `batch_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `location_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `lot_id` int DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `idx_stock_movements_idempotency` (`idempotency_key`),
  ADD INDEX IF NOT EXISTS `created_by` (`created_by`);

ALTER TABLE `batches`
  ADD COLUMN IF NOT EXISTS `qc_status` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `released_by` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `released_at` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD UNIQUE INDEX IF NOT EXISTS `batch_number` (`batch_number`),
  ADD INDEX IF NOT EXISTS `warehouse_id` (`warehouse_id`);

ALTER TABLE `vendors`
  ADD COLUMN IF NOT EXISTS `supply_category` varchar(50) DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`);

ALTER TABLE `purchase_requests`
  ADD COLUMN IF NOT EXISTS `project_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `request_date` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `needed_by` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approval_status` tinyint NOT NULL DEFAULT '0' COMMENT '0=pending,1=sv,2=approved,-1=rejected',
  ADD COLUMN IF NOT EXISTS `approved_by_supervisor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_by_manager_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_supervisor` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_manager` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `vendor_comparisons` json DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `selected_vendor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source_type` varchar(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `mps_header_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `mps_detail_id` int DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `pr_number` (`pr_number`),
  ADD INDEX IF NOT EXISTS `requestor_id` (`requestor_id`),
  ADD INDEX IF NOT EXISTS `approved_by` (`approved_by`),
  ADD INDEX IF NOT EXISTS `idx_pr_project` (`project_id`);

ALTER TABLE `purchase_request_items`
  ADD COLUMN IF NOT EXISTS `mps_detail_ids` json DEFAULT NULL,
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `purchase_orders`
  ADD COLUMN IF NOT EXISTS `project_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approval_status` int NOT NULL DEFAULT '0',
  ADD COLUMN IF NOT EXISTS `expected_date` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `currency` varchar(10) DEFAULT 'IDR',
  ADD COLUMN IF NOT EXISTS `payment_term` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `payment_term_2` varchar(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `address` text,
  ADD COLUMN IF NOT EXISTS `type` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `contact_person` varchar(100) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `delivery_to` text,
  ADD COLUMN IF NOT EXISTS `advance_payment` decimal(15,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `discount_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `ppn_percent` decimal(5,2) NOT NULL DEFAULT '11.00',
  ADD COLUMN IF NOT EXISTS `approved_by_supervisor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_by_manager_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_supervisor` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_manager` timestamp NULL DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `po_number` (`po_number`),
  ADD INDEX IF NOT EXISTS `pr_id` (`pr_id`),
  ADD INDEX IF NOT EXISTS `approved_by` (`approved_by`),
  ADD INDEX IF NOT EXISTS `idx_po_project` (`project_id`);

ALTER TABLE `purchase_order_items`
  ADD COLUMN IF NOT EXISTS `po_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `uom` varchar(50) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `currency` varchar(10) DEFAULT 'IDR',
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `goods_receipts`
  ADD COLUMN IF NOT EXISTS `approval_status` tinyint NOT NULL DEFAULT '0' COMMENT '0=pending,1=sv,2=approved,-1=rejected',
  ADD COLUMN IF NOT EXISTS `approved_by_supervisor_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_by_manager_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_supervisor` timestamp NULL DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `approved_at_manager` timestamp NULL DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `grn_number` (`grn_number`),
  ADD INDEX IF NOT EXISTS `warehouse_id` (`warehouse_id`),
  ADD INDEX IF NOT EXISTS `received_by` (`received_by`);

ALTER TABLE `grn_items`
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `work_orders`
  ADD COLUMN IF NOT EXISTS `line_process_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `priority` varchar(20) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS `completed_quantity` int DEFAULT '0',
  ADD COLUMN IF NOT EXISTS `so_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `mps_detail_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `week_number` tinyint DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `source_type` varchar(20) DEFAULT 'LEGACY_UNKNOWN',
  ADD COLUMN IF NOT EXISTS `source_reason` text,
  ADD COLUMN IF NOT EXISTS `year` int DEFAULT NULL,
  ADD UNIQUE INDEX IF NOT EXISTS `wo_number` (`wo_number`),
  ADD UNIQUE INDEX IF NOT EXISTS `uq_wo_mps_detail_week_year` (`mps_detail_id`,`week_number`,`year`),
  ADD INDEX IF NOT EXISTS `bom_id` (`bom_id`),
  ADD INDEX IF NOT EXISTS `created_by` (`created_by`);

ALTER TABLE `wo_materials`
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`),
  ADD INDEX IF NOT EXISTS `warehouse_id` (`warehouse_id`),
  ADD INDEX IF NOT EXISTS `issued_by` (`issued_by`);

ALTER TABLE `wo_process_logs`
  ADD INDEX IF NOT EXISTS `recorded_by` (`recorded_by`);

ALTER TABLE `wo_results`
  ADD INDEX IF NOT EXISTS `output_uom_id` (`output_uom_id`),
  ADD INDEX IF NOT EXISTS `completed_by` (`completed_by`);

ALTER TABLE `production_tasks`
  ADD INDEX IF NOT EXISTS `wo_id` (`wo_id`),
  ADD INDEX IF NOT EXISTS `assigned_to_user_id` (`assigned_to_user_id`);

ALTER TABLE `qc_tests`
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`),
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `qc_results`
  ADD INDEX IF NOT EXISTS `qc_test_id` (`qc_test_id`),
  ADD INDEX IF NOT EXISTS `wo_id` (`wo_id`),
  ADD INDEX IF NOT EXISTS `tested_by` (`tested_by`);

ALTER TABLE `customers`
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`);

ALTER TABLE `sales_orders`
  ADD COLUMN IF NOT EXISTS `client_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `lead_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `project_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `expected_ship_date` date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `currency` varchar(10) DEFAULT 'IDR',
  ADD UNIQUE INDEX IF NOT EXISTS `so_number` (`so_number`),
  ADD INDEX IF NOT EXISTS `approved_by` (`approved_by`);

ALTER TABLE `so_items`
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `deliveries`
  ADD UNIQUE INDEX IF NOT EXISTS `do_number` (`do_number`);

ALTER TABLE `delivery_items`
  ADD INDEX IF NOT EXISTS `product_id` (`product_id`);

ALTER TABLE `invoices`
  ADD UNIQUE INDEX IF NOT EXISTS `invoice_number` (`invoice_number`);

ALTER TABLE `cogs_tracking`
  ADD INDEX IF NOT EXISTS `wo_id` (`wo_id`),
  ADD INDEX IF NOT EXISTS `batch_id` (`batch_id`);

ALTER TABLE `accounts_payable`
  ADD COLUMN IF NOT EXISTS `po_schedule_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `invoice_date` date DEFAULT NULL,
  ADD INDEX IF NOT EXISTS `po_id` (`po_id`),
  ADD INDEX IF NOT EXISTS `vendor_id` (`vendor_id`);

ALTER TABLE `accounts_receivable`
  ADD INDEX IF NOT EXISTS `invoice_id` (`invoice_id`),
  ADD INDEX IF NOT EXISTS `customer_id` (`customer_id`);

ALTER TABLE `financial_summary`
  ADD UNIQUE INDEX IF NOT EXISTS `period_date` (`period_date`);

ALTER TABLE `employees`
  ADD COLUMN IF NOT EXISTS `basic_rate` decimal(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `tunjangan_rate` decimal(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `ot_rate` decimal(10,2) DEFAULT '0.00',
  ADD COLUMN IF NOT EXISTS `salary_type` varchar(10) DEFAULT 'daily',
  ADD UNIQUE INDEX IF NOT EXISTS `code` (`code`),
  ADD INDEX IF NOT EXISTS `user_id` (`user_id`);

ALTER TABLE `attendance_logs`
  ADD COLUMN IF NOT EXISTS `project_id` int DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `timesheet_value` decimal(3,1) DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS `overtime_hours` decimal(4,1) DEFAULT '0.0',
  ADD COLUMN IF NOT EXISTS `gps_lat` decimal(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `gps_lng` decimal(10,7) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `gps_verified` tinyint(1) DEFAULT '0';

ALTER TABLE `notifications`
  ADD INDEX IF NOT EXISTS `sender_id` (`sender_id`);

ALTER TABLE `system_settings`
  ADD UNIQUE INDEX IF NOT EXISTS `setting_key` (`setting_key`);



SET FOREIGN_KEY_CHECKS = @erp_fk_checks;
