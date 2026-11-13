# Data Model (prototype contract)

**Source of truth in code:** [`src/types/model.ts`](../src/types/model.ts). This document explains it. Changing the types changes a team-wide contract — coordinate before editing.

## Conventions
- IDs are stable strings (e.g. `emp-peter`, `req-0001`).
- `IsoDate` = `YYYY-MM-DD` (no time zone); `IsoDateTime` = ISO 8601 with offset.
- **Persisted** entities live in **MariaDB** ([`db/schema.sql`](../db/schema.sql)) behind a backend API; `AppState` is the seed/snapshot shape. **Derived** views are computed by domain functions and never stored as truth.
- Balance deduction and payroll accounting are always separate fields.
- Nothing is hard-deleted; status changes keep history.

## Persisted entities

| Entity | Key fields | Notes |
|---|---|---|
| `LegalEntity` | `id` (`VIRGO_KFT` \| `VIRGO_ZRT`), `name` | Same leave rules for both. |
| `Employee` | `id`, `displayName`, `email`, `legalEntityId`, `managerId`, `roles[]`, `birthDate`, `employmentStart`, `employmentEnd`, `includeInPayrollExport`, `deputyIds[]` | `includeInPayrollExport` (default `true`): `false` excludes the employee from the payroll (bérszámfejtés) export only; leave, balance and approvals work as usual. `deputyIds`: people who cover for this employee (one-way; empty = no deputy check). Also used for manager delegation: while a manager is on approved leave, their deputies get MANAGER rights over the manager's team (see `ActiveDelegation`). `managerId` is the **only** source for manager permissions (direct team = employees whose `managerId` = me). `roles` always includes `EMPLOYEE`; Katalin is `EMPLOYEE`+`MANAGER`, Piri is `EMPLOYEE`+`HR_ADMIN`. Synthetic data only. |
| `Team` | `managerId` (key), `name` | Display name only. **Membership is derived:** team of M = employees whose `managerId` = M (= who approves their leave). Everyone is in exactly one team; a manager is in their own manager's team. No `teamId` on `Employee`. |
| `LeaveType` | `code`, `label`, `deductsFromAnnualBalance`, `halfDayAllowed`, `payrollCode`, `deputyCheckApplies` | `deputyCheckApplies` true for planned leave (ANNUAL, EXTRAORDINARY, UNPAID), false for SICK_LEAVE, SICK_PAY, PATERNITY. Config data, not hard-coded logic. Values are provisional (see Open Questions). |
| `LeaveEntitlement` | `employeeId`, `year`, `component`, `fullYearDays`, `calculatedDays`, `overrideDays`, `overrideReason`, `payrollReferenceDays`, `usedQ1`–`usedQ4`, `usedYear` | One row per employee/year/component. Effective = `overrideDays ?? calculatedDays`. `payrollReferenceDays` is for double-checking only. `used*` = **redundant cache**, see "Usage cache" below. |
| `LeaveRequest` | `employeeId`, `legalEntityId`, `approverId`, `leaveTypeCode`, `startDate`, `endDate`, `dayPortion`, `status`, `employeeComment`, `submittedAt`, `approval`, `cancellation` | `legalEntityId` and `approverId` are snapshots at submission. AM/PM ⇒ `startDate === endDate`. |
| `Approval` (embedded) | `decision`, `decidedBy`, `onBehalfOf`, `decidedAt`, `comment` | One manager decision per request; no auto-decisions. `onBehalfOf` = approver when a deputy decided. |
| `Cancellation` (embedded) | `kind` (`CANCELLED` employee / `REVOKED` HR), `cancelledBy`, `cancelledAt`, `reason` | |
| `AuditEvent` | `at`, `actorId`, `actorRole`, `onBehalfOf`, `action`, `entityType`, `entityId`, `reason`, `details` | Append-only. Includes simulated SLA reminders and exports. |

