import { describe, expect, it } from 'vitest'
import { approvalDueDate, approvalWorkingDaysLeft, createCalendarService } from './calendar.ts'

// Plain Mon–Fri calendar so the test does not depend on the HU holiday dataset.
const cal = createCalendarService({ overrides: [] } as never)

describe('approval SLA (3 working days, prototype policy)', () => {
  it('due date skips weekends', () => {
    expect(approvalDueDate('2026-11-11', cal)).toBe('2026-11-16') // Wed → Mon
    expect(approvalDueDate('2026-11-13', cal)).toBe('2026-11-18') // Fri → Wed
  })
  it('due date skips calendar rest days', () => {
    const holiday = createCalendarService({
      overrides: [{ date: '2026-11-16', kind: 'REST_DAY' }],
    } as never)
    expect(approvalDueDate('2026-11-11', holiday)).toBe('2026-11-17')
  })
  it('working days left: positive, due today, overdue', () => {
    expect(approvalWorkingDaysLeft('2026-11-11', '2026-11-11', cal).daysLeft).toBe(3)
    expect(approvalWorkingDaysLeft('2026-11-11', '2026-11-14', cal).daysLeft).toBe(1) // Sat
    expect(approvalWorkingDaysLeft('2026-11-11', '2026-11-16', cal).daysLeft).toBe(0)
    expect(approvalWorkingDaysLeft('2026-11-11', '2026-11-18', cal).daysLeft).toBe(-2)
  })
})
