import type { EmployeeId, Role, Team } from '../types/model.ts'

export type { EmployeeId, Role, Team }

export interface CreateTeamInput {
  managerId: EmployeeId
  name: string
}

export interface TeamRow {
  manager_id: string
  name: string
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

export function validateTeam(input: CreateTeamInput): TeamValidationResult {
  const errors: string[] = []

  if (!input.managerId || input.managerId.trim().length === 0) {
    errors.push('A vezető azonosítója (managerId) kötelező.')
  }
  if (!input.name || input.name.trim().length === 0) {
    errors.push('A csapat neve kötelező.')
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
    managerId: input.managerId.trim(),
    name: input.name.trim(),
  }
}

export function mapRowToTeam(row: TeamRow): Team {
  return {
    managerId: row.manager_id,
    name: row.name,
  }
}

export function mapTeamToRow(team: Team): TeamRow {
  return {
    manager_id: team.managerId,
    name: team.name,
  }
}
