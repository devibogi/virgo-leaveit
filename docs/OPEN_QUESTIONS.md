# Open Questions

Unresolved items only. Prototype assumptions must be easy to change and clearly labelled. Do not reopen resolved items without new information from the project owner or HR.

| # | Question | Owner | Status | Impact | Prototype assumption |
|---|---|---|---|---|---|
| Q1 | Exact Q1–Q4 allocation/display formula | HR | Open | Quarter view on dashboard | Provisional equal split, labelled "provisional" |
| Q2 | Payroll export schema: columns, grouping, leave codes, period, file format | Zsuzska | Open | CSV export | Provisional CSV, clearly labelled |
| Q3 | Half-day edge cases: AM+PM same day, >2 half-days in a month, cancellation after payroll export, which leave types allow half-days | Zsuzska / HR | Open | Half-day pairing, `LeaveType.halfDayAllowed` | Only `ANNUAL` allows half-days |
| Q4 | Payroll mapping: sick leave vs sick pay, paternity, extraordinary, other types | Zsuzska | Open | `LeaveType.payrollCode`, export | `payrollCode = null` |
| Q5 | Manager SLA: start point, cutoff time, reminder time/channel | HR | Open | SLA due date & reminder | Count 3 working days starting the working day after submission; in-app reminder 08:00 on due date |
| Q6 | LDAP connection details: server URL, base DN, login attribute (`uid`/`sAMAccountName`/`mail`), LDAPS, test directory for the demo | Project owner / IT | Open | LI-23 | Configured via `.env`; local test directory (OpenLDAP container, synthetic users); demo role switcher stays when `AUTH_MODE=demo` |
| Q7 | Priority of AI conflict wording (LI-15) now that deputy suggestions exist | Project owner | Open | Scope | P1, after deterministic deputy check (LI-17) |
| Q8 | Are current Excel column definitions or sample data available? | HR | Open | Seed data, export | Synthetic data |
| Q9 | Which leave types deduct from the annual balance? (e.g. extraordinary, unpaid) | HR | Open | `LeaveType.deductsFromAnnualBalance` | Only `ANNUAL` deducts |
| Q10 | Can an employee withdraw a **pending** request? | HR / Project owner | Open | Status lifecycle | Not in the model yet |
| Q11 | Is the leave type list complete (ANNUAL, SICK_LEAVE, SICK_PAY, PATERNITY, EXTRAORDINARY, UNPAID)? "Paid leave" in the source brief is unclear | HR | Open | `LeaveTypeCode` | As listed |
| Q12 | Source and review of the Hungarian 2026–2027 calendar file; file is missing from the repo | Project owner / Payroll | Open | All working-day validation, SLA | — (blocking for calendar service) |
| Q13 | Who assigns/maintains deputies (HR Admin, manager, or employee)? | HR / Project owner | Open | Deputy admin UI, permissions | HR Admin maintains `deputyIds`; seed data pre-filled; change logged as `DEPUTIES_UPDATED` |
| Q14 | Half-day overlap with a deputy: does a deputy's AM leave block the requester's PM leave? | HR | Open | Deputy check | Block only when portions overlap (FULL overlaps all; AM↔AM; PM↔PM) |
| Q15 | What does the manager see about a deputy conflict? | HR / Project owner | Open | Approval view | Same as employee: conflict dates only, approve button disabled; manager can still see their own team calendar as usual |
| Q16 | Deputy who has left (`employmentEnd` passed): counts as away or ignored? | HR | Open | Deputy check | Counts as away (conservative); HR must reassign |
| Q17 | Suggestion search range and count | Project owner | Open | `DateSuggestion` | Same working-day length, within ±60 days, same calendar year, max 3, closest first |
| Q18 | Does a manager's half-day or sick leave activate delegation? | HR | Open | `ActiveDelegation` | Any APPROVED leave of any type covering that date (incl. half-day) activates it for the whole day |
| Q19 | Deputy's own request to the absent manager: who decides? | HR | Open | Approval routing | Waits for A (SLA reminder still runs); no auto-escalation |
| Q20 | Manager away with all deputies also away (e.g. sick leave): fallback approver? | HR | Open | Approval routing | None; request waits; SLA reminder |
| Q21 | Who can change `includeInPayrollExport`, and does it appear in the HR overview/export? | HR | Open | HR admin UI | HR Admin only; change logged as `EMPLOYEE_UPDATED`; HR overview shows it, payroll export filters on it |
| Q22 | MariaDB hosting for the demo (local Docker vs shared server) | Project owner | Open | Setup | Local Docker per developer; credentials only in `.env` |
| Q23 | Order in which entitlement components are consumed after carryover | HR | Open | Usage cache | carryover → base → age → child |
| Q24 | Approved usage beyond total entitlement (e.g. after HR lowers an override): where is it booked? | HR | Open | Usage cache | On BASE; balance shown negative; HR resolves |

## Resolved (do not reopen)
- **Mid-year proration rounding:** fraction ≥ 0.5 rounds up; < 0.5 rounds down.
- **Q4 age-based carryover:** carried into the next year, used first, no expiry.
- **Google Calendar / real email:** optional, only if time allows; not MVP.
- **Deputy rule (2026-11-13):** planned leave only; blocked when all deputies have approved leave; one-way; multiple deputies; recheck at approval; employee sees conflict dates only (see BUSINESS_RULES §7).
- **Manager delegation (2026-11-13):** a manager's deputies get MANAGER rights over the direct team only while the manager is on approved leave; separate UI view (BUSINESS_RULES §4).
- **UI language (2026-11-13):** Hungarian.
- **Sign-in (2026-11-13):** company LDAP; roles from LeaveIt DB, matched by email (BUSINESS_RULES §4).
