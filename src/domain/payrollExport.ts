import type { Employee, IsoDate, LeaveCategory, LeaveRequest, LegalEntityId } from '../types/model.ts'
import { createCalendarService, type CalendarService } from './calendar.ts'
import { getLeaveType } from './leaveType.ts'
import { getLegalEntity } from './legalEntity.ts'
import { buildXlsx, columnName } from './xlsx.ts'

/**
 * Monthly payroll (bérszámfejtés) export, layout per docs/samples/payroll_template_2026.csv
 * (BUSINESS_RULES §6a): ';' separated, CRLF, 25 columns, 3 header rows, then
 * name, tax id, 5 Tól/Ig pairs for Szabadság and 5 for Betegszabadság/táppénz.
 *
 * Assumptions (not HR-confirmed, OPEN_QUESTIONS):
 * - Q26 an unpaired last half-day of the month is exported on its own date.
 * - Q27 UNPAID and FUNERAL go under "Szabadság" (category LEAVE).
 * - Q28 more than 5 periods in a group → extra row with the same name / tax id.
 * - Q29 consecutive exported days of a group merge into one period across non-working days.
 * - Q33 every registered employee of the month is listed, even without leave.
 * - Q35 one file per legal entity; "Cégnév" cell = legal entity name.
 */

export const PAYROLL_COLUMNS = 25
export const PAYROLL_PERIODS_PER_GROUP = 5
/** The template has 16 rows (3 header + 13 data/blank rows); shorter exports are padded. */
export const PAYROLL_TEMPLATE_ROWS = 16
const GROUPS: readonly LeaveCategory[] = ['LEAVE', 'SICK']
const GROUP_HEADER: Record<LeaveCategory, string> = {
  LEAVE: 'Szabadság',
  SICK: 'Betegszabadság/táppénz',
}

export interface PayrollPeriod {
  from: number
  to: number
}

export interface PayrollExportRow {
  employeeId: string
  name: string
  taxId: string
  periods: Record<LeaveCategory, PayrollPeriod[]>
}

const pad2 = (n: number) => String(n).padStart(2, '0')
const isoOf = (y: number, m: number, d: number): IsoDate => `${y}-${pad2(m)}-${pad2(d)}`
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate()

/** Employees registered in the month: legal entity match, export flag on, employed at least one day. */
export function payrollEmployees(
  employees: readonly Employee[],
  legalEntityId: LegalEntityId,
  year: number,
  month: number,
): Employee[] {
  const first = isoOf(year, month, 1)
  const last = isoOf(year, month, daysInMonth(year, month))
  return employees
    .filter(
      (e) =>
        e.legalEntityId === legalEntityId &&
        e.includeInPayrollExport !== false &&
        e.employmentStart <= last &&
        (!e.employmentEnd || e.employmentEnd >= first),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'hu'))
}

/**
 * Exported day-of-month numbers per group for ONE employee in ONE month.
 * Only APPROVED requests, only working days. Half-days pair chronologically within the month;
 * the second of a pair is exported (D19); an odd last half-day is exported on its own date (Q26).
 */
export function exportedDaysForMonth(
  requests: readonly LeaveRequest[],
  employeeId: string,
  year: number,
  month: number,
  calendar: CalendarService = createCalendarService(),
): Record<LeaveCategory, number[]> {
  const result: Record<LeaveCategory, Set<number>> = { LEAVE: new Set(), SICK: new Set() }
  const halfDays: { day: number; category: LeaveCategory; order: string }[] = []
  for (const req of requests) {
    if (req.status !== 'APPROVED' || req.employeeId !== employeeId) continue
    const category = getLeaveType(req.leaveTypeCode).category
    for (let d = 1; d <= daysInMonth(year, month); d++) {
      const date = isoOf(year, month, d)
      if (date < req.startDate || date > req.endDate) continue
      if (!calendar.getDay(date).isWorkingDay) continue
      if (req.dayPortion === 'FULL') result[category].add(d)
      else halfDays.push({ day: d, category, order: `${date}|${req.dayPortion}|${req.id}` })
    }
  }
  halfDays.sort((a, b) => a.order.localeCompare(b.order))
  halfDays.forEach((h, i) => {
    const secondOfPair = i % 2 === 1
    const unpairedLast = i === halfDays.length - 1 && i % 2 === 0
    if (secondOfPair || unpairedLast) result[h.category].add(h.day)
  })
  return {
    LEAVE: [...result.LEAVE].sort((a, b) => a - b),
    SICK: [...result.SICK].sort((a, b) => a - b),
  }
}

/** Merges sorted day numbers into Tól/Ig periods, bridging only non-working days (Q29). */
export function buildPeriods(
  days: readonly number[],
  year: number,
  month: number,
  calendar: CalendarService = createCalendarService(),
): PayrollPeriod[] {
  const periods: PayrollPeriod[] = []
  for (const day of days) {
    const last = periods[periods.length - 1]
    let bridged = Boolean(last)
    if (last) {
      for (let d = last.to + 1; d < day; d++) {
        if (calendar.getDay(isoOf(year, month, d)).isWorkingDay) {
          bridged = false
          break
        }
      }
    }
    if (last && bridged) last.to = day
    else periods.push({ from: day, to: day })
  }
  return periods
}

