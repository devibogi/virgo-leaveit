import { describe, expect, it } from 'vitest'
import type { Employee, LeaveRequest } from '../types/model.ts'
import { SYNTHETIC_SEED_EMPLOYEES } from '../server/employeeRepository.ts'
import template from '../../docs/samples/payroll_template_2026.csv?raw'
import {
  buildPayrollCsv,
  buildPayrollRows,
  buildPeriods,
  exportedDaysForMonth,
  payrollEmployees,
  renderPayrollCsv,
} from './payrollExport.ts'

const templateLines = template.split('\r\n')

const emp = (over: Partial<Employee>): Employee => ({
  ...SYNTHETIC_SEED_EMPLOYEES[0],
  ...over,
})

let seq = 0
const req = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: `r${++seq}`,
  employeeId: 'e1',
  legalEntityId: 'VIRGO_KFT',
  approverId: 'm1',
  leaveTypeCode: 'ANNUAL',
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  dayPortion: 'FULL',
  status: 'APPROVED',
  employeeComment: null,
  submittedAt: '2026-10-01T08:00:00Z',
  approval: null,
  cancellation: null,
  ...over,
})

describe('payroll export layout', () => {
  it('reproduces the template header rows, column count and CRLF', () => {
    const csv = renderPayrollCsv('Cégnév', [])
    const lines = csv.split('\r\n')
    expect(lines.slice(0, 3)).toEqual(templateLines.slice(0, 3))
    expect(lines).toHaveLength(16)
    expect(lines.every((l) => l.split(';').length === 25)).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(false)
    expect(csv.charCodeAt(0)).not.toBe(0xfeff)
  })

  it('renders a data row exactly like the template sample', () => {
    const csv = renderPayrollCsv('Cégnév', [
      {
        employeeId: 'x',
        name: 'Gipsz Jakab',
        taxId: '8888888888',
        periods: { LEAVE: [{ from: 2, to: 6 }, { from: 23, to: 25 }], SICK: [{ from: 11, to: 12 }] },
      },
    ])
    expect(csv.split('\r\n')[3]).toBe(templateLines[3])
  })

  it('puts more than 5 periods into an extra row with the same name and tax id (Q28)', () => {
    const periods = Array.from({ length: 7 }, (_, i) => ({ from: i * 3 + 1, to: i * 3 + 1 }))
    const lines = renderPayrollCsv('X', [
      { employeeId: 'x', name: 'A', taxId: '1', periods: { LEAVE: periods, SICK: [] } },
    ]).split('\r\n')
    expect(lines[3].split(';').slice(0, 12)).toEqual(['A', '1', '1', '1', '4', '4', '7', '7', '10', '10', '13', '13'])
    expect(lines[4].split(';').slice(0, 6)).toEqual(['A', '1', '16', '16', '19', '19'])
  })
})

describe('payroll export days', () => {
  it('counts only APPROVED requests on working days, groups by category', () => {
    const days = exportedDaysForMonth(
      [
        req({ startDate: '2026-11-02', endDate: '2026-11-08' }), // Mon–Sun
        req({ startDate: '2026-11-10', endDate: '2026-11-10', status: 'PENDING' }),
        req({ startDate: '2026-11-12', endDate: '2026-11-12', status: 'CANCELLED' }),
        req({ leaveTypeCode: 'CHILD_SICK_LEAVE', startDate: '2026-11-16', endDate: '2026-11-17' }),
        req({ leaveTypeCode: 'UNPAID', startDate: '2026-11-19', endDate: '2026-11-19' }),
        req({ employeeId: 'other', startDate: '2026-11-20', endDate: '2026-11-20' }),
      ],
      'e1',
      2026,
      11,
    )
    expect(days.LEAVE).toEqual([2, 3, 4, 5, 6, 19])
    expect(days.SICK).toEqual([16, 17])
  })

  it('clips multi-month requests to the exported month', () => {
    const days = exportedDaysForMonth([req({ startDate: '2026-10-29', endDate: '2026-11-03' })], 'e1', 2026, 11)
    expect(days.LEAVE).toEqual([2, 3])
  })

  it('pairs half-days and exports the second of each pair (D19); odd last one on its own date (Q26)', () => {
    const days = exportedDaysForMonth(
      [
        req({ startDate: '2026-11-09', endDate: '2026-11-09', dayPortion: 'AM' }),
        req({ startDate: '2026-11-11', endDate: '2026-11-11', dayPortion: 'PM' }),
        req({ startDate: '2026-11-18', endDate: '2026-11-18', dayPortion: 'PM' }),
      ],
      'e1',
      2026,
      11,
    )
    expect(days.LEAVE).toEqual([11, 18])
  })

  it('merges consecutive days across non-working days only (Q29)', () => {
    // Fri 6 + Mon 9 bridge the weekend; 11 is separate because 10 (Tue) is a working day
    expect(buildPeriods([5, 6, 9, 11], 2026, 11)).toEqual([
      { from: 5, to: 9 },
      { from: 11, to: 11 },
    ])
  })
})

describe('payroll export employees', () => {
  const base = { legalEntityId: 'VIRGO_KFT' as const, employmentStart: '2020-01-01', employmentEnd: null }
  it('filters by legal entity, export flag and employment in month; sorts by hu collation', () => {
    const list = payrollEmployees(
      [
        emp({ ...base, id: 'a', displayName: 'Zoltán Ödön' }),
        emp({ ...base, id: 'b', displayName: 'Ábel Béla' }),
        emp({ ...base, id: 'c', displayName: 'Kizárt', includeInPayrollExport: false }),
        emp({ ...base, id: 'd', displayName: 'Zrt', legalEntityId: 'VIRGO_ZRT' }),
        emp({ ...base, id: 'e', displayName: 'Kilépett', employmentEnd: '2026-10-31' }),
        emp({ ...base, id: 'f', displayName: 'Belépő', employmentStart: '2026-12-01' }),
        emp({ ...base, id: 'g', displayName: 'Hó közben kilép', employmentEnd: '2026-11-15' }),
      ],
      'VIRGO_KFT',
      2026,
      11,
    )
    expect(list.map((e) => e.id)).toEqual(['b', 'g', 'a'])
  })

  it('lists employees without leave with empty periods (Q33) and uses the entity name', () => {
    const rows = buildPayrollRows([emp({ ...base, id: 'e1', displayName: 'X', taxId: '123' })], [], 'VIRGO_KFT', 2026, 11)
    expect(rows[0].periods).toEqual({ LEAVE: [], SICK: [] })
    const csv = buildPayrollCsv([emp({ ...base, id: 'e1', displayName: 'X', taxId: '123' })], [], 'VIRGO_KFT', 2026, 11)
    expect(csv.split('\r\n')[0].startsWith('Virgo Kft.;')).toBe(true)
    expect(csv.split('\r\n')[3]).toBe('X;123' + ';'.repeat(23))
  })
})
