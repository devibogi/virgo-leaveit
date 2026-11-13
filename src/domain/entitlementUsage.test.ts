import { describe, expect, it } from 'vitest'
import type { EntitlementComponent, LeaveDay, LeaveEntitlement } from '../types/model'
import { isUsageCacheConsistent, recomputeEntitlementUsage } from './entitlementUsage'

const ent = (component: EntitlementComponent, days: number | null, override: number | null = null, year = 2026): LeaveEntitlement => ({
  id: `ent-${component}-${year}`, employeeId: 'emp-a', year, component,
  fullYearDays: days, calculatedDays: days, overrideDays: override, overrideReason: null, payrollReferenceDays: null,
  usedQ1: 0, usedQ2: 0, usedQ3: 0, usedQ4: 0, usedYear: 0, updatedAt: '2026-01-01T00:00:00Z', updatedBy: 'emp-hr',
})
const day = (date: string, balanceDeduction = 1, requestId = 'req-1'): LeaveDay => ({
  requestId, employeeId: 'emp-a', date, portion: balanceDeduction === 0.5 ? 'AM' : 'FULL',
  leaveTypeCode: 'ANNUAL', balanceDeduction, payrollValue: 1,
})

describe('recomputeEntitlementUsage', () => {
  it('consumes carryover first, then base, split by quarter', () => {
    const rows = [ent('BASE', 20), ent('AGE_ADDITIONAL_CARRYOVER', 2)]
    const u = recomputeEntitlementUsage(rows, [day('2026-02-02'), day('2026-03-31'), day('2026-04-01'), day('2026-12-31')], 2026)
    expect(u.get('ent-AGE_ADDITIONAL_CARRYOVER-2026')).toEqual({ usedQ1: 2, usedQ2: 0, usedQ3: 0, usedQ4: 0, usedYear: 2 })
    expect(u.get('ent-BASE-2026')).toEqual({ usedQ1: 0, usedQ2: 1, usedQ3: 0, usedQ4: 1, usedYear: 2 })
  })

  it('splits a half-day across components and handles 0.5 values', () => {
    const rows = [ent('AGE_ADDITIONAL_CARRYOVER', 0, 1.5), ent('BASE', 20)]
    const u = recomputeEntitlementUsage(rows, [day('2026-01-05'), day('2026-01-06', 0.5), day('2026-01-07', 0.5)], 2026)
    expect(u.get('ent-AGE_ADDITIONAL_CARRYOVER-2026')!.usedYear).toBe(1.5)
    expect(u.get('ent-BASE-2026')!.usedQ1).toBe(0.5)
  })

  it('uses overrideDays over calculatedDays', () => {
    const rows = [ent('BASE', 20, 1), ent('AGE_ADDITIONAL', 5)]
    const u = recomputeEntitlementUsage(rows, [day('2026-05-04'), day('2026-05-05')], 2026)
    expect(u.get('ent-BASE-2026')!.usedQ2).toBe(1)
    expect(u.get('ent-AGE_ADDITIONAL-2026')!.usedQ2).toBe(1)
  })

  it('ignores non-deducting days and days of other years', () => {
    const rows = [ent('BASE', 20)]
    const u = recomputeEntitlementUsage(rows, [day('2026-06-01', 0), day('2025-12-31'), day('2027-01-04')], 2026)
    expect(u.get('ent-BASE-2026')!.usedYear).toBe(0)
  })

  it('books excess beyond total entitlement on BASE', () => {
    const rows = [ent('AGE_ADDITIONAL_CARRYOVER', 1), ent('BASE', 1)]
    const u = recomputeEntitlementUsage(rows, [day('2026-07-01'), day('2026-07-02'), day('2026-07-03')], 2026)
    expect(u.get('ent-BASE-2026')!.usedQ3).toBe(2)
    expect(u.get('ent-AGE_ADDITIONAL_CARRYOVER-2026')!.usedQ3).toBe(1)
  })

  it('usedYear always equals Q1+Q2+Q3+Q4', () => {
    const rows = [ent('BASE', 30)]
    const u = recomputeEntitlementUsage(rows, ['2026-01-02', '2026-04-02', '2026-08-03', '2026-11-02'].map((d) => day(d)), 2026)
    const b = u.get('ent-BASE-2026')!
    expect(b.usedYear).toBe(b.usedQ1 + b.usedQ2 + b.usedQ3 + b.usedQ4)
  })

  it('cancellation: recompute after removing days frees the earliest-consumed component correctly', () => {
    const rows = [ent('AGE_ADDITIONAL_CARRYOVER', 1), ent('BASE', 20)]
    const before = [day('2026-03-02', 1, 'req-1'), day('2026-05-04', 1, 'req-2')]
    const after = before.filter((d) => d.requestId !== 'req-1')
    const u = recomputeEntitlementUsage(rows, after, 2026)
    expect(u.get('ent-AGE_ADDITIONAL_CARRYOVER-2026')!.usedQ2).toBe(1)
    expect(u.get('ent-BASE-2026')!.usedYear).toBe(0)
  })
})

describe('isUsageCacheConsistent', () => {
  it('detects a stale cache', () => {
    const rows = [ent('BASE', 20)]
    expect(isUsageCacheConsistent(rows, [], 2026)).toBe(true)
    expect(isUsageCacheConsistent(rows, [day('2026-02-02')], 2026)).toBe(false)
  })
})
