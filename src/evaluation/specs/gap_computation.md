# Gap Computation (Requirements vs Evidence)

Gaps are computed deterministically for a capability+scope.

## Inputs
- resolved requirements for capability (including modifiers)
- evidence snapshot for subjects

## Outputs
Gap fields:
- gapType: MISSING_<SIGNAL> | UNKNOWN_<SIGNAL> | CONFLICT_<SIGNAL> (optional)
- subjectType: ASSET | DOMAIN | MODEL_ELEMENT (later)
- subjectId
- severity: LOW | MED | HIGH
- explanation
- evidenceRefs

## Rules
For each subject and each required signal type:
- If signal presence == false => MISSING_<SIGNAL>
- If signal evaluability == UNKNOWN => UNKNOWN_<SIGNAL>
- If signal exists but violates requirement (only if you define constraints) => CONFLICT_<SIGNAL>

Severity mapping (example):
- HIGH if requirement blocks capability or subject is Tier-1
- MED if Tier-2
- LOW if informational

Suppressed gaps:
- If scope constraint excludes subject, mark as SUPPRESSED (not done), and include rationale.
