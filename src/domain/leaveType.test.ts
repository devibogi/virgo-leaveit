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

describe('LeaveType configuration (D21)', () => {
  it('provides exactly the 5 leave types', () => {
    expect(DEFAULT_LEAVE_TYPES.map((lt) => lt.code)).toEqual([
      'ANNUAL',
      'SICK_LEAVE',
      'UNPAID',
      'FUNERAL',
      'CHILD_SICK_LEAVE',
    ])
    expect(isLeaveTypeCode('SICK_PAY')).toBe(false)
    expect(isLeaveTypeCode('EXTRAORDINARY')).toBe(false)
  })

  it('has the expected labels', () => {
    expect(getLeaveType('ANNUAL').label).toBe('Fizetett szabadság')
    expect(getLeaveType('FUNERAL').label).toBe('Temetési szabadság')
    expect(getLeaveType('CHILD_SICK_LEAVE').label).toBe(
      'Gyermekápolási szabadság',
    )
  })

  it('only ANNUAL deducts from the annual balance', () => {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      expect(lt.deductsFromAnnualBalance).toBe(lt.code === 'ANNUAL')
    }
  })

  it('groups types into LEAVE and SICK categories', () => {
    expect(getLeaveType('ANNUAL').category).toBe('LEAVE')
    expect(getLeaveType('UNPAID').category).toBe('LEAVE')
    expect(getLeaveType('FUNERAL').category).toBe('LEAVE')
    expect(getLeaveType('FUNERAL').deductsFromAnnualBalance).toBe(false)
    expect(getLeaveType('SICK_LEAVE').category).toBe('SICK')
    expect(getLeaveType('CHILD_SICK_LEAVE').category).toBe('SICK')
  })

  it('never allows half-day for SICK types', () => {
    for (const lt of DEFAULT_LEAVE_TYPES.filter((t) => t.category === 'SICK')) {
      expect(lt.halfDayAllowed).toBe(false)
    }
    expect(getLeaveType('ANNUAL').halfDayAllowed).toBe(true)
    expect(getLeaveType('UNPAID').halfDayAllowed).toBe(true)
    expect(getLeaveType('FUNERAL').halfDayAllowed).toBe(true)
  })

  it('UNPAID is approved by HR Admin, everything else by the manager', () => {
    for (const lt of DEFAULT_LEAVE_TYPES) {
      expect(lt.approverRole).toBe(lt.code === 'UNPAID' ? 'HR_ADMIN' : 'MANAGER')
    }
  })

  it('applies the deputy check to planned leave only', () => {
    expect(getLeaveType(LeaveTypeCodeEnum.ANNUAL).deputyCheckApplies).toBe(true)
    expect(getLeaveType(LeaveTypeCodeEnum.UNPAID).deputyCheckApplies).toBe(true)
    expect(getLeaveType(LeaveTypeCodeEnum.FUNERAL).deputyCheckApplies).toBe(false)
    expect(getLeaveType(LeaveTypeCodeEnum.SICK_LEAVE).deputyCheckApplies).toBe(false)
    expect(
      getLeaveType(LeaveTypeCodeEnum.CHILD_SICK_LEAVE).deputyCheckApplies,
    ).toBe(false)
  })

  it('validates and creates a LeaveType entity', () => {
    const lt = createLeaveType({
      code: 'ANNUAL',
      label: ' Fizetett szabadság ',
      category: 'LEAVE',
      deductsFromAnnualBalance: true,
      halfDayAllowed: true,
      payrollCode: '  SZAB_01 ',
      deputyCheckApplies: true,
    })

    expect(lt).toEqual<LeaveType>({
      code: 'ANNUAL',
      label: 'Fizetett szabadság',
      category: 'LEAVE',
      deductsFromAnnualBalance: true,
      halfDayAllowed: true,
      approverRole: 'MANAGER',
      payrollCode: 'SZAB_01',
      deputyCheckApplies: true,
    })
  })

  it('forces halfDayAllowed=false for SICK types on create', () => {
    const lt = createLeaveType({
      code: 'SICK_LEAVE',
      label: 'Betegszabadság',
      category: 'SICK',
      deductsFromAnnualBalance: false,
      halfDayAllowed: true,
      deputyCheckApplies: false,
    })
    expect(lt.halfDayAllowed).toBe(false)
  })

  it('rejects invalid code, empty label or missing category', () => {
    const validation = validateLeaveType({
      code: 'INVALID' as LeaveType['code'],
      label: '   ',
      category: 'X' as LeaveType['category'],
      deductsFromAnnualBalance: false,
      halfDayAllowed: false,
      deputyCheckApplies: false,
    })

    expect(validation.valid).toBe(false)
    expect(validation.errors).toHaveLength(3)
  })

  it('maps between MariaDB row (TINYINT booleans) and LeaveType entity', () => {
    const original = getLeaveType('ANNUAL')
    const row = mapLeaveTypeToRow(original)

    expect(row).toEqual({
      code: 'ANNUAL',
      label: 'Fizetett szabadság',
      category: 'LEAVE',
      deducts_from_annual_balance: 1,
      half_day_allowed: 1,
      approver_role: 'MANAGER',
      payroll_code: null,
      deputy_check_applies: 1,
    })

    expect(mapRowToLeaveType(row)).toEqual(original)
  })
})
