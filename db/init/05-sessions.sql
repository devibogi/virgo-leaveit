CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(128) NOT NULL,
  employee_id VARCHAR(64) NOT NULL,
  active_role ENUM('EMPLOYEE', 'MANAGER', 'HR_ADMIN') NOT NULL,
  csrf_token VARCHAR(128) NOT NULL DEFAULT '',
  created_at VARCHAR(64) NOT NULL,
  expires_at VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  INDEX idx_sessions_employee_id (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
