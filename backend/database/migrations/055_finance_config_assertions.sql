-- Fail the release when Finance configuration did not fully seed.
--
-- The account_role seeds in 052 and 054 resolve accounts by account_code using
-- INSERT IGNORE and INSERT ... SELECT. Both drop rows silently when the chart of
-- accounts is missing an account, which leaves a fresh install with a Finance
-- configuration that looks applied but cannot resolve posting accounts.
-- These assertions turn that silent misconfiguration into a hard migration failure,
-- so the runner aborts and the server refuses to start on an unusable schema.

DROP PROCEDURE IF EXISTS erp_assert_finance_config;

DELIMITER //
CREATE PROCEDURE erp_assert_finance_config()
BEGIN
  DECLARE seeded_roles INT;
  DECLARE dangling_roles INT;

  -- 25 roles seeded by 052 plus 2 by 054
  SELECT COUNT(*) INTO seeded_roles FROM account_roles WHERE company_id = 1;
  IF seeded_roles < 27 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FINANCE_CONFIG_INCOMPLETE: fewer account_roles than seeded; chart of accounts is missing prerequisite account codes';
  END IF;

  SELECT COUNT(*) INTO dangling_roles
    FROM account_roles ar
    LEFT JOIN chart_of_accounts coa ON coa.id = ar.account_id
   WHERE coa.id IS NULL;
  IF dangling_roles > 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'FINANCE_CONFIG_INVALID: account_roles references an account that does not exist';
  END IF;
END //
DELIMITER ;

CALL erp_assert_finance_config();

DROP PROCEDURE IF EXISTS erp_assert_finance_config;
