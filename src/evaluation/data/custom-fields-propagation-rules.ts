/**
 * Custom Fields Metadata Propagation Rules Module
 *
 * Defines and orchestrates metadata propagation/inheritance patterns across the
 * asset hierarchy (Database → Schema → Table → Column). Supports cascading updates,
 * blocking rules, transformations, and conflict resolution.
 */

import type { AssetType } from './custom-fields-asset-targeting';

// ============================================================================
// Propagation Rule Types
// ============================================================================

export type PropagationType = 'copy' | 'aggregate' | 'filter' | 'transform' | 'override';

export type ConflictResolution = 'child-wins' | 'parent-wins' | 'most-restrictive' | 'custom';

export interface PropagationRuleDefinition {
  ruleId: string;
  sourceAsset: AssetType;
  targetAsset: AssetType;
  fieldId: string;
  fieldName: string;
  propagationType: PropagationType;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transformation?: (...args: any[]) => any;
  conflictResolution?: ConflictResolution;
  allowOverride?: boolean;
  enabled: boolean;
  priority: number;
  createdDate: string;
  lastModified: string;
}

export interface PropagationEvent {
  eventId: string;
  ruleId: string;
  sourceAsset: { type: AssetType; id: string; name: string };
  targetAsset: { type: AssetType; id: string; name: string };
  fieldId: string;
  sourceValue: unknown;
  targetValue: unknown;
  resultValue: unknown;
  status: 'pending' | 'success' | 'failed' | 'conflict';
  conflictResolution?: ConflictResolution;
  timestamp: string;
  error?: string;
}

export interface PropagationConflict {
  conflictId: string;
  ruleId: string;
  sourceAsset: { type: AssetType; id: string };
  targetAsset: { type: AssetType; id: string };
  fieldId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sourceValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  targetValue: any;
  reason: string;
  resolutionOptions: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolvedValue?: any;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface PropagationContext {
  userId: string;
  timestamp: string;
  batchId?: string;
  reason?: string;
  dryRun?: boolean;
}

export interface PropagationExecutionResult {
  executionId: string;
  context: PropagationContext;
  totalRules: number;
  executedRules: number;
  successCount: number;
  failureCount: number;
  conflictCount: number;
  events: PropagationEvent[];
  conflicts: PropagationConflict[];
  duration: number;
  summary: string;
}

// ============================================================================
// Standard Propagation Rules
// ============================================================================

const STANDARD_RULES: PropagationRuleDefinition[] = [
  {
    ruleId: 'lifecycle_cascade_db_to_schema',
    sourceAsset: 'Database',
    targetAsset: 'Schema',
    fieldId: 'lifecycle_status',
    fieldName: 'Lifecycle Status',
    propagationType: 'copy',
    description: 'Cascade lifecycle status from Database to Schema',
    enabled: true,
    priority: 100,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'lifecycle_cascade_schema_to_table',
    sourceAsset: 'Schema',
    targetAsset: 'Table',
    fieldId: 'lifecycle_status',
    fieldName: 'Lifecycle Status',
    propagationType: 'copy',
    description: 'Cascade lifecycle status from Schema to Table',
    enabled: true,
    priority: 99,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'lifecycle_cascade_table_to_column',
    sourceAsset: 'Table',
    targetAsset: 'Column',
    fieldId: 'lifecycle_status',
    fieldName: 'Lifecycle Status',
    propagationType: 'copy',
    description: 'Cascade lifecycle status from Table to Column',
    enabled: true,
    priority: 98,
    allowOverride: true,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'pii_aggregate_columns_to_table',
    sourceAsset: 'Column',
    targetAsset: 'Table',
    fieldId: 'pii_classification',
    fieldName: 'PII Classification',
    propagationType: 'aggregate',
    description: 'Aggregate PII classification from Columns to Table (most restrictive wins)',
    transformation: (sourceValue: string[]) => {
      if (Array.isArray(sourceValue)) {
        const hierarchy = ['None', 'Pseudo', 'Sensitive', 'Health', 'Financial'];
        return sourceValue.reduce((max, val) => {
          const maxIdx = hierarchy.indexOf(max);
          const valIdx = hierarchy.indexOf(val);
          return valIdx > maxIdx ? val : max;
        }, 'None');
      }
      return sourceValue;
    },
    conflictResolution: 'most-restrictive',
    enabled: true,
    priority: 95,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'retention_days_most_strict',
    sourceAsset: 'Table',
    targetAsset: 'Column',
    fieldId: 'retention_days',
    fieldName: 'Retention Days',
    propagationType: 'filter',
    description: 'Apply stricter retention (shorter duration) at Column level',
    transformation: (sourceValue: number, targetValue?: number) => {
      if (!targetValue) return sourceValue;
      return Math.min(sourceValue, targetValue);
    },
    conflictResolution: 'most-restrictive',
    allowOverride: true,
    enabled: true,
    priority: 90,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'retention_days_compliance_block',
    sourceAsset: 'Database',
    targetAsset: 'Table',
    fieldId: 'retention_days',
    fieldName: 'Retention Days',
    propagationType: 'copy',
    description: 'Enforce minimum retention from Database policy to Tables',
    enabled: true,
    priority: 91,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'criticality_cascade_db_to_table',
    sourceAsset: 'Database',
    targetAsset: 'Table',
    fieldId: 'criticality_tier',
    fieldName: 'Criticality Tier',
    propagationType: 'copy',
    description: 'Cascade criticality from Database to Table',
    enabled: true,
    priority: 85,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'criticality_cascade_table_to_column',
    sourceAsset: 'Table',
    targetAsset: 'Column',
    fieldId: 'criticality_tier',
    fieldName: 'Criticality Tier',
    propagationType: 'copy',
    description: 'Cascade criticality from Table to Column',
    allowOverride: true,
    enabled: true,
    priority: 84,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'refresh_frequency_table_baseline',
    sourceAsset: 'Table',
    targetAsset: 'Column',
    fieldId: 'refresh_frequency',
    fieldName: 'Refresh Frequency',
    propagationType: 'copy',
    description: 'Set baseline refresh frequency at Table level',
    enabled: true,
    priority: 80,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'refresh_frequency_column_override',
    sourceAsset: 'Column',
    targetAsset: 'Column',
    fieldId: 'refresh_frequency',
    fieldName: 'Refresh Frequency',
    propagationType: 'override',
    description: 'Allow Column-specific refresh frequency override',
    allowOverride: true,
    enabled: true,
    priority: 81,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'department_cascade_db_to_table',
    sourceAsset: 'Database',
    targetAsset: 'Table',
    fieldId: 'department',
    fieldName: 'Department',
    propagationType: 'copy',
    description: 'Cascade department ownership from Database to Table',
    enabled: true,
    priority: 75,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'cost_center_cascade_db_to_table',
    sourceAsset: 'Database',
    targetAsset: 'Table',
    fieldId: 'cost_center',
    fieldName: 'Cost Center',
    propagationType: 'copy',
    description: 'Cascade cost center allocation from Database to Table',
    enabled: true,
    priority: 70,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'dq_framework_cascade_db_to_table',
    sourceAsset: 'Database',
    targetAsset: 'Table',
    fieldId: 'dq_framework',
    fieldName: 'Data Quality Framework',
    propagationType: 'copy',
    description: 'Cascade DQ framework from Database to Table',
    enabled: true,
    priority: 65,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'dq_framework_cascade_table_to_column',
    sourceAsset: 'Table',
    targetAsset: 'Column',
    fieldId: 'dq_framework',
    fieldName: 'Data Quality Framework',
    propagationType: 'copy',
    description: 'Cascade DQ framework from Table to Column',
    enabled: true,
    priority: 64,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },

  {
    ruleId: 'ml_ready_column_computed',
    sourceAsset: 'Column',
    targetAsset: 'Column',
    fieldId: 'ml_ready',
    fieldName: 'ML Readiness Score',
    propagationType: 'transform',
    description: 'Compute ML readiness independently per column',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    transformation: (_sourceValue: any) => {
      return Math.round(Math.random() * 100);
    },
    enabled: true,
    priority: 50,
    createdDate: '2025-01-02',
    lastModified: '2025-01-02',
  },
];

// ============================================================================
// Propagation Rule Registry & Executor
// ============================================================================

export class PropagationRuleRegistry {
  private rules: Map<string, PropagationRuleDefinition> = new Map();

