import { describe, expect, it } from 'vitest'
import { createEmployeeApiClient } from './employees.ts'
import { TeamApiError } from './teams.ts'
import { createEmployeeApiHandler } from '../server/employeeApi.ts'
import { InMemoryEmployeeRepository } from '../server/employeeRepository.ts'
import type { SessionContext } from '../server/sessionRepository.ts'
import type { Role } from '../domain/employee.ts'

function createInMemoryEmployeeFetch() {
  const repository = new InMemoryEmployeeRepository([
    {
      id: 'emp-piri',
      displayName: 'Varga Piri',
      email: 'piri.varga@virgo.example',
      legalEntityId: 'VIRGO_KFT',
      managerId: null,
      roles: ['EMPLOYEE', 'HR_ADMIN'],
      birthDate: '1984-03-12',
      employmentStart: '2019-02-01',
      employmentEnd: null,
      includeInPayrollExport: true,
      deputyIds: [],
      taxId: '8000000001',
    },
  ])
  const handler = createEmployeeApiHandler(repository)

  function makeFetch(getSession: () => SessionContext | null): typeof fetch {
    return async (input, init) => {
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
        session: getSession(),
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
  }

  return { makeFetch }
}

describe('Employee API endpoints, session authorization & frontend client', () => {
  it('blocks non-HR_ADMIN roles with 403 Forbidden', async () => {
    const { makeFetch } = createInMemoryEmployeeFetch()
    let role: Role = 'EMPLOYEE'
    const client = createEmployeeApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-1',
        employeeId: 'emp-piri',
        activeRole: role,
      })),
    })

    await expect(client.listEmployees()).rejects.toMatchObject({ status: 403 })

    role = 'MANAGER'
    await expect(client.getEmployeeById('emp-piri')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('performs full Employee CRUD as HR_ADMIN', async () => {
    const { makeFetch } = createInMemoryEmployeeFetch()
    const client = createEmployeeApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-hr',
        employeeId: 'emp-piri',
        activeRole: 'HR_ADMIN',
      })),
    })

    const created = await client.createEmployee({
      id: 'emp-peter',
      displayName: 'Kovács Péter',
      email: 'peter.kovacs@virgo.example',
      legalEntityId: 'VIRGO_ZRT',
      managerId: 'emp-piri',
      roles: ['EMPLOYEE'],
      birthDate: '1993-11-04',
      employmentStart: '2022-09-01',
      employmentEnd: null,
      deputyIds: ['emp-piri'],
      taxId: '8000000002',
    })

    expect(created.id).toBe('emp-peter')
    expect(created.legalEntityId).toBe('VIRGO_ZRT')

    const zrtOnly = await client.listEmployees({ legalEntityId: 'VIRGO_ZRT' })
    expect(zrtOnly).toEqual([created])

    const updated = await client.updateEmployee('emp-peter', {
      displayName: 'Dr. Kovács Péter',
      email: 'peter.kovacs@virgo.example',
      legalEntityId: 'VIRGO_KFT',
      managerId: 'emp-piri',
      roles: ['EMPLOYEE', 'MANAGER'],
      birthDate: '1993-11-04',
      employmentStart: '2022-09-01',
      employmentEnd: null,
      deputyIds: ['emp-piri'],
      taxId: '8000000003',
    })
    expect(updated.displayName).toBe('Dr. Kovács Péter')
    expect(updated.roles).toEqual(['EMPLOYEE', 'MANAGER'])

    await client.deleteEmployee('emp-peter')
    await expect(client.getEmployeeById('emp-peter')).rejects.toThrowError(
      TeamApiError,
    )
  })

  it('lets managers list only their direct reports, read-only, without personal fields', async () => {
    const { makeFetch } = createInMemoryEmployeeFetch()
    const hr = createEmployeeApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-hr',
        employeeId: 'emp-piri',
        activeRole: 'HR_ADMIN',
      })),
    })
    await hr.createEmployee({
      id: 'emp-report',
      displayName: 'Teszt Beosztott',
      email: 'report@virgo.example',
      legalEntityId: 'VIRGO_ZRT',
      managerId: 'emp-piri',
      roles: ['EMPLOYEE'],
      birthDate: '1995-05-05',
      employmentStart: '2024-01-01',
      employmentEnd: null,
      includeInPayrollExport: true,
      deputyIds: [],
      taxId: '8000000002',
    })

    const manager = createEmployeeApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-mgr',
        employeeId: 'emp-piri',
        activeRole: 'MANAGER',
      })),
    })
    const team = await manager.listEmployees({ managerId: 'someone-else' })
    expect(team.map((e) => e.id)).toEqual(['emp-report'])
    expect(team[0]).not.toHaveProperty('birthDate')
    expect(team[0]).not.toHaveProperty('taxId')
    expect(team[0]).not.toHaveProperty('legalEntityId')

    await expect(manager.getEmployeeById('emp-report')).rejects.toMatchObject({ status: 403 })
    const anonymous = createEmployeeApiClient({
      fetchFn: makeFetch(() => null),
    })
    await expect(anonymous.listEmployees()).rejects.toMatchObject({ status: 403 })
  })

  it('HR moves an employee to another team; rejects a management cycle', async () => {
    const { makeFetch } = createInMemoryEmployeeFetch()
    const client = createEmployeeApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-hr',
        employeeId: 'emp-piri',
        activeRole: 'HR_ADMIN',
      })),
    })
    const base = {
      email: 'x@virgo.example',
      legalEntityId: 'VIRGO_KFT' as const,
      roles: ['EMPLOYEE' as Role],
      birthDate: '1990-01-01',
      employmentStart: '2024-01-01',
    }
    await client.createEmployee({ ...base, id: 'emp-m', displayName: 'M', managerId: 'emp-piri' })
    const created = await client.createEmployee({ ...base, id: 'emp-d', displayName: 'D', managerId: 'emp-m' })

    const { id: _id, ...rest } = created
    void _id
    const moved = await client.updateEmployee('emp-d', { ...rest, managerId: 'emp-piri' })
    expect(moved.managerId).toBe('emp-piri')

    const m = await client.getEmployeeById('emp-m')
    const { id: _mid, ...mRest } = m
    void _mid
    await expect(
      client.updateEmployee('emp-piri', {
        ...(await client.getEmployeeById('emp-piri')),
        managerId: 'emp-m',
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect((await client.updateEmployee('emp-m', { ...mRest, managerId: 'emp-d' })).managerId).toBe('emp-d')
  })
})
