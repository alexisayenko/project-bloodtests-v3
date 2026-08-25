# Tasks — spec & conventions

This folder is the source of truth for every discrete unit of work
across the repo. One file per task: `task-XXXX.md`, where `XXXX`
is a zero-padded sequential id. The next task takes the id after
the current highest — don't recycle deleted ids.

Cross-slice orientation lives in
[`../concerns.md`](../concerns.md). The `concern` frontmatter
field on each task ties back to an entry there.

---

## When a task must exist

Before starting a feature, bugfix, refactor, or any substantive
change, confirm a task covers it. If no existing task fits, create
one first — **task-before-code, not task-after-code**.

Two-line explorations, trivial typo fixes, and one-off local
tweaks don't need a task. Anything that ends in a commit worth
tracking does.

---

## File layout

```markdown
---
task_id: task-0001
title: Short imperative sentence, no trailing period
concern: "C1 - [TODO: concern name]"
status: done
done_date: 2026-01-15
tags: [optional.tag]
---

# Task title (matches frontmatter)

Body: what, why, rationale. Not a changelog — that's what git is
for. Capture decisions and reasoning that wouldn't survive in a
commit message.
```

---

## Frontmatter fields

### Required

- **`task_id`** — `task-XXXX`, matches filename.
- **`title`** — short, imperative, no trailing period.
- **`status`** — one of:
  - `to do` — not started
  - `in progress` — actively being worked
  - `done` — shipped
  - `blocked` — waiting on something external
  - `cancelled` / `rejected` — decided not to pursue

### Optional

- **`concern`** — `"Cn - Concern Name"` where `Cn` maps to
  [`../concerns.md`](../concerns.md). Use to group tasks by
  cross-cutting work area.
- **`done_date`** — ISO date the task flipped to `done`.
- **`tags`** — flat list of string labels for cross-cutting
  groupings that don't fit `concern`.
- **`source`** — where the task was originally captured
  (e.g. `business/compliance.md`, `chat 2026-01-15`).
- **`parent_task`** — `task-XXXX` id of a parent task this is
  tailing off.
- **`time_entries`** + **`total_minutes`** — optional time
  tracking (see [Time tracking](#time-tracking-optional) below).

### Deliberately not a field

- **No `commits:` list, and no `commit:` on time entries.** The
  commit that adds the entry *is* the commit, recoverable via
  `git log -p docs/tasks/task-XXXX.md`. Inlining a hash creates a
  chicken-and-egg (the hash doesn't exist yet at save-time) and
  invalidates itself the moment anyone amends.

---

## Auto-commit is off

File edits — source, tasks, docs — stay in the working tree until
the user explicitly asks to commit. No speculative commits after
task work, bugfixes, or feature work. When the user *does* ask,
propose logical splits with a one- or two-line rationale per
proposed commit and wait for approval before running `git commit`.

Same rule for `git push` — confirm before sending anything to the
remote.

---

## Commit together with the work

Task-file updates — flipping `status`, adding tags — **ship in
the same commit as the work they describe**, not as a follow-up
commit after the fact.

The task file is part of the change, not accounting about the
change. Keeping them together means one commit answers both "what
shipped?" and "how much of this task is done?". Splitting doubles
the history for no gain and makes the
`git log -p docs/tasks/task-XXXX.md` trace ambiguous.

Applies to every kind of task-file update triggered by the work:
status transitions, tag changes, completion notes. The only
updates that land on their own are retrofits (acknowledging work
already shipped in a prior commit without the task update).

---

## Commit message names the task

Every commit that touches a task includes the **task number and
title** in its message. Format:

```text
<scope>: <summary> (task-XXXX — <task title>)
```

Examples:

```text
web: render painting detail (task-0042 — Painting detail page)
workers: validate license key (task-0078 — License-key validation)
tasks: close task-0014 — Seed catalog from source
```

Two benefits:

- `git log --grep=task-0042` becomes a full audit trail for that
  task without cross-referencing the file.
- Reviewers jump from commit → task context instantly.

If one commit lands work on multiple tasks, list them all:
`(task-0008, task-0145)`.

---

## Task completion

When a task ships, set `status: done` and add `done_date:
YYYY-MM-DD`. Don't delete — the history is load-bearing for time
accounting and for understanding how scope decisions played out.

Cancelled / rejected tasks stay too, with `status: cancelled` or
`status: rejected` and a body line explaining why.

---

## Rolling reports

Per-concern roll-ups live as named reports in this folder,
regenerated / updated whenever the underlying task frontmatter
changes:

- `C1.md` — every task with `concern: C1 - [...]`.
- `C2.md`, `C3.md`, … — one per concern, when populated.

Read these first at session start to orient. When a status
changes in a task file, update the matching roll-up in the
**same commit**.

### Roll-up shape

Group tasks under status headings so the report is scannable.
Sections are optional — drop empty ones. Order them most
actionable first (To do → In progress → Done is also valid).

```markdown
# C1 — [Concern name]

Roll-up of every task with `concern: C1 - …`. Updated whenever
the underlying task frontmatter changes (same commit as the
task).

## Done

- ✅ task-0001 — [task title]
- ✅ task-0003 — [task title]

## In progress

- 🔄 task-0007 — [task title]

## To do

- 🔲 task-0012 — [task title]
- 🔲 task-0014 — [task title]

## Blocked

- ⛔ task-0011 — [task title]
  · blocked on [external dependency]

## Cleared by analysis

- ❌ ~~task-0009~~ — [task title]
  · rejected 2026-01-15: [reason]
  · reopen trigger: [if condition]
```

Status glyphs are optional but help scanning. Pick a set and
stick to it across all roll-ups in the project.

### Strikethrough for items cleared by analysis

A roll-up item that gets cleared by reasoning (not by shipping
code) — "actually not blocking because X" — stays on the list
with a `~~strikethrough~~`, a short note of the evidence, and a
reopen trigger. Don't delete and don't renumber surrounding
items. The strikethrough is the audit trail.

Example:

```text
❌ ~~task-0120~~ — [task title]
   · rejected 2026-01-15: [reason]
   · reopen trigger: [if condition]
```

---

## Time tracking (optional)

Add when the project needs per-task time accounting. Append
`time_entries: []` and `total_minutes: 0` to the frontmatter; at
commit time, append:

```yaml
time_entries:
  - date: 2026-01-15    # ISO date
    time: "10:15"       # local clock time when logged
    minutes: 47         # integer, actual minutes (don't round)
total_minutes: 47
```

`time_entries` is the source of truth; `total_minutes` is derived.
Ship the entry in the same commit as the work — no separate "log
update" commit, no `--amend`.

---

## See also

- [`../concerns.md`](../concerns.md) — cross-cutting axes that
  tasks group around.
