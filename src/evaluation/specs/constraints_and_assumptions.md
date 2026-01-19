# Constraints & Assumptions (Editable Inputs)

## Rule
Users may edit **constraints and requirement modifiers**, not plan actions.

## Constraint types
1. Priority constraints
   - capability priority (H/M/L)
   - domain tiering (Tier-1/Tier-2)
   - usage thresholds

2. Scope constraints
   - include/exclude domains/systems
   - include/exclude asset classes
   - suppress gaps (out-of-scope) with explanation (NOT marked complete)

3. Requirement modifiers
   - mark requirements mandatory/optional per context
   - waive specific requirement only with explicit rationale (auditable)

4. Assumptions (annotations)
   - "Blocked by upstream migration"
   - "Awaiting connector refresh cadence"
   - These do not change scores; they explain why reality may lag.

## Auditability
Every constraint/modifier change produces a new immutable revision:
- who, when, what changed, rationale
- affects derived plan on next generation
