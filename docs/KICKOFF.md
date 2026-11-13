# LeaveIt — Team Kickoff & Hackathon Preparation

**Meeting purpose:** align four teammates on the problem, product, confirmed rules, MVP, architecture, responsibilities, repo setup and unresolved questions.  
**Product:** LeaveIt — *Leave it to us.*  
**Status:** preparation draft; decisions marked “proposed” require team confirmation.

## 1. Executive summary
LeaveIt is a modern leave-management prototype for employees, team leads and HR. It replaces a fragmented Google Forms → email approval → Google Calendar → Excel process with one transparent workflow.

The source brief asks for a working prototype covering the full request and approval flow, role-based access, quarterly balance visibility, overlap awareness, calendar integration concept and payroll export capability.

## 2. What problem are we solving?
- Employees cannot easily see their current balance, prior requests or approval status.
- Team leads lack a single view of direct-team absences and overlaps.
- HR manually reconciles forms, emails and spreadsheets and answers balance questions.
- Existing Sheets/Apps Script attempts did not provide sufficiently granular access control or robust automation.

## 3. Product vision and brand
**Vision:** Make time off effortless for everyone.  
**Tagline:** Leave it to us.  
**Three equal user groups:** Employee, Manager, HR.  
**AI stance:** smart features that support the workflow; AI is not the core source of truth.

Brand palette: Midnight #24243B · Violet #8275E8 · Mint #B9E5D3 · Cloud #F6F5FA.

## 4. Product experience / main screens
### Employee
- Balance overview: annual entitlement, used, remaining, Q1–Q4 tracking.
- New leave request: type, date range, full/half-day, AM/PM, comment.
- Request history and status.
- Own calendar; cancel future approved requests; resubmit after cancellation.

### Manager
- Pending approval queue with due-date indicator.
- Direct-team calendar and overlap warnings.
- Request details; leave shown only as "Szabadság" / "Beteg" (exact type is HR-only).
- Approve / reject with optional comment.

### HR Admin
- Employee directory, team and legal entity (Virgo Kft. / Virgo Zrt.).
- Annual entitlements, manually entered child-related additional leave, balance corrections with audit reason.
- Cross-entity overview.
- Monthly payroll Excel export per template (`docs/samples/payroll_template_2026.csv`).
- Approve unpaid leave.

## 5. Confirmed business rules
- Full annual entitlement is shown in Q1–Q4 tracking; quarters are not independent grants.
- Unused Q1–Q3 balances carry into the next quarter.
- From Q4, only unused age-based additional leave carries into the next year.
- Age-based additional leave is automatically calculated for the calendar year in which the threshold age is reached, even on 31 December.
- Child-related additional leave is entered manually by HR from annual employee declarations.
- Mid-year joiner: sum full-year base and additional entitlements, prorate by employment time in the year; >0.5 rounds up, <0.5 rounds down. HR can manually correct. Exactly 0.5 remains to confirm.
- Pending requests do not reduce or reserve available balance.
- Every request requires manager approval; no auto-approval.
- Approved requests cannot be edited in place: cancel before start and submit a new request.
- Employee can cancel their own approved request before leave starts; HR Admin can revoke.
- Prototype manager SLA: 3 working days; reminder on morning of final due date; no automatic approval/rejection.
- Half-days: AM/PM separately; each active approved half-day deducts 0.5 from balance. In each calendar month, half-days pair chronologically; the second one completes the pair and the day is exported on its date (D19). No half-days for sick types.
- Managers see only their direct team, and only "Szabadság" / "Beteg" (D19). HR Admin can manage both legal entities. Same rules apply to both entities.
- No leave may be booked on Hungarian public holidays / statutory non-working days.

## 6. Recommendation: Hungarian working-day calendar
For both leave validation and the 3-working-day approval SLA, do not calculate working days as simply Monday–Friday. Use a maintained Hungarian calendar dataset that includes public holidays, substitute rest days and officially transferred working Saturdays. For the prototype, use a versioned local JSON dataset and keep the calendar service separate from business rules. Count officially designated working Saturdays; skip weekends and statutory rest days. HR should approve the calendar source before production.

## 7. Proposed technical setup
**Fast prototype proposal:** React + Vite + TypeScript; Tailwind; shadcn/ui or a small consistent component set; pure TypeScript domain modules; synthetic seed data; MariaDB + Node API for persistence (decided 2026-11-13, D15); GitHub shared repo; Vercel preview deploy if convenient.
**Production caveat:** Client-side role switching is not secure. Real deployment needs server-side authentication/authorization, database, audit logging and secure integration credentials.