### Entitlement components
`BASE` · `AGE_ADDITIONAL` (calculated from age) · `CHILD_ADDITIONAL` (HR manual, from annual declaration; `calculatedDays` is `null`) · `AGE_ADDITIONAL_CARRYOVER` (previous year's unused age-based leave; consumed first, no expiry).

### Request status lifecycle
```
PENDING ──approve──▶ APPROVED ──employee cancels before start──▶ CANCELLED
   │                    └────────HR revokes────────────────────▶ REVOKED
   └──reject──▶ REJECTED
```
Only `APPROVED` consumes balance. `PENDING` reserves nothing. Approved requests are never edited: cancel + submit a new request.

## Calendar dataset
File: `data/calendar/hu-working-days-2026-2027.v1.json` (**not yet in the repo**), shape `CalendarDataset`:
`version`, `country`, `years`, `source`, `reviewedByHr`, `overrides[]` with `{ date, kind: PUBLIC_HOLIDAY | REST_DAY | WORKING_DAY, label }`.
Default: Mon–Fri working, Sat–Sun non-working; overrides win. The calendar service resolves it to `CalendarDay { date, isWorkingDay, override }`.

## Derived views (computed)
| View | Computed from | Notes |
|---|---|---|
| `LeaveDay` | Active requests × working-day calendar | One row per working day: `balanceDeduction` (1 / 0.5 / 0) and `payrollValue` (half-day pairing: 1st active in month = 1, 2nd = 0). Never persist a "first/second" flag. |
| `LeaveBalance` | Entitlements (reads the `used*` cache) + approved `LeaveDay`s | `totalEntitlement`, `used`, `pending` (info only), `available`, `quarters[]`. |
| `QuarterBalance` | `LeaveBalance` | `allocated`, `carriedIn`, `used`, `remaining`. Allocation formula is open — provisional. |
| SLA due date | `submittedAt` + 3 working days | Computed via calendar service; not stored. |
| `CalendarDay` | Calendar dataset | See above. |
| `DeputyCheckResult` | Request × requester's `deputyIds` × deputies' **approved** `LeaveDay`s × calendar | `blocked`, `conflictDates[]`, `suggestions[]`. Dates only — no deputy identity, position or leave type. Computed at submit and re-checked at approval. |
| `ActiveDelegation` | Manager's `deputyIds` × manager's approved `LeaveDay`s | `{managerId, deputyId, date}`: deputy holds the manager's MANAGER rights over the direct team that day; never over own requests. Drives the separate "Helyettesítés" view. |
| `DateSuggestion` | Same inputs + requester's balance and own requests | Deterministic alternative windows (same working-day count, no conflict, enough balance), closest first. |
| `DeputyConflictAiInput` | `DeputyCheckResult` + requested dates | The **only** payload allowed to reach the AI helper (wording only). |

## Persistence (MariaDB)
Schema: [`db/schema.sql`](../db/schema.sql). One table per persisted entity; derived views are **not** tables.

| Table | From type | Notes |
|---|---|---|
| `legal_entity` | `LegalEntity` | |
| `employee` | `Employee` | `include_in_payroll_export BOOLEAN NOT NULL DEFAULT TRUE`; `manager_id` self-FK |
| `employee_role` | `Employee.roles[]` | PK (employee, role) |
| `employee_deputy` | `Employee.deputyIds[]` | PK (employee, deputy); CHECK no self-deputy |
| `team` | `Team` | PK `manager_id` |
| `leave_type` | `LeaveType` | config rows |
| `leave_entitlement` | `LeaveEntitlement` | UNIQUE (employee, year, component); `used_q1..q4`, `used_year` cache with CHECK `used_year = sum` |
| `leave_request` | `LeaveRequest` + embedded `Approval`, `Cancellation` | nullable approval/cancellation columns |
| `audit_event` | `AuditEvent` | append-only (no UPDATE/DELETE from the app) |

- Charset `utf8mb4`, collation `utf8mb4_hungarian_ci` (Hungarian sorting).
- Day values `DECIMAL(5,1)` (half-days). Timestamps stored as UTC `DATETIME(3)`; API returns ISO 8601.
- The calendar dataset stays a versioned JSON file, not a table.
- `AppState` = seed/fixture shape; bump `schemaVersion` together with schema changes.

## Design notes
- All UI text is Hungarian and lives in `src/i18n/hu.ts`; type codes stay English.
- Deputy privacy is enforced by the types: conflict results carry dates only, so UI and AI layers cannot leak who is away or why.
- Do not infer entitlement in the UI; domain functions calculate it and are unit-tested.
- Minimize personal data even though it's synthetic (birth date is only for age-based leave).
- Production needs a backend, database, server-side authorization and a real audit trail; this model maps 1:1 to tables.

## Usage cache (`usedQ1`–`usedQ4`, `usedYear`) — redundant, handle with care
Stored on every `LeaveEntitlement` row for performance (D18, amends D3). Source of truth stays the approved requests × calendar.

- **Meaning:** days of *this component* consumed by APPROVED, balance-deducting `LeaveDay`s, by the quarter the day falls in. `usedYear = Q1+Q2+Q3+Q4` (DB CHECK).
- **Allocation:** days in date order fill components in `CONSUMPTION_ORDER` = carryover → base → age → child, each up to `overrideDays ?? calculatedDays`. A half-day may split. Order confirmed 2026-11-13 (BUSINESS_RULES §1). Excess goes on BASE (negative balance) — provisional, Q24.
- **Only writer:** `recomputeEntitlementUsage()` in `src/domain/entitlementUsage.ts`. Always a **full recompute of all rows of one (employee, year)**, written in the **same DB transaction** as the change. Never increment/decrement, never edit by hand.
- **Must recompute when:**
  - request becomes APPROVED, or leaves APPROVED (CANCELLED / REVOKED) → that employee, every year the request touches;
  - entitlement `calculatedDays` / `overrideDays` changes, or a component row is added → that employee + year;
  - `LeaveType.deductsFromAnnualBalance` changes → everyone, affected years;
  - working-day calendar dataset changes → everyone, affected years (DB triggers can't do this: the calendar is a JSON file);
  - `employmentStart` / `employmentEnd` changes → that employee, affected years.
- **Safety net:** `isUsageCacheConsistent()` in tests and an HR/admin "recompute all" job; a mismatch is a bug, fix by recompute.
