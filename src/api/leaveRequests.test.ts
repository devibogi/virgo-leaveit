import { describe, expect, it } from 'vitest'
import { createLeaveRequestApiClient } from './leaveRequests.ts'
import { createLeaveRequestApiHandler } from '../server/leaveRequestApi.ts'
import { InMemoryLeaveRequestRepository } from '../server/leaveRequestRepository.ts'
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

describe('LeaveRequest API endpoints, HR_ADMIN authorization & history preservation', () => {
  it('blocks non-HR_ADMIN roles with 403 Forbidden', async () => {
    const { fakeFetch } = createInMemoryRequestFetch()
    let role: Role = 'EMPLOYEE'
    const client = createLeaveRequestApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => role,
    })

    await expect(client.listRequests()).rejects.toMatchObject({ status: 403 })

    role = 'MANAGER'
    await expect(client.getRequestById('req-0001')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('creates, updates, filters and revokes LeaveRequest without hard-deleting', async () => {
    const { fakeFetch } = createInMemoryRequestFetch()
    const client = createLeaveRequestApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => 'HR_ADMIN',
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
    // Hidden fields are generated / derived server-side (D21)
    expect(created.id).toMatch(/^req-/)
    expect(created.legalEntityId).toBe('VIRGO_ZRT')
    expect(created.approverId).toBe('emp-katalin')

    // Client-sent hidden fields are ignored
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
    expect(spoofed.approverId).toBe('emp-piri') // UNPAID → HR Admin

    // Edit keeps owner, status and history
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
      actorId: 'emp-piri',
    })
    expect(revoked.status).toBe('REVOKED')
    expect(revoked.cancellation?.kind).toBe('REVOKED')
    expect(revoked.cancellation?.reason).toBe('HR korrekció miatt sztornózva')

    // Revoked request stays in history!
    const all = await client.listRequests()
    expect(all).toHaveLength(3)
  })
})
