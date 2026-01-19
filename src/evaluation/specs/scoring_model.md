# Scoring Model (Evidence-Based, UNKNOWN First-Class)

This document specifies how to compute scores deterministically from evidence signals.
No heuristics. No inference. Missing evidence yields UNKNOWN.

## Objects
- **Subject**: DOMAIN or ASSET (can be extended to MODEL_ELEMENT later)
- **Capability**: chosen home object; determines which requirements are active
- **Requirements**: resolved set of requirement IDs + required signal types
- **EvidenceSignals**: observed signals per subject (from Atlan), typed

## Signals (canonical)
- OWNERSHIP
- LINEAGE
- SEMANTICS
- SENSITIVITY
- ACCESS
- USAGE
- FRESHNESS

If a signal cannot be observed, it must be recorded as UNKNOWN for that subject.

---

## Score dimensions

### ImpactScore (0..1)
Represents “importance / leverage”. Inputs are allowed only from evidence.

Allowed sources (pick what you can observe):
- USAGE signals (query counts, consumer counts, dashboard references)
- Downstream dependency count (from lineage graph) if available and reliable

Rules:
1) If USAGE exists: normalize to 0..1 using a deterministic mapping.
2) Else if reliable dependency measure exists: normalize similarly.
3) Else: ImpactScore = 0.25 (low) AND explanation must say "USAGE unavailable; defaulted low".

Impact is never UNKNOWN; it can be low-by-default with explicit rationale.

### QualityScore (0..1 or NULL)
Represents “metadata readiness/coverage” for active requirements.

Inputs:
- For each required signal type, determine presence/absence/unknown for subject.

Rules:
- If one or more required signal types are UNKNOWN (cannot be evaluated): QualityScore = NULL and `qualityUnknown = true`.
- Else QualityScore = (# required signals present) / (total required signals).
- Presence must be defined deterministically per signal:

Presence tests (examples, adjust to your Atlan payload fields):
- OWNERSHIP present if any owner field is non-empty
- LINEAGE present if lineage query returns >= 1 upstream/downstream edge
- SEMANTICS present if description non-empty OR glossary term assigned (if observable)
- SENSITIVITY present if classification/tag indicates sensitivity
- ACCESS present if access policy/ACL metadata is observable (if not, treat UNKNOWN)

### Quadrant
Quadrant is derived from ImpactScore and QualityScore:

- High impact if ImpactScore >= 0.5
- If qualityUnknown: quadrant is HU (high impact) or LU (low impact)
- Else qualityHigh if QualityScore >= 0.5:
  - HH, HL, LH, LL

---

## Explanations (mandatory)
Every score must produce:
- title
- deterministic reasoning text
- evidenceRefs linking to signals and Atlan URLs

Example explanation entries:
- "USAGE unavailable; defaulted impact to low (0.25)."
- "Ownership present (owner: X)."
- "Lineage absent (0 edges returned)."
- "Sensitivity UNKNOWN (no observable classification fields in current evidence)."

---

## Aggregation

### Domain-level scores
Compute by aggregating asset-level scores within the domain:
- ImpactScore: max or weighted average (choose one and document)
- Quality:
  - If any asset has unknown required signals, domain qualityUnknown = true
  - Else average quality across assets

Recommended deterministic aggregation (simple):
- ImpactScore_domain = max(ImpactScore_asset)
- QualityScore_domain = average(QualityScore_asset) over assets (when not unknown)

---

## Storage
Persist for each EvaluationRun:
- scores snapshot with:
  - subjectType, subjectId
  - impactScore
  - qualityScore (nullable)
  - qualityUnknown boolean
  - quadrant
  - explanations[]
