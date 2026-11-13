import { describe, expect, it } from 'vitest'
import type { LeaveRequest } from '../types/model.ts'
import { decideLeaveRequest, LeaveDecisionError } from './leaveRequest.ts'

const base: LeaveRequest = {
  id: 'r1',
  employeeId: 'emp-a',
  legalEntityId: 'VIRGO_KFT',
  approverId: 'emp-m',
  leaveTypeCode: 'ANNUAL',
  startDate: '2026-12-07',
  endDate: '2026-12-09',
  dayPortion: 'FULL',
  status: 'PENDING',
  employeeComment: null,
  submittedAt: '2026-11-13T10:00:00Z',
  approval: null,
  cancellation: null,
}
const AT = '2026-11-14T09:00:00Z'

function expectError(fn: () => unknown, status: number) {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(LeaveDecisionError)
    expect((e as LeaveDecisionError).status).toBe(status)
    return
  }
  throw new Error('expected LeaveDecisionError')
}

describe('decideLeaveRequest', () => {
  it('approves: status + approval record', () => {
    const r = decideLeaveRequest(base, 'emp-m', 'APPROVED', null, AT)
    expect(r.status).toBe('APPROVED')
    expect(r.approval).toEqual({ decision: 'APPROVED', decidedBy: 'emp-m', onBehalfOf: null, decidedAt: AT, comment: null })
    expect(base.status).toBe('PENDING') // input untouched
  })

  it('rejects with trimmed comment; blank comment becomes null', () => {
    expect(decideLeaveRequest(base, 'emp-m', 'REJECTED', '  túl sok távollét ', AT).approval?.comment).toBe('túl sok távollét')
    expect(decideLeaveRequest(base, 'emp-m', 'REJECTED', '   ', AT).approval?.comment).toBeNull()
    expect(decideLeaveRequest(base, 'emp-m', 'REJECTED', null, AT).status).toBe('REJECTED')
  })

  it.each(['APPROVED', 'REJECTED', 'CANCELLED', 'REVOKED'] as const)('409 when status is %s', (status) => {
    expectError(() => decideLeaveRequest({ ...base, status }, 'emp-m', 'APPROVED'), 409)
  })

  it('403 when actor is not the approver', () => {
    expectError(() => decideLeaveRequest(base, 'emp-other', 'APPROVED'), 403)
  })

  it('403 when actor is the requester (even if approver)', () => {
    expectError(() => decideLeaveRequest({ ...base, approverId: 'emp-a' }, 'emp-a', 'APPROVED'), 403)
  })
})
