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
