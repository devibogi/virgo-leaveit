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

## Half-day payroll
- First active approved half-day in month: balance -0.5, payroll 1.
- Second active approved half-day in month: balance -0.5, payroll 0.
- Pairing restarts in next calendar month.
- Cancelling first half-day before it starts makes the remaining half-day first; payroll value recalculates to 1.
- AM and PM are stored distinctly.
- Cancellation after start is blocked for employee.

## Authorization
- Employee sees only own detailed requests and balances.
- Manager sees only direct team and leave type.
- HR sees both legal entities.
- Demo role switcher is clearly marked prototype-only.

## Demo data
Use synthetic names, email addresses, dates and balances only.
