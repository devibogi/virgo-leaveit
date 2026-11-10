# LeaveIt
**Leave it to us.** — leave management, without the hassle.

LeaveIt is a hackathon prototype for employee leave requests, manager approvals, team absence planning and HR administration.

## Project status
Preparation pack / prototype specification. Confirm the stack, scope and ownership at team kickoff before implementation.

## Product docs
- [Kickoff & meeting brief](docs/KICKOFF.md)
- [Product brief / MVP](docs/PRODUCT_BRIEF.md)
- [Business rules & decisions](docs/BUSINESS_RULES.md)
- [Four-person team plan](docs/TEAM_PLAN.md)
- [Data model proposal](docs/DATA_MODEL.md)
- [MVP backlog](docs/BACKLOG.md)
- [Test plan](docs/TEST_PLAN.md)
- [Demo script](docs/DEMO_SCRIPT.md)

## Proposed stack (not yet locked)
React + Vite + TypeScript, Tailwind, small reusable component set, pure TypeScript domain logic, synthetic seed data, localStorage for demo only.

## Getting started
The app scaffold is intentionally not included yet. At kickoff:
1. Confirm stack and package manager.
2. Scaffold the app.
3. Add the initial types and seed data.
4. Ensure `npm run dev`, `npm run build` and `npm test` (or agreed equivalents) work.
5. Keep `main` runnable and use feature branches + pull requests.

## Data safety
Use synthetic/fictitious data only. Do not commit employee personal data, real leave records, credentials, tokens or production exports. Client-side role switching/localStorage are demo-only, not production security.
