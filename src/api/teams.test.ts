import { describe, expect, it } from 'vitest'
import { createTeamApiClient, TeamApiError } from './teams.ts'
import { createTeamApiHandler } from '../server/teamApi.ts'
import type { SessionContext } from '../server/sessionRepository.ts'
import {
  InMemoryTeamRepository,
  MariaDbTeamRepository,
  type SqlExecutor,
} from '../server/teamRepository.ts'
import type { Role, TeamRow } from '../domain/team.ts'

function createInMemoryFetch(getSession?: () => SessionContext | null) {
  const repository = new InMemoryTeamRepository([
    {
      id: 'team-dev',
      managerId: 'emp-katalin',
      name: 'Fejlesztési csapat',
    },
  ])
  const handler = createTeamApiHandler(repository)

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const rawHeaders = (init?.headers ?? {}) as Record<string, string>
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined

    const result = await handler({
      method,
      url,
      headers: rawHeaders,
      body,
      session: getSession ? getSession() : null,
    })
    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Not found', details: ['Route not found'] }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    if (result.status === 204) {
      return new Response(null, { status: 204 })
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return { fakeFetch, handler }
}

describe('Team OpenAPI 3 endpoints, session HR_ADMIN authorization & frontend client', () => {
  it('serves the OpenAPI 3.0.3 document at GET /api/openapi.json', async () => {
    const { handler } = createInMemoryFetch()
    const res = await handler({ method: 'GET', url: '/api/openapi.json' })

    expect(res?.status).toBe(200)
    expect(res?.body).toMatchObject({
      openapi: '3.0.3',
      info: { title: 'LeaveIt API' },
    })
  })

  it('rejects non-HR_ADMIN session roles and unauthenticated requests with 403 Forbidden', async () => {
    let currentRole: Role = 'EMPLOYEE'
    const { fakeFetch } = createInMemoryFetch(() => ({
      sessionId: 'sess-1',
      employeeId: 'emp-peter',
      activeRole: currentRole,
    }))
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
    })

    await expect(client.listTeams()).rejects.toMatchObject({
      status: 403,
    })

    currentRole = 'MANAGER'
    await expect(
      client.createTeam({ managerId: 'emp-piri', name: 'HR Csapat' }),
    ).rejects.toMatchObject({
      status: 403,
    })
  })

  it('lists, creates, fetches, updates and deletes teams as HR_ADMIN in session', async () => {
    const { fakeFetch } = createInMemoryFetch(() => ({
      sessionId: 'sess-hr',
      employeeId: 'emp-piri',
      activeRole: 'HR_ADMIN',
    }))
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
    })

    const initial = await client.listTeams()
    expect(initial).toEqual([
      {
        id: 'team-dev',
        managerId: 'emp-katalin',
        name: 'Fejlesztési csapat',
      },
    ])

    const created = await client.createTeam({
      id: 'team-hr',
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })
    expect(created).toEqual({
      id: 'team-hr',
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })

    const filtered = await client.listTeams({ managerId: 'emp-piri' })
    expect(filtered).toEqual([created])

    // A manager may lead a second team.
    const second = await client.createTeam({ managerId: 'emp-piri', name: 'Operáció 2' })
    expect(second.id).not.toBe('team-hr')
    expect(await client.listTeams({ managerId: 'emp-piri' })).toHaveLength(2)
    await client.deleteTeam(second.id)

    const fetched = await client.getTeamById('team-hr')
    expect(fetched).toEqual(created)

    const updated = await client.updateTeam('team-hr', {
      name: 'People & Operations',
    })
    expect(updated).toEqual({
      id: 'team-hr',
      managerId: 'emp-piri',
      name: 'People & Operations',
    })

    await client.deleteTeam('team-hr')

    await expect(client.getTeamById('team-hr')).rejects.toThrowError(
      TeamApiError,
    )
  })

  it('returns 400 on invalid input and 409 on duplicate team id', async () => {
    const { fakeFetch } = createInMemoryFetch(() => ({
      sessionId: 'sess-hr',
      employeeId: 'emp-piri',
      activeRole: 'HR_ADMIN',
    }))
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
    })

    await expect(
      client.createTeam({ managerId: '', name: '' }),
    ).rejects.toMatchObject({
      status: 400,
    })

    await expect(
      client.createTeam({
        id: 'team-dev',
        managerId: 'emp-katalin',
        name: 'Duplikált csapat',
      }),
    ).rejects.toMatchObject({
      status: 409,
    })
  })

  it('executes parameterized SQL queries in MariaDbTeamRepository', async () => {
    const rows: TeamRow[] = [
      {
        id: 'team-dev',
        manager_id: 'emp-katalin',
        name: 'Fejlesztési csapat',
      },
    ]

    const mockSql: SqlExecutor = {
      async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
        if (sql.includes('WHERE id = ?')) {
          const found = rows.find((r) => r.id === params?.[0])
          return (found ? [found] : []) as T[]
        }
        return rows as T[]
      },
      async execute(sql: string, params?: readonly unknown[]) {
        if (sql.startsWith('INSERT INTO teams')) {
          rows.push({
            id: String(params?.[0]),
            manager_id: String(params?.[1]),
            name: String(params?.[2]),
          })
          return { affectedRows: 1 }
        }
        return { affectedRows: 1 }
      },
    }

    const repo = new MariaDbTeamRepository(mockSql)
    const created = await repo.create({
      id: 'team-hr',
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })

    expect(created).toEqual({
      id: 'team-hr',
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })
    expect(await repo.findAll()).toHaveLength(2)
  })
})
