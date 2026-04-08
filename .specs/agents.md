# Waymark — Agent Reference

This document describes the spec file format, implementation workflow, and conventions so any AI agent can read, understand, and work with specs in this project. Point any agent at this file for full context.

**This file is the single source of truth for agent behavior.** If you're an AI agent implementing a feature, read this entire document before starting.

**For system architecture:** See `ARCHITECTURE.md` in the project root for the full technical architecture, database schema, API surface, and data flows. That document is written for agents without codebase access.

## Generating ARCHITECTURE.md

Every project using Waymark should have an `ARCHITECTURE.md` in the project root. Generate it by having an AI agent with codebase access (Claude Code, Cursor, etc.) analyze the project. The document should cover:
- Directory structure with purpose of each major directory
- Tech stack (runtime, framework, database, deployment)
- Database schema (every table, key columns, relationships)
- API surface (every endpoint group with paths and purpose)
- Key systems and patterns (auth, data flow, state management)
- Configuration (env vars, config files)
- Data flows for common operations

Store as `ARCHITECTURE.md` in the project root. This gives the Waymark AI agent the context to create accurate specs without reading source files.

## Your Role

You are a **planning and implementation agent**. When planning: you create specs, analyze them, and organize dependencies. When implementing: you follow the spec and brief precisely, mark progress, and verify criteria.

**You do NOT manage execution infrastructure.** You don't create branches, start other agents, or monitor progress. You produce documents (specs, briefs, implementation summaries) and write code.

## File Structure

```
.specs/
├── .specconfig.yaml          # Project config: techstack, conventions, requirements
├── roadmap.yaml              # Milestones with target dates and status
├── agents.md                 # This file — agent reference documentation
├── features/                 # Feature specifications (one file per feature)
│   ├── feature-id.md
│   └── ...
└── briefs/                   # Generated implementation briefs
    └── feature-id/
        ├── brief.md           # Single-agent brief (everything you need)
        ├── brief-agent-name.md # Per-agent briefs (team handoff)
        ├── orchestration.md   # Team coordination file
        └── implementation-summary.md  # Written after implementation
```

## Feature Spec Format

Each feature is a markdown file with YAML frontmatter:

```markdown
---
id: feature-id
title: Human Readable Title
status: draft|speccing|planned|ready|in-progress|complete
milestone: milestone-id
priority: low|medium|high|critical
depends_on: other-feature, another-feature
handoff: single|team
---

## Overview
What this feature does and why. 1-2 paragraphs.

## Requirements
- Specific, actionable requirement
- Another requirement

## Technical Design
Architecture decisions, API contracts, data flow.

## Acceptance Criteria
- [ ] Testable criterion that defines "done"
- [ ] Another testable criterion

## Tasks
- [ ] Task description | backend, frontend
- [ ] Another task | testing

## Open Questions
- [ ] Is X the right approach or should we consider Y?
- [ ] What happens when Z fails?
```

**Format rules:**
- Open Questions are simple checklist items (`- [ ] Question?`), **NOT** grouped under headers
- Acceptance Criteria are checklist items, each must be independently testable
- Tasks use `| tag1, tag2` suffix for categorization
- All sections must be present
- Feature IDs are kebab-case derived from the title
- New features default to `milestone: backlog` unless specified

### Status Flow

```
draft → speccing → planned → ready → in-progress → complete
```

- **draft**: Initial idea, incomplete
- **speccing**: Being specified, sections being filled in
- **planned**: Spec is written, not yet approved
- **ready**: Brief generated, ready for implementation
- **in-progress**: Currently being implemented
- **complete**: Done, acceptance criteria verified, implementation summary written

## Quality Standards

When creating or reviewing specs:
- Requirements must be specific and actionable, not vague
- Acceptance criteria must be testable — "user can log in" not "auth works"
- Tasks should be tagged with areas (backend, frontend, testing, etc.)
- Each acceptance criterion should have at least one task that delivers it
- Features should be well-scoped — one deliverable, not multiple features hiding as one
- Don't over-scope: if something is complex or uncertain, put it in Open Questions rather than listing it as a requirement
- Max tasks per feature is defined in .specconfig (usually 10). If you need more, the feature should be split.
- Remove redundant information — specs should be as short as possible while clearly specifying what needs to be done
- Don't answer your own open questions — if the Technical Design already answers it, remove the question

## Implementation Lifecycle

Features follow this lifecycle:
1. **Draft/Speccing** — feature is being planned and written
2. **Planned** — spec is complete, ready for review
3. **Ready** — brief has been generated, spec approved for implementation
4. **In-progress** — an agent is implementing it
5. **Complete** — all tasks done, acceptance criteria verified, implementation summary written

