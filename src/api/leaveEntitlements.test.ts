import { describe, expect, it } from 'vitest'
import { createLeaveEntitlementApiClient } from './leaveEntitlements.ts'
import { TeamApiError } from './teams.ts'
import { createLeaveEntitlementApiHandler } from '../server/leaveEntitlementApi.ts'
import { InMemoryLeaveEntitlementRepository } from '../server/leaveEntitlementRepository.ts'
import type { Role } from '../domain/leaveEntitlement.ts'
import type { LeaveDay } from '../types/model.ts'

function createInMemoryEntitlementFetch(leaveDays: LeaveDay[] = []) {
  const repository = new InMemoryLeaveEntitlementRepository(
    [
      {
        id: 'ent-peter-2026-base',
        employeeId: 'emp-peter',
        year: 2026,
        component: 'BASE',
        fullYearDays: 20,
        calculatedDays: 20,
        overrideDays: null,
        overrideReason: null,
        payrollReferenceDays: 20,
        usedQ1: 0,
        usedQ2: 0,
        usedQ3: 0,
        usedQ4: 0,
        usedYear: 0,
        updatedAt: '2026-01-02T08:00:00Z',
        updatedBy: 'emp-piri',
      },
    ],
    () => leaveDays,
  )
  const handler = createLeaveEntitlementApiHandler(repository)

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

describe('LeaveEntitlement API endpoints, HR_ADMIN authorization & usage cache recompute', () => {
  it('blocks non-HR_ADMIN roles with 403 Forbidden', async () => {
    const { fakeFetch } = createInMemoryEntitlementFetch()
    let role: Role = 'EMPLOYEE'
    const client = createLeaveEntitlementApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => role,
    })

    await expect(client.listEntitlements()).rejects.toMatchObject({
      status: 403,
    })

    role = 'MANAGER'
    await expect(
      client.getEntitlementById('ent-peter-2026-base'),
    ).rejects.toMatchObject({
      status: 403,
    })
  })

  it('performs full LeaveEntitlement CRUD and recomputes usage cache on change', async () => {
    const approvedDays: LeaveDay[] = [
      {
        requestId: 'req-1',
        employeeId: 'emp-peter',
        date: '2026-02-10',
        portion: 'FULL',
        leaveTypeCode: 'ANNUAL',
        balanceDeduction: 1,
        payrollValue: 1,
      },
    ]
    const { fakeFetch } = createInMemoryEntitlementFetch(approvedDays)
    const client = createLeaveEntitlementApiClient({
      fetchFn: fakeFetch,
      getActorRole: () => 'HR_ADMIN',
    })

    // Adding AGE_ADDITIONAL_CARRYOVER should consume the Q1 day first (CONSUMPTION_ORDER)
    const carryover = await client.createEntitlement({
      id: 'ent-peter-2026-carryover',
      employeeId: 'emp-peter',
      year: 2026,
      component: 'AGE_ADDITIONAL_CARRYOVER',
      fullYearDays: 2,
      calculatedDays: 2,
      overrideDays: null,
      overrideReason: null,
      payrollReferenceDays: 2,
      updatedBy: 'emp-piri',
    })

    expect(carryover.usedQ1).toBe(1)
    expect(carryover.usedYear).toBe(1)

    const updated = await client.updateEntitlement(
      'ent-peter-2026-carryover',
      {
        employeeId: 'emp-peter',
        year: 2026,
        component: 'AGE_ADDITIONAL_CARRYOVER',
        fullYearDays: 2,
        calculatedDays: 2,
        overrideDays: 3,
        overrideReason: 'HR felülvizsgálat alapján',
        payrollReferenceDays: 3,
        updatedBy: 'emp-piri',
      },
    )
    expect(updated.overrideDays).toBe(3)
    expect(updated.overrideReason).toBe('HR felülvizsgálat alapján')

    await client.deleteEntitlement('ent-peter-2026-carryover')
    await expect(
      client.getEntitlementById('ent-peter-2026-carryover'),
    ).rejects.toThrowError(TeamApiError)
  })
})