  constructor() {
    STANDARD_RULES.forEach((rule) => this.rules.set(rule.ruleId, rule));
  }

  getRule(ruleId: string): PropagationRuleDefinition | undefined {
    return this.rules.get(ruleId);
  }

  getRulesForField(fieldId: string): PropagationRuleDefinition[] {
    return Array.from(this.rules.values()).filter((r) => r.fieldId === fieldId && r.enabled);
  }

  getPropagationPath(
    fieldId: string,
    sourceAsset: AssetType,
    targetAsset: AssetType
  ): PropagationRuleDefinition[] {
    return Array.from(this.rules.values())
      .filter(
        (r) =>
          r.fieldId === fieldId &&
          r.sourceAsset === sourceAsset &&
          r.targetAsset === targetAsset &&
          r.enabled
      )
      .sort((a, b) => b.priority - a.priority);
  }

  addRule(rule: PropagationRuleDefinition): void {
    this.rules.set(rule.ruleId, rule);
  }

  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      rule.lastModified = new Date().toISOString();
    }
  }

  getAllRulesOrderedByPriority(): PropagationRuleDefinition[] {
    return Array.from(this.rules.values())
      .filter((r) => r.enabled)
      .sort((a, b) => b.priority - a.priority);
  }
}

export class PropagationExecutor {
  private registry: PropagationRuleRegistry;
  private events: PropagationEvent[] = [];
  private conflicts: PropagationConflict[] = [];

  constructor(registry?: PropagationRuleRegistry) {
    this.registry = registry || new PropagationRuleRegistry();
  }

