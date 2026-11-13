-- A manager may lead several teams; each employee belongs to at most one (employees.team_id).
CREATE TABLE IF NOT EXISTS teams (
  id VARCHAR(64) NOT NULL,
  manager_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_teams_manager_id (manager_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO teams (id, manager_id, name) VALUES
  ('team-dev', 'emp-katalin', 'Fejlesztési csapat'),
  ('team-qa', 'emp-katalin', 'Minőségbiztosítás'),
  ('team-hr', 'emp-piri', 'HR és Operáció'),
  ('team-product', 'emp-gabor', 'Termékfejlesztés');
