import type { EntitlementComponent, EntitlementId, IsoDate, LeaveEntitlement, LeaveDay, LeaveRequest } from '../types/model.ts'
import { createCalendarService, type CalendarService } from './calendar.ts'
import { getLeaveType } from './leaveType.ts'

/**
 * Consumption order across components. Confirmed HR rule 2026-11-13 (BUSINESS_RULES §1).
 */
export const CONSUMPTION_ORDER: readonly EntitlementComponent[] = [
  'AGE_ADDITIONAL_CARRYOVER',
  'BASE',
  'AGE_ADDITIONAL',
  'CHILD_ADDITIONAL',
]

export interface EntitlementUsage {
  usedQ1: number
  usedQ2: number
  usedQ3: number
  usedQ4: number
  usedYear: number
}

const ZERO: EntitlementUsage = { usedQ1: 0, usedQ2: 0, usedQ3: 0, usedQ4: 0, usedYear: 0 }
const QUARTER_KEYS = ['usedQ1', 'usedQ2', 'usedQ3', 'usedQ4'] as const

/** Half-day safe rounding (values are multiples of 0.5). */
const r = (n: number) => Math.round(n * 2) / 2

const effective = (e: LeaveEntitlement) => e.overrideDays ?? e.calculatedDays ?? 0

/**
 * Full recompute of the usage cache for ONE employee and ONE year.
 * @param entitlements all entitlement rows of that employee+year
 * @param leaveDays LeaveDays of that employee from APPROVED requests (any year; other years are ignored)
 * Days are consumed chronologically, filling components in CONSUMPTION_ORDER up to their effective days.
 * Excess beyond the total entitlement is booked on BASE (balance goes negative; Q24).
 */
export function recomputeEntitlementUsage(
  entitlements: LeaveEntitlement[],
  leaveDays: LeaveDay[],
  year: number,
): Map<EntitlementId, EntitlementUsage> {
  const rows = entitlements
    .filter((e) => e.year === year)
    .sort((a, b) => CONSUMPTION_ORDER.indexOf(a.component) - CONSUMPTION_ORDER.indexOf(b.component))
  const result = new Map<EntitlementId, EntitlementUsage>(rows.map((e) => [e.id, { ...ZERO }]))
  if (rows.length === 0) return result
  const overflowRow = rows.find((e) => e.component === 'BASE') ?? rows[rows.length - 1]
  const remaining = new Map(rows.map((e) => [e.id, effective(e)]))

  const days = leaveDays
    .filter((d) => d.balanceDeduction > 0 && Number(d.date.slice(0, 4)) === year)
    .sort((a, b) => a.date.localeCompare(b.date) || a.requestId.localeCompare(b.requestId))

  for (const day of days) {
    const qKey = QUARTER_KEYS[Math.floor((Number(day.date.slice(5, 7)) - 1) / 3)]
    let left = day.balanceDeduction
    for (const row of rows) {
      if (left <= 0) break
      const take = Math.min(left, remaining.get(row.id)!)
      if (take <= 0) continue
      remaining.set(row.id, r(remaining.get(row.id)! - take))
      result.get(row.id)![qKey] = r(result.get(row.id)![qKey] + take)
      left = r(left - take)
    }
    if (left > 0) result.get(overflowRow.id)![qKey] = r(result.get(overflowRow.id)![qKey] + left)
  }

  for (const u of result.values()) u.usedYear = r(u.usedQ1 + u.usedQ2 + u.usedQ3 + u.usedQ4)
  return result
}

/** Consistency check: true when the stored cache equals a fresh recompute. Use in tests and the nightly/admin check. */
export function isUsageCacheConsistent(
  entitlements: LeaveEntitlement[],
  leaveDays: LeaveDay[],
  year: number,
): boolean {
  const fresh = recomputeEntitlementUsage(entitlements, leaveDays, year)
  return entitlements
    .filter((e) => e.year === year)
    .every((e) => {
      const f = fresh.get(e.id)!
      return e.usedQ1 === f.usedQ1 && e.usedQ2 === f.usedQ2 && e.usedQ3 === f.usedQ3 && e.usedQ4 === f.usedQ4 && e.usedYear === f.usedYear
    })
}

/**
 * LeaveDays of APPROVED requests on working days up to and including `today` (product-owner request
 * 2026-11-13: leave in the past counts as used; future approved leave is not yet used).
 * Non-working days (weekends, holidays) are skipped via the calendar service.
 */
export function pastApprovedLeaveDays(
  requests: readonly LeaveRequest[],
  today: IsoDate,
  calendar: CalendarService = createCalendarService(),
): LeaveDay[] {
  const days: LeaveDay[] = []
  for (const req of requests) {
    if (req.status !== 'APPROVED') continue
    const deducts = getLeaveType(req.leaveTypeCode).deductsFromAnnualBalance
    const end = req.endDate < today ? req.endDate : today
    for (let d = new Date(`${req.startDate}T00:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
      const date = d.toISOString().slice(0, 10)
      if (date > end) break
      if (!calendar.getDay(date).isWorkingDay) continue
      const amount = req.dayPortion === 'FULL' ? 1 : 0.5
      days.push({
        requestId: req.id,
        employeeId: req.employeeId,
        date,
        portion: req.dayPortion,
        leaveTypeCode: req.leaveTypeCode,
        balanceDeduction: deducts ? amount : 0,
        payrollValue: amount,
      })
    }
  }
  return days
}

/** Overlays used* fields recomputed from past approved leave (read-time; no stored state changes). */
export function withPastUsage<T extends LeaveEntitlement>(
  entitlements: readonly T[],
  requests: readonly LeaveRequest[],
  today: IsoDate,
): T[] {
  const days = pastApprovedLeaveDays(requests, today)
  const usage = new Map<EntitlementId, EntitlementUsage>()
  const keys = new Set(entitlements.map((e) => `${e.employeeId}|${e.year}`))
  for (const key of keys) {
    const [employeeId, year] = key.split('|')
    const rows = entitlements.filter((e) => e.employeeId === employeeId && e.year === Number(year))
    const empDays = days.filter((d) => d.employeeId === employeeId)
    for (const [id, u] of recomputeEntitlementUsage([...rows], empDays, Number(year))) usage.set(id, u)
  }
  return entitlements.map((e) => ({ ...e, ...(usage.get(e.id) ?? {}) }))
}
