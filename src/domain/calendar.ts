import type {
  CalendarDataset,
  CalendarDay,
  DayPortion,
  EmployeeId,
  IsoDate,
  LeaveRequest,
  LeaveTypeCode,
  RequestId,
  RequestStatus,
} from '../types/model.ts'
import { HU_CALENDAR_2026_2027 } from '../data/huCalendar.ts'

export type { CalendarDay }

/** Working-day calendar service. Default Mon–Fri working, Sat–Sun not; dataset overrides win. */
export function createCalendarService(dataset: CalendarDataset = HU_CALENDAR_2026_2027) {
  const overrides = new Map(dataset.overrides.map((o) => [o.date, o]))
  return {
    getDay(date: IsoDate): CalendarDay {
      const override = overrides.get(date) ?? null
      if (override) {
        return { date, isWorkingDay: override.kind === 'WORKING_DAY', override }
      }
      const dow = new Date(`${date}T00:00:00Z`).getUTCDay()
      return { date, isWorkingDay: dow !== 0 && dow !== 6, override: null }
    },
  }
}

export type CalendarService = ReturnType<typeof createCalendarService>

/**
 * Requested amount in working days (display only): working days in the inclusive range,
 * AM/PM counts 0.5. Non-working days per the calendar service are skipped.
 */
export function requestedWorkingDays(
  startDate: IsoDate,
  endDate: IsoDate,
  dayPortion: DayPortion,
  calendar: CalendarService = createCalendarService(),
): number {
  let days = 0
  for (let d = new Date(`${startDate}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10)
    if (date > endDate) break
    if (calendar.getDay(date).isWorkingDay) days += 1
  }
  return dayPortion === 'FULL' ? days : days * 0.5
}

/** Prototype SLA: manager decision due within this many working days after submission (BUSINESS_RULES, Q5 open). */
export const APPROVAL_SLA_WORKING_DAYS = 3

const nextIso = (date: IsoDate): IsoDate => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** SLA due date = submission date + N working days (submission day itself not counted). */
export function approvalDueDate(
  submittedDate: IsoDate,
  calendar: CalendarService = createCalendarService(),
  slaDays: number = APPROVAL_SLA_WORKING_DAYS,
): IsoDate {
  let date = submittedDate
  for (let left = slaDays; left > 0; ) {
    date = nextIso(date)
    if (calendar.getDay(date).isWorkingDay) left -= 1
  }
  return date
}

/**
 * Working days left until the SLA due date, counted after `today` up to and including the due date.
 * 0 = due today; negative = overdue by that many working days. Display only; never auto-decides.
 */
export function approvalWorkingDaysLeft(
  submittedDate: IsoDate,
  today: IsoDate,
  calendar: CalendarService = createCalendarService(),
): { dueDate: IsoDate; daysLeft: number } {
  const dueDate = approvalDueDate(submittedDate, calendar)
  const [from, to, sign] = today <= dueDate ? [today, dueDate, 1] : [dueDate, today, -1]
  let count = 0
  for (let d = from; d < to; ) {
    d = nextIso(d)
    if (calendar.getDay(d).isWorkingDay) count += 1
  }
  return { dueDate, daysLeft: sign * count }
}

/** Local calendar date as ISO (YYYY-MM-DD). */
export function localIsoDate(d: Date = new Date()): IsoDate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

/** Statuses shown on the calendar; rejected/cancelled/revoked stay in history only. */
export const CALENDAR_VISIBLE_STATUSES: readonly RequestStatus[] = ['APPROVED', 'PENDING']

export interface CalendarLeaveEntry {
  requestId: RequestId
  employeeId: EmployeeId
  leaveTypeCode: LeaveTypeCode
  portion: DayPortion
  status: RequestStatus
}

export interface CalendarCell extends CalendarDay {
  /** 1–7, Monday = 1. */
  weekday: number
  inMonth: boolean
  entries: CalendarLeaveEntry[]
}

/**
 * Month grid (Monday-first weeks) with leave entries on working days only.
 * month is 1–12.
 */
export function buildMonthCalendar(
  year: number,
  month: number,
  requests: readonly LeaveRequest[],
  calendar: CalendarService = createCalendarService(),
): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const start = new Date(first)
  start.setUTCDate(1 - offset)

  const visible = requests.filter((r) => CALENDAR_VISIBLE_STATUSES.includes(r.status))
  const weeks: CalendarCell[][] = []
  const cursor = new Date(start)
  do {
    const week: CalendarCell[] = []
    for (let i = 0; i < 7; i++) {
      const date = toIso(cursor)
      const day = calendar.getDay(date)
      week.push({
        ...day,
        weekday: i + 1,
        inMonth: cursor.getUTCMonth() === month - 1,
        entries: day.isWorkingDay
          ? visible
              .filter((r) => r.startDate <= date && date <= r.endDate)
              .map((r) => ({
                requestId: r.id,
                employeeId: r.employeeId,
                leaveTypeCode: r.leaveTypeCode,
                portion: r.dayPortion,
                status: r.status,
              }))
          : [],
      })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
    weeks.push(week)
  } while (cursor.getUTCMonth() === month - 1)
  return weeks
}
