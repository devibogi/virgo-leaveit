import mysql from 'mysql2/promise'
import type { SqlExecutor } from './teamRepository.ts'

export interface MariaDbConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

const SCHEMA_AND_SEED_STATEMENTS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS legal_entity (
    id ENUM('VIRGO_KFT','VIRGO_ZRT') PRIMARY KEY,
    name VARCHAR(100) NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `INSERT IGNORE INTO legal_entity (id, name) VALUES
    ('VIRGO_KFT', 'Virgo Kft.'),
    ('VIRGO_ZRT', 'Virgo Zrt.')`,

  `CREATE TABLE IF NOT EXISTS teams (
    manager_id VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    PRIMARY KEY (manager_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `INSERT IGNORE INTO teams (manager_id, name) VALUES
    ('emp-katalin', 'Fejlesztési csapat'),
    ('emp-piri', 'HR és Operáció'),
    ('emp-gabor', 'Termékfejlesztés')`,

  `CREATE TABLE IF NOT EXISTS employees (
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
    PRIMARY KEY (id),
    INDEX idx_employees_manager_id (manager_id),
    INDEX idx_employees_legal_entity (legal_entity_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS include_in_payroll_export TINYINT(1) NOT NULL DEFAULT 1`,
  `ALTER TABLE employees ADD COLUMN IF NOT EXISTS tax_id CHAR(10) NOT NULL DEFAULT '8400000000'`,

  `INSERT IGNORE INTO employees (
    id, display_name, email, legal_entity_id, manager_id,
    roles_json, birth_date, employment_start, employment_end,
    include_in_payroll_export, tax_id, deputy_ids_json
  ) VALUES
    ('emp-piri', 'Varga Piri', 'piri.varga@virgo.example', 'VIRGO_KFT', NULL, '["EMPLOYEE","MANAGER","HR_ADMIN"]', '1984-03-12', '2019-02-01', NULL, 1, '8000000001', '[]'),
    ('emp-katalin', 'Nagy Katalin', 'katalin.nagy@virgo.example', 'VIRGO_KFT', 'emp-piri', '["EMPLOYEE","MANAGER"]', '1986-07-22', '2020-05-15', NULL, 1, '8000000002', '["emp-piri","emp-gabor"]'),
    ('emp-peter', 'Kovács Péter', 'peter.kovacs@virgo.example', 'VIRGO_KFT', 'emp-katalin', '["EMPLOYEE"]', '1993-11-04', '2022-09-01', NULL, 1, '8000000003', '["emp-anna"]'),
    ('emp-anna', 'Szabó Anna', 'anna.szabo@virgo.example', 'VIRGO_ZRT', 'emp-katalin', '["EMPLOYEE"]', '1995-01-19', '2024-03-01', NULL, 1, '8000000004', '["emp-peter"]'),
    ('emp-eszter', 'Tóth Eszter', 'eszter.toth@virgo.example', 'VIRGO_KFT', 'emp-katalin', '["EMPLOYEE"]', '1989-05-08', '2021-09-01', NULL, 1, '8000000005', '["emp-peter"]'),
    ('emp-gabor', 'Kovács Gábor', 'gabor.kovacs@virgo.example', 'VIRGO_KFT', 'emp-piri', '["EMPLOYEE","MANAGER"]', '1985-09-30', '2020-01-06', NULL, 1, '8000000006', '["emp-katalin"]')`,

  `CREATE TABLE IF NOT EXISTS leave_types (
    code VARCHAR(32) NOT NULL,
    label VARCHAR(255) NOT NULL,
    category ENUM('LEAVE', 'SICK') NOT NULL DEFAULT 'LEAVE',
    deducts_from_annual_balance TINYINT(1) NOT NULL DEFAULT 0,
    half_day_allowed TINYINT(1) NOT NULL DEFAULT 0,
    approver_role ENUM('MANAGER', 'HR_ADMIN') NOT NULL DEFAULT 'MANAGER',
    payroll_code VARCHAR(64) NULL,
    deputy_check_applies TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (code)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `ALTER TABLE leave_types MODIFY COLUMN code VARCHAR(32) NOT NULL`,
  `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS category ENUM('LEAVE', 'SICK') NOT NULL DEFAULT 'LEAVE'`,
  `ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS approver_role ENUM('MANAGER', 'HR_ADMIN') NOT NULL DEFAULT 'MANAGER'`,

  `INSERT IGNORE INTO leave_types (
    code, label, category, deducts_from_annual_balance, half_day_allowed, approver_role, payroll_code, deputy_check_applies
  ) VALUES
    ('ANNUAL', 'Fizetett szabadság', 'LEAVE', 1, 1, 'MANAGER', NULL, 1),
    ('SICK_LEAVE', 'Betegszabadság', 'SICK', 0, 0, 'MANAGER', NULL, 0),
    ('UNPAID', 'Fizetés nélküli szabadság', 'LEAVE', 0, 1, 'HR_ADMIN', NULL, 1),
    ('OTHER', 'Egyéb (pl. temetési szabadság)', 'LEAVE', 0, 1, 'MANAGER', NULL, 0),
    ('CHILD_SICK_LEAVE', 'Gyermekápolási szabadság', 'SICK', 0, 0, 'MANAGER', NULL, 0)`,

  `CREATE TABLE IF NOT EXISTS leave_entitlement (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `INSERT IGNORE INTO leave_entitlement (
    id, employee_id, year, component, full_year_days, calculated_days,
    override_days, override_reason, payroll_reference_days,
    used_q1, used_q2, used_q3, used_q4, used_year, updated_at, updated_by
  ) VALUES
    ('ent-peter-2026-base', 'emp-peter', 2026, 'BASE', 20.0, 20.0, NULL, NULL, 20.0, 0.0, 5.0, 0.0, 0.0, 5.0, '2026-01-02T08:00:00Z', 'emp-piri'),
    ('ent-peter-2026-age', 'emp-peter', 2026, 'AGE_ADDITIONAL', 4.0, 4.0, NULL, NULL, 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-02T08:00:00Z', 'emp-piri'),
    ('ent-katalin-2026-base', 'emp-katalin', 2026, 'BASE', 20.0, 20.0, NULL, NULL, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-02T08:00:00Z', 'emp-piri'),
    ('ent-katalin-2026-child', 'emp-katalin', 2026, 'CHILD_ADDITIONAL', NULL, NULL, 4.0, 'Éves nyilatkozat alapján (2 gyermek)', 4.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-05T09:30:00Z', 'emp-piri'),
    ('ent-eszter-2026-child', 'emp-eszter', 2026, 'CHILD_ADDITIONAL', NULL, NULL, 9.0, 'Éves nyilatkozat alapján (3 gyermek 16 év alatt, ebből 1 fogyatékos: 7 + 2 nap)', 9.0, 0.0, 0.0, 0.0, 0.0, 0.0, '2026-01-05T09:45:00Z', 'emp-piri')`,

  `CREATE TABLE IF NOT EXISTS leave_request (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `ALTER TABLE leave_request MODIFY COLUMN leave_type_code VARCHAR(32) NOT NULL`,
  `UPDATE leave_request SET leave_type_code = 'OTHER' WHERE leave_type_code IN ('EXTRAORDINARY', 'PATERNITY', 'FUNERAL')`,
  `UPDATE leave_request SET leave_type_code = 'CHILD_SICK_LEAVE' WHERE leave_type_code = 'CHILD_SICK_PAY'`,
  `UPDATE leave_request SET leave_type_code = 'SICK_LEAVE' WHERE leave_type_code = 'SICK_PAY'`,

  `INSERT IGNORE INTO leave_request (
    id, employee_id, legal_entity_id, approver_id, leave_type_code,
    start_date, end_date, day_portion, status, employee_comment, submitted_at,
    decision, decided_by, on_behalf_of, decided_at, decision_comment,
    cancellation_kind, cancelled_by, cancelled_at, cancellation_reason
  ) VALUES
    ('req-0001', 'emp-peter', 'VIRGO_KFT', 'emp-katalin', 'ANNUAL', '2026-06-15', '2026-06-19', 'FULL', 'APPROVED', 'Családi nyaralás', '2026-06-01T08:30:00Z', 'APPROVED', 'emp-katalin', NULL, '2026-06-02T10:15:00Z', 'Jóváhagyva', NULL, NULL, NULL, NULL),
    ('req-0002', 'emp-anna', 'VIRGO_ZRT', 'emp-katalin', 'ANNUAL', '2026-07-03', '2026-07-03', 'AM', 'PENDING', 'Hivatali ügyintézés délelőtt', '2026-06-25T14:00:00Z', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
    ('req-0003', 'emp-katalin', 'VIRGO_KFT', 'emp-piri', 'OTHER', '2026-05-04', '2026-05-05', 'FULL', 'REVOKED', 'Költözés', '2026-04-20T09:00:00Z', 'APPROVED', 'emp-piri', NULL, '2026-04-21T11:00:00Z', 'Rendben', 'REVOKED', 'emp-piri', '2026-04-28T16:00:00Z', 'Időpont módosulás miatt HR által visszavonva')`,

  `CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(128) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    active_role ENUM('EMPLOYEE', 'MANAGER', 'HR_ADMIN') NOT NULL,
    csrf_token VARCHAR(128) NOT NULL DEFAULT '',
    created_at VARCHAR(64) NOT NULL,
    expires_at VARCHAR(64) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_sessions_employee_id (employee_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS csrf_token VARCHAR(128) NOT NULL DEFAULT ''`,
]

interface MysqlPromisePool {
  execute(
    sql: string,
    values?: readonly unknown[],
  ): Promise<[unknown, unknown]>
}

export function createMariaDbSqlExecutor(config: MariaDbConfig): SqlExecutor {
  const pool = mysql.createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  }) as unknown as MysqlPromisePool

  let initializedPromise: Promise<void> | null = null

  async function ensureInitialized(): Promise<void> {
    if (!initializedPromise) {
      initializedPromise = (async () => {
        for (const stmt of SCHEMA_AND_SEED_STATEMENTS) {
          await pool.execute(stmt)
        }
      })().catch((err) => {
        initializedPromise = null
        throw err
      })
    }
    return initializedPromise
  }

  return {
    async query<T = unknown>(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<T[]> {
      await ensureInitialized()
      const [rows] = await pool.execute(sql, params)
      return rows as T[]
    },

    async execute(
      sql: string,
      params: readonly unknown[] = [],
    ): Promise<{ affectedRows: number }> {
      await ensureInitialized()
      const [result] = await pool.execute(sql, params)
      const header = result as { affectedRows?: number }
      return { affectedRows: header.affectedRows ?? 0 }
    },
  }
}
