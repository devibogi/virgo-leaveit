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
  deputy_ids_json JSON NOT NULL,
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
  deputy_ids_json
) VALUES
  ('emp-piri', 'Varga Piri', 'piri.varga@virgo.example', 'VIRGO_KFT', NULL, '["EMPLOYEE","HR_ADMIN"]', '1984-03-12', '2019-02-01', NULL, '[]'),
  ('emp-katalin', 'Nagy Katalin', 'katalin.nagy@virgo.example', 'VIRGO_KFT', 'emp-piri', '["EMPLOYEE","MANAGER"]', '1986-07-22', '2020-05-15', NULL, '["emp-piri"]'),
  ('emp-peter', 'Kovács Péter', 'peter.kovacs@virgo.example', 'VIRGO_KFT', 'emp-katalin', '["EMPLOYEE"]', '1993-11-04', '2022-09-01', NULL, '["emp-anna"]'),
  ('emp-anna', 'Szabó Anna', 'anna.szabo@virgo.example', 'VIRGO_ZRT', 'emp-katalin', '["EMPLOYEE"]', '1995-01-19', '2024-03-01', NULL, '["emp-peter"]');
