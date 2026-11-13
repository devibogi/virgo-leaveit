import { describe, expect, it } from 'vitest'
import { buildMonthCalendar, createCalendarService } from './calendar.ts'
import type { LeaveRequest } from '../types/model.ts'

const base: LeaveRequest = {
  id: 'req-1', employeeId: 'emp-anna', legalEntityId: 'VIRGO_KFT', approverId: 'emp-katalin',
  leaveTypeCode: 'ANNUAL', startDate: '2026-08-19', endDate: '2026-08-24', dayPortion: 'FULL',
  status: 'APPROVED', employeeComment: null, submittedAt: '2026-08-01T08:00:00Z',
  approval: null, cancellation: null,
}

describe('calendar service', () => {
  const cal = createCalendarService()
  it('treats weekdays as working and weekends as not', () => {
    expect(cal.getDay('2026-08-18').isWorkingDay).toBe(true)
    expect(cal.getDay('2026-08-22').isWorkingDay).toBe(false)
  })
  it('applies public holidays, rest days and working Saturdays', () => {
    expect(cal.getDay('2026-08-20')).toMatchObject({ isWorkingDay: false, override: { kind: 'PUBLIC_HOLIDAY' } })
    expect(cal.getDay('2026-08-21')).toMatchObject({ isWorkingDay: false, override: { kind: 'REST_DAY' } })
    expect(cal.getDay('2026-08-08')).toMatchObject({ isWorkingDay: true, override: { kind: 'WORKING_DAY' } })
  })
})

describe('buildMonthCalendar', () => {
  it('builds Monday-first weeks covering the whole month', () => {
    const weeks = buildMonthCalendar(2026, 8, [])
    expect(weeks[0][0].date).toBe('2026-07-27')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
    const inMonth = weeks.flat().filter((c) => c.inMonth)
    expect(inMonth).toHaveLength(31)
  })
  it('puts leave only on working days and skips inactive statuses', () => {
    const cells = buildMonthCalendar(2026, 8, [
      base,
      { ...base, id: 'req-2', status: 'REJECTED' },
      { ...base, id: 'req-3', status: 'PENDING', leaveTypeCode: 'SICK_LEAVE', startDate: '2026-08-24', endDate: '2026-08-24' },
    ]).flat()
    const byDate = new Map(cells.map((c) => [c.date, c]))
    expect(byDate.get('2026-08-19')!.entries.map((e) => e.requestId)).toEqual(['req-1'])
    expect(byDate.get('2026-08-20')!.entries).toEqual([]) // holiday
    expect(byDate.get('2026-08-21')!.entries).toEqual([]) // rest day
    expect(byDate.get('2026-08-22')!.entries).toEqual([]) // Saturday
    expect(byDate.get('2026-08-24')!.entries.map((e) => e.requestId)).toEqual(['req-1', 'req-3'])
  })
})
