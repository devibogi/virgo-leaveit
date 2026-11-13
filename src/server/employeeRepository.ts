import {
  createEmployee,
  mapEmployeeToRow,
  mapRowToEmployee,
  type CreateEmployeeInput,
  type Employee,
  type EmployeeRow,
  type LegalEntityId,
} from '../domain/employee.ts'
import type { SqlExecutor } from './teamRepository.ts'

export interface EmployeeFilter {
  legalEntityId?: LegalEntityId
  managerId?: string
}

export interface EmployeeRepository {
  findAll(filter?: EmployeeFilter): Promise<Employee[]>
  findById(id: string): Promise<Employee | null>
  create(input: CreateEmployeeInput): Promise<Employee>
  update(
    id: string,
    update: Omit<CreateEmployeeInput, 'id'>,
  ): Promise<Employee | null>
  delete(id: string): Promise<boolean>
}

export const SYNTHETIC_SEED_EMPLOYEES: readonly Employee[] = [
  {
    id: 'emp-piri',
    displayName: 'Varga Piri',
    email: 'piri.varga@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: null,
    roles: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'],
    birthDate: '1984-03-12',
    employmentStart: '2019-02-01',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: [],
    taxId: '8000000001',
  },
  {
    id: 'emp-katalin',
    displayName: 'Nagy Katalin',
    email: 'katalin.nagy@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: 'emp-piri',
    roles: ['EMPLOYEE', 'MANAGER'],
    birthDate: '1986-07-22',
    employmentStart: '2020-05-15',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-piri', 'emp-gabor'],
    taxId: '8000000002',
  },
  {
    id: 'emp-peter',
    displayName: 'Kovács Péter',
    email: 'peter.kovacs@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: 'emp-katalin',
    roles: ['EMPLOYEE'],
    birthDate: '1993-11-04',
    employmentStart: '2022-09-01',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-anna'],
    taxId: '8000000003',
  },
  {
    id: 'emp-anna',
    displayName: 'Szabó Anna',
    email: 'anna.szabo@virgo.example',
    legalEntityId: 'VIRGO_ZRT',
    managerId: 'emp-katalin',
    roles: ['EMPLOYEE'],
    birthDate: '1995-01-19',
    employmentStart: '2024-03-01',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-peter'],
    taxId: '8000000004',
  },
  {
    id: 'emp-eszter',
    displayName: 'Tóth Eszter',
    email: 'eszter.toth@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: 'emp-katalin',
    roles: ['EMPLOYEE'],
    birthDate: '1989-05-08',
    employmentStart: '2021-09-01',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-peter'],
    taxId: '8000000005',
  },
  {
    id: 'emp-gabor',
    displayName: 'Kovács Gábor',
    email: 'gabor.kovacs@virgo.example',
    legalEntityId: 'VIRGO_KFT',
    managerId: 'emp-piri',
    roles: ['EMPLOYEE', 'MANAGER'],
    birthDate: '1985-09-30',
    employmentStart: '2020-01-06',
    employmentEnd: null,
    includeInPayrollExport: true,
    deputyIds: ['emp-katalin'],
    taxId: '8000000006',
  },
]

export class InMemoryEmployeeRepository implements EmployeeRepository {
  private readonly store = new Map<string, EmployeeRow>()

  constructor(initialEmployees: readonly Employee[] = SYNTHETIC_SEED_EMPLOYEES) {
    for (const emp of initialEmployees) {
      const row = mapEmployeeToRow(emp)
      this.store.set(row.id, row)
    }
  }

  async findAll(filter?: EmployeeFilter): Promise<Employee[]> {
    let rows = Array.from(this.store.values())
    if (filter?.legalEntityId) {
      rows = rows.filter((r) => r.legal_entity_id === filter.legalEntityId)
    }
    if (filter?.managerId) {
      rows = rows.filter((r) =>
        (r.manager_id ?? '')
          .toLowerCase()
          .includes(filter.managerId!.toLowerCase()),
      )
    }
    return rows.map(mapRowToEmployee)
  }

