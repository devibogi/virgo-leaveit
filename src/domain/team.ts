import type { Employee, EmployeeId, Role, Team } from '../types/model.ts'

export type { EmployeeId, Role, Team }

export interface CreateTeamInput {
  /** Generated when missing. */
  id?: string
  managerId: EmployeeId
  name: string
}

export interface TeamRow {
  id: string
  manager_id: string
  name: string
}

export function generateTeamId(): string {
  return `team-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export interface TeamValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Only HR_ADMIN is authorized to manage (list/create/update/delete) Team records
 * in the HR admin Team CRUD module.
 */
export function canManageTeams(roleOrRoles: Role | readonly Role[]): boolean {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.includes('HR_ADMIN')
  }
  return roleOrRoles === 'HR_ADMIN'
}

/**
 * Every team must have a manager: when `manager` is passed (looked up by managerId),
 * it must exist and hold the MANAGER role. `undefined` skips the lookup check.
 */
export function validateTeam(
  input: CreateTeamInput,
  manager?: Pick<Employee, 'roles'> | null,
): TeamValidationResult {
  const errors: string[] = []

  if (!input.managerId || input.managerId.trim().length === 0) {
    errors.push('A vezető azonosítója (managerId) kötelező.')
  }
  if (!input.name || input.name.trim().length === 0) {
    errors.push('A csapat neve kötelező.')
  }
  if (manager === null && input.managerId?.trim()) {
    errors.push('A megadott vezető nem létező munkavállaló.')
  } else if (manager && !manager.roles.includes('MANAGER')) {
    errors.push('A csapat vezetőjének vezetői (MANAGER) szerepkörrel kell rendelkeznie.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createTeam(input: CreateTeamInput): Team {
  const validation = validateTeam(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  return {
    id: input.id?.trim() || generateTeamId(),
    managerId: input.managerId.trim(),
    name: input.name.trim(),
  }
}

export function mapRowToTeam(row: TeamRow): Team {
  return {
    id: row.id,
    managerId: row.manager_id,
    name: row.name,
  }
}

export function mapTeamToRow(team: Team): TeamRow {
  return {
    id: team.id,
    manager_id: team.managerId,
    name: team.name,
  }
}
