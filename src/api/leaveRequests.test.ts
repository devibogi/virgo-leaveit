import { describe, expect, it } from 'vitest'
import { createLeaveRequestApiClient } from './leaveRequests.ts'
import { createLeaveRequestApiHandler } from '../server/leaveRequestApi.ts'
import { InMemoryLeaveRequestRepository } from '../server/leaveRequestRepository.ts'
import type { SessionContext } from '../server/sessionRepository.ts'
import type { Role } from '../domain/leaveRequest.ts'

function createInMemoryRequestFetch() {
  const repository = new InMemoryLeaveRequestRepository([
    {
      id: 'req-0001',
      employeeId: 'emp-peter',
      legalEntityId: 'VIRGO_KFT',
      approverId: 'emp-katalin',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-06-15',
      endDate: '2026-06-19',
      dayPortion: 'FULL',
      status: 'APPROVED',
      employeeComment: 'Családi nyaralás',
      submittedAt: '2026-06-01T08:30:00Z',
      approval: {
        decision: 'APPROVED',
        decidedBy: 'emp-katalin',
        onBehalfOf: null,
        decidedAt: '2026-06-02T10:15:00Z',
        comment: 'Jóváhagyva',
      },
      cancellation: null,
    },
  ])
  const handler = createLeaveRequestApiHandler(repository)

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

describe('LeaveRequest API endpoints, session authorization & history preservation', () => {
  it('blocks non-HR_ADMIN roles and unauthenticated requests with 403 Forbidden', async () => {
    const { makeFetch } = createInMemoryRequestFetch()
    let session: SessionContext | null = null
    const client = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => session),
    })

    // Listing without an active session is rejected.
    await expect(client.listRequests()).rejects.toMatchObject({ status: 403 })

    session = {
      sessionId: 'sess-mgr',
      employeeId: 'emp-katalin',
      activeRole: 'MANAGER',
    }
    await expect(client.getRequestById('req-0001')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('lets every role create a request; non-HR only for themselves', async () => {
    const { makeFetch } = createInMemoryRequestFetch()
    for (const role of ['EMPLOYEE', 'MANAGER', 'HR_ADMIN'] as Role[]) {
      const client = createLeaveRequestApiClient({
        fetchFn: makeFetch(() => ({
          sessionId: `sess-${role}`,
          employeeId: 'emp-anna',
          activeRole: role,
        })),
      })
      const start = role === 'EMPLOYEE' ? '2026-09-01' : role === 'MANAGER' ? '2026-09-02' : '2026-09-03'
      const created = await client.createRequest({
        employeeId: 'emp-anna',
        leaveTypeCode: 'ANNUAL',
        startDate: start,
        endDate: start,
        dayPortion: 'FULL',
        employeeComment: null,
      })
      expect(created.status).toBe('PENDING')
      expect(created.employeeId).toBe('emp-anna')
    }

    // A non-HR actor cannot file for someone else: employeeId is forced to the session actor.
    const employee = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-anna',
        employeeId: 'emp-anna',
        activeRole: 'EMPLOYEE',
      })),
    })
    const forced = await employee.createRequest({
      employeeId: 'emp-katalin',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-09-10',
      endDate: '2026-09-10',
      dayPortion: 'FULL',
      employeeComment: null,
    })
    expect(forced.employeeId).toBe('emp-anna')

    // Without a session a create is rejected.
    const anonymous = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => null),
    })
    await expect(
      anonymous.createRequest({
        employeeId: 'emp-anna',
        leaveTypeCode: 'ANNUAL',
        startDate: '2026-09-11',
        endDate: '2026-09-11',
        dayPortion: 'FULL',
        employeeComment: null,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('lets non-HR roles list only their own requests', async () => {
    const { makeFetch } = createInMemoryRequestFetch()
    const peter = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-peter',
        employeeId: 'emp-peter',
        activeRole: 'MANAGER',
      })),
    })
    // A foreign employeeId filter is ignored: the list is forced to the session actor.
    const own = await peter.listRequests({ employeeId: 'emp-anna' })
    expect(own.map((r) => r.id)).toEqual(['req-0001'])

    const anna = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-anna',
        employeeId: 'emp-anna',
        activeRole: 'EMPLOYEE',
      })),
    })
    expect(await anna.listRequests()).toEqual([])
  })

  it('creates, updates, filters and revokes LeaveRequest without hard-deleting', async () => {
    const { makeFetch } = createInMemoryRequestFetch()
    const client = createLeaveRequestApiClient({
      fetchFn: makeFetch(() => ({
        sessionId: 'sess-hr',
        employeeId: 'emp-piri',
        activeRole: 'HR_ADMIN',
      })),
    })

    const created = await client.createRequest({
      employeeId: 'emp-anna',
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-08-10',
      endDate: '2026-08-10',
      dayPortion: 'AM',
      employeeComment: 'Délelőtti szabadnap',
    })
    expect(created.status).toBe('PENDING')
    expect(created.id).toMatch(/^req-/)
    expect(created.legalEntityId).toBe('VIRGO_ZRT')
    expect(created.approverId).toBe('emp-katalin')

    const spoofed = await client.createRequest({
      employeeId: 'emp-peter',
      leaveTypeCode: 'UNPAID',
      startDate: '2026-09-01',
      endDate: '2026-09-02',
      dayPortion: 'FULL',
      ...({ id: 'req-0001', status: 'APPROVED', approverId: 'emp-peter', legalEntityId: 'VIRGO_ZRT' } as object),
    })
    expect(spoofed.id).not.toBe('req-0001')
    expect(spoofed.status).toBe('PENDING')
    expect(spoofed.legalEntityId).toBe('VIRGO_KFT')
    expect(spoofed.approverId).toBe('emp-piri')

    const edited = await client.updateRequest('req-0001', {
      leaveTypeCode: 'ANNUAL',
      startDate: '2026-06-15',
      endDate: '2026-06-18',
      dayPortion: 'FULL',
    })
    expect(edited.employeeId).toBe('emp-peter')
    expect(edited.status).toBe('APPROVED')
    expect(edited.endDate).toBe('2026-06-18')

    await expect(
      client.createRequest({
        employeeId: 'emp-unknown',
        leaveTypeCode: 'ANNUAL',
        startDate: '2026-08-10',
        endDate: '2026-08-10',
        dayPortion: 'FULL',
      }),
    ).rejects.toMatchObject({ status: 400 })

    const revoked = await client.revokeRequest('req-0001', {
      reason: 'HR korrekció miatt sztornózva',
    })
    expect(revoked.status).toBe('REVOKED')
    expect(revoked.cancellation?.kind).toBe('REVOKED')
    expect(revoked.cancellation?.cancelledBy).toBe('emp-piri')
    expect(revoked.cancellation?.reason).toBe('HR korrekció miatt sztornózva')

    const all = await client.listRequests()
    expect(all).toHaveLength(3)
  })
})
