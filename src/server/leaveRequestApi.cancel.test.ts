import { describe, expect, it } from 'vitest'
import { InMemoryLeaveRequestRepository } from './leaveRequestRepository.ts'
import { InMemoryEmployeeRepository } from './employeeRepository.ts'
import { createLeaveRequestApiHandler } from './leaveRequestApi.ts'
import { cancelLeaveRequestByEmployee, isCancellableByEmployee, LeaveDecisionError } from '../domain/index.ts'
import type { LeaveRequest } from '../types/model.ts'

type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
const session = (employeeId: string, activeRole: Role) => ({ sessionId: 's', employeeId, activeRole, csrfToken: 't' })
const headers = { 'x-csrf-token': 't' }
const handler = (today: string) =>
  createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository(), new InMemoryEmployeeRepository(), () => today)
const cancel = (h: ReturnType<typeof handler>, id: string, who: string, role: Role = 'EMPLOYEE') =>
  h({ method: 'POST', url: `/api/requests/${id}/cancel`, headers, body: {}, session: session(who, role) })

const base = { employeeId: 'emp-anna', status: 'APPROVED', startDate: '2026-12-01' } as LeaveRequest

describe('employee cancel (domain)', () => {
  it('cancels own future approved/pending request and keeps it as CANCELLED', () => {
    const c = cancelLeaveRequestByEmployee(base, 'emp-anna', '2026-11-30', 'T')
    expect(c.status).toBe('CANCELLED')
    expect(c.cancellation).toEqual({ kind: 'CANCELLED', cancelledBy: 'emp-anna', cancelledAt: 'T', reason: null })
    expect(cancelLeaveRequestByEmployee({ ...base, status: 'PENDING' }, 'emp-anna', '2026-11-30').status).toBe('CANCELLED')
  })
  it('start date today or past → 409', () => {
    for (const today of ['2026-12-01', '2026-12-05']) {
      expect(() => cancelLeaveRequestByEmployee(base, 'emp-anna', today)).toThrow(LeaveDecisionError)
    }
    expect(isCancellableByEmployee(base, '2026-12-01')).toBe(false)
    expect(isCancellableByEmployee(base, '2026-11-30')).toBe(true)
  })
  it('rejected/cancelled/revoked → 409; other employee → 403', () => {
    for (const status of ['REJECTED', 'CANCELLED', 'REVOKED'] as const) {
      expect(isCancellableByEmployee({ ...base, status }, '2026-01-01')).toBe(false)
      try { cancelLeaveRequestByEmployee({ ...base, status }, 'emp-anna', '2026-01-01'); expect.unreachable() }
      catch (e) { expect((e as LeaveDecisionError).status).toBe(409) }
    }
    try { cancelLeaveRequestByEmployee(base, 'emp-peter', '2026-01-01'); expect.unreachable() }
    catch (e) { expect((e as LeaveDecisionError).status).toBe(403) }
  })
})

describe('POST /api/requests/:id/cancel', () => {
  it('owner cancels pending future request → 200 CANCELLED', async () => {
    const res = await cancel(handler('2026-06-01'), 'req-0002', 'emp-anna')
    expect(res?.status).toBe(200)
    expect((res?.body as LeaveRequest).status).toBe('CANCELLED')
  })
  it('after start → 409; not owner → 403 (even HR); unknown → 404; no session → 403', async () => {
    expect((await cancel(handler('2026-07-03'), 'req-0002', 'emp-anna'))?.status).toBe(409)
    expect((await cancel(handler('2026-06-01'), 'req-0002', 'emp-piri', 'HR_ADMIN'))?.status).toBe(403)
    expect((await cancel(handler('2026-06-01'), 'nope', 'emp-anna'))?.status).toBe(404)
    const anon = await handler('2026-06-01')({ method: 'POST', url: '/api/requests/req-0002/cancel', headers, body: {}, session: null })
    expect(anon?.status).toBe(403)
  })
})
