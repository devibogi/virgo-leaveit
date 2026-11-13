# Decision Log

Architectural and technical decisions. Business rules live in `BUSINESS_RULES.md`; open items in `OPEN_QUESTIONS.md`.

| # | Date | Decision | Reason |
|---|---|---|---|
| D1 | 2026-11-13 | Shared types live in `src/types/model.ts`; it is the data contract for all workstreams | One place to agree on before splitting tasks |
| D2 | 2026-11-13 | Team = people with the same approver (`Employee.managerId`); no `teamId`; `Team` keyed by `managerId`, name only | One team per person, by who approves their leave; one source of truth for team and permissions |
| D3 | 2026-11-13 | Balances, leave days, payroll values, quarter view and SLA due dates are derived, not persisted | Prevents stale values (e.g. half-day first/second after cancellation) |
| D4 | 2026-11-13 | `LeaveDay` carries `balanceDeduction` and `payrollValue` as separate fields | Confirmed rule: deduction and payroll accounting differ for half-days |
| D5 | 2026-11-13 | Entitlement stored per component with `calculatedDays` + `overrideDays` + `payrollReferenceDays` | Supports automatic calculation, HR manual correction and payroll double-check |
| D6 | 2026-11-13 | Request snapshots `legalEntityId` and `approverId` at submission | Stable reporting and approval routing if org data changes |
| D7 | 2026-11-13 | Leave type behaviour is config data (`LeaveType`), not hard-coded | Payroll mapping and deduction rules are still open |
| D8 | 2026-11-13 | Single `AppState` with `schemaVersion` for localStorage | Simple demo persistence; reset on shape change |
| D9 | 2026-11-13 | Deputies stored as `Employee.deputyIds[]`; `LeaveType.deputyCheckApplies` flags planned leave | Multiple deputies, one-way rule, leave-type scope as config |
| D10 | 2026-11-13 | Deputy check and date suggestions are deterministic domain functions; AI only words the message from `DeputyConflictAiInput` (dates only) with a non-AI fallback | AI is never the authority; privacy enforced by the type |
| D11 | 2026-11-13 | `schemaVersion` stays 1 for the deputy fields | Nothing persisted yet; bump from the first shape change after seed data ships |
| D12 | 2026-11-13 | Delegation is derived (`ActiveDelegation`), not a new `Role`; reuses `deputyIds` | No extra persisted state; rights end automatically when the manager's leave ends |
| D13 | 2026-11-13 | `Approval.onBehalfOf` and `AuditEvent.onBehalfOf` record deputy decisions | Traceability: who decided vs whose authority |
| D14 | 2026-11-13 | Hungarian UI strings in `src/i18n/hu.ts`; no i18n library | Single language; one place for wording; dates as `YYYY. MM. DD.` |
