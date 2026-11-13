CREATE TABLE IF NOT EXISTS employees (
  id VARCHAR(64) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  legal_entity_id ENUM('VIRGO_KFT', 'VIRGO_ZRT') NOT NULL,
  manager_id VARCHAR(64) NULL,
  roles_json JSON NOT NULL,
  birth_date DATE NOT NULL,
  employment_start DATE NOT NULL,
  employment_end DATE NULL,
  include_in_payroll_export TINYINT(1) NOT NULL DEFAULT 1,
  tax_id CHAR(10) NOT NULL DEFAULT '8400000000',
  deputy_ids_json JSON NOT NULL,
  team_id VARCHAR(64) NULL,
  PRIMARY KEY (id),
  INDEX idx_employees_manager_id (manager_id),
  INDEX idx_employees_legal_entity (legal_entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO employees (
  id,
  display_name,
  email,
  legal_entity_id,
  manager_id,
  roles_json,
  birth_date,
  employment_start,
  employment_end,
  include_in_payroll_export,
  tax_id,
  deputy_ids_json,
  team_id
) VALUES
  ('emp-piri', 'Varga Piri', 'piri.varga@virgo.example', 'VIRGO_KFT', NULL, '["EMPLOYEE","MANAGER","HR_ADMIN"]', '1984-03-12', '2019-02-01', NULL, 1, '8401010001', '[]', NULL),
  ('emp-katalin', 'Nagy Katalin', 'katalin.nagy@virgo.example', 'VIRGO_KFT', 'emp-piri', '["EMPLOYEE","MANAGER"]', '1986-07-22', '2020-05-15', NULL, 1, '8401010002', '["emp-piri","emp-gabor"]', 'team-hr'),
  ('emp-peter', 'Kovács Péter', 'peter.kovacs@virgo.example', 'VIRGO_KFT', 'emp-katalin', '["EMPLOYEE"]', '1993-11-04', '2022-09-01', NULL, 1, '8401010003', '["emp-anna"]', 'team-dev'),
  ('emp-anna', 'Szabó Anna', 'anna.szabo@virgo.example', 'VIRGO_ZRT', 'emp-katalin', '["EMPLOYEE"]', '1995-01-19', '2024-03-01', NULL, 1, '8401010004', '["emp-peter"]', 'team-dev'),
  ('emp-eszter', 'Tóth Eszter', 'eszter.toth@virgo.example', 'VIRGO_KFT', 'emp-katalin', '["EMPLOYEE"]', '1989-05-08', '2021-09-01', NULL, 1, '8401010005', '["emp-peter"]', 'team-qa'),
  ('emp-gabor', 'Kovács Gábor', 'gabor.kovacs@virgo.example', 'VIRGO_KFT', 'emp-piri', '["EMPLOYEE","MANAGER"]', '1985-09-30', '2020-01-06', NULL, 1, '8401010006', '["emp-katalin"]', 'team-hr');
