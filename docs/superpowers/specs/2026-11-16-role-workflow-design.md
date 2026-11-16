# Role-based feature workflow — design

Date: 2026-11-16. Status: proposed (awaiting review).

## Goal

Make every change to this site follow one consistent, gated flow in which
Claude plays four roles in turn and the owner approves each hand-off:

1. **Business** — defines the business requirement document (BRD).
2. **Architect** — defines the solution architecture and derives user
   stories from it.
3. **Tester (plan)** — defines use cases and the test plan from the stories,
   before any code.
4. **Developer** — plans and builds the implementation from the stories,
   test-first against the Tester's cases.
5. **Tester (verify)** — runs the plan against the build and records
   evidence.

Success: a reader can open any feature folder and see what was asked, what
was designed, what was promised to be tested, what was built, and proof it
works — and no stage started before the one above it was approved.

### Decisions taken (brainstorm, 2026-11-16)

| Question | Decision |
| --- | --- |
| Who performs the roles | Claude plays each role; the owner approves every hand-off. |
| Where role output lives | One folder per feature, one numbered doc per role. |
| When the Tester works | Test plan before code; verification after. |
| Which work uses the flow | Everything; small fixes take a light track. |
| Superpowers | Always apply in every role; each role has a fixed set of skills (section 2), whose output goes into the role docs. |
| Mechanism | Tool-neutral role definitions in `docs/workflow/`, thin Claude skills as entry points, a Workflow section in CLAUDE.md and AGENTS.md (approach A; subagent-per-role and rules-only were rejected — subagents can't interview the owner, rules alone don't enforce order). |

### Out of scope

* Converting all ~25 existing feature docs now (they migrate on first touch).
* Any automation outside the conversation (CI checks of the status table,
  hooks). Revisit only if approvals get skipped in practice.
* Changing how code, tests or commits work; `make check`, TDD, the skills in
  `docs/skills/` and the "docs match code" rule all stay.

---

## 1. Feature folder and status tracking

```text
docs/features/<feature>/
├── README.md            entry point: summary, current stage, approvals, links
├── 1-business.md        Business   — BRD
├── 2-architecture.md    Architect  — solution architecture
├── 3-stories.md         Architect  — user stories with acceptance criteria
├── 4-test-plan.md       Tester     — use cases + test plan, then results
├── 5-implementation.md  Developer  — task plan, then as-built notes
└── changes/             light-track change records (section 3)
```

Files are numbered in the order they are written (the test plan precedes
the implementation).

`README.md` holds the stage table, the single source of truth for progress:

| # | Stage | Role | Status | Approved |
| - | ----- | ---- | ------ | -------- |
| 1 | Business | Business | Approved | 2026-11-16 |
| 2 | Architecture + stories | Architect | Draft | — |
| 3 | Test plan | Tester | — | — |
| 4 | Implementation | Developer | — | — |
| 5 | Verification | Tester | — | — |

Rules:

* Status is one of `—`, `Draft`, `In review`, `Approved`,
  `Changes requested`.
* Only the owner's explicit approval in the conversation sets `Approved`
  (with the date). A role never approves its own stage.
* A role starts only when every stage above it is `Approved`. If not, it
  says which stage is blocking and stops.
* **Change requests flow upstream.** A later role that finds an earlier
  approved doc wrong does not work around it: it sets that stage to
  `Changes requested` with a one-line reason, and the owning role revises
  it for re-approval. Stages below a re-opened stage drop back to `Draft`
  only if the revision affects them; the revising role says which.
* The Developer's stage has two approvals: the task list (before code) and
  the as-built notes (after). The table records both dates.
* When verification passes, the README's status line becomes `Shipped`.

**Living reference.** The README summary plus `2-architecture.md` (and
`3-stories.md`) are the docs that must match the code — CLAUDE.md's
existing "update the doc in the same commit" rule applies to them. The BRD
records intent and changes only when requirements change.

---

## 2. Roles

Each role is defined once in `docs/workflow/roles/<role>.md` with five
parts: **Reads**, **Writes** (with its template in
`docs/workflow/templates/`), **Superpowers**, **Behaviour**, **Exit
checklist**. A role runs its exit checklist and fixes failures before
asking for approval, then sets its stage to `In review` and stops.

### Superpowers in every role