**Briefs** are generated from complete specs and stored in `.specs/briefs/<feature-id>/`. A brief contains everything an implementing agent needs: the spec content, project standards, constraints, and context. For team handoffs, multiple per-agent briefs are generated with an orchestration file.

**Implementation summaries** are written by the implementing agent after completion. They document: what was built, decisions made, files created/modified, and how criteria were verified. These are the primary handoff document for dependent features.

**Execution metadata (`execution.json`)** is written by the implementing agent after completion, alongside the implementation summary. It captures structured data about the execution for display in the Waymark UI.

Store it at `.specs/briefs/<feature-id>/execution.json`:

```json
{
  "featureId": "my-feature",
  "agent": "Claude:my-feature",
  "startedAt": "2026-03-24T13:00:00Z",
  "completedAt": "2026-03-24T13:16:32Z",
  "durationMs": 992000,
  "outcome": "success",
  "tasksCompleted": 6,
  "tasksTotal": 6,
  "criteriaVerified": 5,
  "criteriaTotal": 5,
  "plan": null,
  "documents": [
    "implementation-summary.md",
    "error-strategy.md"
  ],
  "filesChanged": 9,
  "notes": "Brief description of what was done."
}
```

**Schema fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `featureId` | string | yes | The feature ID that was implemented |
| `agent` | string | yes | Name of the implementing agent (e.g. `"Claude:feature-id"`) |
| `startedAt` | string (ISO 8601) | yes | When implementation started |
| `completedAt` | string (ISO 8601) | yes | When implementation finished |
| `durationMs` | number | yes | Total duration in milliseconds |
| `outcome` | `"success"` \| `"error"` \| `"skipped"` | yes | Final outcome |
| `tasksCompleted` | number | yes | Number of tasks marked done |
| `tasksTotal` | number | yes | Total number of tasks |
| `criteriaVerified` | number | yes | Number of acceptance criteria verified |
| `criteriaTotal` | number | yes | Total number of acceptance criteria |
| `plan` | object \| null | no | Plan context if executed as part of a plan |
| `plan.name` | string | — | Plan name |
| `plan.phase` | string | — | Phase name within the plan |
| `plan.parallel` | boolean | — | Whether this feature ran in parallel with others |
| `documents` | string[] | no | List of extra documents produced (filenames in the briefs dir) |
| `filesChanged` | number | no | Number of source files created or modified |
| `notes` | string | no | Free-form notes about the implementation |

**When to write it:** After writing the implementation summary (Step 5), write `execution.json` with the execution metadata. This is the last file you write before marking the feature complete.

**Handoff between dependent features:**
- Feature B depends on Feature A
- Feature A must be complete before B starts
- Feature B's implementing agent reads A's implementation summary for context
- The brief for Feature B includes context about its dependencies

**Handoff modes:**
- `single` — one agent implements the entire feature
- `team` — multiple agents work on different parts, coordinated by an orchestration file

## Implementation Workflow

**Follow these steps IN ORDER when implementing a feature.**

### Step 1: Read everything

1. Read the brief at `.specs/briefs/<feature-id>/brief.md`
2. Read the feature spec at `.specs/features/<feature-id>.md`
3. Read `.specs/.specconfig.yaml` for project standards
4. Read this file (`agents.md`) if you haven't already
5. Read the existing codebase to understand patterns and structure

**Do not skip this step.** Even if you think you know the content, the spec or brief may have been updated.

### Step 2: Analyze before coding

Before writing any code, think through:

- Do the tasks cover what the acceptance criteria require?
- Is the technical design clear enough to implement from?
- Are there conflicts with existing code?
- Are there edge cases not addressed?
- Can you explain what you're building in one paragraph?

**If anything is unclear: ask the user.** Do not guess. Do not assume.

### Step 3: Implement

1. Update status to `in-progress` in the frontmatter
2. Work through tasks in order
3. **Mark each task `[x]` immediately after completing it** — do not batch
4. Follow project standards from `.specconfig.yaml`
5. Respect constraints from the brief (DO NOT implement/modify things outside scope)

**During implementation, if you discover:**
- A task is more complex than expected → tell the user
- The spec is wrong → stop and report
- You need to modify something outside scope → ask permission

### Step 4: Verify

After all tasks are done:

1. Go through each acceptance criterion
2. Verify it's satisfied (test, code review, run it)
3. Mark `[x]` and note how you verified
4. If it needs manual testing, say so explicitly

### Step 5: Write implementation summary

Create `.specs/briefs/<feature-id>/implementation-summary.md`:

