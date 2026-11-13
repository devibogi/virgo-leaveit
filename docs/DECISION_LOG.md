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
| D7 | 2026-11-13 | Leave type behaviour is config data (`LeaveType`), not hard-coded | Mapping and deduction rules confirmed in D19 |
| D8 | 2026-11-13 | ~~Single `AppState` with `schemaVersion` for localStorage~~ — superseded by D15; `AppState` remains the seed/snapshot shape | |
| D9 | 2026-11-13 | Deputies stored as `Employee.deputyIds[]`; `LeaveType.deputyCheckApplies` flags planned leave | Multiple deputies, one-way rule, leave-type scope as config |
| D10 | 2026-11-13 | Deputy check and date suggestions are deterministic domain functions; AI only words the message from `DeputyConflictAiInput` (dates only) with a non-AI fallback | AI is never the authority; privacy enforced by the type |
| D11 | 2026-11-13 | `schemaVersion` stays 1 for the deputy fields | Nothing persisted yet; bump from the first shape change after seed data ships |
| D12 | 2026-11-13 | Delegation is derived (`ActiveDelegation`), not a new `Role`; reuses `deputyIds` | No extra persisted state; rights end automatically when the manager's leave ends |
| D13 | 2026-11-13 | `Approval.onBehalfOf` and `AuditEvent.onBehalfOf` record deputy decisions | Traceability: who decided vs whose authority |
| D14 | 2026-11-13 | Hungarian UI strings in `src/i18n/hu.ts`; no i18n library | Single language; one place for wording; dates as `YYYY. MM. DD.` |
| D15 | 2026-11-13 | Persistence: MariaDB 11.4 (`db/schema.sql`) behind a Node backend API (`server/`, `mariadb` driver); replaces localStorage | Team decision; real DB, server-side access checks possible |
| D16 | 2026-11-13 | `Employee.includeInPayrollExport` (DB default TRUE) controls payroll export inclusion only | Team decision; HR can exclude people from bérszámfejtés export |
| D17 | 2026-11-13 | Sign-in via LDAP bind in the backend (`ldapts`), email match to `employee`, roles from DB; server-side session; `AUTH_MODE=demo\|ldap` | Team decision; one source of truth for permissions; demo still works without a directory |
| D18 | 2026-11-13 | Amends D3: `LeaveEntitlement` caches `usedQ1`–`usedQ4`, `usedYear` per component row | Performance. Redundant: only written by a full recompute in the same transaction (DATA_MODEL "Usage cache") |
| D19 | 2026-11-13 | HR/payroll answers applied: 6 leave types with `category` LEAVE/SICK and `approverRole`; half-day pair counts on the **second** half-day (supersedes "first = 1, second = 0"); non-HR viewers see only the category (supersedes "managers see the leave type"); monthly Excel export per template; `Employee.taxId` | Confirmed by Zsuzska (payroll); visibility choice by project owner |
| D20 | 2026-11-13 | `schemaVersion` bumped to 2 (amends D11) | First shape change after D11: leave type enum, `LeaveType.category`/`approverRole`, `Employee.taxId` |
