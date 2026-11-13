# Business Rules & Decision Log

**Product:** LeaveIt — *Leave it to us.*  
**Status:** Working specification for prototype; unresolved items are explicitly marked.

## 1. Annual and quarterly leave balances
- The employee's full annual entitlement is also displayed in a Q1–Q4 breakdown for tracking time-proportional usage. Quarters are not independent annual entitlements.
- Unused balance carries forward from Q1 to Q2, Q2 to Q3, and Q3 to Q4.
- At year-end, only unused age-based additional leave may carry into the next year. Other Q4 remainder expires, subject to final HR/payroll confirmation if policy changes.
- Age-based additional leave is generated automatically. The entitlement applies in the calendar year in which the employee reaches the relevant age threshold, even if the birthday is on 31 December.
- Child-related additional leave is entered manually by HR based on the employee's annual declaration; do not calculate it automatically.
- For a mid-year joiner, add the full-year base and additional entitlements first, prorate by employment time in the calendar year, then round: fraction > 0.5 rounds up; fraction < 0.5 rounds down. Exactly 0.5 is not specified; keep configurable / flag for HR confirmation. HR can apply a manual correction. Payroll-provided values may be used as a double-check.
- Pending requests do not reserve or reduce available balance.

## 2. Requests and approvals
- Every leave request requires manager approval; no automatic approval.
- Approved requests cannot be edited in place. The employee cancels (stornoes) the future request and submits a new one.
- Employee may cancel their own approved request only before its start date.
- HR Admin may revoke/cancel on behalf of the employee; preserve the audit trail.
- Prototype policy: manager decision due within 3 working days. Send a reminder on the morning of the final due date if still pending. Exceeding the deadline never auto-approves or auto-rejects.
- Rejected/cancelled/revoked requests remain in history and do not consume balance.

## 3. Half-day leave and payroll pairing
- Half-day requests distinguish AM and PM.
- Each approved half-day consumes 0.5 day from the employee's leave balance.
- Within each calendar month, approved and active half-days are sorted chronologically. The first active half-day in the month has payroll value 1 day; the second has payroll value 0 days. Pairing restarts each month.
- If an earlier half-day is cancelled before it takes place, recalculate the chronological order of remaining active half-days. The remaining half-day becomes first for payroll (1 day).
- Do not allow retrospective edits. Before the leave starts, cancellation is allowed under the same rules as full-day leave.
- Store balance deduction and payroll value separately; never represent both with a single `days` field.
- Pairing eligibility should be based on approved, non-cancelled requests. Confirm edge cases with payroll before production.

## 4. Access and entities
- Roles: Employee, Manager, HR Admin.
- **Teams (confirmed 2026-11-13):** everyone belongs to exactly one team, defined by who approves their leave (their direct manager). A manager is a member of their own manager's team.
- Managers can see only their direct team's leave data and can see the leave reason/type.
- HR Admin can manage employees in both Virgo Kft. and Virgo Zrt.
- The two legal entities follow the same leave rules but remain separate employee attributes for filtering and reporting.
- Enforce authorization in the backend in production; a client-side role switch is demo-only.
- **Manager delegation (confirmed 2026-11-13):** if A manages B and C is A's deputy, C gets A's **manager rights** over A's direct team (approve/reject, team calendar, leave type) **only on days A has approved leave**.
  - All of A's deputies get the rights; no chaining (C's deputies get nothing from A).
  - MANAGER rights only, never HR Admin rights.
  - C can never decide on C's own request (prototype: it waits for A, see Q19).
  - C acts in a **separate "Helyettesítés" view**, never mixed with C's own team.
  - The decision records `onBehalfOf = A`; audit shows who acted for whom.
- **UI language (confirmed 2026-11-13):** the whole user interface is Hungarian. Code, docs and commits stay English.

## 5. Non-working days and SLA calendar
- Leave cannot be booked on Hungarian public holidays or statutory non-working days.
- **Recommendation for prototype:** use a versioned Hungarian working-day calendar dataset that includes public holidays, substitute rest days and transferred working Saturdays. For the 3-working-day approval SLA, count Monday–Friday only when the date is a working day; skip statutory rest days and weekends, but count officially designated working Saturdays.
- Keep calendar data separate from business logic so HR can correct exceptional company-specific non-working days.
- Do not rely on a browser's locale or a hard-coded weekday-only calculation.
- Production should use a maintained, HR-approved calendar source and define how calendar updates are applied.

## 6. Leave types from source brief
Base leave; age-based additional leave; child-related additional leave; paternity leave; extraordinary leave; paid leave; sick leave (up to 15 days); sick pay / táppénz (after 15 days). Exact entitlements and payroll export mapping need HR confirmation.

## 7. Deputy (substitute) availability — confirmed 2026-11-13
- An employee can have **multiple deputies**. Employees without deputies are not checked.
- **Planned leave only** (ANNUAL, EXTRAORDINARY, UNPAID) is blocked. SICK_LEAVE, SICK_PAY and PATERNITY are never blocked.
- A requested working day is **blocked if ALL of the requester's deputies are away** that day.
- "Away" = the deputy has an **APPROVED**, active leave on that day (any leave type). Pending deputy requests do not block.
- **One-way:** only the requester's own deputies matter. Being someone else's deputy does not restrict your leave.
- Checked at **submission** and **re-checked at manager approval**; the manager cannot approve if a conflict appeared in the meantime.
- **Privacy:** the employee is told only *that* there is a conflict and on which dates — never the deputy's name, position or leave type.
- Alternative dates are calculated deterministically (working days, deputies available, enough balance). The **AI helper only words the message**; it receives dates only, never decides, and a non-AI fallback text always exists.
- Open details: see `OPEN_QUESTIONS.md` Q13–Q16.

## 8. Open questions / not yet specified
- Exact treatment when a prorated result is exactly x.5 (the response says above/below 0.5 but does not explicitly state the tie).
- Detailed Q1–Q4 allocation formula and whether quarterly display is based on calendar days, working days, or payroll-specific allocation.
- Whether the Q4 carryover rule has any expiry/use-by date in the next year.
- Payroll export columns, grouping, codes, file format, and period rules (awaiting Zsuzsanna).
- Half-day pairing edge cases: multiple half-days, AM/PM ordering on same date, cancellation after payroll export, and whether all leave types are eligible.
- Exact rules for sickness, paternity, extraordinary leave and other leave types.
- Official source / process for maintaining Hungarian working-day calendar.
- Reminder delivery channel and exact time/time zone.
- Whether a manager's 3-working-day SLA is measured from submission timestamp or next working day. Prototype assumption: submission day excluded if submitted after working hours; confirm with HR.
- Company-specific closure days and approval delegation / out-of-office cover.