export function buildPayrollRows(
  employees: readonly Employee[],
  requests: readonly LeaveRequest[],
  legalEntityId: LegalEntityId,
  year: number,
  month: number,
  calendar: CalendarService = createCalendarService(),
): PayrollExportRow[] {
  return payrollEmployees(employees, legalEntityId, year, month).map((e) => {
    const days = exportedDaysForMonth(requests, e.id, year, month, calendar)
    return {
      employeeId: e.id,
      name: e.displayName,
      taxId: e.taxId,
      periods: {
        LEAVE: buildPeriods(days.LEAVE, year, month, calendar),
        SICK: buildPeriods(days.SICK, year, month, calendar),
      },
    }
  })
}

const csvCell = (v: string) => (/[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** The template grid: 3 header rows + data rows, every row PAYROLL_COLUMNS wide (no padding rows). */
export function payrollGrid(legalEntityName: string, rows: readonly PayrollExportRow[]): string[][] {
  const span = PAYROLL_PERIODS_PER_GROUP * 2
  const header1 = [legalEntityName, '']
  const header2 = ['', '']
  const header3 = ['Dolgozó neve', 'Adóazonosító jel']
  for (const g of GROUPS) {
    for (let i = 0; i < span; i++) {
      header1.push(i === 0 ? GROUP_HEADER[g] : '')
      header2.push(i % 2 === 0 ? String(i / 2 + 1) : '')
      header3.push(i % 2 === 0 ? 'Tól' : 'Ig')
    }
  }
  const grid = [header1, header2, header3]

  for (const row of rows) {
    const chunks = Math.max(
      1,
      ...GROUPS.map((g) => Math.ceil(row.periods[g].length / PAYROLL_PERIODS_PER_GROUP)),
    )
    for (let c = 0; c < chunks; c++) {
      const cells = [row.name, row.taxId]
      for (const g of GROUPS) {
        const slice = row.periods[g].slice(c * PAYROLL_PERIODS_PER_GROUP, (c + 1) * PAYROLL_PERIODS_PER_GROUP)
        for (let i = 0; i < PAYROLL_PERIODS_PER_GROUP; i++) {
          const p = slice[i]
          cells.push(p ? String(p.from) : '', p ? String(p.to) : '')
        }
      }
      grid.push(cells)
    }
  }
  return grid.map((r) => {
    const full = [...r]
    while (full.length < PAYROLL_COLUMNS) full.push('')
    return full
  })
}

/** Renders rows in the exact template layout (UTF-8, no BOM, CRLF, no trailing newline). */
export function renderPayrollCsv(legalEntityName: string, rows: readonly PayrollExportRow[]): string {
  const lines = payrollGrid(legalEntityName, rows).map((r) => r.map(csvCell).join(';'))
  while (lines.length < PAYROLL_TEMPLATE_ROWS) lines.push(';'.repeat(PAYROLL_COLUMNS - 1))
  return lines.join('\r\n')
}

/**
 * Same grid as the CSV template, as a real .xlsx (BUSINESS_RULES §6a asks for Excel):
 * group headers merged over their 10 columns, period numbers over their Tól/Ig pair,
 * Tól/Ig day numbers stored as numbers, tax id kept as text.
 */
export function renderPayrollXlsx(legalEntityName: string, rows: readonly PayrollExportRow[]): Uint8Array {
  const grid = payrollGrid(legalEntityName, rows)
  const cells = grid.map((r, ri) =>
    r.map((v, ci) => (ri >= 3 && ci >= 2 && /^\d+$/.test(v) ? Number(v) : v)),
  )
  const span = PAYROLL_PERIODS_PER_GROUP * 2
  const merges: string[] = []
  GROUPS.forEach((_, g) => {
    const first = 2 + g * span
    merges.push(`${columnName(first)}1:${columnName(first + span - 1)}1`)
    for (let i = 0; i < PAYROLL_PERIODS_PER_GROUP; i++) {
      const c = first + i * 2
      merges.push(`${columnName(c)}2:${columnName(c + 1)}2`)
    }
  })
  return buildXlsx({
    name: legalEntityName,
    rows: cells,
    merges,
    colWidths: [24, 18, ...Array(span * GROUPS.length).fill(6)],
  })
}

export function buildPayrollCsv(
  employees: readonly Employee[],
  requests: readonly LeaveRequest[],
  legalEntityId: LegalEntityId,
  year: number,
  month: number,
  calendar: CalendarService = createCalendarService(),
): string {
  return renderPayrollCsv(
    getLegalEntity(legalEntityId).name,
    buildPayrollRows(employees, requests, legalEntityId, year, month, calendar),
  )
}

export function payrollExportFileName(
  legalEntityId: LegalEntityId,
  year: number,
  month: number,
  format: 'csv' | 'xlsx' = 'csv',
): string {
  return `payroll_${legalEntityId}_${year}-${pad2(month)}.${format}`
}

export function buildPayrollXlsx(
  employees: readonly Employee[],
  requests: readonly LeaveRequest[],
  legalEntityId: LegalEntityId,
  year: number,
  month: number,
  calendar: CalendarService = createCalendarService(),
): Uint8Array {
  return renderPayrollXlsx(
    getLegalEntity(legalEntityId).name,
    buildPayrollRows(employees, requests, legalEntityId, year, month, calendar),
  )
}
