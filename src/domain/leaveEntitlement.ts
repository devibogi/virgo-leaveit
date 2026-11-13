import type {
  EmployeeId,
  EntitlementComponent,
  EntitlementId,
  IsoDateTime,
  LeaveEntitlement,
  Role,
} from '../types/model.ts'

export type {
  EmployeeId,
  EntitlementComponent,
  EntitlementId,
  IsoDateTime,
  LeaveEntitlement,
  Role,
}

export const EntitlementComponentEnum = {
  BASE: 'BASE',
  AGE_ADDITIONAL: 'AGE_ADDITIONAL',
  CHILD_ADDITIONAL: 'CHILD_ADDITIONAL',
  AGE_ADDITIONAL_CARRYOVER: 'AGE_ADDITIONAL_CARRYOVER',
} as const satisfies Record<EntitlementComponent, EntitlementComponent>

export const ENTITLEMENT_COMPONENTS: readonly EntitlementComponent[] = [
  EntitlementComponentEnum.BASE,
  EntitlementComponentEnum.AGE_ADDITIONAL,
  EntitlementComponentEnum.CHILD_ADDITIONAL,
  EntitlementComponentEnum.AGE_ADDITIONAL_CARRYOVER,
] as const

export interface CreateLeaveEntitlementInput {
  id: EntitlementId
  employeeId: EmployeeId
  year: number
  component: EntitlementComponent
  fullYearDays?: number | null
  calculatedDays?: number | null
  overrideDays?: number | null
  overrideReason?: string | null
  payrollReferenceDays?: number | null
  usedQ1?: number
  usedQ2?: number
  usedQ3?: number
  usedQ4?: number
  usedYear?: number
  updatedAt?: IsoDateTime
  updatedBy: EmployeeId
}

export interface LeaveEntitlementRow {
  id: string
  employee_id: string
  year: number
  component: EntitlementComponent
  full_year_days: number | string | null
  calculated_days: number | string | null
  override_days: number | string | null
  override_reason: string | null
  payroll_reference_days: number | string | null
  used_q1: number | string
  used_q2: number | string
  used_q3: number | string
  used_q4: number | string
  used_year: number | string
  updated_at: string
  updated_by: string
}

export interface LeaveEntitlementValidationResult {
  valid: boolean
  errors: string[]
}

export function isEntitlementComponent(
  value: unknown,
): value is EntitlementComponent {
  return (
    typeof value === 'string' &&
    (ENTITLEMENT_COMPONENTS as readonly string[]).includes(value)
  )
}

/**
 * Only HR_ADMIN is authorized to manage LeaveEntitlement records in the HR admin CRUD.
 */
export function canManageEntitlements(
  roleOrRoles: Role | readonly Role[],
): boolean {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.includes('HR_ADMIN')
  }
  return roleOrRoles === 'HR_ADMIN'
}

/**
 * Effective days = overrideDays ?? calculatedDays ?? 0 (DATA_MODEL.md).
 */
export function getEffectiveEntitlementDays(
  entitlement: Pick<LeaveEntitlement, 'overrideDays' | 'calculatedDays'>,
): number {
  return entitlement.overrideDays ?? entitlement.calculatedDays ?? 0
}

function isHalfDayStep(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && Math.abs(value * 2 - Math.round(value * 2)) < 1e-6
}