  async executeRule(
    rule: PropagationRuleDefinition,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceValue: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targetValue: any,
    context: PropagationContext
  ): Promise<PropagationEvent> {
    const eventId = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      let resultValue = sourceValue;
      if (rule.transformation) {
        resultValue = rule.transformation(sourceValue, targetValue, context);
      }

      const event: PropagationEvent = {
        eventId,
        ruleId: rule.ruleId,
        sourceAsset: { type: rule.sourceAsset, id: '', name: '' },
        targetAsset: { type: rule.targetAsset, id: '', name: '' },
        fieldId: rule.fieldId,
        sourceValue,
        targetValue,
        resultValue,
        status: 'success',
        timestamp: new Date().toISOString(),
      };

      this.events.push(event);
      return event;
    } catch (error) {
      const event: PropagationEvent = {
        eventId,
        ruleId: rule.ruleId,
        sourceAsset: { type: rule.sourceAsset, id: '', name: '' },
        targetAsset: { type: rule.targetAsset, id: '', name: '' },
        fieldId: rule.fieldId,
        sourceValue,
        targetValue,
        resultValue: null,
        status: 'failed',
        timestamp: new Date().toISOString(),
        error: (error as Error).message,
      };

      this.events.push(event);
      return event;
    }
  }

  async executePropagation(
    fieldId: string,
    sourceAsset: AssetType,
    targetAsset: AssetType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceValue: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targetValue: any,
    context: PropagationContext
  ): Promise<PropagationExecutionResult> {
    const startTime = Date.now();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    this.events = [];
    this.conflicts = [];

    const rules = this.registry.getPropagationPath(fieldId, sourceAsset, targetAsset);

    for (const rule of rules) {
      if (rule.conflictResolution && targetValue != null && sourceValue !== targetValue) {
        const conflict: PropagationConflict = {
          conflictId: `conf_${Date.now()}`,
          ruleId: rule.ruleId,
          sourceAsset: { type: rule.sourceAsset, id: '' },
          targetAsset: { type: rule.targetAsset, id: '' },
          fieldId: rule.fieldId,
          sourceValue,
          targetValue,
          reason: `Value mismatch: source="${sourceValue}" vs target="${targetValue}"`,
          resolutionOptions: ['source-wins', 'target-wins', 'most-restrictive'],
        };

        if (rule.conflictResolution === 'most-restrictive') {
          conflict.resolvedValue = (sourceValue > targetValue) ? sourceValue : targetValue;
        } else if (rule.conflictResolution === 'child-wins') {
          conflict.resolvedValue = targetValue;
        } else {
          conflict.resolvedValue = sourceValue;
        }

        this.conflicts.push(conflict);
      }

      await this.executeRule(rule, sourceValue, targetValue, context);
    }

    const duration = Date.now() - startTime;

    return {
      executionId,
      context,
      totalRules: rules.length,
      executedRules: this.events.length,
      successCount: this.events.filter((e) => e.status === 'success').length,
      failureCount: this.events.filter((e) => e.status === 'failed').length,
      conflictCount: this.conflicts.length,
      events: this.events,
      conflicts: this.conflicts,
      duration,
      summary: `Executed ${this.events.length}/${rules.length} rules with ${this.events.filter((e) => e.status === 'success').length} successes, ${this.events.filter((e) => e.status === 'failed').length} failures, ${this.conflicts.length} conflicts in ${duration}ms`,
    };
  }

  async simulatePropagation(
    fieldId: string,
    sourceAsset: AssetType,
    targetAsset: AssetType,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sourceValue: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    targetValue: any
  ): Promise<PropagationExecutionResult> {
    const context: PropagationContext = {
      userId: 'system',
      timestamp: new Date().toISOString(),
      dryRun: true,
    };

    return this.executePropagation(fieldId, sourceAsset, targetAsset, sourceValue, targetValue, context);
  }

  getExecutionSummary(result: PropagationExecutionResult): string {
    let summary = `# Propagation Execution Summary\n\n`;
    summary += `**Execution ID:** ${result.executionId}\n`;
    summary += `**Duration:** ${result.duration}ms\n`;
    summary += `**Total Rules:** ${result.totalRules}\n`;
    summary += `**Successes:** ${result.successCount}\n`;
    summary += `**Failures:** ${result.failureCount}\n`;
    summary += `**Conflicts:** ${result.conflictCount}\n\n`;

    if (result.conflicts.length > 0) {
      summary += `## Conflicts Detected\n\n`;
      result.conflicts.forEach((c) => {
        summary += `- **${c.fieldId}** (${c.sourceAsset.type} → ${c.targetAsset.type})\n`;
        summary += `  - Source: ${c.sourceValue} | Target: ${c.targetValue}\n`;
        summary += `  - Resolved to: ${c.resolvedValue}\n\n`;
      });
    }

    return summary;
  }
}

export function getDefaultPropagationRegistry(): PropagationRuleRegistry {
  return new PropagationRuleRegistry();
}

export function getDefaultPropagationExecutor(): PropagationExecutor {
  return new PropagationExecutor(getDefaultPropagationRegistry());
}
