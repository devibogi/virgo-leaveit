# LeaveIt
**Leave it to us.** — leave management, without the hassle.

LeaveIt is a hackathon prototype for employee leave requests, manager approvals, team absence planning and HR administration.

## Project status
Technical foundation in place: React + Vite + TypeScript scaffold with a branded landing page, Vitest and CI. No product features or business logic yet; see the [backlog](docs/BACKLOG.md).

## Product docs
- [Kickoff & meeting brief](docs/KICKOFF.md)
- [Product brief / MVP](docs/PRODUCT_BRIEF.md)
- [Business rules & decisions](docs/BUSINESS_RULES.md)
- [Four-person team plan](docs/TEAM_PLAN.md)
- [Data model proposal](docs/DATA_MODEL.md)
- [MVP backlog](docs/BACKLOG.md)
- [Test plan](docs/TEST_PLAN.md)
- [Demo script](docs/DEMO_SCRIPT.md)

## Tech stack (current)
| Tool | Version |
|---|---|
| React / React DOM | 19.3.1 |
| Vite | 8.3.7 (`@vitejs/plugin-react` 6.3.0) |
| TypeScript | 7.0.2 |
| Vitest | 5.1.0 |
| lucide-react | 1.71.0 |
| Node.js | 24 (see `.nvmrc`; CI uses the same) |

All dependency versions are pinned exactly; `package-lock.json` is committed. Use npm.

Proposed but not added yet: Tailwind, shadcn/ui, routing, state management, localStorage persistence. Business rules will live in pure TypeScript modules under `src/domain/`.

## Getting started
```sh
npm ci            # install exact locked versions
npm run dev       # dev server (http://localhost:5173)
npm test          # run Vitest once (npm run test:watch for watch mode)
npm run typecheck # type-check app (tsconfig.app.json) and Vite config (tsconfig.node.json)
npm run build     # type-check + production build to dist/
npm run preview   # serve the production build
```

Tests live next to the code as `src/**/*.test.ts(x)`.

## Workflow
- `main` stays runnable; work on feature branches and open pull requests.
- GitHub Actions (`.github/workflows/ci.yml`) runs `npm ci`, `npm test` and `npm run build` on every pull request and on pushes to `main`.
- No ESLint yet: `typescript-eslint` does not support TypeScript 7.

## Data safety
Use synthetic/fictitious data only. Do not commit employee personal data, real leave records, credentials, tokens or production exports. Client-side role switching/localStorage are demo-only, not production security.
