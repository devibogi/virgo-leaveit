-- LeaveEntitlement & LeaveRequest tables and initial seed data for MariaDB 11.4
CREATE TABLE IF NOT EXISTS leave_entitlement (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  year SMALLINT NOT NULL,
  component ENUM('BASE','AGE_ADDITIONAL','CHILD_ADDITIONAL','AGE_ADDITIONAL_CARRYOVER') NOT NULL,
  full_year_days DECIMAL(5,1) NULL,
  calculated_days DECIMAL(5,1) NULL,
  override_days DECIMAL(5,1) NULL,
  override_reason VARCHAR(500) NULL,
  payroll_reference_days DECIMAL(5,1) NULL,
  used_q1 DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q2 DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q3 DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q4 DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_year DECIMAL(5,1) NOT NULL DEFAULT 0,
  updated_at VARCHAR(64) NOT NULL,
  updated_by VARCHAR(64) NOT NULL,
  UNIQUE KEY uq_entitlement (employee_id, year, component)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO leave_entitlement (
  id, employee_id, year, component, full_year_days, calculated_days,
  override_days, override_reason, payroll_reference_days,
  used_q1, used_q2, used_q3, used_q4, used_year, updated_at, updated_by
) VALUES
  ('ent-peter-2026-base', 'emp-peter', 2026, 'BASE', 20.0, 20.0, NULL, NULL, 20.0, 0.0, 5.0, 0.0, 0.0, 5.0, '2026-01-02T08:00:00Z', 'emp-piri'),
  ('ent-peter-2026-age', 'emp-peter', 2026, 'AGE_ADDITIONAL', 4.0, 4.0, NULL, NULL, 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-02T08:00:00Z', 'emp-piri'),
  ('ent-katalin-2026-base', 'emp-katalin', 2026, 'BASE', 20.0, 20.0, NULL, NULL, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-02T08:00:00Z', 'emp-piri'),
  ('ent-katalin-2026-child', 'emp-katalin', 2026, 'CHILD_ADDITIONAL', NULL, NULL, 4.0, 'Éves nyilatkozat alapján (2 gyermek)', 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-05T09:30:00Z', 'emp-piri');

CREATE TABLE IF NOT EXISTS leave_request (
  id VARCHAR(64) PRIMARY KEY,
  employee_id VARCHAR(64) NOT NULL,
  legal_entity_id ENUM('VIRGO_KFT','VIRGO_ZRT') NOT NULL,
  approver_id VARCHAR(64) NOT NULL,
  leave_type_code VARCHAR(32) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  day_portion ENUM('FULL','AM','PM') NOT NULL,
  status ENUM('PENDING','APPROVED','REJECTED','CANCELLED','REVOKED') NOT NULL DEFAULT 'PENDING',
  employee_comment VARCHAR(1000) NULL,
  submitted_at VARCHAR(64) NOT NULL,
  decision ENUM('APPROVED','REJECTED') NULL,
  decided_by VARCHAR(64) NULL,
  on_behalf_of VARCHAR(64) NULL,
  decided_at VARCHAR(64) NULL,
  decision_comment VARCHAR(1000) NULL,
  cancellation_kind ENUM('CANCELLED','REVOKED') NULL,
  cancelled_by VARCHAR(64) NULL,
  cancelled_at VARCHAR(64) NULL,
  cancellation_reason VARCHAR(1000) NULL,
  INDEX ix_req_employee_start (employee_id, start_date),
  INDEX ix_req_approver_status (approver_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO leave_request (
  id, employee_id, legal_entity_id, approver_id, leave_type_code,
  start_date, end_date, day_portion, status, employee_comment, submitted_at,
  decision, decided_by, on_behalf_of, decided_at, decision_comment,
  cancellation_kind, cancelled_by, cancelled_at, cancellation_reason
) VALUES
  ('req-0001', 'emp-peter', 'VIRGO_KFT', 'emp-katalin', 'ANNUAL', '2026-06-15', '2026-06-19', 'FULL', 'APPROVED', 'Családi nyaralás', '2026-06-01T08:30:00Z', 'APPROVED', 'emp-katalin', NULL, '2026-06-02T10:15:00Z', 'Jóváhagyva', NULL, NULL, NULL, NULL),
  ('req-0002', 'emp-anna', 'VIRGO_ZRT', 'emp-katalin', 'ANNUAL', '2026-07-03', '2026-07-03', 'AM', 'PENDING', 'Hivatali ügyintézés délelőtt', '2026-06-25T14:00:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('req-0003', 'emp-katalin', 'VIRGO_KFT', 'emp-piri', 'UNPAID', '2026-05-04', '2026-05-05', 'FULL', 'REVOKED', 'Költözés', '2026-04-20T09:00:00Z', 'APPROVED', 'emp-piri', NULL, '2026-04-21T11:00:00Z', 'Rendben', 'REVOKED', 'emp-piri', '2026-04-28T16:00:00Z', 'Időpont módosulás miatt HR által visszavonva');
