import { describe, expect, it } from 'vitest'
import { createTeamApiClient, TeamApiError } from './teams.ts'
import { createTeamApiHandler } from '../server/teamApi.ts'
import {
  InMemoryTeamRepository,
  MariaDbTeamRepository,
  type SqlExecutor,
} from '../server/teamRepository.ts'
import type { Role, TeamRow } from '../domain/team.ts'

function createInMemoryFetch() {
  const repository = new InMemoryTeamRepository([
    {
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

describe('Team OpenAPI 3 endpoints, HR_ADMIN authorization & frontend client', () => {
  it('serves the OpenAPI 3.0.3 document at GET /api/openapi.json', async () => {
    const { handler } = createInMemoryFetch()
    const res = await handler({ method: 'GET', url: '/api/openapi.json' })

    expect(res?.status).toBe(200)
    expect(res?.body).toMatchObject({
      openapi: '3.0.3',
      info: { title: 'LeaveIt API' },
    })
  })

  it('rejects non-HR_ADMIN roles with 403 Forbidden', async () => {
    const { fakeFetch } = createInMemoryFetch()
    let currentRole: Role = 'EMPLOYEE'
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => currentRole,
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

  it('lists, creates, fetches, updates and deletes teams as HR_ADMIN', async () => {
    const { fakeFetch } = createInMemoryFetch()
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => 'HR_ADMIN',
    })

    const initial = await client.listTeams()
    expect(initial).toEqual([
      {
        managerId: 'emp-katalin',
        name: 'Fejlesztési csapat',
      },
    ])

    const created = await client.createTeam({
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })
    expect(created).toEqual({
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })

    const filtered = await client.listTeams({ managerId: 'emp-piri' })
    expect(filtered).toEqual([created])

    const fetched = await client.getTeamByManagerId('emp-piri')
    expect(fetched).toEqual(created)

    const updated = await client.updateTeam('emp-piri', {
      name: 'People & Operations',
    })
    expect(updated).toEqual({
      managerId: 'emp-piri',
      name: 'People & Operations',
    })

    await client.deleteTeam('emp-piri')

    await expect(client.getTeamByManagerId('emp-piri')).rejects.toThrowError(
      TeamApiError,
    )
  })

  it('returns 400 on invalid input and 409 on duplicate managerId', async () => {
    const { fakeFetch } = createInMemoryFetch()
    const client = createTeamApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => 'HR_ADMIN',
    })

    await expect(
      client.createTeam({ managerId: '', name: '' }),
    ).rejects.toMatchObject({
      status: 400,
    })

    await expect(
      client.createTeam({
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
        manager_id: 'emp-katalin',
        name: 'Fejlesztési csapat',
      },
    ]

    const mockSql: SqlExecutor = {
      async query<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
        if (sql.includes('WHERE manager_id = ?')) {
          const found = rows.find((r) => r.manager_id === params?.[0])
          return (found ? [found] : []) as T[]
        }
        return rows as T[]
      },
      async execute(sql: string, params?: readonly unknown[]) {
        if (sql.startsWith('INSERT INTO teams')) {
          rows.push({
            manager_id: String(params?.[0]),
            name: String(params?.[1]),
          })
          return { affectedRows: 1 }
        }
        return { affectedRows: 1 }
      },
    }

    const repo = new MariaDbTeamRepository(mockSql)
    const created = await repo.create({
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })

    expect(created).toEqual({
      managerId: 'emp-piri',
      name: 'HR és Operáció',
    })
    expect(await repo.findAll()).toHaveLength(2)
  })
})
