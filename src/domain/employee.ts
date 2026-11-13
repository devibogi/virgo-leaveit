import type {
  Employee,
  EmployeeId,
  IsoDate,
  LegalEntityId,
  Role,
} from '../types/model.ts'
import { isLegalEntityId } from './legalEntity.ts'

export type { Employee, EmployeeId, IsoDate, LegalEntityId, Role }

export interface CreateEmployeeInput {
  id: EmployeeId
  displayName: string
  email: string
  legalEntityId: LegalEntityId
  managerId: EmployeeId | null
  roles: Role[]
  birthDate: IsoDate
  employmentStart: IsoDate
  employmentEnd?: IsoDate | null
  includeInPayrollExport?: boolean
  deputyIds?: EmployeeId[]
}

export interface EmployeeRow {
  id: string
  display_name: string
  email: string
  legal_entity_id: LegalEntityId
  manager_id: string | null
  roles_json: string
  birth_date: string
  employment_start: string
  employment_end: string | null
  include_in_payroll_export: number | boolean
  deputy_ids_json: string
}

export interface EmployeeValidationResult {
  valid: boolean
  errors: string[]
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const VALID_ROLES: readonly Role[] = ['EMPLOYEE', 'MANAGER', 'HR_ADMIN']

/**
 * Only HR_ADMIN is authorized to manage Employee records in the HR admin CRUD.
 */
export function canManageEmployees(
  roleOrRoles: Role | readonly Role[],
): boolean {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.includes('HR_ADMIN')
  }
  return roleOrRoles === 'HR_ADMIN'
}

export function validateEmployee(
  input: CreateEmployeeInput,
): EmployeeValidationResult {
  const errors: string[] = []
  const trimmedId = input.id?.trim() ?? ''
  const trimmedName = input.displayName?.trim() ?? ''
  const trimmedEmail = input.email?.trim() ?? ''
  const trimmedManagerId =
    input.managerId && input.managerId.trim().length > 0
      ? input.managerId.trim()
      : null

  if (!trimmedId) {
    errors.push('A munkavállaló azonosítója (id) kötelező.')
  }
  if (!trimmedName) {
    errors.push('A munkavállaló neve (displayName) kötelező.')
  }
  if (!trimmedEmail || !trimmedEmail.includes('@')) {
    errors.push('Érvényes e-mail cím megadása kötelező.')
  }
  if (!isLegalEntityId(input.legalEntityId)) {
    errors.push('Érvényes jogi személy (VIRGO_KFT vagy VIRGO_ZRT) kötelező.')
  }
  if (trimmedManagerId && trimmedManagerId === trimmedId) {
    errors.push('A munkavállaló nem lehet saját maga közvetlen vezetője.')
  }
  if (
    !Array.isArray(input.roles) ||
    input.roles.length === 0 ||
    !input.roles.includes('EMPLOYEE') ||
    input.roles.some((r) => !VALID_ROLES.includes(r))
  ) {
    errors.push(
      'A szerepköröknek (roles) tartalmazniuk kell az EMPLOYEE szerepkört.',
    )
  }
  if (!input.birthDate || !ISO_DATE_REGEX.test(input.birthDate)) {
    errors.push('A születési dátum (YYYY-MM-DD) kötelező.')
  }
  if (!input.employmentStart || !ISO_DATE_REGEX.test(input.employmentStart)) {
    errors.push('A belépés dátuma (YYYY-MM-DD) kötelező.')
  }
  if (input.employmentEnd != null && input.employmentEnd !== '') {
    if (!ISO_DATE_REGEX.test(input.employmentEnd)) {
      errors.push('A kilépés dátuma csak YYYY-MM-DD formátumú lehet.')
    } else if (
      ISO_DATE_REGEX.test(input.employmentStart) &&
      input.employmentEnd < input.employmentStart
    ) {
      errors.push('A kilépés dátuma nem lehet korábbi a belépés dátumánál.')
    }
  }

  const deputyIds = (input.deputyIds ?? [])
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
  if (trimmedId && deputyIds.includes(trimmedId)) {
    errors.push(
      'A helyettesek listája (deputyIds) nem tartalmazhatja magát a munkavállalót.',
    )
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createEmployee(input: CreateEmployeeInput): Employee {
  const validation = validateEmployee(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const uniqueRoles = Array.from(new Set<Role>(['EMPLOYEE', ...input.roles]))
  const uniqueDeputies = Array.from(
    new Set(
      (input.deputyIds ?? []).map((d) => d.trim()).filter((d) => d.length > 0),
    ),
  )
  const trimmedManagerId =
    input.managerId && input.managerId.trim().length > 0
      ? input.managerId.trim()
      : null
  const trimmedEmploymentEnd =
    input.employmentEnd && input.employmentEnd.trim().length > 0
      ? input.employmentEnd.trim()
      : null

  return {
    id: input.id.trim(),
    displayName: input.displayName.trim(),
    email: input.email.trim(),
    legalEntityId: input.legalEntityId,
    managerId: trimmedManagerId,
    roles: uniqueRoles,
    birthDate: input.birthDate.trim(),
    employmentStart: input.employmentStart.trim(),
    employmentEnd: trimmedEmploymentEnd,
    includeInPayrollExport: input.includeInPayrollExport ?? true,
    deputyIds: uniqueDeputies,
  }
}

export function mapRowToEmployee(row: EmployeeRow): Employee {
  let roles: Role[] = ['EMPLOYEE']
  try {
    const parsed = JSON.parse(row.roles_json) as unknown
    if (Array.isArray(parsed)) {
      roles = parsed as Role[]
    }
  } catch {
    roles = ['EMPLOYEE']
  }

  let deputyIds: EmployeeId[] = []
  try {
    const parsed = JSON.parse(row.deputy_ids_json) as unknown
    if (Array.isArray(parsed)) {
      deputyIds = parsed as EmployeeId[]
    }
  } catch {
    deputyIds = []
  }

  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    legalEntityId: row.legal_entity_id,
    managerId: row.manager_id,
    roles,
    birthDate: row.birth_date,
    employmentStart: row.employment_start,
    employmentEnd: row.employment_end,
    includeInPayrollExport: Boolean(row.include_in_payroll_export),
    deputyIds,
  }
}

export function mapEmployeeToRow(employee: Employee): EmployeeRow {
  return {
    id: employee.id,
    display_name: employee.displayName,
    email: employee.email,
    legal_entity_id: employee.legalEntityId,
    manager_id: employee.managerId,
    roles_json: JSON.stringify(employee.roles),
    birth_date: employee.birthDate,
    employment_start: employee.employmentStart,
    employment_end: employee.employmentEnd,
    include_in_payroll_export: employee.includeInPayrollExport ? 1 : 0,
    deputy_ids_json: JSON.stringify(employee.deputyIds),
  }
}
