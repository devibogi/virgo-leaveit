import { recomputeEntitlementUsage } from '../domain/entitlementUsage.ts'
import {
  createLeaveEntitlement,
  mapLeaveEntitlementToRow,
  mapRowToLeaveEntitlement,
  type CreateLeaveEntitlementInput,
  type EntitlementComponent,
  type LeaveEntitlement,
  type LeaveEntitlementRow,
} from '../domain/leaveEntitlement.ts'
import type { LeaveDay } from '../types/model.ts'
import type { SqlExecutor } from './teamRepository.ts'

export interface LeaveEntitlementFilter {
  employeeId?: string
  year?: number
  component?: EntitlementComponent
}

export interface LeaveEntitlementRepository {
  findAll(filter?: LeaveEntitlementFilter): Promise<LeaveEntitlement[]>
  findById(id: string): Promise<LeaveEntitlement | null>
  create(input: CreateLeaveEntitlementInput): Promise<LeaveEntitlement>
  update(
    id: string,
    update: Omit<CreateLeaveEntitlementInput, 'id'>,
  ): Promise<LeaveEntitlement | null>
  delete(id: string): Promise<boolean>
}

export const SYNTHETIC_SEED_ENTITLEMENTS: readonly LeaveEntitlement[] = [
  {
    id: 'ent-peter-2026-base',
    employeeId: 'emp-peter',
    year: 2026,
    component: 'BASE',
    fullYearDays: 20,
    calculatedDays: 20,
    overrideDays: null,
    overrideReason: null,
    payrollReferenceDays: 20,
    usedQ1: 0,
    usedQ2: 0,
    usedQ3: 0,
    usedQ4: 0,
    usedYear: 0,
    updatedAt: '2026-01-02T08:00:00Z',
    updatedBy: 'emp-piri',
  },
  {
    id: 'ent-peter-2026-age',
    employeeId: 'emp-peter',
    year: 2026,
    component: 'AGE_ADDITIONAL',
    fullYearDays: 4,
    calculatedDays: 4,
    overrideDays: null,
    overrideReason: null,
    payrollReferenceDays: 4,
    usedQ1: 0,
    usedQ2: 0,
    usedQ3: 0,
    usedQ4: 0,
    usedYear: 0,
    updatedAt: '2026-01-02T08:00:00Z',
    updatedBy: 'emp-piri',
  },
  {
    id: 'ent-katalin-2026-base',
    employeeId: 'emp-katalin',
    year: 2026,
    component: 'BASE',
    fullYearDays: 20,
    calculatedDays: 20,
    overrideDays: null,
    overrideReason: null,
    payrollReferenceDays: 20,
    usedQ1: 0,
    usedQ2: 0,
    usedQ3: 0,
    usedQ4: 0,
    usedYear: 0,
    updatedAt: '2026-01-02T08:00:00Z',
    updatedBy: 'emp-piri',
  },
  {
    id: 'ent-katalin-2026-child',
    employeeId: 'emp-katalin',
    year: 2026,
    component: 'CHILD_ADDITIONAL',
    fullYearDays: null,
    calculatedDays: null,
    overrideDays: 4,
    overrideReason: 'Éves nyilatkozat alapján (2 gyermek)',
    payrollReferenceDays: 4,
    usedQ1: 0,
    usedQ2: 0,
    usedQ3: 0,
    usedQ4: 0,
    usedYear: 0,
    updatedAt: '2026-01-05T09:30:00Z',
    updatedBy: 'emp-piri',
  },
  {
    id: 'ent-eszter-2026-child',
    employeeId: 'emp-eszter',
    year: 2026,
    component: 'CHILD_ADDITIONAL',
    fullYearDays: null,
    calculatedDays: null,
    overrideDays: 9,
    overrideReason: 'Éves nyilatkozat alapján (3 gyermek 16 év alatt, ebből 1 fogyatékos: 7 + 2 nap)',
    payrollReferenceDays: 9,
    usedQ1: 0,
    usedQ2: 0,
    usedQ3: 0,
    usedQ4: 0,
    usedYear: 0,
    updatedAt: '2026-01-05T09:45:00Z',
    updatedBy: 'emp-piri',
  },
]

