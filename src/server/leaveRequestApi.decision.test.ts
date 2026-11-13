import { describe, expect, it } from 'vitest'
import { InMemoryLeaveRequestRepository } from './leaveRequestRepository.ts'
import { createLeaveRequestApiHandler } from './leaveRequestApi.ts'

type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
const session = (employeeId: string, activeRole: Role) => ({ sessionId: 's', employeeId, activeRole, csrfToken: 't' })
const headers = { 'x-csrf-token': 't' }
const decide = (h: ReturnType<typeof createLeaveRequestApiHandler>, id: string, who: string, role: Role, body: unknown) =>
  h({ method: 'POST', url: `/api/requests/${id}/decision`, headers, body, session: session(who, role) })

describe('leave request decision API', () => {
  it('incoming list returns only requests where the actor is approver', async () => {
    const h = createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository())
    const res = await h({ method: 'GET', url: '/api/requests?scope=incoming', session: session('emp-katalin', 'MANAGER') })
    expect(res?.status).toBe(200)
    const rows = res?.body as { approverId: string; id: string }[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.approverId === 'emp-katalin')).toBe(true)
    expect(rows.some((r) => r.id === 'req-0002')).toBe(true)
  })

  it('approver manager approves a pending request', async () => {
    const h = createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository())
    const res = await decide(h, 'req-0002', 'emp-katalin', 'MANAGER', { decision: 'APPROVED' })
    expect(res?.status).toBe(200)
    expect((res?.body as { status: string }).status).toBe('APPROVED')
    // second decision on the same request → 409
    expect((await decide(h, 'req-0002', 'emp-katalin', 'MANAGER', { decision: 'REJECTED' }))?.status).toBe(409)
  })

  it('rejection keeps the comment', async () => {
    const h = createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository())
    const res = await decide(h, 'req-0002', 'emp-katalin', 'MANAGER', { decision: 'REJECTED', comment: 'Leadási határidő' })
    expect(res?.status).toBe(200)
    expect((res?.body as { approval: { comment: string } }).approval.comment).toBe('Leadási határidő')
  })

  it('non-approver gets 403', async () => {
    const h = createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository())
    expect((await decide(h, 'req-0002', 'emp-piri', 'HR_ADMIN', { decision: 'APPROVED' }))?.status).toBe(403)
  })

  it('invalid decision → 400, unknown id → 404', async () => {
    const h = createLeaveRequestApiHandler(new InMemoryLeaveRequestRepository())
    expect((await decide(h, 'req-0002', 'emp-katalin', 'MANAGER', { decision: 'MAYBE' }))?.status).toBe(400)
    expect((await decide(h, 'nope', 'emp-katalin', 'MANAGER', { decision: 'APPROVED' }))?.status).toBe(404)
  })
})
