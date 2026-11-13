CREATE TABLE IF NOT EXISTS leave_types (
  code ENUM('ANNUAL', 'SICK_LEAVE', 'SICK_PAY', 'PATERNITY', 'EXTRAORDINARY', 'UNPAID') NOT NULL,
  label VARCHAR(255) NOT NULL,
  deducts_from_annual_balance TINYINT(1) NOT NULL DEFAULT 0,
  half_day_allowed TINYINT(1) NOT NULL DEFAULT 0,
  payroll_code VARCHAR(64) NULL,
  deputy_check_applies TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO leave_types (
  code,
  label,
  deducts_from_annual_balance,
  half_day_allowed,
  payroll_code,
  deputy_check_applies
) VALUES
  ('ANNUAL', 'Szabadság', 1, 1, NULL, 1),
  ('SICK_LEAVE', 'Betegszabadság', 0, 0, NULL, 0),
  ('SICK_PAY', 'Táppénz', 0, 0, NULL, 0),
  ('PATERNITY', 'Apai szabadság', 0, 0, NULL, 0),
  ('EXTRAORDINARY', 'Rendkívüli szabadság', 0, 0, NULL, 1),
  ('UNPAID', 'Fizetés nélküli szabadság', 0, 0, NULL, 1);
