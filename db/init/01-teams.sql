CREATE TABLE IF NOT EXISTS teams (
  manager_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO teams (manager_id, name) VALUES
  ('emp-katalin', 'Fejlesztési csapat'),
  ('emp-piri', 'HR és Operáció'),
  ('emp-gabor', 'Termékfejlesztés');
