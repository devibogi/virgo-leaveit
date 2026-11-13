# Business Rules & Decision Log

**Product:** LeaveIt — *Leave it to us.*  
**Status:** Working specification for prototype; unresolved items are explicitly marked.

## 1. Annual and quarterly leave balances
- The employee's full annual entitlement is also displayed in a Q1–Q4 breakdown for tracking time-proportional usage. Quarters are not independent annual entitlements.
- Unused balance carries forward from Q1 to Q2, Q2 to Q3, and Q3 to Q4.
- At year-end, only unused age-based additional leave may carry into the next year. Other Q4 remainder expires, subject to final HR/payroll confirmation if policy changes.
- Age-based additional leave is generated automatically. The entitlement applies in the calendar year in which the employee reaches the relevant age threshold, even if the birthday is on 31 December.
- Child-related additional leave is entered manually by HR based on the employee's annual declaration; do not calculate it automatically.
- For a mid-year joiner, add the full-year base and additional entitlements first, prorate by employment time in the calendar year, then round: fraction > 0.5 rounds up; fraction < 0.5 rounds down. Exactly 0.5 rounds up (resolved, OPEN_QUESTIONS). HR can apply a manual correction. Payroll-provided values may be used as a double-check.
- Pending requests do not reserve or reduce available balance.
- **Quarterly breakdown (confirmed 2026-11-13):** the annual entitlement is split evenly, time-proportionally across Q1–Q4.
- **Leaver proration (confirmed 2026-11-13):** entitlement = annual entitlement / calendar days of the year (365, or 366 in a leap year) × calendar days employed in that year. Rounding of the result: see Q32.
- **Overdrawn at exit (confirmed 2026-11-13):** if a leaver has used more than the prorated entitlement, nothing happens (no clawback, no financial deduction). The system shows the prorated limit and warns when it is exceeded.
- **Only paid leave (ANNUAL) reduces the annual balance (confirmed 2026-11-13).**
- **Consumption order (confirmed 2026-11-13):** approved leave uses entitlement components in this order: age-based carryover from the previous year → base → age-based additional → child-related additional. (Payroll mentioned base → additional → other; the project owner kept the order above, which only adds the carryover in front.)
- **Default entitlements for everyone (product-owner request 2026-11-13; HR confirmation pending):** when entitlements for a year are read, every employee employed in that year gets BASE (20 days, Mt. §116) and AGE_ADDITIONAL (statutory Mt. §117 table: age reached in the year 25→1, 28→2, 31→3, 33→4, 35→5, 37→6, 39→7, 41→8, 43→9, 45+→10) if missing. Days are prorated by calendar days employed in the year, fraction ≥ 0.5 rounds up. Rows are persisted (updatedBy `system`) and HR can override them. CHILD_ADDITIONAL is never generated. The age table is statutory, not yet confirmed by HR. Young workers (age ≤ 18 in the year, Mt. §118(4)) get 5 days instead of the age table — statutory, unverified, HR confirmation pending. The 2023 bill T/4740 (age days up to 63) was never enacted; the cap stays 10 days from 45. For HR reference only, `childAdditionalDays` implements Mt. §118(1)-(2): children under 16, 1→2, 2→4, 3+→7 days, plus 2 per disabled child, for each parent; HR still enters CHILD_ADDITIONAL manually. Demo data: Tóth Eszter (emp-eszter, 3 children, 1 disabled) has CHILD_ADDITIONAL 9, so 20 + 6 + 9 = 35 days.
- **Used days (product-owner request 2026-11-13; HR confirmation pending):** approved leave counts as *used* only for working days up to and including today. Future approved leave is booked but not yet used. Pending, rejected, cancelled and revoked requests never count.

