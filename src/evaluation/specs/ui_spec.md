# UI Spec (Capability-Centric)

This UI is capability-first. Every screen is anchored to a selected capability within a run.

## Global navigation
- Runs list (optional)
- Current Run
  - Capabilities list (selected)
  - Each capability has tabs:
    - Overview
    - Gaps
    - Plan (derived)
    - Progress

## Screens

### 1) Start (create run)
Route: `/start`
Purpose:
- Choose capabilities (AI + Data)
- Optional scope constraints (domains/systems)
Output:
- Creates Run + attaches chosen capabilities
Actions:
- "Create run" → navigates to capability list

### 2) Capability Overview
Route: `/capability/:runId/:capabilityId`
Contents:
- Capability state (DEFINED/EVALUATED/PLANNED/REMEDIATING/ENABLED)
- Last evaluated time, baseline run id, latest run id
- Impact×Quality quadrant for this capability's top domains/assets
- "Evaluate now" CTA
- "Derive plan" CTA (enabled once evaluated)

### 3) Gaps
Route: `/capability/:runId/:capabilityId/gaps`
Contents:
- Blocking gaps (HIGH severity) first
- Suppressed gaps section (explicitly not done)
- Filters: workstream, severity, subjectType, domain
Each gap row must show:
- gapType
- subject (domain/asset)
- severity
- explanation
- evidence links (Atlan URLs)
Actions:
- "Add constraint" (opens constraint editor)
- "Re-evaluate"

### 4) Plan (derived, read-only)
Route: `/capability/:runId/:capabilityId/plan`
Contents:
- 3 phases
- Workstream grouping inside each phase
Each action card:
- workstream
- scope (domains/assets/model elements)
- effort bucket (S/M/L)
- expected effect (gap types expected to close)
- evidence/rationale references
Actions:
- "Regenerate plan" (after constraints changes)
- "Export markdown"

### 5) Progress (observed)
Route: `/capability/:runId/:capabilityId/progress`
Contents:
- Gap trajectory over evaluation runs (count over time)
- Quadrant movement summary (baseline vs latest)
- Evidence delta feed (ADDED/REMOVED/CHANGED)
Actions:
- "Evaluate now"
- "Reset baseline" (guarded; creates new baseline pointer)

## Constraint editor (modal / page)
Purpose:
- Edit priority constraints, scope constraints, requirement modifiers, assumptions
Rules:
- Every save creates an immutable revision with rationale
- No plan actions editable here

Fields:
- Priority: capability priority H/M/L
- Scope: included/excluded domains/systems
- Tiering: Tier-1 domains/assets (optional)
- Requirement modifiers: mandatory/optional/waived with rationale
- Assumptions: free text (non-scoring)

## UX rules (non-negotiable)
- Every score and gap has an explanation.
- UNKNOWN is prominent, never buried.
- No task/status/assignee UI anywhere.
