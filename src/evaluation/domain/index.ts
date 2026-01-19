/**
 * @atlan/assessment-domain
 *
 * Domain layer for Atlan health assessment platform
 * Provides gap computation, plan generation, and scoring enrichment
 */

// Export all models
export * from './models';

// Export all engines
export * from './engines';

// Export requirements
export * from './requirements/capability-requirements';

// Export unified field catalog
export * from './catalog';

// Export tenant discovery
export * from './discovery';

// Export hierarchical assessment
export * from './assessment';

// Main evaluation orchestrator
export { evaluateCapability } from './evaluate-capability';