## 2. Requests and approvals
- Every leave request requires approval; no automatic approval. The direct manager decides, except **unpaid leave (UNPAID), which HR Admin approves** (HR wish 2026-11-13; flow details Q25).
- Approved requests cannot be edited in place. The employee cancels (stornoes) the future request and submits a new one.
- **Request submission (product-owner request 2026-11-13):** every role (Employee, Manager, HR Admin) can submit a new request, always for themselves (employeeId = signed-in user). Listing and revoking all requests stay HR Admin only. Nobody, HR Admin included, can modify a submitted request (product-owner request 2026-11-13; backend returns 405). Demo identity comes from the `X-Actor-Role`/`X-Actor-Id` headers; a real deployment must take both from a verified session.
- **Own requests page (product-owner request 2026-11-13):** every role, HR Admin included, has a separate "Saját kérelmeim" page to submit requests and see their own requests read-only. The "Összes kérelem" page (all employees' requests: filter, revoke) is a separate HR Admin-only page. Non-HR actors may list only their own requests (backend-enforced).
- **No duplicate submission (product-owner request 2026-11-13; detail is an assumption, not HR-confirmed):** a new request may not overlap a PENDING or APPROVED request of the same employee (backend 409, `findOverlappingRequest`). An AM and a PM half-day on the same date are allowed. The own requests page shows pending requests prominently, including inside the submit form.
- **Approver inbox (product-owner request 2026-11-13):** Manager and HR Admin get a "Beérkező kérelmek" page listing requests whose `approverId` is the signed-in user (`GET /api/requests?scope=incoming`), with Approve/Reject (`POST /api/requests/{id}/decision`). Backend enforces: only PENDING (409), only the snapshot approver, never the requester (403). Managers see only the category (Szabadság/Beteg) in the UI. **Assumptions, not HR-confirmed:** the rejection comment is optional. **Not yet implemented:** deputy delegation (`onBehalfOf`) and the §7 deputy re-check at approval time.
- Employee may cancel their own approved request only before its start date.
  - Implemented: "Lemondás" button on *Saját kérelmeim* for own PENDING/APPROVED requests whose start date is after today; `POST /api/requests/:id/cancel`. Pending cancel before start is an assumption (not HR-confirmed).
- HR Admin may revoke/cancel on behalf of the employee; preserve the audit trail.
- Prototype policy: manager decision due within 3 working days. Send a reminder on the morning of the final due date if still pending. Exceeding the deadline never auto-approves or auto-rejects.
- Rejected/cancelled/revoked requests remain in history and do not consume balance.

## 3. Half-day leave and payroll pairing
- Half-day requests distinguish AM and PM.
- Each approved half-day consumes 0.5 day from the employee's leave balance.
- **Payroll pairing (confirmed 2026-11-13, D19, replaces the earlier "first = 1, second = 0" rule):** within each calendar month, approved and active half-days are sorted chronologically and paired. The **second half-day of a pair completes it**: the pair counts as 1 day and is exported **on the date of the second half-day** (first of the pair = 0, second = 1). Pairing restarts each month.
- An unpaired (odd) last half-day in a month: see Q26.
- If a half-day is cancelled before it takes place, re-pair the remaining active half-days chronologically.
- **Half-days are not allowed for sick types** (SICK_LEAVE, CHILD_SICK_LEAVE).
- A half-day revoked or changed after it was already exported is written out in the export (correction handling: Q31).
- Do not allow retrospective edits. Before the leave starts, cancellation is allowed under the same rules as full-day leave.
- Store balance deduction and payroll value separately; never represent both with a single `days` field.
- Pairing eligibility is based on approved, non-cancelled requests.

## 4. Access and entities
- Roles: Employee, Manager, HR Admin.
- **Teams (confirmed 2026-11-13, updated 2026-11-13):** an employee belongs to at most one team and is managed through it (the team's manager approves their leave). A manager may lead several teams (demo: Nagy Katalin leads "Fejlesztési csapat" and "Minőségbiztosítás"). A manager is a member of their own manager's team.
- **Team deputy (confirmed 2026-11-13: required, one per team):** every team must have a deputy (`Team.deputyId`) who stands in for the team's manager. *Assumption (not confirmed):* the deputy may be any employee other than the manager; the team deputy is not yet wired into approval delegation, which still uses the manager's `deputyIds`. New-team form also lets HR pick initial members (moving them from their current team).
- Managers can see only their direct team's leave data.
- **Leave type visibility (confirmed 2026-11-13, D19, replaces "managers see the leave type"):** everyone except HR Admin — colleagues, team calendar, managers and acting deputies — sees only the **category**: "Szabadság" or "Beteg". Only HR Admin (and the employee for their own requests) sees the exact leave type.
- **Entitlement visibility (product-owner request 2026-11-13):** every role, HR Admin included, sees their own entitlements read-only (per component, total/used/remaining days). A manager also sees each direct report's total / used / remaining days as **numbers only** — no component and no leave type — on a separate "Csapatom szabadságkerete" page (product-owner request 2026-11-13). Editing entitlements stays HR Admin only, on a separate "Összes szabadságkeret" page (HR Admin's own entitlements stay on the "Saját szabadságkeretem" page); the create form there is hidden until HR clicks "+ Új szabadságkeret".
- **Teams view (product-owner request 2026-11-13):** only HR Admin sees and manages the Teams page. HR Admin can move any employee to another team on that page ("Csapattagság"); this sets the employee's `teamId` and their `managerId` to the team's manager. Assignments that would create a management cycle are rejected (backend-enforced). The create-team form is hidden until HR clicks "+ Új csapat". Open: whether already pending requests move to the new manager as approver (currently `approverId` stays as set at submission; not HR-confirmed).
- **Employees page (product-owner request 2026-11-13):** hidden from the Employee role. Managers see a read-only list of their direct reports without personal fields (birth date, tax id — assumption, not HR-confirmed) and without legal entity or employment start date (product-owner requests 2026-11-13, GDPR). Creating/editing employees stays HR Admin only (backend-enforced); the create form is hidden until HR clicks "+ Új munkavállaló".
- HR Admin can manage employees in both Virgo Kft. and Virgo Zrt.
- The two legal entities follow the same leave rules but remain separate employee attributes for filtering and reporting.
- Enforce authorization in the backend in production; a client-side role switch is demo-only.
- **Sign-in (confirmed 2026-11-13):** users sign in with their company LDAP account. LDAP only proves identity; the user is matched to an `employee` row by email. Roles (`employee_role`) and team/manager rights (`managerId`, delegation) come from the LeaveIt database, not from LDAP groups. LDAP user with no matching active employee → access denied.
- **Manager delegation (confirmed 2026-11-13):** if A manages B and C is A's deputy, C gets A's **manager rights** over A's direct team (approve/reject, team calendar; category only, not the exact type) **only on days A has approved leave**.
  - All of A's deputies get the rights; no chaining (C's deputies get nothing from A).
  - MANAGER rights only, never HR Admin rights.
  - C can never decide on C's own request (prototype: it waits for A, see Q19).
  - C acts in a **separate "Helyettesítés" view**, never mixed with C's own team.
  - The decision records `onBehalfOf = A`; audit shows who acted for whom.
