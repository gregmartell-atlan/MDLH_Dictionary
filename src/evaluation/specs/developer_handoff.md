# Developer Handoff: What to Build Next

This repo is a scaffold. The next work is to implement the capability-centric remediation engine.

## Build order
1) EvaluationRun persistence and baseline selection per capability
2) Evidence ingestion from Atlan REST into EvidenceSignals (typed)
3) Gap computation (requirements vs evidence)
4) Score computation + explainability (deterministic)
5) EvidenceDelta generation (between runs)
6) Derived state machine (DEFINED/EVALUATED/PLANNED/REMEDIATING/ENABLED)
7) UI tabs per capability:
   - Current gaps
   - Derived plan
   - Progress (trajectory + deltas)

## Non-goals (do not implement)
- tasks, assignees, due dates, % complete
- write-back to Atlan/Snowflake
- governance workflows
