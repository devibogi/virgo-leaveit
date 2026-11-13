# Test Plan

## Balance and entitlement
- Age-based additional day appears in the calendar year the threshold age is reached, including a 31 December birthday.
- Child-related additional leave is not auto-calculated; HR manual entry is reflected.
- Mid-year joiner prorates full-year base + additional entitlement.
- Rounding below and above 0.5 follows the confirmed rule; exact 0.5 is flagged as unresolved.
- Pending request does not reduce available balance.
- Q1–Q3 carryover works; year-end carries only age-based additional leave.

## Requests and approval
- Every request is pending until manager decision.
- Manager sees only direct-team requests.
- Rejected/cancelled/revoked requests do not consume balance.
- Employee can cancel own approved request only before start.
- HR Admin can revoke and reason is recorded.
- Approved request cannot be edited; cancel + resubmit.
- SLA reminder is shown on final due-date morning; expiry does not auto-decide.

## Calendar and validation
- Weekend and Hungarian statutory rest day cannot be booked.
- Officially designated working Saturday is treated as a working day.
- Team overlap is detected.
- Leave range crossing a holiday is handled according to agreed per-day validation.
- Date range and half-day AM/PM validation.

## Deputy availability
- No deputies assigned → never blocked.
- One deputy with approved leave on a requested day → that day blocked; conflict date listed.
- Two deputies, only one away → not blocked; both away → blocked.
- Deputy's PENDING, REJECTED, CANCELLED or REVOKED leave → not blocked.
- SICK_LEAVE, SICK_PAY, PATERNITY → never blocked; ANNUAL, EXTRAORDINARY, UNPAID → checked.
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
- First active approved half-day in month: balance -0.5, payroll 1.
- Second active approved half-day in month: balance -0.5, payroll 0.
- Pairing restarts in next calendar month.
- Cancelling first half-day before it starts makes the remaining half-day first; payroll value recalculates to 1.
- AM and PM are stored distinctly.
- Cancellation after start is blocked for employee.

## Payroll export flag
- New employee defaults to `includeInPayrollExport = true`.
- Employee with `false` is missing from the payroll export but balance, requests and approvals work normally.
- Changing the flag creates an audit event.

## Authorization
- Employee sees only own detailed requests and balances.
- Manager sees only direct team and leave type.
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
