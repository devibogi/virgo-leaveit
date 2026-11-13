import { describe, expect, it } from 'vitest'
import {
  canManageTeams,
  createTeam,
  mapRowToTeam,
  mapTeamToRow,
  validateTeam,
  type Team,
  type TeamRow,
} from './team.ts'

describe('Team entity (shared DATA_MODEL contract)', () => {
  it('creates a valid Team entity keyed by managerId and trims fields', () => {
    const team = createTeam({
      id: ' team-dev ',
      managerId: ' emp-katalin ', deputyId: 'emp-dep',
      name: ' Fejlesztési csapat ',
    })

    expect(team).toEqual<Team>({
      id: 'team-dev',
      managerId: 'emp-katalin', deputyId: 'emp-dep',
      name: 'Fejlesztési csapat',
    })
  })

  it('rejects empty fields during validation', () => {
    const result = validateTeam({
      managerId: '   ', deputyId: 'emp-dep',
      name: '',
    })

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual([
      'A vezető azonosítója (managerId) kötelező.',
      'A csapat neve kötelező.',
    ])
  })

  it('throws when createTeam receives invalid input', () => {
    expect(() =>
      createTeam({
        managerId: 'emp-katalin', deputyId: 'emp-dep',
        name: '',
      }),
    ).toThrow('A csapat neve kötelező.')
  })

  it('maps between MariaDB row (snake_case) and Team entity (camelCase)', () => {
    const row: TeamRow = {
      id: 'team-dev',
      manager_id: 'emp-katalin', deputy_id: 'emp-dep',
      name: 'Fejlesztési csapat',
    }

    const entity = mapRowToTeam(row)
    expect(entity).toEqual<Team>({
      id: 'team-dev',
      managerId: 'emp-katalin', deputyId: 'emp-dep',
      name: 'Fejlesztési csapat',
    })

    expect(mapTeamToRow(entity)).toEqual(row)
  })

  it('allows only HR_ADMIN role to manage teams', () => {
    expect(canManageTeams('HR_ADMIN')).toBe(true)
    expect(canManageTeams(['EMPLOYEE', 'HR_ADMIN'])).toBe(true)
    expect(canManageTeams('MANAGER')).toBe(false)
    expect(canManageTeams('EMPLOYEE')).toBe(false)
    expect(canManageTeams(['EMPLOYEE', 'MANAGER'])).toBe(false)
  })
})

describe('createTeam id', () => {
  it('generates an id when none is given, so one manager can lead several teams', () => {
    const a = createTeam({ managerId: 'emp-katalin', deputyId: 'emp-dep', name: 'A' })
    const b = createTeam({ managerId: 'emp-katalin', deputyId: 'emp-dep', name: 'B' })
    expect(a.id).toMatch(/^team-/)
    expect(a.id).not.toBe(b.id)
  })
})

describe('validateTeam: every team has a manager', () => {
  it('requires an existing employee with the MANAGER role when looked up', () => {
    const input = { managerId: 'emp-x', deputyId: 'emp-dep', name: 'Csapat' }
    expect(validateTeam(input, { roles: ['EMPLOYEE', 'MANAGER'] }).valid).toBe(true)
    expect(validateTeam(input, { roles: ['EMPLOYEE'] }).valid).toBe(false)
    expect(validateTeam(input, null).valid).toBe(false)
    expect(validateTeam(input).valid).toBe(true) // no lookup available
  })
})
