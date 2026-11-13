/**
 * LeaveIt shared data model (prototype contract).
 *
 * Rules of thumb:
 * - Persisted entities are stored in AppState (localStorage for the demo).
 * - Derived views (balances, leave days, payroll values, due dates) are computed
 *   by domain functions and never persisted as the source of truth.
 * - Dates are ISO strings: IsoDate = "YYYY-MM-DD", IsoDateTime = full ISO 8601 with offset.
 * - Balance deduction and payroll accounting are always separate values.
 *
 * See docs/DATA_MODEL.md. Changing this file changes a team-wide contract: coordinate first.
 */

// ---------- Primitives ----------

/** Calendar date, "YYYY-MM-DD". No time zone. */
export type IsoDate = string
/** Timestamp, e.g. "2026-11-13T09:30:00+01:00". */
export type IsoDateTime = string

export type EmployeeId = string
export type RequestId = string
export type EntitlementId = string
export type AuditEventId = string

// ---------- Organization ----------

export type LegalEntityId = 'VIRGO_KFT' | 'VIRGO_ZRT'

export interface LegalEntity {
  id: LegalEntityId
  name: string // "Virgo Kft." | "Virgo Zrt."
}

export type Role = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'

export interface Employee {
  id: EmployeeId
  displayName: string
  email: string // synthetic only
  legalEntityId: LegalEntityId
  /**
   * Direct manager. Source of truth for manager permissions:
   * a manager's direct team = employees whose managerId is the manager's id.
   * null for top-level people.
   */
  managerId: EmployeeId | null
  /** Every person has EMPLOYEE; managers and HR admins have additional roles. */
  roles: Role[]
  birthDate: IsoDate // synthetic; used only for age-based additional leave
  employmentStart: IsoDate
  employmentEnd: IsoDate | null
  /**
   * People who cover for this employee. One-way: only the requester's own deputies matter.
   * 1) Availability: planned leave is blocked on a day only if ALL deputies are away (approved leave).
   * 2) Manager delegation: if this employee is a manager, each deputy gets this manager's
   *    MANAGER rights (not HR_ADMIN) only on days this manager has approved leave. No chaining.
   * Empty array = no deputy check, no delegation. Must not contain the employee's own id.
   */
  deputyIds: EmployeeId[]
}

/**
 * Team = the people one manager approves. Membership is derived, never stored:
 * team of M = employees whose managerId === M. So everyone is in exactly one team
 * (or none, if managerId is null). A manager belongs to their own manager's team.
 * This record only holds the display name; one per manager.
 */
export interface Team {
  /** Key: the manager who approves this team's leave. Unique. */
  managerId: EmployeeId
  name: string
}

// ---------- Leave types ----------

export type LeaveTypeCode =
  | 'ANNUAL' // regular leave (szabadság), consumes the annual entitlement pool
  | 'SICK_LEAVE' // betegszabadság
  | 'SICK_PAY' // táppénz
  | 'PATERNITY'
  | 'EXTRAORDINARY'
  | 'UNPAID'

/** Configuration per leave type. Values are provisional until HR/payroll confirm (OPEN_QUESTIONS). */
export interface LeaveType {
  code: LeaveTypeCode
  label: string
  /** Whether approved days reduce the annual leave balance. */
  deductsFromAnnualBalance: boolean
  /** Whether AM/PM half-day requests are allowed for this type. */
  halfDayAllowed: boolean
  /** Payroll export code; null until the export schema is confirmed. */
  payrollCode: string | null
  /**
   * Whether the deputy-availability block applies (planned leave only).
   * true: ANNUAL, EXTRAORDINARY, UNPAID. false: SICK_LEAVE, SICK_PAY, PATERNITY.
   */
  deputyCheckApplies: boolean
}

// ---------- Entitlement ----------

export type EntitlementComponent =
  | 'BASE'
  | 'AGE_ADDITIONAL' // calculated from age
  | 'CHILD_ADDITIONAL' // entered manually by HR from the annual declaration
  | 'AGE_ADDITIONAL_CARRYOVER' // unused age-based leave from the previous year; consumed first

/**
 * One entitlement component for one employee and year.
 * Effective days = overrideDays ?? calculatedDays.
 */
export interface LeaveEntitlement {
  id: EntitlementId
  employeeId: EmployeeId
  year: number
  component: EntitlementComponent
  /** Full-year value before proration. null for manual-only components (CHILD_ADDITIONAL). */
  fullYearDays: number | null
  /** Value after mid-year proration and rounding. null for manual-only components. */
  calculatedDays: number | null
  /** HR manual value; wins over calculatedDays when set. */
  overrideDays: number | null
  overrideReason: string | null
  /** Value supplied by payroll, for double-checking only. Never used in calculations. */
  payrollReferenceDays: number | null
  updatedAt: IsoDateTime
  updatedBy: EmployeeId
}

// ---------- Requests ----------

export type DayPortion = 'FULL' | 'AM' | 'PM'

export type RequestStatus =
  | 'PENDING' // waiting for manager; does NOT reserve balance
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED' // by the employee, before start date
  | 'REVOKED' // by HR Admin

export interface Approval {
  decision: 'APPROVED' | 'REJECTED'
  decidedBy: EmployeeId
  /** Set when a deputy decided for the absent approver (= request.approverId); null otherwise. */
  onBehalfOf: EmployeeId | null
  decidedAt: IsoDateTime
  comment: string | null
}

export interface Cancellation {
  kind: 'CANCELLED' | 'REVOKED'
  cancelledBy: EmployeeId
  cancelledAt: IsoDateTime
  reason: string | null
}

