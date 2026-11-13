import { describe, expect, it } from 'vitest'
import { createEmployeeApiHandler } from './employeeApi.ts'

const hr = { sessionId: 's', employeeId: 'emp-piri', activeRole: 'HR_ADMIN' as const, csrfToken: 't' }
const headers = { 'x-csrf-token': 't' }
const base = {
  id: 'emp-tax',
  displayName: 'Teszt Tamás',
  email: 'tamas.teszt@virgo.example',
  legalEntityId: 'VIRGO_KFT',
  managerId: null,
  roles: ['EMPLOYEE'],
  birthDate: '1990-01-01',
  employmentStart: '2024-01-01',
  employmentEnd: null,
  deputyIds: [],
}

describe('employee tax id (HR admin)', () => {
  it('create requires a 10-digit tax id', async () => {
    const handler = createEmployeeApiHandler()
    for (const taxId of [undefined, '', '123', '12345678901', '84000000ab']) {
      const res = await handler({ method: 'POST', url: '/api/employees', headers, session: hr, body: { ...base, taxId } })
      expect(res?.status).toBe(400)
    }
  })

  it('HR creates and updates tax id; HR sees it, manager does not', async () => {
    const handler = createEmployeeApiHandler()
    const created = await handler({ method: 'POST', url: '/api/employees', headers, session: hr, body: { ...base, taxId: '8400000077' } })
    expect(created?.status).toBe(201)
    expect((created?.body as { taxId: string }).taxId).toBe('8400000077')

    const updated = await handler({ method: 'PUT', url: '/api/employees/emp-tax', headers, session: hr, body: { ...base, taxId: '8400000088' } })
    expect(updated?.status).toBe(200)
    const got = await handler({ method: 'GET', url: '/api/employees/emp-tax', session: hr })
    expect((got?.body as { taxId: string }).taxId).toBe('8400000088')

    const bad = await handler({ method: 'PUT', url: '/api/employees/emp-tax', headers, session: hr, body: { ...base, taxId: '84' } })
    expect(bad?.status).toBe(400)

    const mgr = await handler({ method: 'GET', url: '/api/employees', session: { ...hr, employeeId: 'emp-katalin', activeRole: 'MANAGER' } })
    for (const r of mgr?.body as Record<string, unknown>[]) expect(r).not.toHaveProperty('taxId')
  })
})
