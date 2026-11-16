import { describe, expect, it } from 'vitest'
import type { LeaveRequest } from '../types/model.ts'
import { checkDeputyAvailability } from './deputyCheck.ts'

const leave = (employeeId: string, startDate: string, endDate: string, o: Partial<LeaveRequest> = {}): LeaveRequest => ({
  id: `${employeeId}-${startDate}`,
  employeeId,
  legalEntityId: 'VIRGO_KFT',
  approverId: 'emp-m',
  leaveTypeCode: 'ANNUAL',
  startDate,
  endDate,
  dayPortion: 'FULL',
  status: 'APPROVED',
  employeeComment: null,
  submittedAt: '2026-11-01T08:00:00Z',
  approval: null,
  cancellation: null,
  ...o,
})
const req = (startDate: string, endDate: string, o: Partial<LeaveRequest> = {}) =>
  ({ leaveTypeCode: 'ANNUAL', startDate, endDate, dayPortion: 'FULL', ...o }) as const

describe('checkDeputyAvailability (BUSINESS_RULES §7)', () => {
  it('blocks working days where the only deputy has approved leave', () => {
    const r = checkDeputyAvailability(req('2026-12-18', '2026-12-23'), ['d1'], [leave('d1', '2026-12-21', '2026-12-23')])
    expect(r).toEqual({ blocked: true, conflictDates: ['2026-12-21', '2026-12-22', '2026-12-23'], suggestions: [] })
  })
  it('does not block when at least one deputy is available', () => {
    const r = checkDeputyAvailability(req('2026-12-21', '2026-12-21'), ['d1', 'd2'], [leave('d1', '2026-12-21', '2026-12-21')])
    expect(r.blocked).toBe(false)
  })
  it('blocks when all of several deputies are away', () => {
    const r = checkDeputyAvailability(req('2026-12-21', '2026-12-22'), ['d1', 'd2'], [
      leave('d1', '2026-12-21', '2026-12-22'),
      leave('d2', '2026-12-22', '2026-12-22', { leaveTypeCode: 'SICK_LEAVE' }),
    ])
    expect(r.conflictDates).toEqual(['2026-12-22'])
  })
  it('ignores pending/cancelled deputy leave, weekends and no-deputy employees', () => {
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21'), ['d1'], [leave('d1', '2026-12-21', '2026-12-21', { status: 'PENDING' })]).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21'), ['d1'], [leave('d1', '2026-12-21', '2026-12-21', { status: 'CANCELLED' })]).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-19', '2026-12-20'), ['d1'], [leave('d1', '2026-12-19', '2026-12-20')]).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21'), [], [leave('d1', '2026-12-21', '2026-12-21')]).blocked).toBe(false)
  })
  it('never blocks sick leave or funeral leave', () => {
    const away = [leave('d1', '2026-12-21', '2026-12-21')]
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21', { leaveTypeCode: 'SICK_LEAVE' }), ['d1'], away).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21', { leaveTypeCode: 'FUNERAL' }), ['d1'], away).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21', { leaveTypeCode: 'UNPAID' }), ['d1'], away).blocked).toBe(true)
  })
  it('half-days block only when portions overlap (Q14 assumption)', () => {
    const am = [leave('d1', '2026-12-21', '2026-12-21', { dayPortion: 'AM' })]
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21', { dayPortion: 'PM' }), ['d1'], am).blocked).toBe(false)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21', { dayPortion: 'AM' }), ['d1'], am).blocked).toBe(true)
    expect(checkDeputyAvailability(req('2026-12-21', '2026-12-21'), ['d1'], am).blocked).toBe(true)
  })
})
