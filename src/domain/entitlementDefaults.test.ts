import { describe, expect, it } from 'vitest'
import type { Employee } from '../types/model.ts'
import { ageAdditionalDays, defaultEntitlements, employedFraction, prorateDays } from './entitlementDefaults.ts'

const base: Employee = {
  id: 'emp-x',
  displayName: 'Teszt Elek',
  email: 'x@example.test',
  legalEntityId: 'VIRGO_KFT',
  managerId: null,
  roles: ['EMPLOYEE'],
  birthDate: '1984-03-12',
  employmentStart: '2019-02-01',
  employmentEnd: null,
  includeInPayrollExport: true,
  taxId: '8000000000',
  deputyIds: [],
}

describe('ageAdditionalDays', () => {
  it('follows the statutory thresholds by age reached in the year', () => {
    expect(ageAdditionalDays('2002-12-31', 2026)).toBe(0) // 24
    expect(ageAdditionalDays('2001-12-31', 2026)).toBe(1) // 25, birthday on 31 Dec still counts
    expect(ageAdditionalDays('1993-11-04', 2026)).toBe(4) // 33
    expect(ageAdditionalDays('1984-03-12', 2026)).toBe(8) // 42
    expect(ageAdditionalDays('1960-01-01', 2026)).toBe(10) // 66
  })
})

describe('employedFraction / prorateDays', () => {
  it('full year when employed all year', () => {
    expect(employedFraction(base, 2026)).toBe(1)
  })
  it('zero outside employment', () => {
    expect(employedFraction({ employmentStart: '2027-01-01', employmentEnd: null }, 2026)).toBe(0)
    expect(employedFraction({ employmentStart: '2019-01-01', employmentEnd: '2025-12-31' }, 2026)).toBe(0)
  })
  it('half year joiner rounds 0.5 up', () => {
    expect(prorateDays(20, 0.5)).toBe(10)
    expect(prorateDays(5, 0.5)).toBe(3)
    expect(prorateDays(5, 0.49)).toBe(2)
  })
  it('mid-year joiner', () => {
    const f = employedFraction({ employmentStart: '2026-07-01', employmentEnd: null }, 2026)
    expect(f).toBeCloseTo(184 / 365)
    expect(prorateDays(20, f)).toBe(10)
  })
})

describe('defaultEntitlements', () => {
  it('generates BASE and AGE_ADDITIONAL, never CHILD_ADDITIONAL', () => {
    const rows = defaultEntitlements(base, 2026, 'system')
    expect(rows.map((r) => [r.component, r.calculatedDays])).toEqual([
      ['BASE', 20],
      ['AGE_ADDITIONAL', 8],
    ])
  })
  it('skips AGE_ADDITIONAL when zero and nothing when not employed', () => {
    expect(defaultEntitlements({ ...base, birthDate: '2005-01-01' }, 2026, 'system').map((r) => r.component)).toEqual(['BASE'])
    expect(defaultEntitlements({ ...base, employmentStart: '2027-01-01' }, 2026, 'system')).toEqual([])
  })
})
