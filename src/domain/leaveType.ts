import type {
  LeaveCategory,
  LeaveType,
  LeaveTypeCode,
} from '../types/model.ts'

export type { LeaveCategory, LeaveType, LeaveTypeCode }

type ApproverRole = LeaveType['approverRole']

export const LeaveTypeCodeEnum = {
  ANNUAL: 'ANNUAL',
  SICK_LEAVE: 'SICK_LEAVE',
  UNPAID: 'UNPAID',
  FUNERAL: 'FUNERAL',
  CHILD_SICK_LEAVE: 'CHILD_SICK_LEAVE',
} as const satisfies Record<LeaveTypeCode, LeaveTypeCode>

export const LEAVE_TYPE_CODES: readonly LeaveTypeCode[] = [
  LeaveTypeCodeEnum.ANNUAL,
  LeaveTypeCodeEnum.SICK_LEAVE,
  LeaveTypeCodeEnum.UNPAID,
  LeaveTypeCodeEnum.FUNERAL,
  LeaveTypeCodeEnum.CHILD_SICK_LEAVE,
] as const

export interface CreateLeaveTypeInput {
  code: LeaveTypeCode
  label: string
  category: LeaveCategory
  deductsFromAnnualBalance: boolean
  halfDayAllowed: boolean
  approverRole?: ApproverRole
  payrollCode?: string | null
  deputyCheckApplies: boolean
}

export interface LeaveTypeRow {
  code: LeaveTypeCode
  label: string
  category: LeaveCategory
  deducts_from_annual_balance: number | boolean
  half_day_allowed: number | boolean
  approver_role: ApproverRole
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
 * Leave types (D21, 2026-11-13; replaces the D19 list):
 * fizetett szabadság, betegszabadság, fizetés nélküli szabadság,
 * temetési szabadság, egyéb, gyermekápolási szabadság.
 * FUNERAL attributes are an assumption, not HR-confirmed.
 * Only ANNUAL deducts from the annual balance. UNPAID is decided by HR Admin.
 * deputyCheckApplies: planned leave only (ANNUAL, UNPAID); FUNERAL false (assumption, Q30).
 */
export const DEFAULT_LEAVE_TYPES: readonly LeaveType[] = [
  {
    code: LeaveTypeCodeEnum.ANNUAL,
    label: 'Fizetett szabadság',
    category: 'LEAVE',
    deductsFromAnnualBalance: true,
    halfDayAllowed: true,
    approverRole: 'MANAGER',
    payrollCode: null,
    deputyCheckApplies: true,
  },
  {
    code: LeaveTypeCodeEnum.SICK_LEAVE,
    label: 'Betegszabadság',
    category: 'SICK',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    approverRole: 'MANAGER',
    payrollCode: null,
    deputyCheckApplies: false,
  },
  {
    code: LeaveTypeCodeEnum.UNPAID,
    label: 'Fizetés nélküli szabadság',
    category: 'LEAVE',
    deductsFromAnnualBalance: false,
    halfDayAllowed: true,
    approverRole: 'HR_ADMIN',
    payrollCode: null,
    deputyCheckApplies: true,
  },
  {
    code: LeaveTypeCodeEnum.FUNERAL,
    label: 'Temetési szabadság',
    category: 'LEAVE',
    deductsFromAnnualBalance: false,
    halfDayAllowed: true,
    approverRole: 'MANAGER',
    payrollCode: null,
    deputyCheckApplies: false,
  },
  {
    code: LeaveTypeCodeEnum.CHILD_SICK_LEAVE,
    label: 'Gyermekápolási szabadság',
    category: 'SICK',
    deductsFromAnnualBalance: false,
    halfDayAllowed: false,
    approverRole: 'MANAGER',
    payrollCode: null,
    deputyCheckApplies: false,
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
  if (input.category !== 'LEAVE' && input.category !== 'SICK') {
    errors.push('Érvényes kategória (LEAVE vagy SICK) kötelező.')
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
    category: input.category,
    deductsFromAnnualBalance: Boolean(input.deductsFromAnnualBalance),
    // Confirmed: never half-day for SICK types.
    halfDayAllowed: input.category === 'SICK' ? false : Boolean(input.halfDayAllowed),
    approverRole: input.approverRole ?? 'MANAGER',
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
    category: row.category,
    deductsFromAnnualBalance: Boolean(row.deducts_from_annual_balance),
    halfDayAllowed: Boolean(row.half_day_allowed),
    approverRole: row.approver_role,
    payrollCode: row.payroll_code,
    deputyCheckApplies: Boolean(row.deputy_check_applies),
  }
}

export function mapLeaveTypeToRow(leaveType: LeaveType): LeaveTypeRow {
  return {
    code: leaveType.code,
    label: leaveType.label,
    category: leaveType.category,
    deducts_from_annual_balance: leaveType.deductsFromAnnualBalance ? 1 : 0,
    half_day_allowed: leaveType.halfDayAllowed ? 1 : 0,
    approver_role: leaveType.approverRole,
    payroll_code: leaveType.payrollCode,
    deputy_check_applies: leaveType.deputyCheckApplies ? 1 : 0,
  }
}
