import type { Employee } from '../types/model.ts'
import type { CreateLeaveEntitlementInput } from './leaveEntitlement.ts'

/** Statutory base annual leave (Mt. §116). */
export const BASE_ANNUAL_DAYS = 20

/**
 * Statutory age-based additional days (Mt. §117): [age reached in the year, days].
 * HR confirmation pending — not listed in BUSINESS_RULES.
 */
const AGE_TABLE: readonly [number, number][] = [
  [45, 10], [43, 9], [41, 8], [39, 7], [37, 6], [35, 5], [33, 4], [31, 3], [28, 2], [25, 1],
]

/** Young worker (fiatal munkavállaló, Mt. §118(4)): 5 days, last in the year they turn 18. */
export const YOUNG_WORKER_DAYS = 5

/**
 * Age additional days for a year: applies in the calendar year the threshold age is reached
 * (Mt. §117(2)), so only the birth year matters, not the birthday.
 * Current law caps at 10 days from 45 (the T/4740 extension to 63 was never enacted).
 */
export function ageAdditionalDays(birthDate: string, year: number): number {
  const ageInYear = year - Number(birthDate.slice(0, 4))
  if (ageInYear <= 18) return YOUNG_WORKER_DAYS
  return AGE_TABLE.find(([age]) => ageInYear >= age)?.[1] ?? 0
}

/**
 * Child additional days (Mt. §118(1)-(2)) for HR to enter manually from the annual declaration:
 * children under 16: 1 → 2, 2 → 4, 3+ → 7 days; +2 per disabled child. Each parent separately.
 * Never applied automatically.
 */
export function childAdditionalDays(childrenUnder16: number, disabledChildren = 0): number {
  const n = Math.max(0, Math.floor(childrenUnder16))
  const base = n === 0 ? 0 : n === 1 ? 2 : n === 2 ? 4 : 7
  return base + 2 * Math.max(0, Math.floor(disabledChildren))
}

function dayIndex(iso: string): number {
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000
}

/** Share of the calendar year employed (calendar days, inclusive), 0..1. */
export function employedFraction(employee: Pick<Employee, 'employmentStart' | 'employmentEnd'>, year: number): number {
  const yStart = dayIndex(`${year}-01-01`)
  const yEnd = dayIndex(`${year}-12-31`)
  const from = Math.max(yStart, dayIndex(employee.employmentStart))
  const to = Math.min(yEnd, employee.employmentEnd ? dayIndex(employee.employmentEnd) : yEnd)
  if (to < from) return 0
  return (to - from + 1) / (yEnd - yStart + 1)
}

/** Prorate and round: fraction >= 0.5 rounds up. */
export function prorateDays(fullYearDays: number, fraction: number): number {
  return Math.floor(fullYearDays * fraction + 0.5)
}

/**
 * Default BASE + AGE_ADDITIONAL rows for an employee/year.
 * CHILD_ADDITIONAL is HR-manual and never generated here.
 */
export function defaultEntitlements(
  employee: Employee,
  year: number,
  updatedBy: string,
): CreateLeaveEntitlementInput[] {
  const fraction = employedFraction(employee, year)
  if (fraction <= 0) return []
  const components: [CreateLeaveEntitlementInput['component'], number][] = [
    ['BASE', BASE_ANNUAL_DAYS],
    ['AGE_ADDITIONAL', ageAdditionalDays(employee.birthDate, year)],
  ]
  return components
    .filter(([, full]) => full > 0)
    .map(([component, full]) => ({
      id: `ent-${employee.id.replace(/^emp-/, '')}-${year}-${component === 'BASE' ? 'base' : 'age'}`,
      employeeId: employee.id,
      year,
      component,
      fullYearDays: full,
      calculatedDays: prorateDays(full, fraction),
      updatedBy,
    }))
}
