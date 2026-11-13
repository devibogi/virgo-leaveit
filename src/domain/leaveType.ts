import type { LeaveType, LeaveTypeCode } from '../types/model.ts'

export type { LeaveType, LeaveTypeCode }

export const LeaveTypeCodeEnum = {
  ANNUAL: 'ANNUAL',
  SICK_LEAVE: 'SICK_LEAVE',
  SICK_PAY: 'SICK_PAY',
  PATERNITY: 'PATERNITY',
  EXTRAORDINARY: 'EXTRAORDINARY',
  UNPAID: 'UNPAID',
} as const satisfies Record<LeaveTypeCode, LeaveTypeCode>

export const LEAVE_TYPE_CODES: readonly LeaveTypeCode[] = [
  LeaveTypeCodeEnum.ANNUAL,
  LeaveTypeCodeEnum.SICK_LEAVE,
  LeaveTypeCodeEnum.SICK_PAY,
  LeaveTypeCodeEnum.PATERNITY,
  LeaveTypeCodeEnum.EXTRAORDINARY,
  LeaveTypeCodeEnum.UNPAID,
] as const

export interface CreateLeaveTypeInput {
  code: LeaveTypeCode
  label: string
  deductsFromAnnualBalance: boolean
  halfDayAllowed: boolean
  payrollCode?: string | null
  deputyCheckApplies: boolean
}

export interface LeaveTypeRow {
  code: LeaveTypeCode
  label: string
  deducts_from_annual_balance: number | boolean
  half_day_allowed: number | boolean
  payroll_code: string | null
  deputy_check_applies: number | boolean
}

export interface LeaveTypeValidationResult {
  valid: boolean
  errors: string[]
}

export function isLeaveTypeCode(value: unknown): value is LeaveTypeCode {
  return (
    typeof value === 'string' &&
    (LEAVE_TYPE_CODES as readonly string[]).includes(value)
  )
}

/**
 * Provisional configuration per leave type as specified in docs/DATA_MODEL.md:
 * - deputyCheckApplies is true for planned leave (ANNUAL, EXTRAORDINARY, UNPAID)
 *   and false for SICK_LEAVE, SICK_PAY, PATERNITY.
 * - payrollCode is null until confirmed with HR/payroll.
 */
export const DEFAULT_LEAVE_TYPES: readonly LeaveType[] = [
  {
    code: LeaveTypeCodeEnum.ANNUAL,
    label: 'Szabadság',
    deductsFromAnnualBalance: true,
    halfDayAllowed: true,
    payrollCode: null,
    deputyCheckApplies: true,
  },
  {
    code: LeaveTypeCodeEnum.SICK_LEAVE,
    label: 'Betegszabadság',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    payrollCode: null,
    deputyCheckApplies: false,
  },
  {
    code: LeaveTypeCodeEnum.SICK_PAY,
    label: 'Táppénz',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    payrollCode: null,
    deputyCheckApplies: false,
  },
  {
    code: LeaveTypeCodeEnum.PATERNITY,
    label: 'Apai szabadság',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    payrollCode: null,
    deputyCheckApplies: false,
  },
  {
    code: LeaveTypeCodeEnum.EXTRAORDINARY,
    label: 'Rendkívüli szabadság',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    payrollCode: null,
    deputyCheckApplies: true,
  },
  {
    code: LeaveTypeCodeEnum.UNPAID,
    label: 'Fizetés nélküli szabadság',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    payrollCode: null,
    deputyCheckApplies: true,
  },
] as const

export function validateLeaveType(
  input: CreateLeaveTypeInput,
): LeaveTypeValidationResult {
  const errors: string[] = []

  if (!isLeaveTypeCode(input.code)) {
    errors.push(
      `Érvénytelen szabadságtípus kód (code). Engedélyezett értékek: ${LEAVE_TYPE_CODES.join(', ')}.`,
    )
  }
  if (!input.label || input.label.trim().length === 0) {
    errors.push('A szabadságtípus megnevezése (label) kötelező.')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createLeaveType(input: CreateLeaveTypeInput): LeaveType {
  const validation = validateLeaveType(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const trimmedPayroll =
    input.payrollCode && input.payrollCode.trim().length > 0
      ? input.payrollCode.trim()
      : null

  return {
    code: input.code,
    label: input.label.trim(),
    deductsFromAnnualBalance: Boolean(input.deductsFromAnnualBalance),
    halfDayAllowed: Boolean(input.halfDayAllowed),
    payrollCode: trimmedPayroll,
    deputyCheckApplies: Boolean(input.deputyCheckApplies),
  }
}

export function getLeaveType(
  code: LeaveTypeCode,
  leaveTypes: readonly LeaveType[] = DEFAULT_LEAVE_TYPES,
): LeaveType {
  const found = leaveTypes.find((lt) => lt.code === code)
  if (!found) {
    throw new Error(`Ismeretlen szabadságtípus (LeaveTypeCode): ${String(code)}`)
  }
  return found
}

export function mapRowToLeaveType(row: LeaveTypeRow): LeaveType {
  return {
    code: row.code,
    label: row.label,
    deductsFromAnnualBalance: Boolean(row.deducts_from_annual_balance),
    halfDayAllowed: Boolean(row.half_day_allowed),
    payrollCode: row.payroll_code,
    deputyCheckApplies: Boolean(row.deputy_check_applies),
  }
}

export function mapLeaveTypeToRow(leaveType: LeaveType): LeaveTypeRow {
  return {
    code: leaveType.code,
    label: leaveType.label,
    deducts_from_annual_balance: leaveType.deductsFromAnnualBalance ? 1 : 0,
    half_day_allowed: leaveType.halfDayAllowed ? 1 : 0,
    payroll_code: leaveType.payrollCode,
    deputy_check_applies: leaveType.deputyCheckApplies ? 1 : 0,
  }
}