Superpowers skills always apply: every role invokes the skills listed for
it before doing its work, follows them, and treats the workflow as the
user preference that sets *where* their output goes — into the role docs
in the feature folder, never a separate `docs/superpowers/specs|plans`
file. Where a skill and the workflow both define a gate, both apply (the
stricter wins).

| Role | Superpowers skills | Output lands in |
| ---- | ------------------ | --------------- |
| Business | `brainstorming` — its discovery part: classify the request (maps to light vs full), one question at a time, write back understanding for correction. Stops before design. | `1-business.md` / change file *Business* |
| Architect | `brainstorming` — approaches with trade-offs, sectioned design approval, spec self-review; `systematic-debugging` for a bug's root cause before any design | `2-architecture.md`, `3-stories.md` / *Design* |
| Tester (plan) | `test-driven-development` — every TC is written so it can be seen failing first | `4-test-plan.md` / *Test cases* |
| Developer | `writing-plans` (the task list); `using-git-worktrees` when work runs beside other sessions; `test-driven-development`; `executing-plans` or `subagent-driven-development` (owner picks, as writing-plans asks); `systematic-debugging` on any failure; `requesting-code-review` before the as-built approval; `finishing-a-development-branch` at the end | `5-implementation.md` / *Implementation* |
| Tester (verify) | `verification-before-completion` — no pass claimed without fresh evidence; `systematic-debugging` to triage failures before routing them | `4-test-plan.md` results / *Verification* |

`using-superpowers` stays the session-level rule (check for skills before
any action); the table names which ones each role must use, so none is
skipped.

### 2.1 Business → `1-business.md`

* **Reads:** the owner's request; existing feature docs for context.
* **Behaviour:** interviews the owner one question at a time (purpose,
  users, success, constraints). Proposes light vs full track (section 3).
  Writes no technical design — no files, routes, tables or libraries.
* **Writes:** background and problem; goals and success measures; users;
  business requirements `BR-1…` phrased must/should/could; in scope / out
  of scope; constraints (privacy, cost, deadlines); assumptions; open
  questions.
* **Exit checklist:** every BR is testable in plain language; no technical
  decisions; no placeholders; open questions are either resolved or listed
  as blocking.

### 2.2 Architect → `2-architecture.md`, `3-stories.md`

* **Reads:** the approved BRD; the code; `docs/skills/*`; CLAUDE.md.
* **Writes `2-architecture.md`:** components and data flow; UI and its
  states; HTMX interactions; routes/handlers; data model and migrations;
  business rules and validation; security; key decisions with rejected
  alternatives. (These are today's `template.md` sections, which move
  here.)
* **Writes `3-stories.md`:** `US-1…` as "As a … I want … so that …", each
  with acceptance criteria `AC-n.m` in Given/When/Then and a `Covers:
  BR-…` line.
* **Exit checklist:** every BR is covered by at least one story; every
  story maps to architecture elements; the design follows `docs/skills/*`
  or states why not.

### 2.3 Tester (plan) → `4-test-plan.md`

* **Reads:** approved architecture and stories.
* **Writes:** use cases `UC-1…` (main flow, alternate flows, error flows);
  test cases `TC-1…`, each with level (Go unit, JS unit, Playwright,
  manual), target file, the `AC` it proves, and data/fakes needed; a list
  of what can't be automated and why.
* **Exit checklist:** every AC has at least one TC; every TC names a
  level and a file.

### 2.4 Developer → `5-implementation.md`, then code

* **Reads:** all approved docs.
* **Writes first:** an ordered task list, grouped by story, each task
  naming the files it touches and the TCs it makes pass. Stops for
  approval.
