import { describe, expect, it } from 'vitest'
import { createTeamApiHandler } from './teamApi.ts'
import { InMemoryTeamRepository, SYNTHETIC_SEED_TEAMS } from './teamRepository.ts'
import { InMemoryEmployeeRepository, SYNTHETIC_SEED_EMPLOYEES } from './employeeRepository.ts'

const hr = { sessionId: 's', employeeId: 'emp-piri', activeRole: 'HR_ADMIN' as const }

describe('Team API: every team has a manager', () => {
  it('every seeded team manager is a seeded MANAGER', () => {
    for (const team of SYNTHETIC_SEED_TEAMS) {
      const manager = SYNTHETIC_SEED_EMPLOYEES.find((e) => e.id === team.managerId)
      expect(manager?.roles, team.name).toContain('MANAGER')
    }
  })

  it('rejects a team whose manager is missing or lacks the MANAGER role', async () => {
    const handler = createTeamApiHandler(new InMemoryTeamRepository([]), new InMemoryEmployeeRepository())
    const post = (managerId: string) =>
      handler({ method: 'POST', url: '/api/teams', body: { managerId, name: 'Új csapat' }, session: hr })
    expect((await post('emp-peter'))?.status).toBe(400)
    expect((await post('emp-nobody'))?.status).toBe(400)
    expect((await post('emp-gabor'))?.status).toBe(201)
  })

  it('seeds Nagy Katalin with two teams; every member shares the team manager', () => {
    expect(SYNTHETIC_SEED_TEAMS.filter((t) => t.managerId === 'emp-katalin').map((t) => t.id)).toEqual([
      'team-dev',
      'team-qa',
    ])
    for (const emp of SYNTHETIC_SEED_EMPLOYEES) {
      if (!emp.teamId) continue
      const team = SYNTHETIC_SEED_TEAMS.find((t) => t.id === emp.teamId)
      expect(team?.managerId, emp.id).toBe(emp.managerId)
    }
  })
})
