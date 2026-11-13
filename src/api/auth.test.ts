import { describe, expect, it } from 'vitest'
import { createAuthApiClient } from './auth.ts'
import { createAuthApiHandler } from '../server/authApi.ts'
import { InMemoryEmployeeRepository } from '../server/employeeRepository.ts'
import {
  extractSessionIdFromHeaders,
  InMemorySessionRepository,
  MariaDbSessionRepository,
  SESSION_COOKIE_NAME,
  type SessionRow,
} from '../server/sessionRepository.ts'
import type { SqlExecutor } from '../server/teamRepository.ts'
import { DEMO_VALID_PASSWORD } from '../domain/auth.ts'

function createInMemoryAuthHarness() {
  const employeeRepo = new InMemoryEmployeeRepository()
  const sessionRepo = new InMemorySessionRepository()
  const handler = createAuthApiHandler(employeeRepo, sessionRepo)

  let cookieJar = ''

  const fakeFetch: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.toString()
    const method = init?.method ?? 'GET'
    const rawHeaders: Record<string, string> = {
      ...((init?.headers ?? {}) as Record<string, string>),
    }
    if (cookieJar) {
      rawHeaders.cookie = cookieJar
    }
    const body =
      typeof init?.body === 'string' ? JSON.parse(init.body) : undefined

    const sessionId = extractSessionIdFromHeaders(rawHeaders)
    const activeSession = sessionId
      ? await sessionRepo.findById(sessionId)
      : null

    const result = await handler({
      method,
      url,
      headers: rawHeaders,
      body,
      session: activeSession
        ? {
            sessionId: activeSession.id,
            employeeId: activeSession.employeeId,
            activeRole: activeSession.activeRole,
            csrfToken: activeSession.csrfToken,
          }
        : null,
    })

    if (!result) {
      return new Response(
        JSON.stringify({ error: 'Not found', details: ['Route not found'] }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      )
    }

    const setCookie = result.headers?.['Set-Cookie']
    if (setCookie) {
      if (setCookie.includes('Max-Age=0')) {
        cookieJar = ''
      } else {
        cookieJar = setCookie.split(';')[0]
      }
    }

    if (result.status === 204) {
      return new Response(null, { status: 204 })
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        'Content-Type': 'application/json',
        ...(result.headers ?? {}),
      },
    })
  }

  return {
    fakeFetch,
    getCookieJar: () => cookieJar,
  }
}

describe('Session-based Auth API (HttpOnly cookie + own-role switching)', () => {
  it('logs in, sets HttpOnly session cookie, restores session, switches own roles, and logs out', async () => {
    const { fakeFetch, getCookieJar } = createInMemoryAuthHarness()
    const client = createAuthApiClient({ fetchFn: fakeFetch })

    // Initially no active session
    expect(await client.getSession()).toBeNull()

    // Login as Varga Piri (roles: ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'])
    const loggedIn = await client.login({
      email: 'piri.varga@virgo.example',
      password: DEMO_VALID_PASSWORD,
    })
    expect(loggedIn.employee.id).toBe('emp-piri')
    expect(loggedIn.defaultRole).toBe('HR_ADMIN')
    expect(loggedIn.activeRole).toBe('HR_ADMIN')
    expect(getCookieJar()).toContain(`${SESSION_COOKIE_NAME}=`)

    // Restore session via GET /api/auth/session
    const restored = await client.getSession()
    expect(restored?.employee.id).toBe('emp-piri')
    expect(restored?.activeRole).toBe('HR_ADMIN')

    // Switch to own EMPLOYEE role via POST /api/auth/role
    const switched = await client.switchRole('EMPLOYEE')
    expect(switched.activeRole).toBe('EMPLOYEE')
    expect((await client.getSession())?.activeRole).toBe('EMPLOYEE')

    // Piri manages the HR team, so MANAGER is one of her roles
    expect((await client.switchRole('MANAGER')).activeRole).toBe('MANAGER')
    // A role outside the known set is rejected
    await expect(client.switchRole('ROOT' as never)).rejects.toMatchObject({
      status: 400,
    })

    // Logout clears session and cookie
    await client.logout()
    expect(getCookieJar()).toBe('')
    expect(await client.getSession()).toBeNull()
  })

  it('persists sessions in MariaDbSessionRepository using parameterized SQL', async () => {
    const rows: SessionRow[] = []
    const mockSql: SqlExecutor = {
      async query<T>(_sql: string, params?: readonly unknown[]): Promise<T[]> {
        const found = rows.find((r) => r.id === params?.[0])
        return (found ? [found] : []) as T[]
      },
      async execute(sql: string, params?: readonly unknown[]) {
        if (sql.startsWith('INSERT INTO sessions')) {
          rows.push({
            id: String(params?.[0]),
            employee_id: String(params?.[1]),
            active_role: params?.[2] as SessionRow['active_role'],
            csrf_token: String(params?.[3]),
            created_at: String(params?.[4]),
            expires_at: String(params?.[5]),
          })
          return { affectedRows: 1 }
        }
        if (sql.startsWith('UPDATE sessions')) {
          const row = rows.find((r) => r.id === params?.[1])
          if (!row) return { affectedRows: 0 }
          row.active_role = params?.[0] as SessionRow['active_role']
          return { affectedRows: 1 }
        }
        if (sql.startsWith('DELETE FROM sessions')) {
          const idx = rows.findIndex((r) => r.id === params?.[0])
          if (idx === -1) return { affectedRows: 0 }
          rows.splice(idx, 1)
          return { affectedRows: 1 }
        }
        return { affectedRows: 0 }
      },
    }

    const repo = new MariaDbSessionRepository(mockSql)
    const created = await repo.create('emp-katalin', 'MANAGER')
    expect(created.employeeId).toBe('emp-katalin')
    expect(created.activeRole).toBe('MANAGER')

    const updated = await repo.updateRole(created.id, 'EMPLOYEE')
    expect(updated?.activeRole).toBe('EMPLOYEE')

    expect(await repo.delete(created.id)).toBe(true)
    expect(await repo.findById(created.id)).toBeNull()
  })
})
