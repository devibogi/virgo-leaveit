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
      handler({ method: 'POST', url: '/api/teams', body: { managerId, deputyId: 'emp-anna', name: 'Új csapat' }, session: hr })
    expect((await post('emp-peter'))?.status).toBe(400)
    expect((await post('emp-nobody'))?.status).toBe(400)
    expect((await post('emp-gabor'))?.status).toBe(201)
  })

  it('requires a team deputy different from the manager', async () => {
    const handler = createTeamApiHandler(new InMemoryTeamRepository([]), new InMemoryEmployeeRepository())
    const post = (deputyId: string) =>
      handler({ method: 'POST', url: '/api/teams', body: { managerId: 'emp-gabor', deputyId, name: 'X' }, session: hr })
    expect((await post(''))?.status).toBe(400)
    expect((await post('emp-gabor'))?.status).toBe(400)
    const ok = await post('emp-anna')
    expect(ok?.status).toBe(201)
    expect((ok?.body as { deputyId: string }).deputyId).toBe('emp-anna')
  })

  it('every seeded team has a deputy who is not its manager', () => {
    for (const team of SYNTHETIC_SEED_TEAMS) {
      expect(team.deputyId, team.id).toBeTruthy()
      expect(team.deputyId, team.id).not.toBe(team.managerId)
    }
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
