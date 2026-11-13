-- LeaveIt MariaDB schema (MariaDB 11.4). Mirrors src/types/model.ts persisted entities.
-- Derived views (balances, LeaveDay, deputy checks, delegation, team membership) are NOT stored.
-- Timestamps are UTC. Synthetic data only.

CREATE DATABASE IF NOT EXISTS leaveit CHARACTER SET utf8mb4 COLLATE utf8mb4_hungarian_ci;
USE leaveit;

CREATE TABLE legal_entity (
  id   ENUM('VIRGO_KFT','VIRGO_ZRT') PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE employee (
  id                        VARCHAR(64)  PRIMARY KEY,
  display_name              VARCHAR(200) NOT NULL,
  email                     VARCHAR(254) NOT NULL UNIQUE,
  legal_entity_id           ENUM('VIRGO_KFT','VIRGO_ZRT') NOT NULL,
  manager_id                VARCHAR(64)  NULL,
  birth_date                DATE         NOT NULL,
  employment_start          DATE         NOT NULL,
  employment_end            DATE         NULL,
  include_in_payroll_export BOOLEAN      NOT NULL DEFAULT TRUE,
  CONSTRAINT fk_employee_le      FOREIGN KEY (legal_entity_id) REFERENCES legal_entity(id),
  CONSTRAINT fk_employee_manager FOREIGN KEY (manager_id) REFERENCES employee(id),
  CONSTRAINT ck_employee_not_own_manager CHECK (manager_id IS NULL OR manager_id <> id),
  INDEX ix_employee_manager (manager_id)
);

CREATE TABLE employee_role (
  employee_id VARCHAR(64) NOT NULL,
  role        ENUM('EMPLOYEE','MANAGER','HR_ADMIN') NOT NULL,
  PRIMARY KEY (employee_id, role),
  CONSTRAINT fk_role_employee FOREIGN KEY (employee_id) REFERENCES employee(id)
);

CREATE TABLE employee_deputy (
  employee_id VARCHAR(64) NOT NULL,
  deputy_id   VARCHAR(64) NOT NULL,
  PRIMARY KEY (employee_id, deputy_id),
  CONSTRAINT fk_deputy_employee FOREIGN KEY (employee_id) REFERENCES employee(id),
  CONSTRAINT fk_deputy_deputy   FOREIGN KEY (deputy_id)   REFERENCES employee(id),
  CONSTRAINT ck_deputy_not_self CHECK (employee_id <> deputy_id),
  INDEX ix_deputy_deputy (deputy_id)
);

-- Display name only; membership = employees whose manager_id = team.manager_id.
CREATE TABLE team (
  manager_id VARCHAR(64)  PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  CONSTRAINT fk_team_manager FOREIGN KEY (manager_id) REFERENCES employee(id)
);

CREATE TABLE leave_type (
  code                        ENUM('ANNUAL','SICK_LEAVE','SICK_PAY','PATERNITY','EXTRAORDINARY','UNPAID') PRIMARY KEY,
  label                       VARCHAR(100) NOT NULL,
  deducts_from_annual_balance BOOLEAN NOT NULL,
  half_day_allowed            BOOLEAN NOT NULL,
  payroll_code                VARCHAR(32) NULL,
  deputy_check_applies        BOOLEAN NOT NULL
);

CREATE TABLE leave_entitlement (
  id                     VARCHAR(64) PRIMARY KEY,
  employee_id            VARCHAR(64) NOT NULL,
  year                   SMALLINT    NOT NULL,
  component              ENUM('BASE','AGE_ADDITIONAL','CHILD_ADDITIONAL','AGE_ADDITIONAL_CARRYOVER') NOT NULL,
  full_year_days         DECIMAL(5,1) NULL,
  calculated_days        DECIMAL(5,1) NULL,
  override_days          DECIMAL(5,1) NULL,
  override_reason        VARCHAR(500) NULL,
  payroll_reference_days DECIMAL(5,1) NULL,
  -- CACHED, REDUNDANT usage (performance, D18). Never write by hand or increment:
  -- the backend overwrites all rows of an (employee, year) with recomputeEntitlementUsage()
  -- in the same transaction as the triggering change (see DATA_MODEL "Usage cache").
  used_q1                DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q2                DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q3                DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_q4                DECIMAL(5,1) NOT NULL DEFAULT 0,
  used_year              DECIMAL(5,1) NOT NULL DEFAULT 0,
  updated_at             DATETIME(3) NOT NULL,
  updated_by             VARCHAR(64) NOT NULL,
  UNIQUE KEY uq_entitlement (employee_id, year, component),
  CONSTRAINT ck_ent_used_year CHECK (used_year = used_q1 + used_q2 + used_q3 + used_q4),
  CONSTRAINT fk_ent_employee   FOREIGN KEY (employee_id) REFERENCES employee(id),
  CONSTRAINT fk_ent_updated_by FOREIGN KEY (updated_by)  REFERENCES employee(id)
);

-- Approval and Cancellation are embedded (nullable columns). Never hard-deleted.
CREATE TABLE leave_request (
  id                 VARCHAR(64) PRIMARY KEY,
  employee_id        VARCHAR(64) NOT NULL,
  legal_entity_id    ENUM('VIRGO_KFT','VIRGO_ZRT') NOT NULL, -- snapshot at submission
  approver_id        VARCHAR(64) NOT NULL,                   -- snapshot at submission
  leave_type_code    ENUM('ANNUAL','SICK_LEAVE','SICK_PAY','PATERNITY','EXTRAORDINARY','UNPAID') NOT NULL,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  day_portion        ENUM('FULL','AM','PM') NOT NULL,
  status             ENUM('PENDING','APPROVED','REJECTED','CANCELLED','REVOKED') NOT NULL DEFAULT 'PENDING',
  employee_comment   VARCHAR(1000) NULL,
  submitted_at       DATETIME(3) NOT NULL,
  -- Approval
  decision           ENUM('APPROVED','REJECTED') NULL,
  decided_by         VARCHAR(64) NULL,
  on_behalf_of       VARCHAR(64) NULL,
  decided_at         DATETIME(3) NULL,
  decision_comment   VARCHAR(1000) NULL,
  -- Cancellation
  cancellation_kind  ENUM('CANCELLED','REVOKED') NULL,
  cancelled_by       VARCHAR(64) NULL,
  cancelled_at       DATETIME(3) NULL,
  cancellation_reason VARCHAR(1000) NULL,
  CONSTRAINT fk_req_employee  FOREIGN KEY (employee_id)     REFERENCES employee(id),
  CONSTRAINT fk_req_le        FOREIGN KEY (legal_entity_id) REFERENCES legal_entity(id),
  CONSTRAINT fk_req_approver  FOREIGN KEY (approver_id)     REFERENCES employee(id),
  CONSTRAINT fk_req_type      FOREIGN KEY (leave_type_code) REFERENCES leave_type(code),
  CONSTRAINT fk_req_decided   FOREIGN KEY (decided_by)      REFERENCES employee(id),
  CONSTRAINT fk_req_behalf    FOREIGN KEY (on_behalf_of)    REFERENCES employee(id),
  CONSTRAINT fk_req_cancelled FOREIGN KEY (cancelled_by)    REFERENCES employee(id),
  CONSTRAINT ck_req_dates     CHECK (end_date >= start_date),
  CONSTRAINT ck_req_half_day  CHECK (day_portion = 'FULL' OR start_date = end_date),
  CONSTRAINT ck_req_no_self_decision CHECK (decided_by IS NULL OR decided_by <> employee_id),
  INDEX ix_req_employee_start (employee_id, start_date),
  INDEX ix_req_approver_status (approver_id, status)
);

-- Append-only: the app user should have INSERT/SELECT only on this table.
CREATE TABLE audit_event (
  id           VARCHAR(64) PRIMARY KEY,
  at           DATETIME(3) NOT NULL,
  actor_id     VARCHAR(64) NOT NULL,
  actor_role   ENUM('EMPLOYEE','MANAGER','HR_ADMIN') NOT NULL,
  on_behalf_of VARCHAR(64) NULL,
  action       ENUM('REQUEST_SUBMITTED','REQUEST_APPROVED','REQUEST_REJECTED','REQUEST_CANCELLED','REQUEST_REVOKED',
                    'ENTITLEMENT_UPDATED','SLA_REMINDER_SENT','EXPORT_CREATED','DEPUTIES_UPDATED','EMPLOYEE_UPDATED') NOT NULL,
  entity_type  ENUM('LEAVE_REQUEST','LEAVE_ENTITLEMENT','EXPORT','EMPLOYEE') NOT NULL,
  entity_id    VARCHAR(64) NOT NULL,
  reason       VARCHAR(1000) NULL,
  details      TEXT NULL,
  CONSTRAINT fk_audit_actor  FOREIGN KEY (actor_id)     REFERENCES employee(id),
  CONSTRAINT fk_audit_behalf FOREIGN KEY (on_behalf_of) REFERENCES employee(id),
  INDEX ix_audit_entity (entity_type, entity_id),
  INDEX ix_audit_at (at)
);
