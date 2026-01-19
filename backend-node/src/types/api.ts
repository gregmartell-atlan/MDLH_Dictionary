/**
 * API Request/Response Types
 * Properly typed - NO `any`
 */

import { z } from 'zod';

// ============================================
// METHODOLOGY TYPES
// ============================================

export const MethodologyTypeSchema = z.enum([
  'WEIGHTED_DIMENSIONS',
  'WEIGHTED_MEASURES', 
  'CHECKLIST',
  'QTRIPLET',
  'MATURITY',
]);

export type MethodologyType = z.infer<typeof MethodologyTypeSchema>;

export const UnknownPolicySchema = z.enum([
  'IGNORE_IN_ROLLUP',
  'TREAT_UNKNOWN_AS_ZERO',
]);

export type UnknownPolicy = z.infer<typeof UnknownPolicySchema>;

// ============================================
// REQUEST SCHEMAS (with Zod validation)
// ============================================

export const RunScopeSchema = z.object({
  database: z.string().optional(),
  schema: z.string().optional(),
  connectorFilter: z.string().optional(),
  assetTypeFilter: z.array(z.string()).optional(),
  limit: z.number().int().positive().max(50000).optional(),
});

export const ScoringConfigSchema = z.object({
  methodology: MethodologyTypeSchema.default('WEIGHTED_DIMENSIONS'),
  unknownPolicy: UnknownPolicySchema.default('IGNORE_IN_ROLLUP'),
  readyThreshold: z.number().min(0).max(1).default(0.75),
  impactThreshold: z.number().min(0).max(1).default(0.5),
  qualityThreshold: z.number().min(0).max(1).default(0.7),
});

export type ScoringConfig = z.infer<typeof ScoringConfigSchema>;

export const CreateRunRequestSchema = z.object({
  scope: RunScopeSchema.optional(),
  capabilities: z.array(z.string()).optional(),
  scoringConfig: ScoringConfigSchema.optional(),
});

export const IngestRequestSchema = z.object({
  database: z.string().optional(),
  schema: z.string().optional(),
  limit: z.number().int().positive().max(50000).optional(),
});

// ============================================
// DERIVED TYPES
// ============================================

export type RunScope = z.infer<typeof RunScopeSchema>;
export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>;
export type IngestRequest = z.infer<typeof IngestRequestSchema>;

// ============================================
// RESPONSE TYPES
// ============================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
