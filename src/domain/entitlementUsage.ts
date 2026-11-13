import type { EntitlementComponent, EntitlementId, LeaveEntitlement, LeaveDay } from '../types/model'

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
