import { describe, expect, it } from 'vitest'
import {
  canManageEntitlements,
  createLeaveEntitlement,
  EntitlementComponentEnum,
  getEffectiveEntitlementDays,
  mapLeaveEntitlementToRow,
  mapRowToLeaveEntitlement,
  summarizeEntitlementBalance,
  validateLeaveEntitlement,
} from './leaveEntitlement.ts'

describe('LeaveEntitlement entity & validation (shared DATA_MODEL contract)', () => {
  it('creates a valid LeaveEntitlement and computes effective days', () => {
    const ent = createLeaveEntitlement({
      id: ' ent-peter-2026-base ',
      employeeId: ' emp-peter ',
      year: 2026,
      component: EntitlementComponentEnum.BASE,
      fullYearDays: 20,
      calculatedDays: 20,
      overrideDays: 22,
      overrideReason: ' Évközi korrekció ',
      payrollReferenceDays: 22,
      updatedAt: '2026-01-10T09:00:00Z',
      updatedBy: ' emp-piri ',
    })

    expect(ent.id).toBe('ent-peter-2026-base')
    expect(ent.employeeId).toBe('emp-peter')
    expect(ent.overrideReason).toBe('Évközi korrekció')
    expect(getEffectiveEntitlementDays(ent)).toBe(22)
    expect(ent.usedYear).toBe(0)
  })

  it('requires overrideReason when overrideDays is set and checks usedYear sum', () => {
    const res = validateLeaveEntitlement({
      id: 'ent-1',
      employeeId: 'emp-peter',
      year: 2026,
      component: 'CHILD_ADDITIONAL',
      fullYearDays: null,
      calculatedDays: null,
      overrideDays: 4,
      overrideReason: '   ',
      usedQ1: 1,
      usedQ2: 1,
      usedQ3: 0,
      usedQ4: 0,
      usedYear: 5,
      updatedBy: 'emp-piri',
    })

    expect(res.valid).toBe(false)
    expect(res.errors).toContain(
      'Kézi HR korrekció (overrideDays) esetén az indoklás (overrideReason) megadása kötelező.',
    )
    expect(res.errors).toContain(
      'Az éves felhasznált napok száma (usedYear) meg kell egyezzen a negyedévek (Q1–Q4) összegével.',
    )
  })

  it('maps between MariaDB row (DECIMAL strings/numbers) and LeaveEntitlement entity', () => {
    const ent = createLeaveEntitlement({
      id: 'ent-peter-2026-child',
      employeeId: 'emp-peter',
      year: 2026,
      component: 'CHILD_ADDITIONAL',
      fullYearDays: null,
      calculatedDays: null,
      overrideDays: 4,
      overrideReason: 'Éves nyilatkozat (2 gyermek)',
      payrollReferenceDays: 4,
      usedQ1: 1.5,
      usedQ2: 0.5,
      usedQ3: 0,
      usedQ4: 0,
      updatedAt: '2026-02-01T10:00:00Z',
      updatedBy: 'emp-piri',
    })

    const row = mapLeaveEntitlementToRow(ent)
    expect(row.used_year).toBe(2)

    const mapped = mapRowToLeaveEntitlement({
      ...row,
      override_days: '4.0',
      used_q1: '1.5',
      used_q2: '0.5',
      used_year: '2.0',
    })
    expect(mapped).toEqual(ent)
  })

  it('allows only HR_ADMIN role to manage entitlements', () => {
    expect(canManageEntitlements('HR_ADMIN')).toBe(true)
    expect(canManageEntitlements(['EMPLOYEE', 'HR_ADMIN'])).toBe(true)
    expect(canManageEntitlements('MANAGER')).toBe(false)
    expect(canManageEntitlements('EMPLOYEE')).toBe(false)
  })

  it('summarizes an employee balance across components as plain numbers', () => {
    const base = {
      employeeId: 'emp-peter',
      year: 2026,
      fullYearDays: 0,
      overrideReason: null,
      payrollReferenceDays: 0,
      usedQ1: 0,
      usedQ2: 0,
      usedQ3: 0,
      usedQ4: 0,
      updatedAt: '2026-01-02T08:00:00Z',
      updatedBy: 'emp-piri',
    }
    const rows = [
      { ...base, id: 'a', component: 'BASE' as const, calculatedDays: 20, overrideDays: null, usedYear: 5 },
      { ...base, id: 'b', component: 'AGE_ADDITIONAL' as const, calculatedDays: 5, overrideDays: 6, overrideReason: 'x', usedYear: 1.5 },
      { ...base, id: 'c', component: 'BASE' as const, year: 2025, calculatedDays: 20, overrideDays: null, usedYear: 0 },
      { ...base, id: 'd', component: 'BASE' as const, employeeId: 'emp-anna', calculatedDays: 20, overrideDays: null, usedYear: 0 },
    ]
    expect(summarizeEntitlementBalance(rows, 'emp-peter', 2026)).toEqual({
      employeeId: 'emp-peter',
      year: 2026,
      totalDays: 26,
      usedDays: 6.5,
      remainingDays: 19.5,
    })
    expect(summarizeEntitlementBalance([], 'emp-x', 2026).totalDays).toBe(0)
  })
})
