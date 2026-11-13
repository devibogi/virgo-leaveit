# CLAUDE.md — LeaveIt project instructions

## Role
Act as a senior software engineer implementing the approved LeaveIt specification. Do not silently invent HR policy. When a rule is missing or ambiguous, flag it and ask before implementing.

## Read first
1. `docs/PRODUCT_BRIEF.md`
2. `docs/BUSINESS_RULES.md`
3. `docs/DATA_MODEL.md`
4. `docs/BACKLOG.md`
5. `docs/TEST_PLAN.md`

## Product constraints
- Three equally important roles: Employee, Manager, HR Admin.
- Core flow: request → validation → manager decision → balance/calendar update → HR overview/export.
- AI is an optional helper, never the authority for calculations, permissions, or approvals.
- Use synthetic data only.

## Engineering constraints
- Keep business rules in pure, testable TypeScript modules, separate from UI.
- Keep balance deduction and payroll accounting as separate values.
- Keep the working-day calendar behind a service/module; do not assume Monday–Friday only.
- Preserve cancelled/revoked requests in history; do not hard-delete.
- Enforce access checks in the backend for any real deployment. Client-only role switching is demo-only.
- Avoid unnecessary abstractions; prioritize a working end-to-end MVP.
- Add tests for every calculation and validation rule.
- Do not add real credentials or secrets to the repository.

## Collaboration
- Push directly to `main` (team decision 2026-11-13, hackathon speed). Run `npm test` and `npm run build` first; never force-push.
- Keep commits small and explain changed behavior and tests in the commit message.
- Before changing shared types/contracts, coordinate with the team.
- Update docs when a confirmed business rule changes.

## Current uncertainty
Consult `docs/BUSINESS_RULES.md` and `docs/KICKOFF.md` for explicit open questions. Never treat a proposed assumption as a confirmed HR rule.
