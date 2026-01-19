/**
 * Data Module Exports Reference
 * 
 * Quick lookup for importing recommendation data and helpers
 * 
 * DO NOT USE THIS FILE FOR IMPORTS.
 * Import directly from the individual data modules.
 * This is a documentation-only reference guide.
 */

// ============================================
// USE CASE × FIELD RECOMMENDATIONS
// ============================================
// File: src/data/use-case-field-recommendations.ts
// 
// import type { UseCaseFieldRecommendation } from '../data/use-case-field-recommendations';
// import {
//   USE_CASE_FIELD_RECOMMENDATIONS,
//   getFieldsForUseCase,
//   getRankedFieldsForUseCases,
//   filterTemplatesForUseCase,
// } from '../data/use-case-field-recommendations';
//
// Usage:
// const fields = getFieldsForUseCase('Data Discovery');
// const ranked = getRankedFieldsForUseCases(['Data Discovery', 'Compliance']);
// const filtered = filterTemplatesForUseCase(templates, 'Metrics Catalog');

// ============================================
// VERTICAL × PATTERN RECOMMENDATIONS
// ============================================
// File: src/data/vertical-recommendations.ts
//
// import type { VerticalRecommendation } from '../data/vertical-recommendations';
// import {
//   VERTICAL_RECOMMENDATIONS,
//   getVerticalRecommendation,
//   getFieldsForVertical,
//   getUseCasesForVertical,
//   getReferenceImplementation,
//   getVerticalQuickReference,
//   generateVerticalSummary,
//   getVerticalsByReference,
// } from '../data/vertical-recommendations';
//
// Usage:
// const rec = getVerticalRecommendation('Manufacturing/HVAC');
// const fields = getFieldsForVertical('Manufacturing/HVAC');
// const reference = getReferenceImplementation('Retail/E-commerce'); // 'Raptive'

// ============================================
// PERSONA × FIELD IMPORTANCE MATRIX
// ============================================
// File: src/data/persona-field-matrix.ts
//
// import type { PersonaFieldImportance } from '../data/persona-field-matrix';
// import {
//   PERSONA_FIELD_MATRIX,
//   getFieldPrioritiesForPersona,
//   getCriticalFieldsForPersona,
//   getRecommendedFieldsForPersona,
//   getPersonasForField,
//   buildPersonaFieldChecklist,
//   generatePersonaFieldReport,
// } from '../data/persona-field-matrix';
//
// Usage:
// const critical = getCriticalFieldsForPersona('Data Governance Lead');
// const recommended = getRecommendedFieldsForPersona('Data Steward');
// const personas = getPersonasForField('certificateStatus');
// const checklist = buildPersonaFieldChecklist(['Data Steward', 'Data Analyst']);

// ============================================
// QUICK IMPORT GUIDE
// ============================================

export const IMPORT_GUIDE = `
### Import from individual modules:

// Use Cases
import { getFieldsForUseCase, getRankedFieldsForUseCases } 
  from '../data/use-case-field-recommendations';

// Verticals
import { getVerticalRecommendation, getVerticalsByReference } 
  from '../data/vertical-recommendations';

// Personas
import { getCriticalFieldsForPersona, buildPersonaFieldChecklist } 
  from '../data/persona-field-matrix';

### Common Patterns:

// Pattern 1: Get fields for a use case
const ucFields = getFieldsForUseCase('Data Discovery');

// Pattern 2: Get fields for multiple use cases
const allFields = getRankedFieldsForUseCases(['Data Discovery', 'Compliance']);

// Pattern 3: Get vertical patterns
const vertical = getVerticalRecommendation('Manufacturing/HVAC');
const reference = vertical?.reference; // 'Daikin'

// Pattern 4: Get fields critical for a persona
const personaFields = getCriticalFieldsForPersona('Data Steward');

// Pattern 5: Build checklist for team
const team = ['Data Steward', 'Data Analyst', 'Data Governance Lead'];
const teamChecklist = buildPersonaFieldChecklist(team);
`;
