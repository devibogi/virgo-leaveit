-- Leave types (D21, 2026-11-13). Keep in sync with src/domain/leaveType.ts.
CREATE TABLE IF NOT EXISTS leave_types (
  code ENUM('ANNUAL', 'SICK_LEAVE', 'UNPAID', 'FUNERAL', 'CHILD_SICK_LEAVE') NOT NULL,
  label VARCHAR(255) NOT NULL,
  category ENUM('LEAVE', 'SICK') NOT NULL,
  deducts_from_annual_balance TINYINT(1) NOT NULL DEFAULT 0,
  half_day_allowed TINYINT(1) NOT NULL DEFAULT 0,
  approver_role ENUM('MANAGER', 'HR_ADMIN') NOT NULL DEFAULT 'MANAGER',
  payroll_code VARCHAR(64) NULL,
  deputy_check_applies TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO leave_types (
  code,
  label,
  category,
  deducts_from_annual_balance,
  half_day_allowed,
  approver_role,
  payroll_code,
  deputy_check_applies
) VALUES
  ('ANNUAL', 'Fizetett szabadság', 'LEAVE', 1, 1, 'MANAGER', NULL, 1),
  ('SICK_LEAVE', 'Betegszabadság', 'SICK', 0, 0, 'MANAGER', NULL, 0),
  ('UNPAID', 'Fizetés nélküli szabadság', 'LEAVE', 0, 1, 'HR_ADMIN', NULL, 1),
  ('FUNERAL', 'Temetési szabadság', 'LEAVE', 0, 1, 'MANAGER', NULL, 0),
  ('CHILD_SICK_LEAVE', 'Gyermekápolási szabadság', 'SICK', 0, 0, 'MANAGER', NULL, 0);
