# Role-based Feature Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Business → Architect → Tester (plan) → Developer → Tester (verify) workflow in place — role definitions, templates, entry-point skills, top-level docs — with a checker that enforces its structure, and pilot it on Bus Stop Finder.

**Architecture:** Role definitions and templates are tool-neutral Markdown in `docs/workflow/`; four thin Claude skills point at them; CLAUDE.md and AGENTS.md carry a short Workflow section. A small Node module (`scripts/workflow-check.mjs`) checks the docs' structure (stage tables, required sections, dangling feature-doc links) and runs with `npm run test:unit`.

**Tech Stack:** Markdown; Node 20+ ES modules with `node --test` (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-11-16-role-workflow-design.md`

## Global Constraints

- Stage table header, verbatim: `| # | Stage | Role | Status | Approved |`; five rows in this order: `Business`/`Business`, `Architecture + stories`/`Architect`, `Test plan`/`Tester`, `Implementation`/`Developer`, `Verification`/`Tester`.
- Statuses, verbatim: `—`, `Draft`, `In review`, `Approved`, `Changes requested`.
- Feature folder files: `README.md`, `1-business.md`, `2-architecture.md`, `3-stories.md`, `4-test-plan.md`, `5-implementation.md`, `changes/YYYY-MM-DD-<slug>.md`.
- IDs: `BR-n`, `US-n`, `AC-n.m`, `UC-n`, `TC-n`.
- Role files have exactly these `##` sections in order: `Reads`, `Writes`, `Superpowers`, `Behaviour`, `Exit checklist`.
- Superpowers per role (spec §2 table): Business `brainstorming`; Architect `brainstorming`, `systematic-debugging`; Tester `test-driven-development`, `verification-before-completion`, `systematic-debugging`; Developer `writing-plans`, `using-git-worktrees`, `test-driven-development`, `executing-plans`, `subagent-driven-development`, `systematic-debugging`, `requesting-code-review`, `finishing-a-development-branch`.
- Light-track eligibility, verbatim from spec §3: within one existing feature; no new route, table or dependency; no change to the intent of an existing BR.
- Only the owner's explicit approval sets `Approved`; a role never approves its own stage.
- `.claude/skills/` is outside the sandbox's writable set: those writes need the owner's approval.
- Never touch the owner's `:8080` server; commits push with bare `git push vincentmegia-origin <branch>`.

## Review Focus

1. **A feature doc moves and code comments still point at the old path** (about 30 comments cite `docs/features/bus-stop-finder.md`) — expected: the checker lists each dangling reference. Test in Task 1 (`checkDocLinks`).
2. **A stage table edited out of order** (Developer `Approved` while Architecture is `Draft`) — expected: an error naming both rows; an upstream `Changes requested` doesn't flag downstream rows. Tests in Task 1.
3. **Developer row marked `Approved` with only the plan date** — expected: error; it needs both `plan` and `built` dates. Test in Task 1.
4. **Legacy folders that aren't workflow folders** (`docs/features/easy-diagram/` has `BUILD.md`, no `README.md`) — expected: ignored, not an error. Test in Task 1.
5. **A light-track change file filed under a feature that hasn't migrated** — expected: error "migrate <feature> first". Test in Task 1.

---

### Task 1: Workflow checker

**Files:**
- Create: `scripts/workflow-check.mjs`
- Test: `scripts/workflow-check.test.mjs`
- Modify: `package.json` (`test:unit` — append `scripts/*.test.mjs`)

**Interfaces:**
- Produces (all exported from `scripts/workflow-check.mjs`; errors are human-readable strings naming the file):
  - `STATUSES: string[]`, `STAGES: Array<{stage: string, role: string}>`
  - `parseStageTable(markdown: string): Array<{n: number, stage: string, role: string, status: string, approved: string}> | null` — the first table whose header matches the constant; `null` if none.
  - `checkStages(rows, file: string): string[]`
  - `checkFeatureFolders(root: string): string[]` — every `docs/features/<f>/README.md` must exist alongside `1-business.md`…`5-implementation.md` and have a valid stage table; every `docs/features/<f>/changes/*.md` must have a valid stage table and its feature folder must have `README.md`.
  - `checkDocLinks(root: string): string[]` — every `docs/features/…\.md` path mentioned in tracked text files (skip `node_modules`, `.git`, `vendor`, `docs/superpowers`, `.claude/worktrees`) must exist.
  - `checkRepo(root: string): string[]` — concatenation of the named checks (later tasks add theirs).

- [ ] **Step 1: Write the failing unit tests** in `scripts/workflow-check.test.mjs` (fixtures as inline strings / temp dirs via `fs.mkdtempSync` under `os.tmpdir()`):
  - `parseStageTable` returns 5 rows for a valid table and `null` without the header.
  - `checkStages` → `[]` for all-`—`; error for status `Done`; error for `Approved` with empty date; error for row 4 `Approved` with `plan 2026-11-16` only, `[]` with `plan 2026-11-16, built 2026-11-18`; error naming rows 2 and 4 when row 4 is `Draft` and row 2 is `Draft`; `[]` when row 2 is `Changes requested` and row 4 is `Approved`; error when row order/names differ from `STAGES`.
  - `checkFeatureFolders`: folder with only `BUILD.md` → `[]`; folder with `README.md` but missing `3-stories.md` → error naming it; `changes/x.md` under a folder without `README.md` → error containing `migrate`.
  - `checkDocLinks`: a file mentioning `docs/features/gone.md` → one error naming the mentioning file; mentions under `docs/superpowers/` → ignored.
  - Integration: `checkFeatureFolders(repoRoot)` and `checkDocLinks(repoRoot)` → `[]` (repoRoot = `new URL('..', import.meta.url)` path).

- [ ] **Step 2: Run them to see them fail**

Run: `node --test scripts/workflow-check.test.mjs`
Expected: FAIL — cannot find module `./workflow-check.mjs`.

- [ ] **Step 3: Implement the interfaces above** in `scripts/workflow-check.mjs` with `node:fs`/`node:path` only. Gate rule: a row whose status is `Draft`, `In review` or `Approved` needs every earlier row `Approved` or `Changes requested`. `Approved` needs a `YYYY-MM-DD` date; the Implementation row needs both `plan YYYY-MM-DD` and `built YYYY-MM-DD`. File walking for `checkDocLinks`: use `git ls-files` via `child_process.execFileSync` so only tracked files are scanned.

- [ ] **Step 4: Run tests to see them pass**

Run: `node --test scripts/workflow-check.test.mjs` → all pass. Then `npm run test:unit` → `fail 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/workflow-check.mjs scripts/workflow-check.test.mjs package.json
git commit -m "workflow: checker for stage tables, feature folders and doc links"
```

---

### Task 2: Workflow overview and role definitions

**Files:**
- Create: `docs/workflow/README.md`, `docs/workflow/roles/{business,architect,tester,developer}.md`
- Modify: `scripts/workflow-check.mjs`, `scripts/workflow-check.test.mjs`

**Interfaces:**
- Consumes: `STATUSES`, `STAGES` (Task 1).
- Produces: `checkWorkflowDocs(root: string): string[]`, added to `checkRepo`; `ROLE_SKILLS: Record<'business'|'architect'|'tester'|'developer', string[]>` (values from Global Constraints).

- [ ] **Step 1: Failing test** — integration `checkWorkflowDocs(repoRoot)` → `[]`, plus unit fixtures: a role file missing `## Superpowers` → error; a role file whose sections are out of order → error; the architect file not mentioning `systematic-debugging` → error; README missing the stage-table header or any status → error.

- [ ] **Step 2: Run** `node --test scripts/workflow-check.test.mjs` → FAIL (missing `docs/workflow/README.md`).

- [ ] **Step 3: Write the docs.**
  - `docs/workflow/README.md`: the five stages and who acts; the approval rule; the gate rule; change requests flowing upstream (spec §1); the living reference (README + `2-architecture.md` + `3-stories.md` must match the code, updated in the same commit; the BRD changes only with requirements); the stage table with the five statuses; light vs full track with the verbatim eligibility test and "upgrade, never downgrade" (spec §3); the superpowers rule and table (spec §2), including "output goes into role docs, not `docs/superpowers/`"; legacy-doc migration on first touch (spec §4); the command `node --test scripts/workflow-check.test.mjs`.
  - Each `roles/<role>.md`: the five sections, filled from spec §2.1–2.5 (tester.md covers *plan* and *verify* modes, each with its own Behaviour and Exit checklist subsections). Every role's Behaviour starts with "Check the stage table; if an earlier stage isn't `Approved`, name it and stop" and ends with "Run the exit checklist, set your stage to `In review`, stop for the owner."
  - Implement `checkWorkflowDocs` (README + role files).

- [ ] **Step 4: Run** the tests → pass.

- [ ] **Step 5: Commit** — `git add docs/workflow scripts/workflow-check.*` · `workflow: overview and role definitions`.

---

### Task 3: Templates

**Files:**
- Create: `docs/workflow/templates/{feature-README,1-business,2-architecture,3-stories,4-test-plan,5-implementation,change}.md`
- Modify: `scripts/workflow-check.mjs`, `scripts/workflow-check.test.mjs`

**Interfaces:**
- Consumes: `parseStageTable`, `checkStages` (Task 1); `checkWorkflowDocs` (Task 2) — extended, same signature.

- [ ] **Step 1: Failing test** — integration `checkWorkflowDocs(repoRoot)` → `[]` now also requires all seven templates, and `feature-README.md` and `change.md` each contain a stage table that parses to 5 rows, all `—`, passing `checkStages`.

- [ ] **Step 2: Run** → FAIL (missing templates).

- [ ] **Step 3: Write the templates.** Section headings come from the spec: `1-business.md` (§2.1 Writes list), `2-architecture.md` (§2.2 — the sections of today's `docs/features/template.md`: User Flow, UI + states, HTMX Interactions, Routes / Handlers, Data Model, Business Rules / Validation, Security Considerations, plus Components & data flow and Decisions), `3-stories.md` (US / AC Given-When-Then / `Covers: BR-…` example), `4-test-plan.md` (UC list; TC table `| TC | Level | File | Proves | Data/fakes |`; Not automated; Results table `| TC | Result | Evidence |`), `5-implementation.md` (task list grouped by story with files + TCs; As-built notes; Deviations sent upstream), `feature-README.md` (Summary, Status line `Proposed | In progress | Shipped | Deprecated`, stage table, links, Known limitations), `change.md` (spec §3 block). Each template's first line under the title is a one-line "Owner role:" note; no other instructions inside templates (they live in the role files).
  - Extend `checkWorkflowDocs`.

- [ ] **Step 4: Run** → pass.

- [ ] **Step 5: Commit** — `workflow: document templates`.

---

### Task 4: Top-level docs and retiring `template.md`

**Files:**
- Modify: `CLAUDE.md`, `AGENTS.md`, `docs/skills/{go-backend,htmx-ui,postgres,tailwind-ui}/SKILL.md` (their `template.md` references)
- Delete: `docs/features/template.md`
- Modify: `scripts/workflow-check.mjs`, `scripts/workflow-check.test.mjs`

**Interfaces:**
- Produces: `checkTopLevelDocs(root: string): string[]` in `checkRepo` — `CLAUDE.md` and `AGENTS.md` each contain a `## Workflow` heading, the path `docs/workflow/`, and the five role names; no file outside `docs/superpowers/` mentions `docs/features/template.md`.

- [ ] **Step 1: Failing test** — integration `checkTopLevelDocs(repoRoot)` → `[]`.
- [ ] **Step 2: Run** → FAIL (no Workflow section).
- [ ] **Step 3: Edit.** Add `## Workflow` to both files (after "Read before working in an area"): five stages, one line per role (reads → writes), approval rule, light vs full, superpowers-in-every-role with their output in role docs, `docs/superpowers/` holds only non-feature work and history, pointer to `docs/workflow/README.md`. In "Read before working in an area": features have a folder `docs/features/<feature>/` or a legacy single doc migrated on first touch; new ones start from `docs/workflow/templates/`. Replace each `template.md` reference in the four skill docs with `docs/workflow/templates/`. `git rm docs/features/template.md`.
- [ ] **Step 4: Run** `node --test scripts/workflow-check.test.mjs` → pass; `npm run test:unit` → `fail 0`.
- [ ] **Step 5: Check the staged diff** of CLAUDE.md/AGENTS.md for edits from other sessions, then commit — `workflow: Workflow section in CLAUDE.md/AGENTS.md; retire template.md`.

---

### Task 5: Entry-point skills

**Files:**
- Create: `.claude/skills/{business,architect,tester,developer}/SKILL.md` (needs owner approval: sandbox-protected path)
- Modify: `scripts/workflow-check.mjs`, `scripts/workflow-check.test.mjs`

**Interfaces:**
- Produces: `checkSkills(root: string): string[]` in `checkRepo` — each SKILL.md has frontmatter `name: <role>` and a `description:`, and its body references `docs/workflow/README.md` and `docs/workflow/roles/<role>.md`.

- [ ] **Step 1: Failing test** — integration `checkSkills(repoRoot)` → `[]`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Write the four skills.** Description triggers on `/<role>` and the role's intent (e.g. business: "define or change business requirements / a BRD for a feature or fix"). Body: read the two workflow files and follow them; argument is the feature slug (and for tester `plan|verify`, default from the stage table). Commit only `.claude/skills/` — the rest of `.claude/` stays untracked.
- [ ] **Step 4: Run** → pass.
- [ ] **Step 5: Commit** — `git add .claude/skills scripts/workflow-check.*` · `workflow: /business /architect /tester /developer skills`.

---

### Task 6: Pilot — migrate Bus Stop Finder and record the permission fix

**Files:**
- Create: `docs/features/bus-stop-finder/{README,1-business,2-architecture,3-stories,4-test-plan,5-implementation}.md`, `docs/features/bus-stop-finder/changes/2026-11-15-location-permission.md`
- Delete: `docs/features/bus-stop-finder.md`
- Modify: every file listed by `checkDocLinks` after the delete (≈30 code comments, `.env.example`, `Makefile`, `docs/features/projects.md`, `CLAUDE.md`/`AGENTS.md` feature table)

**Interfaces:**
- Consumes: templates (Task 3), `/architect` behaviour (Task 2), `checkRepo` (Tasks 1–5).

- [ ] **Step 1: Split** per spec §4 "Migrating legacy single-file docs", using `/architect` and its superpowers. Section names in `2-architecture.md` keep the old headings (Business Rules / Validation, Data Model, Go contracts, Security Considerations, Routes / Handlers) so comments citing them stay meaningful. Verify every claim against the code while moving it; list corrections in the README. Derive `US-n`/`AC-n.m` from the User Flow and UI-state table; list the existing Go/JS/Playwright tests as `TC-n` in `4-test-plan.md` with their files. README stage table: all five rows `Approved` with the owner's approval date (Implementation: `plan` and `built` both that date, noted "shipped before the workflow").
- [ ] **Step 2: Owner review of the split** — stop and ask the owner to approve the folder. Do not delete the old file before approval.
- [ ] **Step 3: Change file** `changes/2026-11-15-location-permission.md` from `change.md`: Business (phone shows "turned off" without ever being asked; expected: ask when not yet given, follow the permission state, explain http), Design (cause: insecure context + ignored permission state; approach and files from commits `3b31c3f`, `a068873`), Test cases (the five `location permission state` Playwright tests), Implementation and Verification (44 passed / 2 skipped, Chromium + WebKit, 2026-11-15), marked "recorded after the fact". Fold its stories into `3-stories.md`.
- [ ] **Step 4: Delete and repoint** — `git rm docs/features/bus-stop-finder.md`; run `node -e` over `checkDocLinks` to list dangling references; repoint each to `docs/features/bus-stop-finder/2-architecture.md` (or `README.md` for general mentions); update the CLAUDE.md/AGENTS.md table Doc cell to `bus-stop-finder/`.
- [ ] **Step 5: Verify** — `node --test scripts/workflow-check.test.mjs` → pass (checkFeatureFolders validates the new folder and change file; checkDocLinks finds nothing dangling); `make check` → pass (only comments changed in Go).
- [ ] **Step 6: Commit** — `bus-stops: migrate feature doc to the workflow folder; record the permission fix`.

---

### Task 7: Dry run of the gates

**Files:** none committed (scratch feature `docs/features/zz-dry-run/`, removed afterwards).

- [ ] **Step 1:** Invoke `/business zz-dry-run` with a made-up change ("show a 'last updated' time on the landing page"). Expected: it invokes brainstorming, asks one question at a time, proposes a track, writes no routes/files, ends at `In review`.
- [ ] **Step 2:** Without approving, invoke `/architect zz-dry-run`. Expected: refuses, naming stage 1.
- [ ] **Step 3:** Approve stage 1; invoke `/architect`. Expected: stage 1 shows `Approved` + today's date; architect proceeds.
- [ ] **Step 4:** Hand-edit the table to set row 4 `Approved`; run `node --test scripts/workflow-check.test.mjs`. Expected: FAIL naming the out-of-order row. Revert.
- [ ] **Step 5:** `rm -r docs/features/zz-dry-run`; `git status` clean of it. Report each expected/actual to the owner.