export function validateLeaveEntitlement(
  input: CreateLeaveEntitlementInput,
): LeaveEntitlementValidationResult {
  const errors: string[] = []

  if (!input.id || input.id.trim().length === 0) {
    errors.push('A jogosultság azonosítója (id) kötelező.')
  }
  if (!input.employeeId || input.employeeId.trim().length === 0) {
    errors.push('A munkavállaló azonosítója (employeeId) kötelező.')
  }
  if (
    !Number.isInteger(input.year) ||
    input.year < 2000 ||
    input.year > 2100
  ) {
    errors.push('Az évszám (year) 2000 és 2100 közötti egész szám kell legyen.')
  }
  if (!isEntitlementComponent(input.component)) {
    errors.push(
      `Érvénytelen jogosultság komponens (component). Engedélyezett: ${ENTITLEMENT_COMPONENTS.join(', ')}.`,
    )
  }

  const fullYearDays = input.fullYearDays ?? null
  const calculatedDays = input.calculatedDays ?? null
  const overrideDays = input.overrideDays ?? null
  const payrollReferenceDays = input.payrollReferenceDays ?? null

  if (fullYearDays !== null && !isHalfDayStep(fullYearDays)) {
    errors.push('Az egész éves keret (fullYearDays) nemnegatív 0.5 többszörös kell legyen.')
  }
  if (calculatedDays !== null && !isHalfDayStep(calculatedDays)) {
    errors.push('A számított keret (calculatedDays) nemnegatív 0.5 többszörös kell legyen.')
  }
  if (overrideDays !== null && !isHalfDayStep(overrideDays)) {
    errors.push('A HR felülírás (overrideDays) nemnegatív 0.5 többszörös kell legyen.')
  }
  if (payrollReferenceDays !== null && !isHalfDayStep(payrollReferenceDays)) {
    errors.push('A bérszámfejtési referencia (payrollReferenceDays) nemnegatív 0.5 többszörös kell legyen.')
  }

  if (calculatedDays === null && overrideDays === null) {
    errors.push(
      'Legalább a számított keret (calculatedDays) vagy a kézi HR korrekció (overrideDays) megadása kötelező.',
    )
  }

  const trimmedReason = input.overrideReason?.trim() ?? ''
  if (overrideDays !== null && trimmedReason.length === 0) {
    errors.push(
      'Kézi HR korrekció (overrideDays) esetén az indoklás (overrideReason) megadása kötelező.',
    )
  }

  if (!input.updatedBy || input.updatedBy.trim().length === 0) {
    errors.push('A módosító azonosítója (updatedBy) kötelező.')
  }

  const q1 = input.usedQ1 ?? 0
  const q2 = input.usedQ2 ?? 0
  const q3 = input.usedQ3 ?? 0
  const q4 = input.usedQ4 ?? 0
  const expectedUsedYear = Math.round((q1 + q2 + q3 + q4) * 2) / 2
  const usedYear = input.usedYear ?? expectedUsedYear

  if (Math.abs(usedYear - expectedUsedYear) > 1e-6) {
    errors.push(
      'Az éves felhasznált napok száma (usedYear) meg kell egyezzen a negyedévek (Q1–Q4) összegével.',
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createLeaveEntitlement(
  input: CreateLeaveEntitlementInput,
): LeaveEntitlement {
  const validation = validateLeaveEntitlement(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const q1 = input.usedQ1 ?? 0
  const q2 = input.usedQ2 ?? 0
  const q3 = input.usedQ3 ?? 0
  const q4 = input.usedQ4 ?? 0
  const usedYear = Math.round((q1 + q2 + q3 + q4) * 2) / 2

  const trimmedReason =
    input.overrideReason && input.overrideReason.trim().length > 0
      ? input.overrideReason.trim()
      : null

  return {
    id: input.id.trim(),
    employeeId: input.employeeId.trim(),
    year: input.year,
    component: input.component,
    fullYearDays: input.fullYearDays ?? null,
    calculatedDays: input.calculatedDays ?? null,
    overrideDays: input.overrideDays ?? null,
    overrideReason: trimmedReason,
    payrollReferenceDays: input.payrollReferenceDays ?? null,
    usedQ1: q1,
    usedQ2: q2,
    usedQ3: q3,
    usedQ4: q4,
    usedYear,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
    updatedBy: input.updatedBy.trim(),
  }
}

function toNullableNumber(val: number | string | null): number | null {
  if (val === null || val === undefined) return null
  return Number(val)
}

export function mapRowToLeaveEntitlement(
  row: LeaveEntitlementRow,
): LeaveEntitlement {
  return {
    id: row.id,
    employeeId: row.employee_id,
    year: Number(row.year),
    component: row.component,
    fullYearDays: toNullableNumber(row.full_year_days),
    calculatedDays: toNullableNumber(row.calculated_days),
    overrideDays: toNullableNumber(row.override_days),
    overrideReason: row.override_reason,
    payrollReferenceDays: toNullableNumber(row.payroll_reference_days),
    usedQ1: Number(row.used_q1),
    usedQ2: Number(row.used_q2),
    usedQ3: Number(row.used_q3),
    usedQ4: Number(row.used_q4),
    usedYear: Number(row.used_year),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export function mapLeaveEntitlementToRow(
  ent: LeaveEntitlement,
): LeaveEntitlementRow {
  return {
    id: ent.id,
    employee_id: ent.employeeId,
    year: ent.year,
    component: ent.component,
    full_year_days: ent.fullYearDays,
    calculated_days: ent.calculatedDays,
    override_days: ent.overrideDays,
    override_reason: ent.overrideReason,
    payroll_reference_days: ent.payrollReferenceDays,
    used_q1: ent.usedQ1,
    used_q2: ent.usedQ2,
    used_q3: ent.usedQ3,
    used_q4: ent.usedQ4,
    used_year: ent.usedYear,
    updated_at: ent.updatedAt,
    updated_by: ent.updatedBy,
  }
}
