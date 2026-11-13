# Test Plan

## Balance and entitlement
- Age-based additional day appears in the calendar year the threshold age is reached, including a 31 December birthday.
- Child-related additional leave is not auto-calculated; HR manual entry is reflected.
- Mid-year joiner prorates full-year base + additional entitlement.
- Rounding: fraction < 0.5 rounds down; ≥ 0.5 (including exactly 0.5) rounds up.
- Pending request does not reduce available balance.
- Q1–Q3 carryover works; year-end carries only age-based additional leave.
- Quarter allocation = even, time-proportional split of the annual entitlement.
- Leaver proration: annual / 365 × days employed; leap year uses 366 (e.g. 2028).
- Leaver who used more than the prorated limit: warning shown, no deduction/clawback.
- Only ANNUAL reduces the balance; UNPAID, FUNERAL and sick types do not.

## Sick-leave pool
- 15 days betegszabadság per year; prorated for joiners/leavers.
- Day 16+ is táppénz (Q32 assumption: automatic split).
- Half-day not allowed for SICK_LEAVE, CHILD_SICK_LEAVE.

## Entitlement usage cache
- Carryover consumed first, then base, age, child (confirmed); split per quarter of the leave date.
- Half-day can split across two components; `overrideDays` wins over `calculatedDays`.
- Non-deducting types and other years ignored; excess beyond entitlement booked on BASE (Q24).
- `usedYear = Q1+Q2+Q3+Q4` (also DB CHECK).
- Approve / cancel / revoke / entitlement change / calendar change → cache equals a fresh recompute (`isUsageCacheConsistent`).

## Requests and approval
- Every request is pending until decision.
- UNPAID is decided by HR Admin, not the manager; all other types by the manager.
- Manager sees only direct-team requests.
- Rejected/cancelled/revoked requests do not consume balance.
- Employee can cancel own approved request only before start.
- `POST /api/requests/:id/cancel`: own PENDING/APPROVED with start date after today → CANCELLED (kept in history); start today/past or other status 409; not owner (HR too) 403; unknown 404 (`leaveRequestApi.cancel.test.ts`).
- HR Admin can revoke and reason is recorded.
- Approved request cannot be edited; cancel + resubmit.
- SLA reminder is shown on final due-date morning; expiry does not auto-decide.
- Approver inbox shows working days left until the SLA due date (submission + 3 working days, calendar-aware; 0 = due today, negative = overdue) (`approvalSla.test.ts`). Display only; Q5 still open.

## Calendar and validation
- Weekend and Hungarian statutory rest day cannot be booked.
- Officially designated working Saturday is treated as a working day.
- Team overlap is detected.
- Leave range crossing a holiday is handled according to agreed per-day validation.
- Date range and half-day AM/PM validation.
- Overlap with own PENDING/APPROVED request is blocked (409); AM + PM same day allowed; rejected/cancelled ignored.

## Deputy availability
- No deputies assigned → never blocked.
- One deputy with approved leave on a requested day → that day blocked; conflict date listed.
- Two deputies, only one away → not blocked; both away → blocked.
- Deputy's PENDING, REJECTED, CANCELLED or REVOKED leave → not blocked.
- SICK_LEAVE, CHILD_SICK_LEAVE, FUNERAL → never blocked; ANNUAL, UNPAID → checked.
- One-way: requester is someone else's deputy and that person is away → not blocked.
- Conflict on a weekend/holiday only → not blocked (working days only).
- Recheck: deputy's leave approved after submission → manager approval is blocked.
- Half-day portions: AM vs deputy PM → not blocked; AM vs deputy FULL → blocked (provisional, Q14).
- Result and AI input contain no deputy id, name, position or leave type.
- Suggestions: same working-day count, no conflict, within balance, closest first, max 3; AI failure → fallback text shown.
- Deputy list cannot contain the employee themself.

## Manager delegation
- A has approved leave today → each of A's deputies can see and decide A's direct-team requests.
- A not on leave → deputy has no access; A's leave ends → access ends.
- Pending (not approved) leave of A → no delegation.
- Deputy cannot decide own request.
- No chaining: A's deputy's deputy gets nothing.
- Delegation never grants HR Admin rights.
- Decision stores `onBehalfOf = A`; audit event shows actor and `onBehalfOf`.
- Delegated requests appear only in the "Helyettesítés" view, not in the deputy's own team list.
- Deputy availability recheck still blocks approval.

## Half-day payroll
- First half-day of a pair in month: balance -0.5, payroll 0.
- Second half-day of the pair: balance -0.5, payroll 1, exported on its date.
- Pairing restarts in next calendar month; odd last half-day per Q26 assumption (own date, 0.5).
- Cancelling a half-day before it starts re-pairs the remaining ones.
- AM and PM are stored distinctly.
- Cancellation after start is blocked for employee.

## Payroll export
- Layout matches `docs/samples/payroll_template_2026.csv`: 3 header rows, name, tax id, 5 Tól/Ig per group.
- LEAVE types under "Szabadság", SICK types under "Betegszabadság/táppénz".
- Tól/Ig are day-of-month numbers; consecutive same-group days merged across weekends/holidays (Q29).
- Half-day pair appears on the second half-day's date.
- Every registered employee with the flag listed, also with no leave (Q33).
- More than 5 periods → extra row with the same name and tax id (Q28 assumption).
- Odd last half-day of the month exported on its own date (Q26 assumption).
- Only APPROVED requests on working days; multi-month requests clipped to the month.
- Endpoint: 403 for EMPLOYEE/MANAGER/no session, 400 for invalid year/month/entity, default .xlsx (PK zip) for HR_ADMIN; `format=csv` → CSV with BOM; unknown format 400.
- Change after export is written out (Q31).

## Payroll export flag
- New employee defaults to `includeInPayrollExport = true`.
- Employee with `false` is missing from the payroll export but balance, requests and approvals work normally.
- Changing the flag creates an audit event.

## Employee tax id
- HR Admin create/update requires a 10-digit synthetic `taxId` (Adóazonosító jel); missing/invalid → 400 (`employeeApi.taxId.test.ts`).
- HR Admin sees and edits it in the employee list/form; manager views never contain it.

## Authorization
- Approver inbox lists only requests where approverId = actor; decision allowed only on PENDING (409), only by the approver, never by the requester (403); unknown id 404, invalid decision 400 (`leaveDecision.test.ts`, `leaveRequestApi.decision.test.ts`).
- Employee sees only own detailed requests and balances.
- Manager, deputy, colleagues and team calendar see only "Szabadság" / "Beteg", never the exact type.
- HR Admin sees the exact type; employee sees own exact type.
- HR sees both legal entities.
- Demo role switcher is clearly marked prototype-only and only available with `AUTH_MODE=demo`.

## LDAP sign-in
- Valid LDAP credentials + matching active employee → signed in with DB roles.
- Wrong password → generic Hungarian error, no detail on which part was wrong.
- Valid LDAP user with no employee row, or `employmentEnd` passed → access denied.
- LDAP group membership never grants LeaveIt roles.
- Every API call without a valid session → 401; role checks enforced server-side.
- Password never logged or stored.
- All visible UI text is Hungarian.

## Demo data
Use synthetic names, email addresses, dates and balances only.