* **Then builds** test-first using the TCs, following the existing repo
  conventions (`make check`, the relevant e2e specs, own server ports, no
  touching the owner's :8080 server).
* **Writes after:** as-built notes — what differs from the plan and why;
  each deviation that changes a story or the architecture is sent upstream
  as a change request, not silently patched. Updates the living docs in the
  same commit as the code.
* **Exit checklist:** all tasks done; every TC exists and passes; living
  docs match the code.

### 2.5 Tester (verify) → appends to `4-test-plan.md`

* **Behaviour:** runs every TC against the build and records
  pass/fail with evidence — the command and its output, screenshots for
  UI (saved under `/tmp/claude/<task>/`, referenced by absolute path, not
  committed).
* A failure goes back to the Developer, or upstream if the requirement or
  story is what's wrong.
* **Exit checklist:** every TC passed or was explicitly accepted by the
  owner; then the README status becomes `Shipped`.

---

## 3. Light track

For small fixes the same roles, order and gates apply, but all stages live
in one file: `docs/features/<feature>/changes/YYYY-MM-DD-<slug>.md`, from
`docs/workflow/templates/change.md`:

```markdown
# Change: <title>
Track: light   Feature: <feature>
<stage table, same columns as the feature README>

## Business        — problem as the user sees it, expected behaviour, BR-n affected
## Design          — cause, approach, files touched, stories added/changed (US/AC lines)
## Test cases      — TC lines: level, file, AC proved
## Implementation  — task list, then as-built note
## Verification    — results with evidence
```

* **Eligibility** (Business proposes, owner decides): within one existing
  feature, no new route, table or dependency, and no change to the intent
  of an existing BR. Otherwise full track. A light change that grows is
  upgraded to full and never downgraded.
* **Batched approval:** the owner may approve Business + Design + Test
  cases in one reply. Verification always follows the code.
* **Fold-back:** on completion the Architect merges lasting changes (new or
  changed stories, architecture facts) into the feature's
  `2-architecture.md` / `3-stories.md`. The change file stays as the record.
* A light change to a legacy single-file feature first triggers its
  migration (section 4).

---

## 4. Files, migration and rollout

### New

```text
docs/workflow/
├── README.md         the flow, approval rule, light vs full, status table
├── roles/{business,architect,tester,developer}.md
└── templates/{feature-README,1-business,2-architecture,3-stories,
               4-test-plan,5-implementation,change}.md

.claude/skills/{business,architect,tester,developer}/SKILL.md
```

Each skill is a thin wrapper: a description that triggers on `/business`
(etc.) and on the matching intent, and a body that says to read
`docs/workflow/README.md` and `docs/workflow/roles/<role>.md` and follow
them. `/tester` takes `plan` or `verify` (defaulting from the status
table). The sandbox can't write `.claude/skills/`; the owner approves
those writes or places the files.

### Changed

* **CLAUDE.md and AGENTS.md** get a short **Workflow** section: the five
  stages, one line per role (reads → writes), the approval rule, light vs
  full, and a pointer to `docs/workflow/`. "Read before working in an
  area" says each feature has a folder (or a legacy single doc not yet
  migrated); the feature table links folders as they appear. CLAUDE.md
  also states that superpowers skills apply in every role (section 2
  table) and that their specs and plans are written into the role docs,
  so `docs/superpowers/specs|plans` holds only work outside a feature
  (like this design) plus history.
* **`docs/features/template.md`** is deleted; its sections live in the
  role templates.

### Migrating legacy single-file docs (on first touch)

When any change touches a feature that still has a single
`docs/features/<feature>.md`, the Architect first splits it into the
folder, as its own reviewed stage of that change:

* Summary, Problem/Motivation, Scope → `1-business.md` (BRs extracted).
* User Flow, UI, HTMX, Routes, Data Model, Business Rules, Security →
  `2-architecture.md`.
* Stories derived from the user flow → `3-stories.md`.
* Testing Plan → `4-test-plan.md` (existing tests listed as TCs).
* Status, known limitations, open questions → `README.md`.

Every claim is checked against the code while splitting (these docs have
drifted before); the old file is removed in the same commit. Easy
Diagram's existing `easy-diagram/BUILD.md` becomes its
`5-implementation.md`.

### Rollout

1. Create `docs/workflow/` (README, roles, templates) and the CLAUDE.md /
   AGENTS.md sections; remove `template.md`.
2. Create the four skills.
3. Pilot: migrate `bus-stop-finder.md` to its folder and record the
   2026-11-16 location-permission fix as a light-track change file after
   the fact (its stories folded back into `3-stories.md`).
4. Dry run on a small made-up change to check the gates.

### Verifying the workflow

No code to unit-test; acceptance is the dry run:

* `/business` interviews rather than designs, and proposes a track.
* Each role invokes its superpowers skills from the section 2 table, and
  their output lands in the role doc, not `docs/superpowers/`.
* `/architect` (and each later role) refuses to start while an earlier
  stage isn't `Approved`, naming the blocking stage.
* Status rows change only on owner approval; a change request re-opens the
  right stage.
* The pilot's bus-stop folder is complete and consistent with the code.
