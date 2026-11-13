import type {
  Approval,
  Cancellation,
  DayPortion,
  Employee,
  EmployeeId,
  IsoDate,
  IsoDateTime,
  LeaveRequest,
  LeaveTypeCode,
  LegalEntityId,
  RequestId,
  RequestStatus,
  Role,
} from '../types/model.ts'
import { getLeaveType, isLeaveTypeCode } from './leaveType.ts'
import { isLegalEntityId } from './legalEntity.ts'

export type {
  Approval,
  Cancellation,
  DayPortion,
  EmployeeId,
  IsoDate,
  IsoDateTime,
  LeaveRequest,
  LeaveTypeCode,
  LegalEntityId,
  RequestId,
  RequestStatus,
  Role,
}

export const DayPortionEnum = {
  FULL: 'FULL',
  AM: 'AM',
  PM: 'PM',
} as const satisfies Record<DayPortion, DayPortion>

export const DAY_PORTIONS: readonly DayPortion[] = [
  DayPortionEnum.FULL,
  DayPortionEnum.AM,
  DayPortionEnum.PM,
] as const

export const RequestStatusEnum = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  REVOKED: 'REVOKED',
} as const satisfies Record<RequestStatus, RequestStatus>

export const REQUEST_STATUSES: readonly RequestStatus[] = [
  RequestStatusEnum.PENDING,
  RequestStatusEnum.APPROVED,
  RequestStatusEnum.REJECTED,
  RequestStatusEnum.CANCELLED,
  RequestStatusEnum.REVOKED,
] as const

export interface CreateLeaveRequestInput {
  id: RequestId
  employeeId: EmployeeId
  legalEntityId: LegalEntityId
  approverId: EmployeeId
  leaveTypeCode: LeaveTypeCode
  startDate: IsoDate
  endDate: IsoDate
  dayPortion: DayPortion
  status?: RequestStatus
  employeeComment?: string | null
  submittedAt?: IsoDateTime
  approval?: Approval | null
  cancellation?: Cancellation | null
}

/**
 * What the client sends when submitting / editing a request (D21).
 * id, legalEntityId, approverId and status are never taken from the client:
 * the server generates or derives them.
 */
export interface LeaveRequestDraft {
  employeeId: EmployeeId
  leaveTypeCode: LeaveTypeCode
  startDate: IsoDate
  endDate: IsoDate
  dayPortion: DayPortion
  employeeComment?: string | null
}

export interface LeaveRequestRow {
  id: string
  employee_id: string
  legal_entity_id: LegalEntityId
  approver_id: string
  leave_type_code: LeaveTypeCode
  start_date: string
  end_date: string
  day_portion: DayPortion
  status: RequestStatus
  employee_comment: string | null
  submitted_at: string
  decision: 'APPROVED' | 'REJECTED' | null
  decided_by: string | null
  on_behalf_of: string | null
  decided_at: string | null
  decision_comment: string | null
  cancellation_kind: 'CANCELLED' | 'REVOKED' | null
  cancelled_by: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
}

