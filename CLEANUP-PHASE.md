# Phase 11: Cleanup & Quality

Polish the loose ends after the main feature work — git hygiene, dashboard rebuild, testing, and dependency cleanup.

---

## 11a — Git & Infrastructure

- [x] `.gitattributes` created with `* text=auto` (fixes CRLF warnings on 6 files)
- [x] `.gitignore` updated — add `.cursor/`, `.windsurf/`
- [x] `tsconfig.json` exists and is ready to track
- [x] `npm install` re-run — `dotenv` added, TypeScript confirmed
- [x] `npm run build` passes cleanly
- [ ] CRLF warnings resolved (run `git add` to verify)

## 11b — Dashboard Frontend

- [x] Decision: restored old vis.js UI from git history
- [x] SSE `/events` client added to `index.html` (triggers refresh on `task_created`)
- [x] `/api/session` endpoint wired into `app.js` (restored)
- [x] Dashboard is functional — served from `public/index.html`

## 11c — Chrome Extension

- [x] `chrome-extension/` reviewed — background, popup, content script all solid
- [x] Decision: integrate — ready for production
- [ ] Icon warning: `manifest.json` references `.png` icons but files are `.svg` — needs conversion
- [x] `.gitignore` only ignores `chrome-extension/node_modules/` — correct

## 11d — Testing

- [x] `npm test` runs `node test/test-core.js` — 6/6 tests pass
- [x] Module-level imports validated: `agent-db`, `knowledge`, `model-router`, `task-worker`, `prompt-builder`, `server`
- [ ] API smoke test: POST `/task`, GET `/health`, GET `/events` (requires server running)
- [x] Test file: `test/test-core.js`

## 11e — Dependency Audit

- [x] `cors` — verified: used in `server.js` line 26 (`app.use(cors(...))`), kept
- [x] `concurrently` — CLI-only, stays as devDep (correct)
- [x] `overdrive-db` v2.4.6 — latest stable
- [ ] ⚠️ `@modelcontextprotocol/sdk` v0.5.0 has 1 high-severity vulnerability (ReDoS + DNS rebinding). Fix requires bump to v1.29.0 (breaking change) — defer

## 11f — Finalize

- [ ] All Phase 11 items reviewed
- [ ] Meaningful commit prepared
- [ ] Changes pushed / PR created
