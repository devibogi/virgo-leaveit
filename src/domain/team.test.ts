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
      managerId: ' emp-katalin ',
      name: ' Fejlesztési csapat ',
    })

    expect(team).toEqual<Team>({
      managerId: 'emp-katalin',
      name: 'Fejlesztési csapat',
    })
  })

  it('rejects empty fields during validation', () => {
    const result = validateTeam({
      managerId: '   ',
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
        managerId: 'emp-katalin',
        name: '',
      }),
    ).toThrow('A csapat neve kötelező.')
  })

  it('maps between MariaDB row (snake_case) and Team entity (camelCase)', () => {
    const row: TeamRow = {
      manager_id: 'emp-katalin',
      name: 'Fejlesztési csapat',
    }

    const entity = mapRowToTeam(row)
    expect(entity).toEqual<Team>({
      managerId: 'emp-katalin',
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
