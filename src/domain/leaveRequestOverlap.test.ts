import { describe, expect, it } from 'vitest'
import type { LeaveRequest } from '../types/model.ts'
import { findOverlappingRequest } from './leaveRequest.ts'

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
const cand = (o: Partial<LeaveRequest>) => ({ ...base, id: 'new', ...o })

describe('findOverlappingRequest (duplicate block, assumption)', () => {
  it('blocks the same dates and partial overlap with PENDING/APPROVED', () => {
    expect(findOverlappingRequest(cand({}), [base])?.id).toBe('r1')
    expect(findOverlappingRequest(cand({ startDate: '2026-12-09', endDate: '2026-12-11' }), [{ ...base, status: 'APPROVED' }])?.id).toBe('r1')
  })
  it('allows adjacent dates, other employees, rejected/cancelled requests', () => {
    expect(findOverlappingRequest(cand({ startDate: '2026-12-10', endDate: '2026-12-10' }), [base])).toBeNull()
    expect(findOverlappingRequest(cand({ employeeId: 'emp-b' }), [base])).toBeNull()
    expect(findOverlappingRequest(cand({}), [{ ...base, status: 'REJECTED' }])).toBeNull()
    expect(findOverlappingRequest(cand({}), [{ ...base, status: 'CANCELLED' }])).toBeNull()
  })
  it('allows AM + PM on the same day, blocks AM + AM and half + full', () => {
    const am = { ...base, startDate: '2026-12-07', endDate: '2026-12-07', dayPortion: 'AM' as const }
    expect(findOverlappingRequest(cand({ startDate: '2026-12-07', endDate: '2026-12-07', dayPortion: 'PM' }), [am])).toBeNull()
    expect(findOverlappingRequest(cand({ startDate: '2026-12-07', endDate: '2026-12-07', dayPortion: 'AM' }), [am])?.id).toBe('r1')
    expect(findOverlappingRequest(cand({}), [am])?.id).toBe('r1')
  })
  it('ignores the candidate itself (same id)', () => {
    expect(findOverlappingRequest({ ...base }, [base])).toBeNull()
  })
})
