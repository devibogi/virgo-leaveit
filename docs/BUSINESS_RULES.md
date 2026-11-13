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

## 2. Requests and approvals
- Every leave request requires approval; no automatic approval. The direct manager decides, except **unpaid leave (UNPAID), which HR Admin approves** (HR wish 2026-11-13; flow details Q25).
- Approved requests cannot be edited in place. The employee cancels (stornoes) the future request and submits a new one.
- Employee may cancel their own approved request only before its start date.
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
- **Teams (confirmed 2026-11-13):** everyone belongs to exactly one team, defined by who approves their leave (their direct manager). A manager is a member of their own manager's team.
- Managers can see only their direct team's leave data.
- **Leave type visibility (confirmed 2026-11-13, D19, replaces "managers see the leave type"):** everyone except HR Admin — colleagues, team calendar, managers and acting deputies — sees only the **category**: "Szabadság" or "Beteg". Only HR Admin (and the employee for their own requests) sees the exact leave type.
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
| `OTHER` | Egyéb (pl. temetési szabadság) | LEAVE (Szabadság) | no | yes | Manager | no (assumption, Q30) |
| `SICK_LEAVE` | Betegszabadság | SICK (Beteg) | no | no | Manager | no |
| `CHILD_SICK_LEAVE` | Gyermekápolási szabadság | SICK (Beteg) | no | no | Manager | no |

- Paternity leave is **not** a LeaveIt type. FUNERAL is folded into `OTHER`; there is no separate táppénz (`SICK_PAY`) type (D21; conflicts with the sick pool below, Q37).
- **Sick-leave pool:** 15 days of betegszabadság per calendar year, prorated for joiners/leavers; after that, absence is táppénz (proration rounding and the day-16 switch: Q32).
- **Payroll categories:** only two groups, "Szabadság" and "Betegszabadság/táppénz". Medical-certificate subtypes are not LeaveIt's concern.

## 6a. Payroll export — confirmed 2026-11-13
- **Monthly Excel (.xlsx)** matching the template [`docs/samples/payroll_template_2026.csv`](samples/payroll_template_2026.csv).
- Header row 1: `Cégnév` (legal entity), then group headers `Szabadság` and `Betegszabadság/táppénz`. Row 2: periods 1–5 per group. Row 3: `Dolgozó neve`, `Adóazonosító jel`, then `Tól`/`Ig` pairs, 5 per group.
- One row per registered employee with `includeInPayrollExport = true`; `Adóazonosító jel` = `Employee.taxId`.
- `Tól`/`Ig` are day-of-month numbers of the exported month. A half-day pair appears on the second half-day's date.
- One block/sheet per legal entity (assumption: one sheet per `Cégnév`).
- Open details: Q26–Q29, Q31, Q33.

## 7. Deputy (substitute) availability — confirmed 2026-11-13
- An employee can have **multiple deputies**. Employees without deputies are not checked.
- **Planned leave only** (ANNUAL, UNPAID) is blocked. SICK_LEAVE, CHILD_SICK_LEAVE and OTHER are never blocked (OTHER: assumption, Q30).
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
