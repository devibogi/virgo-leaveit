# Four-person team plan

Assign people by strengths during kickoff; names are intentionally left blank.

| Workstream | Suggested owner | Responsibilities | Deliverable |
|---|---|---|---|
| Product / UX / Demo | Person 1 | Scope, user journeys, screen map, acceptance criteria, demo script, visual consistency | Clickable flow / screen checklist / pitch |
| Frontend / Integration | Person 2 | App shell, navigation, role dashboards, forms, calendar UI, integration of modules | Working UI |
| Domain Logic / Data | Person 3 | TypeScript types, synthetic seed data, balance engine, working-day calendar, validations, half-day pairing | Tested business logic |
| QA / HR Workflow / Platform | Person 4 | HR dashboard/export, test matrix, edge cases, GitHub hygiene, deployment, integration checks | HR view, test evidence, deploy/demo readiness |

## Working agreement
- One shared GitHub repository.
- `main` stays runnable; no direct pushes to `main`.
- Each person works on a short-lived branch: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`.
- Open small pull requests; another teammate reviews before merge.
- Agree on API/data contracts before parallel implementation.
- Integrate continuously; avoid four isolated mini-apps.
- One person is the integration coordinator for the day; rotate or choose based on Git confidence.
- Use synthetic/fictitious employee data only.

## Suggested ownership boundaries
- Person 1 owns product decisions and acceptance criteria, but does not unilaterally change HR rules.
- Person 2 owns UI components and routing, not business calculations.
- Person 3 owns pure domain functions and tests, not screen-specific state.
- Person 4 owns test coverage, HR/reporting flow and repo/deployment coordination.
- Pair on cross-cutting changes; avoid editing the same files simultaneously.

## Six-hour build rhythm
1. 0:00–0:30 — align scope, repo, contracts, screen map.
2. 0:30–1:30 — parallel foundation: app shell, domain types/rules, seed data, test setup.
3. 1:30–2:30 — employee and manager flows.
4. 2:30–3:30 — approval integration, balances and calendar.
5. 3:30–4:30 — HR overview/export, overlap and edge cases.
6. 4:30–5:30 — end-to-end test, visual polish, optional AI insight.
7. 5:30–6:00 — freeze scope, rehearse demo, final fixes.

If the event duration differs, preserve the sequence and scale the timeboxes.
