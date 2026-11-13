import { describe, expect, it } from 'vitest'
import { createEmployeeApiHandler } from './employeeApi.ts'

const handler = createEmployeeApiHandler()
const session = (activeRole: 'MANAGER' | 'HR_ADMIN') => ({
  sessionId: 's',
  employeeId: activeRole === 'MANAGER' ? 'emp-katalin' : 'emp-piri',
  activeRole,
  csrfToken: 't',
})

describe('employee API GDPR field stripping', () => {
  it('manager list has no employment start, birth date, tax id or entity', async () => {
    const res = await handler({ method: 'GET', url: '/api/employees', session: session('MANAGER') })
    expect(res?.status).toBe(200)
    const rows = res?.body as Record<string, unknown>[]
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      for (const f of ['employmentStart', 'birthDate', 'taxId', 'legalEntityId']) expect(r).not.toHaveProperty(f)
    }
  })
  it('HR admin still sees employment start', async () => {
    const res = await handler({ method: 'GET', url: '/api/employees', session: session('HR_ADMIN') })
    expect((res?.body as Record<string, unknown>[])[0]).toHaveProperty('employmentStart')
  })
})
