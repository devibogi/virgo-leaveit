import { describe, expect, it } from 'vitest'
import {
  createLeaveType,
  DEFAULT_LEAVE_TYPES,
  getLeaveType,
  isLeaveTypeCode,
  LeaveTypeCodeEnum,
  mapLeaveTypeToRow,
  mapRowToLeaveType,
  validateLeaveType,
  type LeaveType,
} from './leaveType.ts'

describe('LeaveType entity & configuration (shared DATA_MODEL contract)', () => {
  it('provides all 6 provisional leave types with correct deputyCheckApplies flags', () => {
    expect(DEFAULT_LEAVE_TYPES).toHaveLength(6)

    // Planned leave: deputyCheckApplies = true
    expect(getLeaveType(LeaveTypeCodeEnum.ANNUAL).deputyCheckApplies).toBe(true)
    expect(
      getLeaveType(LeaveTypeCodeEnum.EXTRAORDINARY).deputyCheckApplies,
    ).toBe(true)
    expect(getLeaveType(LeaveTypeCodeEnum.UNPAID).deputyCheckApplies).toBe(true)

    // Unplanned / statutory leave: deputyCheckApplies = false
    expect(getLeaveType(LeaveTypeCodeEnum.SICK_LEAVE).deputyCheckApplies).toBe(
      false,
    )
    expect(getLeaveType(LeaveTypeCodeEnum.SICK_PAY).deputyCheckApplies).toBe(
      false,
    )
    expect(getLeaveType(LeaveTypeCodeEnum.PATERNITY).deputyCheckApplies).toBe(
      false,
    )
  })

  it('validates and creates a LeaveType entity', () => {
    const lt = createLeaveType({
      code: 'ANNUAL',
      label: ' Szabadság ',
      deductsFromAnnualBalance: true,
      halfDayAllowed: true,
      payrollCode: '  SZAB_01 ',
      deputyCheckApplies: true,
    })

    expect(lt).toEqual<LeaveType>({
      code: 'ANNUAL',
      label: 'Szabadság',
      deductsFromAnnualBalance: true,
      halfDayAllowed: true,
      payrollCode: 'SZAB_01',
      deputyCheckApplies: true,
    })
  })

  it('rejects invalid code or empty label', () => {
    expect(isLeaveTypeCode('ANNUAL')).toBe(true)
    expect(isLeaveTypeCode('INVALID')).toBe(false)

    const validation = validateLeaveType({
      code: 'INVALID' as LeaveType['code'],
      label: '   ',
      deductsFromAnnualBalance: false,
      halfDayAllowed: false,
      deputyCheckApplies: false,
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toHaveLength(2)
  })

  it('maps between MariaDB row (TINYINT booleans) and LeaveType entity', () => {
    const original = getLeaveType('ANNUAL')
    const row = mapLeaveTypeToRow(original)

    expect(row).toEqual({
      code: 'ANNUAL',
      label: 'Szabadság',
      deducts_from_annual_balance: 1,
      half_day_allowed: 1,
      payroll_code: null,
      deputy_check_applies: 1,
    })

    expect(mapRowToLeaveType(row)).toEqual(original)
  })
})
