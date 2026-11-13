# Open Questions

Unresolved items only. Prototype assumptions must be easy to change and clearly labelled. Do not reopen resolved items without new information from the project owner or HR.

| # | Question | Owner | Status | Impact | Prototype assumption |
|---|---|---|---|---|---|
| Q5 | Manager SLA: start point, cutoff time, reminder time/channel | HR | Open | SLA due date & reminder | Count 3 working days starting the working day after submission; in-app reminder 08:00 on due date |
| Q6 | LDAP connection details: server URL, base DN, login attribute (`uid`/`sAMAccountName`/`mail`), LDAPS, test directory for the demo | Project owner / IT | Open | LI-23 | Configured via `.env`; local test directory (OpenLDAP container, synthetic users); demo role switcher stays when `AUTH_MODE=demo` |
| Q7 | Priority of AI conflict wording (LI-15) now that deputy suggestions exist | Project owner | Open | Scope | P1, after deterministic deputy check (LI-17) |
| Q8 | Sample data beyond the export template? (template received: `docs/samples/payroll_template_2026.csv`) | HR | Partly answered | Seed data | Synthetic data |
| Q10 | Can an employee withdraw a **pending** request? | HR / Project owner | Open | Status lifecycle | Not in the model yet |
| Q12 | Source and review of the Hungarian 2026–2027 calendar file (file is missing from the repo); for production: maintained source and how updates are applied | Project owner / Payroll | Open | All working-day validation, SLA | — (blocking for calendar service) |
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
| Q24 | Approved usage beyond total entitlement (e.g. after HR lowers an override): where is it booked? | HR | Open | Usage cache | On BASE; balance shown negative; HR resolves |
| Q25 | Unpaid leave approved by HR: any HR Admin or a named one? Is the manager informed / asked first? Same SLA? Deputy check? | HR | Open | Approval routing, `LeaveType.approverRole` | Any HR Admin decides instead of the manager; manager sees it as "Szabadság" in the team calendar; same 3-day SLA; deputy check applies |
| Q26 | Unpaired (odd) last half-day in a month: exported on its own date? With what value? | Zsuzska | Open | Half-day pairing, export | Exported on its own date as a half-day (`payrollValue` 0.5), not carried to next month |
| Q27 | UNPAID and FUNERAL in the export: which group, or left out? | Zsuzska | Open | Export | Under "Szabadság" (category LEAVE) |
| Q28 | More than 5 periods per group in a month for one employee? | Zsuzska | Open | Export | Export shows a warning listing the employee; extra periods go into an extra row with the same name/tax id |
| Q29 | Period building: are consecutive same-group days merged into one Tól–Ig, bridging weekends/holidays? | Zsuzska | Open | Export | Yes: merged across non-working days between them; different groups never merged |
| Q30 | Is FUNERAL subject to the deputy check? | HR | Open | `deputyCheckApplies` | No (not plannable) |
| Q31 | Corrections after export ("kiírásra kerül"): re-export the closed month, or show in the next month's file? | Zsuzska | Open | Export | HR re-generates the affected month; the change is listed in an export audit event |
| Q32 | Leaver proration rounding; sick-pool proration rounding; is the switch from betegszabadság to táppénz automatic at day 16? | HR / Zsuzska | Open | Entitlement, sick pool | Same rounding as joiners; system splits automatically at day 16 and shows it to HR |
| Q33 | Are registered employees with no leave in the month listed in the export? | Zsuzska | Open | Export | Yes, with empty periods |
| Q34 | Company-specific closure days (e.g. year-end shutdown): do they exist, who maintains them, do they consume leave? | HR | Open | Calendar service, balance | None in the prototype; HR can add non-working days to the calendar data, not deducted |
| Q35 | Export layout per legal entity: one sheet per Cégnév, one file per entity, or one block per entity in a single sheet? | Zsuzska | Open | Export | One .xlsx, one sheet per Cégnév |
| Q36 | Approved stack, deployment target (Vercel allowed?) and repo visibility | Project owner / Virgo | Open | Setup, hosting | React/Vite/TS + MariaDB as in PRODUCT_BRIEF §7; private repo; local demo, no public deployment |

## Resolved (do not reopen)
- **Mid-year proration rounding:** fraction ≥ 0.5 rounds up (exactly 0.5 included); < 0.5 rounds down.
- **Q4 age-based carryover:** carried into the next year, used first, no expiry.
- **Google Calendar / real email:** optional, only if time allows; not MVP.
- **Deputy rule (2026-11-13):** planned leave only; blocked when all deputies have approved leave; one-way; multiple deputies; recheck at approval; employee sees conflict dates only (see BUSINESS_RULES §7).
- **Manager delegation (2026-11-13):** a manager's deputies get MANAGER rights over the direct team only while the manager is on approved leave; separate UI view (BUSINESS_RULES §4).
- **UI language (2026-11-13):** Hungarian.
- **Q23 Consumption order (2026-11-13):** carryover → base → age-based → child-related (BUSINESS_RULES §1).
- **Sign-in (2026-11-13):** company LDAP; roles from LeaveIt DB, matched by email (BUSINESS_RULES §4).
- **Q1 Quarter allocation (2026-11-13):** even, time-proportional split.
- **Q2 Export schema (2026-11-13):** monthly Excel per template; two groups; name + tax id + 5 Tól/Ig per group (BUSINESS_RULES §6a). Details Q26–Q29, Q31, Q33.
- **Q3 Half-days (2026-11-13):** second half-day completes the pair, exported on its date; none for sick types; post-export changes are written out (D19).
- **Q4 Payroll mapping (2026-11-13):** only "Szabadság" and "Betegszabadság/táppénz"; certificate subtypes not our concern.
- **Q9 Deducting types (2026-11-13):** only paid leave (ANNUAL).
- **Q11 Leave types (2026-11-13):** ANNUAL, SICK_LEAVE, SICK_PAY, UNPAID, FUNERAL, CHILD_SICK_PAY; no paternity/extraordinary.
- **Leaver proration (2026-11-13):** annual / days in year (366 in leap years) × days employed; overdrawn at exit → no clawback.
- **Sick-leave pool (2026-11-13):** 15 days/year, prorated; then táppénz.
- **Leave type visibility (2026-11-13):** everyone but HR sees only "Szabadság" / "Beteg" (D19).