- **Payroll export flag (confirmed 2026-11-13):** each employee has "include in payroll (bérszámfejtés) export", default yes. If no, the employee's leave is left out of the payroll export; everything else is unchanged.
- **UI language (confirmed 2026-11-13):** the whole user interface is Hungarian. Code, docs and commits stay English.
- **No technical IDs in the UI (product-owner request 2026-11-13):** people are always shown and picked by name; employee/request IDs and internal field or code names are never displayed.

## 5. Non-working days and SLA calendar
- Leave cannot be booked on Hungarian public holidays or statutory non-working days.
- **Recommendation for prototype:** use a versioned Hungarian working-day calendar dataset that includes public holidays, substitute rest days and transferred working Saturdays. For the 3-working-day approval SLA, count Monday–Friday only when the date is a working day; skip statutory rest days and weekends, but count officially designated working Saturdays.
- Keep calendar data separate from business logic so HR can correct exceptional company-specific non-working days.
- Do not rely on a browser's locale or a hard-coded weekday-only calculation.
- Production should use a maintained, HR-approved calendar source and define how calendar updates are applied.

## 6. Leave types — list per product-owner request 2026-11-13 (D21; HR confirmation pending, Q37)
| Code | Hungarian | Category | Reduces annual balance | Half-day | Approver | Deputy check |
|---|---|---|---|---|---|---|
| `ANNUAL` | Fizetett szabadság | LEAVE (Szabadság) | yes | yes | Manager | yes |
| `UNPAID` | Fizetés nélküli szabadság | LEAVE (Szabadság) | no | yes | **HR Admin** | yes |
| `FUNERAL` | Temetési szabadság | LEAVE (Szabadság) | no | yes | Manager | no (assumption, Q30) |
| `SICK_LEAVE` | Betegszabadság | SICK (Beteg) | no | no | Manager | no |
| `CHILD_SICK_LEAVE` | Gyermekápolási szabadság | SICK (Beteg) | no | no | Manager | no |

