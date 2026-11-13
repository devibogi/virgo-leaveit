# MVP Backlog

Priority definitions: **P0** demo must-have · **P1** valuable if time · **P2** stretch / production follow-up.

| ID | Priority | Story / task | Acceptance criteria |
|---|---|---|---|
| LI-01 | P0 | App shell and role navigation | Employee, Manager and HR views are reachable using demo role switcher. |
| LI-02 | P0 | Synthetic seed dataset | Includes multiple teams, both legal entities, balances and sample requests; no real personal data. |
| LI-03 | P0 | Employee balance dashboard | Shows annual, used, remaining and Q1–Q4 tracking values with clear labels. |
| LI-04 | P0 | Submit leave request | Employee can choose leave type, dates and full/AM/PM; validation feedback is visible. |
| LI-05 | P0 | Request validation | Rejects invalid date range, statutory non-working days and insufficient balance; detects overlap. |
| LI-06 | P0 | Manager approval queue | Manager sees only direct-team pending requests and can approve/reject. |
| LI-07 | P0 | Approval updates state | Approved request updates employee balance and team calendar; rejected does not deduct. |
| LI-08 | P0 | Team calendar | Shows direct-team approved absences and overlap warnings. |
| LI-09 | P0 | HR overview | HR can filter employees/requests across Kft. and Zrt. |
| LI-10 | P1 | Cancel and resubmit | Future approved request can be cancelled; history remains; employee can submit replacement. |
| LI-11 | P1 | Half-day pairing | Each half-day deducts 0.5; monthly chronological pairs, first = 0, second = 1 (exported on the second's date); cancellation re-pairs; no half-days for sick types. |
| LI-12 | P1 | Three-working-day SLA | Due date skips weekends/rest days and counts designated working Saturdays; reminder can be simulated. |
| LI-13 | P1 | HR manual adjustment | HR changes entitlement with reason; audit event is created. |
| LI-14 | P1 | Monthly payroll Excel export | .xlsx matching `docs/samples/payroll_template_2026.csv`: per legal entity, name + tax id + 5 Tól/Ig per group (Szabadság / Betegszabadság/táppénz); only employees with `includeInPayrollExport = true`; assumptions Q26–Q29, Q31, Q33 labelled. |
| LI-15 | P1 | AI conflict wording | Words the deputy conflict + suggested dates from `DeputyConflictAiInput` (dates only); never names the deputy, position or leave type; non-AI fallback text; never approves or calculates. |
| LI-17 | P1 | Deputy availability check | Planned leave blocked on days all deputies have approved leave; checked at submit and re-checked at approval; employee/manager see conflict dates only; deterministic alternative dates (up to 3). |
| LI-18 | P1 | Deputy assignment | HR Admin (assumption, Q13) edits an employee's deputies; no self-deputy; audit `DEPUTIES_UPDATED`. |
| LI-19 | P1 | Manager delegation view | "Helyettesítés" view, separate from own team, visible only while an `ActiveDelegation` exists; approve/reject for the absent manager's team; own requests excluded; `onBehalfOf` recorded. |
| LI-20 | P0 | Hungarian UI | All user-facing text from `src/i18n/hu.ts`; Hungarian date format. |
| LI-21 | P0 | MariaDB + backend API | `db/schema.sql` applied to local MariaDB; Node API serves the data; seed script with synthetic data; credentials only in `.env`. |
| LI-22 | P1 | Payroll export flag | HR can toggle "Bérszámfejtésbe exportálandó" per employee (default igen); audited; export respects it. |
| LI-23 | P1 | LDAP sign-in | Backend binds to LDAP with the user's credentials over LDAPS; matches the employee by email; roles from DB; server-side session (httpOnly cookie); unknown/inactive user denied; Hungarian login page; `AUTH_MODE=demo` keeps the role switcher; LDAP credentials only in `.env`. |
| LI-24 | P1 | Entitlement usage cache | `used_q1..q4`, `used_year` on every entitlement row; backend calls `recomputeEntitlementUsage()` in the same transaction on every trigger in DATA_MODEL "Usage cache"; admin "recompute all"; consistency test. Domain function + tests done. |
| LI-25 | P1 | HR approves unpaid leave | UNPAID requests go to the HR Admin queue instead of the manager (`approverRole`); manager cannot decide them; flow per Q25 assumption. |
| LI-26 | P1 | Category visibility + sick pool | Non-HR views show only "Szabadság" / "Beteg"; HR sees the exact type; 15-day prorated betegszabadság pool, then táppénz (Q32). |
| LI-27 | P1 | Leaver proration | Annual / days in year (366 leap) × days employed; overdrawn warning, no clawback. |
| LI-16 | P2 | Google Calendar/email | Integration feasibility and permissions confirmed before implementation. |

## Definition of Done
- Acceptance criteria met.
- Build succeeds.
- Relevant tests pass.
- No secrets or real employee data committed.
- Pushed to `main` with tests and build passing (no PR required).
- UI states include empty/loading/error where relevant.
