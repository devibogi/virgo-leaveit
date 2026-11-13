export { openApiDocument } from './openapi.ts'
export {
  authApi,
  createAuthApiClient,
  type AuthApiClientOptions,
  type LoginRequest,
  type LoginResponse,
} from './auth.ts'
export {
  createTeamApiClient,
  teamApi,
  TeamApiError,
  type CreateTeamRequest,
  type ErrorResponse,
  type ListTeamsQuery,
  type TeamApiClientOptions,
  type UpdateTeamRequest,
} from './teams.ts'
export {
  createEmployeeApiClient,
  employeeApi,
  type CreateEmployeeRequest,
  type EmployeeApiClientOptions,
  type ListEmployeesQuery,
  type UpdateEmployeeRequest,
} from './employees.ts'
export {
  createLeaveEntitlementApiClient,
  leaveEntitlementApi,
  type CreateLeaveEntitlementRequest,
  type LeaveEntitlementApiClientOptions,
  type ListLeaveEntitlementsQuery,
  type UpdateLeaveEntitlementRequest,
} from './leaveEntitlements.ts'
export {
  createLeaveRequestApiClient,
  leaveRequestApi,
  type CreateLeaveRequestPayload,
  type LeaveRequestApiClientOptions,
  type ListLeaveRequestsQuery,
  type UpdateLeaveRequestPayload,
  type LeaveRequestListItem,
} from './leaveRequests.ts'
