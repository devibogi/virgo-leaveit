import type { DeputyCheckResult, LeaveRequest } from '../types/model.ts'
import { createCalendarService, type CalendarService } from './calendar.ts'
import { getLeaveType } from './leaveType.ts'

type Candidate = Pick<LeaveRequest, 'leaveTypeCode' | 'startDate' | 'endDate' | 'dayPortion'>

/**
 * Deputy availability check (BUSINESS_RULES §7, LI-17). A requested working day is blocked when
 * ALL of the requester's deputies have an APPROVED leave that day. Only leave types with
 * deputyCheckApplies; no deputies = no check. Half-days block only when portions overlap
 * (FULL overlaps all, AM↔AM, PM↔PM) — Q14 assumption, not HR-confirmed.
 * Result carries dates only (privacy). Alternative-date suggestions not implemented yet.
 */
export function checkDeputyAvailability(
  candidate: Candidate,
  deputyIds: readonly string[],
  deputyRequests: readonly LeaveRequest[],
  calendar: CalendarService = createCalendarService(),
): DeputyCheckResult {
  const none: DeputyCheckResult = { blocked: false, conflictDates: [], suggestions: [] }
  if (deputyIds.length === 0 || !getLeaveType(candidate.leaveTypeCode).deputyCheckApplies) return none

  const portionsOverlap = (a: string, b: string) => a === 'FULL' || b === 'FULL' || a === b
  const deputyAway = (deputyId: string, date: string) =>
    deputyRequests.some(
      (r) =>
        r.employeeId === deputyId &&
        r.status === 'APPROVED' &&
        r.startDate <= date &&
        date <= r.endDate &&
        portionsOverlap(r.dayPortion, candidate.dayPortion),
    )

  const conflictDates: string[] = []
  for (let d = new Date(`${candidate.startDate}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const date = d.toISOString().slice(0, 10)
    if (date > candidate.endDate) break
    if (!calendar.getDay(date).isWorkingDay) continue
    if (deputyIds.every((id) => deputyAway(id, date))) conflictDates.push(date)
  }
  return { blocked: conflictDates.length > 0, conflictDates, suggestions: [] }
}

export const DEPUTY_CONFLICT_PREFIX = 'A helyetteseid egyike sem elérhető'

export function deputyConflictMessage(conflictDates: readonly string[]): string {
  return `${DEPUTY_CONFLICT_PREFIX} ezeken a napokon: ${conflictDates.join(', ')}. Válassz másik időpontot.`
}
