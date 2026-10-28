# Tasks

## 1. Backend REST API (`src/server.ts`)

- [x] 1.1 Implement core `src/server.ts` using `Bun.serve` with route dispatching, CORS handling, and JSON error formatting; verify server starts and responds to basic requests.
- [x] 1.2 Implement document query and deletion routes (`GET /api/docs`, `GET /api/docs/:id/chunks`, `DELETE /api/docs/:id`) and verify behavior in `test/server.test.ts` via `docker compose exec app bun test test/server.test.ts`.
- [x] 1.3 Implement document upload and sync routes (`POST /api/docs/upload`, `POST /api/docs/sync`) integrating with `data/docs/` and ingestion services; verify file upload handling in `test/server.test.ts`.
- [x] 1.4 Implement question answering (`POST /api/ask`) and evaluation routes (`POST /api/eval/run`, `GET /api/eval`); verify structured responses in `test/server.test.ts`.

## 2. Frontend Scaffolding & Component Primitives (`web/`)

- [x] 2.1 Scaffold Vite React 19 + TypeScript frontend under `web/` with Tailwind CSS, Lucide React icons, and typed API client in `web/src/api.ts`; verify build succeeds via `bun run --cwd web build`.
- [x] 2.2 Build reusable shadcn/ui style primitives in `web/src/components/ui/` (`Tabs`, `Card`, `Badge`, `Button`, `Input`, `Select`, `Table`, `Sheet`, `Progress`, `ScrollArea`, `Alert`) with `cn()` utility; verify type check passes.

## 3. Frontend Views & End-to-End Integration

- [x] 3.1 Implement **Tab 1: Ask & Inspect** (`AskTab.tsx`) with question input, document filter dropdown, test question pills, grounded answer card, citation badges, and top-5 retrieved chunks with similarity bars; verify interactive state rendering.
- [x] 3.2 Implement **Tab 2: Documents & Chunks** (`DocsTab.tsx`) with drag-and-drop file upload, folder sync button, indexed documents table, document deletion, and chunk inspection Sheet drawer; verify document actions.
- [x] 3.3 Implement **Tab 3: Golden Set Evaluation** (`EvalTab.tsx`) with one-click evaluation trigger, KPI summary cards, and detailed question pass/fail results table; verify benchmark display.
- [x] 3.4 Assemble views in `web/src/App.tsx`, configure Vite API proxy to backend server, add `server` and `dev` scripts to root `package.json`, and verify full project type check via `docker compose exec app bun x tsc --noEmit`.
