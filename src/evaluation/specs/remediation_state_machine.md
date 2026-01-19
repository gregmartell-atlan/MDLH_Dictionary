# Remediation State Machine (Capability-Centric)

This document defines the deterministic state machine and recomputation rules for capability remediation.
It is **not** task/project management. Progress is observed via evidence deltas and gap disappearance.

## Definitions

### Core objects
- **Capability**: The home object users choose (e.g., `ai.rag`).
- **Requirements**: Deterministic set derived from (Capability → catalog) + (Requirement Modifiers).
- **Evidence**: Signals pulled from Atlan (read-only), representing current reality.
- **Gaps**: Missing/unknown evidence required by requirements, computed deterministically.
- **Constraints & Assumptions**: User-editable inputs that change planning scope/priority/requirements without editing plan actions.

### Evidence signals (examples)
- OWNERSHIP, LINEAGE, SEMANTICS, SENSITIVITY, ACCESS, USAGE, FRESHNESS
- Missing signals must be treated as **UNKNOWN** (not inferred).

### Canonical progress rule
A remediation is **done** when a **gap no longer exists** after recomputation.

---

## State machine

### States
1. **DEFINED**
   - Capability selected
   - Requirements resolved from catalog + modifiers
   - No evaluation run yet

2. **EVALUATED**
   - Evidence pulled (Atlan)
   - Scores computed
   - Gaps computed

3. **PLANNED**
   - Logical model exists for capability scope (template or user-edited)
   - Plan derived from gaps + constraints (read-only output)

4. **REMEDIATING**
   - At least one follow-up evaluation run has occurred after baseline
   - Evidence deltas exist OR gaps/scores have changed over time

5. **ENABLED**
   - No blocking gaps remain (per current requirements and scope)
   - Note: Capability can regress back to earlier states if evidence changes or requirements change.

---

## Transitions (deterministic)

### T1: Define capability
`(none) -> DEFINED`
Trigger:
- User selects capability + scope
- System resolves requirements

### T2: Evaluate
`DEFINED -> EVALUATED`
Trigger:
- Evidence pull completes
- Compute scores + gaps

### T3: Plan derived
`EVALUATED -> PLANNED`
Trigger:
- Logical model exists (template or created)
- Compute model coverage
- Generate plan from gaps + constraints

### T4: Subsequent evaluation run
`EVALUATED or PLANNED or ENABLED -> REMEDIATING`
Trigger:
- Any evaluation run after baseline
- Evidence deltas computed and stored
- Gaps/scores recomputed

### T5: Enabled
`EVALUATED or PLANNED or REMEDIATING -> ENABLED`
Condition:
- Blocking gap set is empty (for active requirements and scope)
- UNKNOWN gaps count = 0 for required signal types OR explicitly waived via requirement modifiers

### T6: Regression (allowed and explicit)
`ENABLED -> EVALUATED or REMEDIATING`
Trigger:
- Evidence removal/expiry/regression (e.g., lineage disappears, owner removed)
- Requirements change (e.g., asset becomes PII causing sensitivity requirement activation)
- Scope constraint changes (e.g., Tier-1 expanded)

---

## Evaluation runs

### EvaluationRun
Each run produces an immutable snapshot:
- `requirementsResolved` (ids + modifiers applied)
- `scopeResolved` (domains/systems/asset filters)
- `evidenceSnapshot` (signals)
- `scoresSnapshot`
- `gapsSnapshot`
- `planSnapshot` (optional; derived if requested)

### Baseline
- The first completed EvaluationRun for a capability+scope is **baseline**.
- All progress is measured relative to baseline unless the user explicitly resets baseline.

---

## Evidence delta model (feed)

### EvidenceDelta (computed between runs)
For each asset or domain:
- `signalType`
- `deltaType`: ADDED | REMOVED | CHANGED
- `before`, `after`
- `observedAt`
- `atlanUrl` / references

This powers:
- update feed
- explanation regeneration
- auditability

---

## Gap model

### Gap categories
- **MISSING_SIGNAL**: required signal absent
- **UNKNOWN_SIGNAL**: signal cannot be evaluated with available evidence (must be explicit)
- **CONFLICT**: signal exists but violates requirement (optional; if introduced)

### Gap severity
Deterministic mapping (example):
- HIGH: blocking requirement for capability OR Tier-1 scope
- MED: non-blocking requirement OR Tier-2
- LOW: informational

---

## Scores (high-level)

Scores are computed deterministically from evidence:
- **Impact**: usage/importance signals (if missing, default low with explicit explanation)
- **Quality**: coverage across required signal types
- Missing signals yield UNKNOWN dimension; never guessed.

---

## Planning (derived, read-only)

Plan generation consumes:
- current gaps
- constraints (priority + scope + effort heuristics)
Outputs:
- 3 phases (Minimum viable / Expanded coverage / Hardening)
- grouped by workstream
- action entries include: scope, effort bucket, expected effect (gaps closed / score movement)

User changes occur by editing constraints/modifiers, then regenerating plan.

---

## Implementation checklist
- Store EvaluationRuns per capability
- Store EvidenceSignals per run
- Compute and store EvidenceDeltas between consecutive runs
- Compute and store Gap snapshots per run
- Compute derived State from latest run + baseline presence + gap emptiness
