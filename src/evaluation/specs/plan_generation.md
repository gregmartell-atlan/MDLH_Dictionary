# Plan Generation (Derived)

Plans are derived outputs, regenerated when evidence or constraints change.

## Inputs
- current gaps snapshot
- constraints (priority/scope)
- optional: impact×quality ordering
- workstream definitions

## Output
3 phases:
1) Minimum viable enablement
2) Expanded coverage
3) Hardening

Actions grouped by workstream:
- OWNERSHIP
- SEMANTICS
- LINEAGE
- SENSITIVITY_ACCESS
- QUALITY_FRESHNESS

Each action includes:
- scope (domains/assets/model elements)
- effort bucket: S/M/L (deterministic thresholds by asset count)
- expected effect: list of gapTypes expected to close

## Rules (deterministic starter)
- Phase 1: close highest-severity gaps on highest-impact subjects with smallest gap count; prioritize Ownership+Semantics+Lineage.
- Phase 2: expand to next subjects by impact/priority.
- Phase 3: hardening, especially Sensitivity/Access and Freshness where observable.

No action is marked done manually; actions “complete” only when their associated gaps disappear on recompute.
