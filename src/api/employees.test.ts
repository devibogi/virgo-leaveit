import { describe, expect, it } from 'vitest'
import { createEmployeeApiClient } from './employees.ts'
import { TeamApiError } from './teams.ts'
import { createEmployeeApiHandler } from '../server/employeeApi.ts'
import { InMemoryEmployeeRepository } from '../server/employeeRepository.ts'
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

  return { fakeFetch }
}

describe('Employee API endpoints, HR_ADMIN authorization & frontend client', () => {
  it('blocks non-HR_ADMIN roles with 403 Forbidden', async () => {
    const { fakeFetch } = createInMemoryEmployeeFetch()
    let role: Role = 'EMPLOYEE'
    const client = createEmployeeApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => role,
    })

    await expect(client.listEmployees()).rejects.toMatchObject({ status: 403 })

    role = 'MANAGER'
    await expect(client.getEmployeeById('emp-piri')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('performs full Employee CRUD as HR_ADMIN', async () => {
    const { fakeFetch } = createInMemoryEmployeeFetch()
    const client = createEmployeeApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => 'HR_ADMIN',
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
})
