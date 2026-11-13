import { describe, expect, it } from 'vitest'
import { InMemoryEmployeeRepository } from './employeeRepository.ts'
import { InMemoryLeaveRequestRepository } from './leaveRequestRepository.ts'
import { createPayrollExportApiHandler } from './payrollExportApi.ts'

const handler = createPayrollExportApiHandler(new InMemoryEmployeeRepository(), new InMemoryLeaveRequestRepository())
const session = (activeRole: 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN') => ({
  sessionId: 's',
  employeeId: 'emp-piri',
  activeRole,
  csrfToken: 't',
})
const url = '/api/exports/payroll?year=2026&month=11&legalEntityId=VIRGO_KFT'

describe('payroll export API', () => {
  it('ignores other paths', async () => {
    expect(await handler({ method: 'GET', url: '/api/teams', session: session('HR_ADMIN') })).toBeNull()
  })

  it.each(['EMPLOYEE', 'MANAGER'] as const)('rejects %s with 403', async (role) => {
    const res = await handler({ method: 'GET', url, session: session(role) })
    expect(res?.status).toBe(403)
  })

  it('rejects missing session with 403', async () => {
    expect((await handler({ method: 'GET', url, session: null }))?.status).toBe(403)
  })

  it('validates query params', async () => {
    const res = await handler({ method: 'GET', url: '/api/exports/payroll?year=2026&month=13&legalEntityId=X', session: session('HR_ADMIN') })
    expect(res?.status).toBe(400)
  })

  it('returns the CSV with download headers for HR_ADMIN', async () => {
    const res = await handler({ method: 'GET', url, session: session('HR_ADMIN') })
    expect(res?.status).toBe(200)
    expect(res?.headers?.['Content-Type']).toBe('text/csv; charset=utf-8')
    expect(res?.headers?.['Content-Disposition']).toContain('payroll_VIRGO_KFT_2026-11.csv')
    const lines = String(res?.body).split('\r\n')
    expect(lines[0].startsWith('Virgo Kft.;')).toBe(true)
    expect(lines.some((l) => l.startsWith('Varga Piri;8000000001;'))).toBe(true)
    expect(lines.some((l) => l.includes('Anna'))).toBe(false) // VIRGO_ZRT
  })
})