  async findById(id: string): Promise<Employee | null> {
    const row = this.store.get(id)
    return row ? mapRowToEmployee(row) : null
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const validated = createEmployee(input)
    if (this.store.has(validated.id)) {
      throw new DuplicateEmployeeError(validated.id)
    }
    const row = mapEmployeeToRow(validated)
    this.store.set(row.id, row)
    return mapRowToEmployee(row)
  }

  async update(
    id: string,
    update: Omit<CreateEmployeeInput, 'id'>,
  ): Promise<Employee | null> {
    if (!this.store.has(id)) {
      return null
    }
    const validated = createEmployee({
      ...update,
      id,
    })
    const row = mapEmployeeToRow(validated)
    this.store.set(id, row)
    return mapRowToEmployee(row)
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id)
  }
}

export class MariaDbEmployeeRepository implements EmployeeRepository {
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findAll(filter?: EmployeeFilter): Promise<Employee[]> {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter?.legalEntityId) {
      clauses.push('legal_entity_id = ?')
      params.push(filter.legalEntityId)
    }
    if (filter?.managerId) {
      clauses.push('manager_id = ?')
      params.push(filter.managerId)
    }

    const whereClause =
      clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = await this.db.query<EmployeeRow>(
      `SELECT id, display_name, email, legal_entity_id, manager_id, roles_json, birth_date, employment_start, employment_end, include_in_payroll_export, deputy_ids_json, tax_id FROM employees${whereClause} ORDER BY display_name ASC`,
      params,
    )
    return rows.map(mapRowToEmployee)
  }

  async findById(id: string): Promise<Employee | null> {
    const rows = await this.db.query<EmployeeRow>(
      'SELECT id, display_name, email, legal_entity_id, manager_id, roles_json, birth_date, employment_start, employment_end, include_in_payroll_export, deputy_ids_json, tax_id FROM employees WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? mapRowToEmployee(rows[0]) : null
  }

  async create(input: CreateEmployeeInput): Promise<Employee> {
    const validated = createEmployee(input)
    const existing = await this.findById(validated.id)
    if (existing) {
      throw new DuplicateEmployeeError(validated.id)
    }

    const row = mapEmployeeToRow(validated)
    await this.db.execute(
      `INSERT INTO employees (
        id, display_name, email, legal_entity_id, manager_id,
        roles_json, birth_date, employment_start, employment_end,
        include_in_payroll_export, deputy_ids_json, tax_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.display_name,
        row.email,
        row.legal_entity_id,
        row.manager_id,
        row.roles_json,
        row.birth_date,
        row.employment_start,
        row.employment_end,
        row.include_in_payroll_export ?? 1,
        row.deputy_ids_json,
        row.tax_id ?? '',
      ],
    )
    return validated
  }

  async update(
    id: string,
    update: Omit<CreateEmployeeInput, 'id'>,
  ): Promise<Employee | null> {
    const validated = createEmployee({
      ...update,
      id,
    })
    const row = mapEmployeeToRow(validated)
    const result = await this.db.execute(
      `UPDATE employees SET
        display_name = ?,
        email = ?,
        legal_entity_id = ?,
        manager_id = ?,
        roles_json = ?,
        birth_date = ?,
        employment_start = ?,
        employment_end = ?,
        include_in_payroll_export = ?,
        deputy_ids_json = ?,
        tax_id = ?
      WHERE id = ?`,
      [
        row.display_name,
        row.email,
        row.legal_entity_id,
        row.manager_id,
        row.roles_json,
        row.birth_date,
        row.employment_start,
        row.employment_end,
        row.include_in_payroll_export ?? 1,
        row.deputy_ids_json,
        row.tax_id ?? '',
        row.id,
      ],
    )
    if (result.affectedRows === 0) {
      return null
    }
    return validated
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute('DELETE FROM employees WHERE id = ?', [
      id,
    ])
    return result.affectedRows > 0
  }
}

export class DuplicateEmployeeError extends Error {
  readonly employeeId: string

  constructor(employeeId: string) {
    super(`A(z) '${employeeId}' azonosítójú munkavállaló már létezik.`)
    this.name = 'DuplicateEmployeeError'
    this.employeeId = employeeId
  }
}