export interface LeaveRequestValidationResult {
  valid: boolean
  errors: string[]
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function isDayPortion(value: unknown): value is DayPortion {
  return (
    typeof value === 'string' &&
    (DAY_PORTIONS as readonly string[]).includes(value)
  )
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return (
    typeof value === 'string' &&
    (REQUEST_STATUSES as readonly string[]).includes(value)
  )
}

/**
 * Only HR_ADMIN is authorized to use the HR Admin LeaveRequest CRUD view.
 */
export function canManageLeaveRequests(
  roleOrRoles: Role | readonly Role[],
): boolean {
  if (Array.isArray(roleOrRoles)) {
    return roleOrRoles.includes('HR_ADMIN')
  }
  return roleOrRoles === 'HR_ADMIN'
}

export function validateLeaveRequest(
  input: CreateLeaveRequestInput,
): LeaveRequestValidationResult {
  const errors: string[] = []
  const trimmedId = input.id?.trim() ?? ''
  const trimmedEmpId = input.employeeId?.trim() ?? ''
  const trimmedApproverId = input.approverId?.trim() ?? ''

  if (!trimmedId) {
    errors.push('A kérelem azonosítója (id) kötelező.')
  }
  if (!trimmedEmpId) {
    errors.push('A munkavállaló azonosítója (employeeId) kötelező.')
  }
  if (!trimmedApproverId) {
    errors.push('A jóváhagyó vezető azonosítója (approverId) kötelező.')
  }
  if (trimmedEmpId && trimmedApproverId && trimmedEmpId === trimmedApproverId) {
    errors.push('A munkavállaló nem hagyhatja jóvá saját kérelmét.')
  }
  if (!isLegalEntityId(input.legalEntityId)) {
    errors.push('Érvényes jogi személy (VIRGO_KFT vagy VIRGO_ZRT) kötelező.')
  }
  if (!isLeaveTypeCode(input.leaveTypeCode)) {
    errors.push('Érvényes szabadságtípus (leaveTypeCode) kötelező.')
  }
  if (!input.startDate || !ISO_DATE_REGEX.test(input.startDate)) {
    errors.push('A kezdő dátum (YYYY-MM-DD) kötelező.')
  }
  if (!input.endDate || !ISO_DATE_REGEX.test(input.endDate)) {
    errors.push('A záró dátum (YYYY-MM-DD) kötelező.')
  }
  if (
    ISO_DATE_REGEX.test(input.startDate) &&
    ISO_DATE_REGEX.test(input.endDate) &&
    input.endDate < input.startDate
  ) {
    errors.push('A záró dátum (endDate) nem lehet korábbi a kezdő dátumnál.')
  }
  if (!isDayPortion(input.dayPortion)) {
    errors.push('Érvényes napszak (FULL, AM vagy PM) kötelező.')
  } else if (input.dayPortion !== 'FULL') {
    if (input.startDate !== input.endDate) {
      errors.push(
        'Félnapos (AM/PM) kérelem esetén a kezdő és záró dátumnak meg kell egyeznie.',
      )
    }
    if (isLeaveTypeCode(input.leaveTypeCode)) {
      const leaveType = getLeaveType(input.leaveTypeCode)
      if (!leaveType.halfDayAllowed) {
        errors.push(
          `A(z) ${leaveType.label} (${leaveType.code}) típusnál félnapos kérelem nem engedélyezett.`,
        )
      }
    }
  }

  const status = input.status ?? 'PENDING'
  if (!isRequestStatus(status)) {
    errors.push('Érvénytelen kérelem státusz (status).')
  }

  if (input.approval) {
    if (
      trimmedEmpId &&
      input.approval.decidedBy.trim() === trimmedEmpId
    ) {
      errors.push('Saját kérelemről a munkavállaló nem dönthet.')
    }
  }

  if (input.cancellation) {
    if (
      input.cancellation.kind === 'REVOKED' &&
      (!input.cancellation.reason ||
        input.cancellation.reason.trim().length === 0)
    ) {
      errors.push(
        'HR általi visszavonás (REVOKED) esetén az indoklás megadása kötelező.',
      )
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function createLeaveRequest(
  input: CreateLeaveRequestInput,
): LeaveRequest {
  const validation = validateLeaveRequest(input)
  if (!validation.valid) {
    throw new Error(validation.errors.join(' '))
  }

  const trimmedComment =
    input.employeeComment && input.employeeComment.trim().length > 0
      ? input.employeeComment.trim()
      : null

  return {
    id: input.id.trim(),
    employeeId: input.employeeId.trim(),
    legalEntityId: input.legalEntityId,
    approverId: input.approverId.trim(),
    leaveTypeCode: input.leaveTypeCode,
    startDate: input.startDate.trim(),
    endDate: input.endDate.trim(),
    dayPortion: input.dayPortion,
    status: input.status ?? 'PENDING',
    employeeComment: trimmedComment,
    submittedAt: input.submittedAt ?? new Date().toISOString(),
    approval: input.approval ?? null,
    cancellation: input.cancellation ?? null,
  }
}

export function revokeLeaveRequestByHr(
  request: LeaveRequest,
  hrActorId: EmployeeId,
  reason: string,
  at: IsoDateTime = new Date().toISOString(),
): LeaveRequest {
  const trimmedReason = reason.trim()
  if (!trimmedReason) {
    throw new Error(
      'HR általi visszavonás (REVOKED) esetén az indoklás megadása kötelező.',
    )
  }

  return {
    ...request,
    status: 'REVOKED',
    cancellation: {
      kind: 'REVOKED',
      cancelledBy: hrActorId.trim(),
      cancelledAt: at,
      reason: trimmedReason,
    },
  }
}

/**
 * Approver decision on a PENDING request (BUSINESS_RULES §2). Only the snapshot approver
 * (request.approverId) may decide, never on their own request. Rejection reason is optional
 * (assumption, not HR-confirmed). Deputy delegation and the deputy re-check at approval are not wired yet.
 */
export function decideLeaveRequest(
  request: LeaveRequest,
  actorId: EmployeeId,
  decision: 'APPROVED' | 'REJECTED',
  comment: string | null = null,
  at: IsoDateTime = new Date().toISOString(),
): LeaveRequest {
  const actor = actorId.trim()
  if (request.status !== 'PENDING') {
    throw new LeaveDecisionError(409, 'Csak jóváhagyásra váró kérelemről lehet dönteni.')
  }
  if (actor === request.employeeId) {
    throw new LeaveDecisionError(403, 'Saját kérelemről a munkavállaló nem dönthet.')
  }
  if (actor !== request.approverId) {
    throw new LeaveDecisionError(403, 'Erről a kérelemről csak a kijelölt jóváhagyó dönthet.')
  }
  const trimmed = comment?.trim() || null
  return {
    ...request,
    status: decision,
    approval: { decision, decidedBy: actor, onBehalfOf: null, decidedAt: at, comment: trimmed },
  }
}

export class LeaveDecisionError extends Error {
  readonly status: 403 | 409
  constructor(status: 403 | 409, message: string) {
    super(message)
    this.name = 'LeaveDecisionError'
    this.status = status
  }
}

export function mapRowToLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  const approval: Approval | null =
    row.decision && row.decided_by && row.decided_at
      ? {
          decision: row.decision,
          decidedBy: row.decided_by,
          onBehalfOf: row.on_behalf_of,
          decidedAt: row.decided_at,
          comment: row.decision_comment,
        }
      : null

  const cancellation: Cancellation | null =
    row.cancellation_kind && row.cancelled_by && row.cancelled_at
      ? {
          kind: row.cancellation_kind,
          cancelledBy: row.cancelled_by,
          cancelledAt: row.cancelled_at,
          reason: row.cancellation_reason,
        }
      : null

  return {
    id: row.id,
    employeeId: row.employee_id,
    legalEntityId: row.legal_entity_id,
    approverId: row.approver_id,
    leaveTypeCode: row.leave_type_code,
    startDate: row.start_date,
    endDate: row.end_date,
    dayPortion: row.day_portion,
    status: row.status,
    employeeComment: row.employee_comment,
    submittedAt: row.submitted_at,
    approval,
    cancellation,
  }
}

export function mapLeaveRequestToRow(req: LeaveRequest): LeaveRequestRow {
  return {
    id: req.id,
    employee_id: req.employeeId,
    legal_entity_id: req.legalEntityId,
    approver_id: req.approverId,
    leave_type_code: req.leaveTypeCode,
    start_date: req.startDate,
    end_date: req.endDate,
    day_portion: req.dayPortion,
    status: req.status,
    employee_comment: req.employeeComment,
    submitted_at: req.submittedAt,
    decision: req.approval?.decision ?? null,
    decided_by: req.approval?.decidedBy ?? null,
    on_behalf_of: req.approval?.onBehalfOf ?? null,
    decided_at: req.approval?.decidedAt ?? null,
    decision_comment: req.approval?.comment ?? null,
    cancellation_kind: req.cancellation?.kind ?? null,
    cancelled_by: req.cancellation?.cancelledBy ?? null,
    cancelled_at: req.cancellation?.cancelledAt ?? null,
    cancellation_reason: req.cancellation?.reason ?? null,
  }
}

export function generateRequestId(): RequestId {
  const uuid = (
    globalThis as { crypto?: { randomUUID?: () => string } }
  ).crypto?.randomUUID?.()
  return uuid
    ? `req-${uuid}`
    : `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Approver derivation (D21):
 * - leave type with approverRole HR_ADMIN (UNPAID) → first active HR Admin who is not the requester;
 * - otherwise → the employee's line manager (managerId).
 * Returns null when no approver can be determined.
 */
export function resolveApproverId(
  employee: Employee,
  leaveTypeCode: LeaveTypeCode,
  employees: readonly Employee[],
): EmployeeId | null {
  const approverRole = isLeaveTypeCode(leaveTypeCode)
    ? getLeaveType(leaveTypeCode).approverRole
    : 'MANAGER'

  if (approverRole === 'HR_ADMIN') {
    const hr = employees.find(
      (e) =>
        e.id !== employee.id &&
        e.roles.includes('HR_ADMIN') &&
        e.employmentEnd === null,
    )
    return hr?.id ?? null
  }
  return employee.managerId
}

export interface BuildLeaveRequestResult {
  input: CreateLeaveRequestInput | null
  errors: string[]
}

/**
 * Builds the full create input from a client draft: id is generated, status is PENDING,
 * legalEntityId comes from the employee, approverId is derived.
 */
export function buildLeaveRequestFromDraft(
  draft: LeaveRequestDraft,
  employee: Employee | null,
  employees: readonly Employee[],
  id: RequestId = generateRequestId(),
): BuildLeaveRequestResult {
  if (!employee) {
    return {
      input: null,
      errors: [`A(z) '${draft.employeeId}' munkavállaló nem található.`],
    }
  }
  const approverId = resolveApproverId(employee, draft.leaveTypeCode, employees)
  if (!approverId) {
    return {
      input: null,
      errors: ['Nem határozható meg jóváhagyó ehhez a kérelemhez.'],
    }
  }
  const input: CreateLeaveRequestInput = {
    id,
    employeeId: employee.id,
    legalEntityId: employee.legalEntityId,
    approverId,
    leaveTypeCode: draft.leaveTypeCode,
    startDate: draft.startDate,
    endDate: draft.endDate,
    dayPortion: draft.dayPortion,
    status: 'PENDING',
    employeeComment: draft.employeeComment ?? null,
  }
  const validation = validateLeaveRequest(input)
  return validation.valid
    ? { input, errors: [] }
    : { input: null, errors: validation.errors }
}

export const DUPLICATE_REQUEST_MESSAGE = 'Erre az időszakra már van leadott kérelmed.'

/**
 * Duplicate block (assumption, not HR-confirmed): a new request may not overlap a PENDING or
 * APPROVED request of the same employee. An AM and a PM half-day on the same date do not overlap.
 */
export function findOverlappingRequest(
  candidate: Pick<LeaveRequest, 'employeeId' | 'startDate' | 'endDate' | 'dayPortion'> & { id?: string },
  existing: readonly LeaveRequest[],
): LeaveRequest | null {
  return (
    existing.find(
      (r) =>
        r.id !== candidate.id &&
        r.employeeId === candidate.employeeId &&
        (r.status === 'PENDING' || r.status === 'APPROVED') &&
        r.startDate <= candidate.endDate &&
        candidate.startDate <= r.endDate &&
        !(
          r.dayPortion !== 'FULL' &&
          candidate.dayPortion !== 'FULL' &&
          r.dayPortion !== candidate.dayPortion
        ),
    ) ?? null
  )
}