export class InMemoryLeaveEntitlementRepository
  implements LeaveEntitlementRepository
{
  private readonly store = new Map<string, LeaveEntitlementRow>()
  private readonly getApprovedLeaveDays: (employeeId: string) => LeaveDay[]

  constructor(
    initialEntitlements: readonly LeaveEntitlement[] = SYNTHETIC_SEED_ENTITLEMENTS,
    getApprovedLeaveDays: (employeeId: string) => LeaveDay[] = () => [],
  ) {
    this.getApprovedLeaveDays = getApprovedLeaveDays
    for (const ent of initialEntitlements) {
      const row = mapLeaveEntitlementToRow(ent)
      this.store.set(row.id, row)
    }
  }

  private recomputeCacheForEmployeeYear(employeeId: string, year: number) {
    const employeeRows = Array.from(this.store.values())
      .filter((r) => r.employee_id === employeeId && Number(r.year) === year)
      .map(mapRowToLeaveEntitlement)

    const leaveDays = this.getApprovedLeaveDays(employeeId)
    const usageMap = recomputeEntitlementUsage(employeeRows, leaveDays, year)

    for (const ent of employeeRows) {
      const usage = usageMap.get(ent.id)
      if (!usage) continue
      const updated = mapLeaveEntitlementToRow({
        ...ent,
        usedQ1: usage.usedQ1,
        usedQ2: usage.usedQ2,
        usedQ3: usage.usedQ3,
        usedQ4: usage.usedQ4,
        usedYear: usage.usedYear,
      })
      this.store.set(ent.id, updated)
    }
  }

  async findAll(filter?: LeaveEntitlementFilter): Promise<LeaveEntitlement[]> {
    let rows = Array.from(this.store.values())
    if (filter?.employeeId) {
      rows = rows.filter((r) =>
        r.employee_id.toLowerCase().includes(filter.employeeId!.toLowerCase()),
      )
    }
    if (filter?.year !== undefined) {
      rows = rows.filter((r) => Number(r.year) === filter.year)
    }
    if (filter?.component) {
      rows = rows.filter((r) => r.component === filter.component)
    }
    return rows.map(mapRowToLeaveEntitlement)
  }

  async findById(id: string): Promise<LeaveEntitlement | null> {
    const row = this.store.get(id)
    return row ? mapRowToLeaveEntitlement(row) : null
  }

  async create(input: CreateLeaveEntitlementInput): Promise<LeaveEntitlement> {
    const validated = createLeaveEntitlement(input)
    if (this.store.has(validated.id)) {
      throw new DuplicateEntitlementError(
        `A(z) '${validated.id}' azonosítójú jogosultság már létezik.`,
      )
    }

    const duplicateComponent = Array.from(this.store.values()).find(
      (r) =>
        r.employee_id === validated.employeeId &&
        Number(r.year) === validated.year &&
        r.component === validated.component,
    )
    if (duplicateComponent) {
      throw new DuplicateEntitlementError(
        `Ehhez a munkavállalóhoz (${validated.employeeId}) és évhez (${validated.year}) már létezik ${validated.component} komponens.`,
      )
    }

    const row = mapLeaveEntitlementToRow(validated)
    this.store.set(row.id, row)
    this.recomputeCacheForEmployeeYear(validated.employeeId, validated.year)
    return mapRowToLeaveEntitlement(this.store.get(row.id)!)
  }

  async update(
    id: string,
    update: Omit<CreateLeaveEntitlementInput, 'id'>,
  ): Promise<LeaveEntitlement | null> {
    const existing = this.store.get(id)
    if (!existing) {
      return null
    }

    const validated = createLeaveEntitlement({
      ...update,
      id,
    })

    const duplicateComponent = Array.from(this.store.values()).find(
      (r) =>
        r.id !== id &&
        r.employee_id === validated.employeeId &&
        Number(r.year) === validated.year &&
        r.component === validated.component,
    )
    if (duplicateComponent) {
      throw new DuplicateEntitlementError(
        `Ehhez a munkavállalóhoz (${validated.employeeId}) és évhez (${validated.year}) már létezik ${validated.component} komponens.`,
      )
    }

    const row = mapLeaveEntitlementToRow(validated)
    this.store.set(id, row)
    this.recomputeCacheForEmployeeYear(validated.employeeId, validated.year)
    return mapRowToLeaveEntitlement(this.store.get(id)!)
  }

  async delete(id: string): Promise<boolean> {
    const existing = this.store.get(id)
    if (!existing) {
      return false
    }
    this.store.delete(id)
    this.recomputeCacheForEmployeeYear(
      existing.employee_id,
      Number(existing.year),
    )
    return true
  }
}

