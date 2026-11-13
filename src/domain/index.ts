export {
  authenticateDemoUser,
  DEMO_VALID_PASSWORD,
  resolveDefaultRole,
  type AuthFailureReason,
  type AuthResult,
} from './auth.ts'

export {
  getLegalEntity,
  isLegalEntityId,
  LEGAL_ENTITIES,
  LEGAL_ENTITY_IDS,
  LegalEntityEnum,
  type LegalEntity,
  type LegalEntityId,
} from './legalEntity.ts'

export {
  createLeaveType,
  DEFAULT_LEAVE_TYPES,
  getLeaveType,
  isLeaveTypeCode,
  LEAVE_TYPE_CODES,
  LeaveTypeCodeEnum,
  mapLeaveTypeToRow,
  mapRowToLeaveType,
  validateLeaveType,
  type CreateLeaveTypeInput,
  type LeaveType,
  type LeaveTypeCode,
  type LeaveTypeRow,
  type LeaveTypeValidationResult,
} from './leaveType.ts'

export {
  canManageTeams,
  createTeam,
  mapRowToTeam,
  mapTeamToRow,
  validateTeam,
  type CreateTeamInput,
  type EmployeeId,
  type Role,
  type Team,
  type TeamRow,
  type TeamValidationResult,
} from './team.ts'

export {
  canManageEmployees,
  createEmployee,
  mapEmployeeToRow,
  mapRowToEmployee,
  validateEmployee,
  wouldCreateManagementCycle,
  type CreateEmployeeInput,
  type Employee,
  type EmployeeRow,
  type EmployeeValidationResult,
  type IsoDate,
} from './employee.ts'

export {
  canManageEntitlements,
  createLeaveEntitlement,
  ENTITLEMENT_COMPONENTS,
  EntitlementComponentEnum,
  getEffectiveEntitlementDays,
  summarizeEntitlementBalance,
  type EntitlementBalanceSummary,
  isEntitlementComponent,
  mapLeaveEntitlementToRow,
  mapRowToLeaveEntitlement,
  validateLeaveEntitlement,
  type CreateLeaveEntitlementInput,
  type EntitlementComponent,
  type EntitlementId,
  type IsoDateTime,
  type LeaveEntitlement,
  type LeaveEntitlementRow,
  type LeaveEntitlementValidationResult,
} from './leaveEntitlement.ts'

export {
  CONSUMPTION_ORDER,
  isUsageCacheConsistent,
  pastApprovedLeaveDays,
  recomputeEntitlementUsage,
  withPastUsage,
  type EntitlementUsage,
} from './entitlementUsage.ts'

export {
  buildLeaveRequestFromDraft,
  canManageLeaveRequests,
  createLeaveRequest,
  generateRequestId,
  resolveApproverId,
  DAY_PORTIONS,
  DayPortionEnum,
  isDayPortion,
  isRequestStatus,
  mapLeaveRequestToRow,
  mapRowToLeaveRequest,
  REQUEST_STATUSES,
  RequestStatusEnum,
  revokeLeaveRequestByHr,
  DUPLICATE_REQUEST_MESSAGE,
  findOverlappingRequest,
  validateLeaveRequest,
  type Approval,
  type Cancellation,
  type CreateLeaveRequestInput,
  type DayPortion,
  type BuildLeaveRequestResult,
  type LeaveRequest,
  type LeaveRequestDraft,
  type LeaveRequestRow,
  type LeaveRequestValidationResult,
  type RequestId,
  type RequestStatus,
} from './leaveRequest.ts'
export * from './calendar.ts'
export * from './entitlementDefaults.ts'