```markdown
# Implementation Summary: <feature-title>

## Overview
One paragraph: what was built and the approach taken.

## Decisions Made
- Decision 1 — why it was made
- Decision 2 — alternatives considered

## Files Created
- path/to/file — what it does

## Files Modified
- path/to/file — what changed and why

## Acceptance Criteria Verification
- [x] Criterion 1 — how verified
- [x] Criterion 2 — how verified

## Known Limitations
- Anything not covered or edge cases not handled
```

### Step 6: Complete

1. Update status to `complete` in the frontmatter
2. Verify the implementation summary exists
3. Report to the user:
   - Tasks completed: X/Y
   - Criteria verified: X/Y
   - Any items needing manual testing

## For Planning Agents

When helping a user plan (not implement):

1. Read existing specs to understand project scope
2. Check quality: does each spec have required sections, reasonable task count, declared dependencies?
3. Suggest improvements: missing criteria, overly broad features, undeclared dependencies
4. Create new specs following the format above
5. Features should be well-scoped — one clear deliverable per feature
6. When a feature involves orchestration, produce plan documents — not execution engines

## Conventions

- One feature per file, filename matches the `id` field
- Use kebab-case for IDs: `user-authentication`, not `userAuthentication`
- Dependencies reference feature IDs, not filenames
- Briefs are generated, not hand-written — but you can edit them
- Implementation summaries are written by the implementing agent after completion
- The spec file is the source of truth. If the brief disagrees with the spec, the spec wins.

## MCP Integration (SaaS)

If you're connected to Waymark via MCP, you have live access to project data and can report progress in real-time.

### Connection

Configure your MCP client with:
- **Transport:** Streamable HTTP
- **URL:** `https://waymark.berge.tech/api/mcp`
- **Auth:** `Authorization: Bearer <your-api-key>`

API keys are user-scoped — one key gives access to all your projects. Generate keys from the Waymark dashboard.

### Available Tools

**Read tools:**
- `list_projects` — list all projects you have access to
- `set_project` — set the active project for subsequent calls
- `list_features` — list features with optional filters (status, milestone, priority)
- `get_feature` — get full feature spec content
- `get_brief` — get the implementation brief for a feature
- `get_config` — get the project .specconfig.yaml
- `get_roadmap` — get milestones with status
- `check_readiness` — run quality analysis on a feature
- `get_next_feature` — get ready features sorted by priority (deps met)

**Write tools:**
- `start_feature` — lock a feature and begin tracking
- `report_task` — mark a task as done (progress overlay, not spec mutation)
- `report_error` — log an error
- `complete_feature` — signal completion and release lock
- `heartbeat` — keep the lock alive (locks expire after 10 min without heartbeat)

### Implementation Workflow with MCP

When implementing a feature with MCP connected:

1. Call `set_project` to select the project
2. Call `get_brief` (or `get_feature`) to read the implementation brief
3. Call `start_feature` to lock the feature and announce you're working on it
4. **Start a heartbeat loop** — call `heartbeat` every 5 minutes in the background to keep the lock alive
5. Implement the feature following the standard workflow (read spec → analyze → implement → verify)
6. As you complete each task, call `report_task` with the task index — this updates the board in real-time
7. If you hit an error, call `report_error` to log it
8. When done, call `complete_feature` to release the lock and log completion
9. **Stop the heartbeat loop**
10. Push your changes via git as usual — the spec file updates will reconcile with the progress overlay

**Important:** `report_task` creates a progress **overlay** — it does NOT modify the spec file. The spec is owned by git. When you push your changes (with tasks marked `[x]` in the markdown), the overlay reconciles automatically.

### Plan Execution Mode

When executing a plan (multiple features in sequence), the workflow changes:

1. Call `get_plan` to see the active plan, phases, and progress
2. Call `get_next_assignment` to get your next feature — it returns the brief, dependency context, and info about parallel features
3. Implement the feature using the standard workflow (read → analyze → implement → verify → summary → complete)
4. **Skip the user checkpoint between features** — don't wait for approval between features. Just log completion and get the next assignment.
5. After `complete_feature`, immediately call `get_next_assignment` again
6. Repeat until `get_next_assignment` returns null (plan complete)
7. Report a final summary of all features implemented

**Error handling during plans:**
- If you encounter an error, call `report_error`
- If the plan has `onError: "pause"`, `get_next_assignment` will return "paused" — stop and wait for the user to resume
- If the plan has `onError: "continue"`, skip the failed feature and move to the next one
- Always log errors clearly so the user can see what happened in the activity feed

**Parallel features:**
- `get_next_assignment` tells you which other features in the same phase are being worked on by other agents
- If you notice a potential conflict (same files, overlapping concerns), call `report_error` to flag it

### Multi-Project Usage

If you work across multiple projects, call `set_project` to switch context. Alternatively, pass `projectId` as a parameter to any tool call.