export class MariaDbLeaveEntitlementRepository
  implements LeaveEntitlementRepository
{
  private readonly db: SqlExecutor

  constructor(db: SqlExecutor) {
    this.db = db
  }

  async findAll(filter?: LeaveEntitlementFilter): Promise<LeaveEntitlement[]> {
    const clauses: string[] = []
    const params: unknown[] = []

    if (filter?.employeeId) {
      clauses.push('employee_id = ?')
      params.push(filter.employeeId)
    }
    if (filter?.year !== undefined) {
      clauses.push('year = ?')
      params.push(filter.year)
    }
    if (filter?.component) {
      clauses.push('component = ?')
      params.push(filter.component)
    }

    const where = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : ''
    const rows = await this.db.query<LeaveEntitlementRow>(
      `SELECT id, employee_id, year, component, full_year_days, calculated_days, override_days, override_reason, payroll_reference_days, used_q1, used_q2, used_q3, used_q4, used_year, updated_at, updated_by FROM leave_entitlement${where} ORDER BY employee_id ASC, year DESC`,
      params,
    )
    return rows.map(mapRowToLeaveEntitlement)
  }

  async findById(id: string): Promise<LeaveEntitlement | null> {
    const rows = await this.db.query<LeaveEntitlementRow>(
      'SELECT id, employee_id, year, component, full_year_days, calculated_days, override_days, override_reason, payroll_reference_days, used_q1, used_q2, used_q3, used_q4, used_year, updated_at, updated_by FROM leave_entitlement WHERE id = ? LIMIT 1',
      [id],
    )
    return rows[0] ? mapRowToLeaveEntitlement(rows[0]) : null
  }

  async create(input: CreateLeaveEntitlementInput): Promise<LeaveEntitlement> {
    const validated = createLeaveEntitlement(input)
    const existing = await this.findById(validated.id)
    if (existing) {
      throw new DuplicateEntitlementError(
        `A(z) '${validated.id}' azonosítójú jogosultság már létezik.`,
      )
    }

    const row = mapLeaveEntitlementToRow(validated)
    await this.db.execute(
      `INSERT INTO leave_entitlement (
        id, employee_id, year, component, full_year_days, calculated_days,
        override_days, override_reason, payroll_reference_days,
        used_q1, used_q2, used_q3, used_q4, used_year, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.employee_id,
        row.year,
        row.component,
        row.full_year_days,
        row.calculated_days,
        row.override_days,
        row.override_reason,
        row.payroll_reference_days,
        row.used_q1,
        row.used_q2,
        row.used_q3,
        row.used_q4,
        row.used_year,
        row.updated_at,
        row.updated_by,
      ],
    )
    return validated
  }

  async update(
    id: string,
    update: Omit<CreateLeaveEntitlementInput, 'id'>,
  ): Promise<LeaveEntitlement | null> {
    const validated = createLeaveEntitlement({
      ...update,
      id,
    })
    const row = mapLeaveEntitlementToRow(validated)
    const result = await this.db.execute(
      `UPDATE leave_entitlement SET
        employee_id = ?, year = ?, component = ?, full_year_days = ?,
        calculated_days = ?, override_days = ?, override_reason = ?,
        payroll_reference_days = ?, updated_at = ?, updated_by = ?
      WHERE id = ?`,
      [
        row.employee_id,
        row.year,
        row.component,
        row.full_year_days,
        row.calculated_days,
        row.override_days,
        row.override_reason,
        row.payroll_reference_days,
        row.updated_at,
        row.updated_by,
        row.id,
      ],
    )
    if (result.affectedRows === 0) {
      return null
    }
    return validated
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db.execute(
      'DELETE FROM leave_entitlement WHERE id = ?',
      [id],
    )
    return result.affectedRows > 0
  }
}

export class DuplicateEntitlementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DuplicateEntitlementError'
  }
}
