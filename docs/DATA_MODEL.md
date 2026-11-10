# Data Model Proposal (prototype)

This is a starting point for team review, not a final production schema.

## Entities
- `Employee`: id, displayName, email (synthetic), teamId, managerId, legalEntity (`VIRGO_KFT` | `VIRGO_ZRT`), hireDate, birthDate (synthetic), active.
- `Team`: id, name, managerId.
- `LeaveEntitlement`: id, employeeId, year, leaveType, annualDays, source (`calculated` | `hr_manual`), adjustmentReason, createdBy.
- `QuarterBalanceSnapshot` (or derived view): employeeId, year, quarter, openingDays, accruedOrAllocatedDays, usedDays, closingDays. Confirm allocation formula before treating as authoritative.
- `LeaveRequest`: id, employeeId, approverId, leaveType, startDate, endDate, partOfDay (`FULL` | `AM` | `PM`), status, employeeComment, managerComment, submittedAt, decidedAt, cancelledAt, cancellationActorId.
- `LeaveDay` (optional normalized form): requestId, date, partOfDay, balanceDeductionDays, payrollAccountingDays.
- `AuditEvent`: id, actorId, entityType, entityId, action, timestamp, reason, before/after summary.
- `HolidayCalendarDay`: date, kind (`PUBLIC_HOLIDAY` | `REST_DAY` | `WORKING_DAY` | `COMPANY_CLOSED`), label, sourceVersion.

## Important design notes
- Store annual entitlement separately from quarter display/allocation.
- Store balance deduction and payroll value separately (half-day rule).
- Half-day pairing should be derived from active approved requests per employee and calendar month; do not persist an easily stale “first/second” flag as the only truth.
- Keep leave type, legal entity and status as enums.
- Do not infer entitlement values from age in the UI; calculate in a domain service and cover with tests.
- Keep an audit trail for manual HR corrections and admin revocations.
- Avoid storing unnecessary sensitive personal data in a demo. Birth dates should be synthetic and minimized.