- Paternity leave is **not** a LeaveIt type. There is no OTHER (Egyéb) type; FUNERAL is its own type (product-owner request 2026-11-13; attributes not HR-confirmed — Mt. 146 may limit it to 2 days, Q37); there is no separate táppénz (`SICK_PAY`) type (D21; conflicts with the sick pool below, Q37).
- **Sick-leave pool:** 15 days of betegszabadság per calendar year, prorated for joiners/leavers; after that, absence is táppénz (proration rounding and the day-16 switch: Q32).
- **Payroll categories:** only two groups, "Szabadság" and "Betegszabadság/táppénz". Medical-certificate subtypes are not LeaveIt's concern.

## 6a. Payroll export — confirmed 2026-11-13
- **Monthly Excel (.xlsx)** matching the template [`docs/samples/payroll_template_2026.csv`](samples/payroll_template_2026.csv).
- Header row 1: `Cégnév` (legal entity), then group headers `Szabadság` and `Betegszabadság/táppénz`. Row 2: periods 1–5 per group. Row 3: `Dolgozó neve`, `Adóazonosító jel`, then `Tól`/`Ig` pairs, 5 per group.
- One row per registered employee with `includeInPayrollExport = true`; `Adóazonosító jel` = `Employee.taxId`.
- `Tól`/`Ig` are day-of-month numbers of the exported month. A half-day pair appears on the second half-day's date.
- One block/sheet per legal entity (assumption: one sheet per `Cégnév`).
- Open details: Q26–Q29, Q31, Q33.
- **Implemented (2026-11-13):** default **.xlsx** with the template grid and the HR template workbook formatting (fonts, grey header fills, medium/thin borders, merges, column widths, frozen panes at C4; Tól/Ig and tax id as numbers); optional `format=csv` = template layout (`;`, CRLF, 25 columns, padded to 16 rows) with a UTF-8 BOM so Excel shows accents. HR Admin tab "Bérszámfejtés" → `GET /api/exports/payroll?year&month&legalEntityId[&format=xlsx|csv]` (HR_ADMIN only); xlsx writer: `src/domain/xlsx.ts` (no dependency). Logic: `src/domain/payrollExport.ts`.
- Implemented **assumptions (not HR-confirmed)**: Q26 odd last half-day of the month exported on its own date; Q27 UNPAID and FUNERAL under `Szabadság`; Q28 more than 5 periods → extra row with the same name/tax id; Q29 periods merge across non-working days only; Q33 employees without leave are listed with empty cells; `Cégnév` = legal entity name.

## 7. Deputy (substitute) availability — confirmed 2026-11-13
- An employee can have **multiple deputies**. Employees without deputies are not checked.
- **Planned leave only** (ANNUAL, UNPAID) is blocked. SICK_LEAVE, CHILD_SICK_LEAVE, and FUNERAL are never blocked (FUNERAL: assumption, Q30).
- A requested working day is **blocked if ALL of the requester's deputies are away** that day.
- "Away" = the deputy has an **APPROVED**, active leave on that day (any leave type). Pending deputy requests do not block.
- **One-way:** only the requester's own deputies matter. Being someone else's deputy does not restrict your leave.
- Checked at **submission** and **re-checked at manager approval**; the manager cannot approve if a conflict appeared in the meantime.
- **Privacy:** the employee is told only *that* there is a conflict and on which dates — never the deputy's name, position or leave type.
- Alternative dates are calculated deterministically (working days, deputies available, enough balance). The **AI helper only words the message**; it receives dates only, never decides, and a non-AI fallback text always exists.
- Open details: see `OPEN_QUESTIONS.md` Q13–Q16.

## 8. Open questions / not yet specified
All open items live in [`OPEN_QUESTIONS.md`](OPEN_QUESTIONS.md) (single source). Main ones:
- SLA start, cutoff, reminder channel/time: Q5.
- Working-day calendar source and maintenance: Q12. Company closure days: Q34.
- Delegation edge cases: Q18–Q20.
- Payroll export details, unpaid-leave approval flow, leaver/sick-pool rounding: Q25–Q33, Q35.
- Resolved since: exactly 0.5 rounds up; age-based carryover has no expiry (OPEN_QUESTIONS → Resolved).