Suggested modules:
- `domain/leaveTypes.ts`
- `domain/balance.ts`
- `domain/workingDays.ts`
- `domain/halfDayPayroll.ts`
- `domain/validation.ts`
- `data/seed.ts`
- `features/employee/`
- `features/manager/`
- `features/hr/`
- `components/`
- `tests/`

## 8. Four-person responsibility proposal
See `TEAM_PLAN.md`. Allocate by strengths at the meeting:
1. Product / UX / Demo owner.
2. Frontend / Integration owner.
3. Domain Logic / Data owner.
4. QA / HR Workflow / Platform owner.

Agree on one integration coordinator. Each stream must define a small contract and deliver a working vertical slice, not just isolated screens.

## 9. MVP priorities
### P0 — must work
- Three role-based views (demo role switcher).
- Employee balance, request creation and history.
- Date/type/holiday/balance/overlap validation.
- Manager approval/rejection.
- Approved request updates balance and team calendar.
- HR overview across both entities.
- Synthetic data and repeatable demo.

### P1 — if time allows
- Half-day AM/PM and monthly payroll pairing.
- Q1–Q4 tracking and carryover display.
- Cancellation/storno and audit history.
- Three-working-day SLA indicator and reminder simulation.
- CSV export with provisional columns.

### P2 — stretch
- AI conflict explanation / smart date suggestions.
- Google Calendar live sync, real email, 2FA. (LDAP sign-in moved into scope 2026-11-13, LI-23.)
- Production-grade persistence and permissions.

## 10. Demo story
1. Péter opens his dashboard and sees his balance.
2. Péter requests leave; system validates dates, leave type, balance and holiday rules.
3. Katalin sees the request in her pending queue and checks team overlaps.
4. Katalin approves; balance and calendar update.
5. Piri sees the request in the HR overview and exports a payroll-style report.
6. Optional: show an AI-generated explanation of a team conflict, with deterministic overlap detection underneath.

## 11. Open questions for tomorrow
### HR / Payroll
- ~~Payroll export schema~~ answered 2026-11-13 (BUSINESS_RULES §6a); details Q26–Q29, Q31, Q33.
- ~~Quarter allocation~~ answered: even, time-proportional.
- Exactly 0.5 rounding case for mid-year proration.
- Q4 age-based carryover: expiry date / use-by rule.
- ~~Leave types and payroll mapping~~ answered 2026-11-13 (BUSINESS_RULES §6).
- ~~Half-day edge cases~~ answered (D19); odd half-day Q26.
### Process
- SLA clock: does the 3-working-day count start on submission date or next working day? What is cutoff time?
- Reminder channel and exact send time.
- Delegation / manager absence and company-specific closure days.
### Product / technical
- Calendar and Google integration: live sync required for demo or just calendar view?
- Is AI conflict insight the preferred stretch feature?
- Who provides the synthetic sample data and source spreadsheet column definitions?
- Which stack and deployment approach are approved by the team?

## 12. Decisions to leave the meeting with
- Confirm MVP P0 list and explicitly defer P1/P2.
- Confirm stack and repo owner/admins.
- Assign the four workstream owners and integration coordinator.
- Agree data contracts and branch/PR workflow.
- Resolve / assign an owner and due date for each open HR question.
- Pick the demo scenario and acceptance criteria.

## 13. Proposed meeting agenda (45–60 min)
1. 5 min — problem and product vision.
2. 10 min — three user roles and core flow.
3. 10 min — HR rules and open policy questions.
4. 10 min — MVP scope, architecture and integrations.
5. 10 min — four-person ownership and GitHub workflow.
6. 5–15 min — open questions, decisions, next actions.

## 14. Repository start checklist
- Create private GitHub repository `leaveit` (confirm visibility with Virgo / data owner).
- Add all four teammates; enable branch protection for `main` if available.
- Add `README.md`, `CLAUDE.md`, `docs/`, `.gitignore`, issue/PR templates.
- Choose one package manager and commit its lockfile.
- Create `main` as stable branch; use feature branches and PRs.
- Never commit credentials, real employee data, personal data or production exports.
- Use synthetic demo data only.
- Confirm whether Vercel is permitted and whether the repo may be public (default recommendation: private).

## 15. First 30 minutes after repo creation
1. One person creates the repo and invites the team.
2. All four clone the same repo and verify Node/package manager versions.
3. Agree TypeScript types and domain contracts before parallel coding.
4. Scaffold the app and run it locally on all four machines.
5. Commit a minimal working app to `main`.
6. Each person creates a feature branch and opens a small PR.
7. Merge only after review and successful build/test.