/**
 * A leave request. Never edited in place once decided and never deleted:
 * changes happen via cancel + new request. Rejected/cancelled/revoked stay in history.
 */
export interface LeaveRequest {
  id: RequestId
  employeeId: EmployeeId
  /** Snapshot at submission time (for reporting even if the employee moves). */
  legalEntityId: LegalEntityId
  /** Snapshot of the direct manager at submission time; this person decides. */
  approverId: EmployeeId
  leaveTypeCode: LeaveTypeCode
  startDate: IsoDate
  /** Inclusive. For AM/PM requests startDate === endDate. */
  endDate: IsoDate
  dayPortion: DayPortion
  status: RequestStatus
  employeeComment: string | null
  submittedAt: IsoDateTime
  approval: Approval | null
  cancellation: Cancellation | null
}

// ---------- Working-day calendar ----------

export type CalendarOverrideKind =
  | 'PUBLIC_HOLIDAY'
  | 'REST_DAY' // transferred rest day (weekday made non-working)
  | 'WORKING_DAY' // transferred working Saturday

export interface CalendarOverride {
  date: IsoDate
  kind: CalendarOverrideKind
  label: string
}

/** Shape of data/calendar/hu-working-days-*.json. Default: Mon–Fri working, Sat–Sun not; overrides win. */
export interface CalendarDataset {
  version: string
  country: 'HU'
  years: number[]
  source: string
  reviewedByHr: boolean
  overrides: CalendarOverride[]
}

/** Resolved day, produced by the calendar service. */
export interface CalendarDay {
  date: IsoDate
  isWorkingDay: boolean
  override: CalendarOverride | null
}

// ---------- Derived views (computed, not persisted) ----------

/** One working day covered by an active request. */
export interface LeaveDay {
  requestId: RequestId
  employeeId: EmployeeId
  date: IsoDate
  portion: DayPortion
  leaveTypeCode: LeaveTypeCode
  /** Deducted from the annual balance: 1, 0.5, or 0 for types that don't deduct. */
  balanceDeduction: number
  /** Payroll accounting value. Half-days: first active in month = 1, second = 0. */
  payrollValue: number
}

export interface QuarterBalance {
  quarter: 1 | 2 | 3 | 4
  /** Allocation formula is an open question; values are provisional. */
  allocated: number
  carriedIn: number
  used: number
  remaining: number
}

export interface LeaveBalance {
  employeeId: EmployeeId
  year: number
  /** Effective days per component. */
  entitlementByComponent: Record<EntitlementComponent, number>
  totalEntitlement: number
  /** Approved, active, deducting days. */
  used: number
  /** Shown for information only; pending requests do not reduce `available`. */
  pending: number
  available: number
  quarters: QuarterBalance[]
}

/** Consecutive working-day window with no deputy conflict, computed deterministically. */
export interface DateSuggestion {
  startDate: IsoDate
  endDate: IsoDate
  workingDays: number
}

/**
 * Result of the deputy-availability check for one request.
 * Contains ONLY dates — never a deputy's id, name, position or leave type.
 * Run at submission and again at manager approval.
 */
export interface DeputyCheckResult {
  /** true when at least one requested working day has all deputies away. */
  blocked: boolean
  /** Requested working days on which every deputy is away. */
  conflictDates: IsoDate[]
  /** Alternative windows, closest first. Empty when not blocked. */
  suggestions: DateSuggestion[]
}

/**
 * The only data that may be sent to the AI helper for wording a conflict message.
 * Anonymized by construction: dates and counts only. The AI never decides or calculates.
 */
export interface DeputyConflictAiInput {
  requestedStartDate: IsoDate
  requestedEndDate: IsoDate
  requestedWorkingDays: number
  conflictDates: IsoDate[]
  suggestions: DateSuggestion[]
}

/**
 * Derived: deputy acts for an absent manager on one date. Computed from the manager's
 * deputyIds and approved leave; never persisted. Grants MANAGER rights over the manager's
 * direct team only, never over the deputy's own requests. Shown in a separate UI view.
 */
export interface ActiveDelegation {
  managerId: EmployeeId
  deputyId: EmployeeId
  date: IsoDate
}

// ---------- Audit ----------

export type AuditAction =
  | 'REQUEST_SUBMITTED'
  | 'REQUEST_APPROVED'
  | 'REQUEST_REJECTED'
  | 'REQUEST_CANCELLED'
  | 'REQUEST_REVOKED'
  | 'ENTITLEMENT_UPDATED'
  | 'SLA_REMINDER_SENT' // simulated
  | 'EXPORT_CREATED'
  | 'DEPUTIES_UPDATED'

export interface AuditEvent {
  id: AuditEventId
  at: IsoDateTime
  actorId: EmployeeId
  actorRole: Role
  /** Set when the actor acted as deputy for this manager. */
  onBehalfOf: EmployeeId | null
  action: AuditAction
  entityType: 'LEAVE_REQUEST' | 'LEAVE_ENTITLEMENT' | 'EXPORT' | 'EMPLOYEE'
  entityId: string
  reason: string | null
  /** Short human-readable before/after or context. */
  details: string | null
}

// ---------- Persisted app state ----------

export interface AppState {
  /** Bump when the shape changes; persistence resets/migrates on mismatch. */
  schemaVersion: 1
  legalEntities: LegalEntity[]
  teams: Team[]
  employees: Employee[]
  leaveTypes: LeaveType[]
  entitlements: LeaveEntitlement[]
  requests: LeaveRequest[]
  auditEvents: AuditEvent[]
}
