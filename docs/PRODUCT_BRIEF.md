# LeaveIt — Product Brief & MVP Specification

**Tagline:** Leave it to us.  
**Positioning:** Modern, practical leave management for employees, team leads and HR.  
**Product vision:** Make time off effortless for everyone.

## 1. Problem
The current process is fragmented across Google Forms, email approvals, Google Calendar and a central Excel register. Employees cannot reliably see their balance or request history; team leads lack a complete view of team absences; HR reconciles records manually and handles repeated balance questions. The source brief estimates 3–4 hours of monthly HR administration for reconciliation and inquiries.

## 2. Users and value
- **Employee (Péter):** see own annual/quarterly balance, submit and track requests, view history and own calendar.
- **Manager (Katalin):** see direct team's requests and calendar, approve/reject, spot overlapping absences.
- **HR Admin (Piri):** manage employee records, legal entities and balances; review all requests; prepare payroll reports/exports.

## 3. MVP outcome
Demonstrate the full end-to-end flow:
1. Employee submits a leave request.
2. System validates dates, leave type, holidays and balance.
3. Request goes to the employee's direct manager.
4. Manager approves or rejects.
5. Approved absence updates balance and team calendar.
6. HR can see the consolidated record and a prototype export.

## 4. MVP scope
### Must-have
- Role-based demo views for Employee, Manager and HR Admin.
- Employee dashboard with annual and Q1–Q4 balance display.
- Leave request form with full-day and half-day (AM/PM) options.
- Validation for weekends/public holidays, date order, balance and overlapping requests.
- Pending / approved / rejected / cancelled / revoked states and request history.
- Manager queue with approve/reject and direct-team calendar.
- HR overview across Virgo Kft. and Virgo Zrt.; manual balance adjustment with reason.
- Synthetic demo dataset and reproducible demo scenario.

### Should-have if time
- Edit workflow implemented as cancel + resubmit.
- Half-day monthly payroll pairing calculation.
- Three-working-day manager SLA indicator and reminder simulation.
- CSV export using a provisional, clearly labelled schema.
- Conflict insights / smart leave planning as an AI-assisted enhancement.

### Not in six-hour MVP unless specifically confirmed
- Production LDAP/OIDC SSO and 2FA.
- Live Google Calendar synchronization.
- Real email delivery and scheduled background jobs.
- Production payroll integration.
- Production-grade identity, audit and database infrastructure.

## 5. AI approach
AI is an enhancement, not the source of truth. Good demo candidate: explain team absence conflicts in natural language and suggest alternative dates. Deterministic code must calculate balances, validate requests, enforce permissions and determine approval status. AI may explain or suggest; it must not independently approve requests or calculate statutory entitlement.

## 6. Brand and UI direction
- Name: LeaveIt
- Tagline: Leave it to us.
- Palette: Midnight #24243B, Violet #8275E8, Mint #B9E5D3, Cloud #F6F5FA.
- Visual direction: modern independent SaaS, clean and friendly, not corporate intranet.
- Logo concept: simple “L.” in a violet tile.
- Optional subtle “Built for Virgo” attribution.

## 7. Proposed prototype stack (confirm as a team)
React + Vite + TypeScript; Tailwind CSS; component library such as shadcn/ui; synthetic data in MariaDB behind a Node API (D15); business rules in separate pure TypeScript modules. GitHub as source of truth; Vercel preview deployments optional.
**Important:** Client-side role switching is prototype-only and are not secure production architecture.

## 8. Success criteria for demo
- Complete request → validation → approval → balance/calendar update flow.
- All three roles can demonstrate their key tasks.
- At least one conflict/overlap case is visible.
- Core calculations are deterministic and covered by tests.
- Open policy assumptions are clearly labelled, not hidden.
