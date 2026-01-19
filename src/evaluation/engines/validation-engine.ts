// ============================================
// VALIDATION ENGINE
// Anti-pattern detection and recommendations
// ============================================

import type {
  FieldCoverage,
  MetadataFieldType,
  AuditResult,
  ValidationIssue,
  RecommendedFix,
  AntiPatternCategory,
} from '../types/priority';

/**
 * Run all validation checks against audit data
 */
export function validateMetadataModel(audit: AuditResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Check for orphan assets (no owner)
  const ownerCoverage = audit.fieldCoverage.find(f => f.field === 'ownerUsers');
  if (ownerCoverage && ownerCoverage.coveragePercent < 0.5) {
    issues.push({
      id: 'orphan-assets',
      severity: 'error',
      category: 'orphan-assets',
      title: 'Orphan Assets Detected',
      description: `${((1 - ownerCoverage.coveragePercent) * 100).toFixed(0)}% of assets have no owner. This creates accountability gaps and makes it impossible to route questions or issues.`,
      affectedFields: ['ownerUsers', 'ownerGroups'],
      recommendation: 'Implement bulk owner assignment starting with critical data assets. Consider domain-based ownership where a single steward owns assets in their domain.',
    });
  }

  // Check for description desert
  const descCoverage = audit.fieldCoverage.find(f => f.field === 'description');
  if (descCoverage && descCoverage.coveragePercent < 0.3) {
    issues.push({
      id: 'description-desert',
      severity: 'error',
      category: 'description-desert',
      title: 'Description Desert',
      description: `Only ${(descCoverage.coveragePercent * 100).toFixed(0)}% of assets have descriptions. Users cannot understand what data means without context.`,
      affectedFields: ['description', 'userDescription', 'readme'],
      recommendation: 'Enable user-contributed descriptions. Start with top 100 most-queried assets. Consider AI-assisted description generation for tables with clear column names.',
    });
  }

  // Check for classification chaos
  const tagCoverage = audit.fieldCoverage.find(f => f.field === 'atlanTags');
  if (tagCoverage && tagCoverage.coveragePercent < 0.2) {
    issues.push({
      id: 'classification-chaos',
      severity: 'warning',
      category: 'classification-chaos',
      title: 'Classification Chaos',
      description: `Only ${(tagCoverage.coveragePercent * 100).toFixed(0)}% of assets are classified. This creates compliance risk and makes policy enforcement impossible.`,
      affectedFields: ['atlanTags'],
      recommendation: 'Define classification taxonomy first. Use auto-classification rules for PII detection. Prioritize columns in customer-facing databases.',
    });
  }

  // Check for lineage blackout
  const lineageCoverage = audit.fieldCoverage.find(f => f.field === 'lineage');
  if (lineageCoverage && lineageCoverage.coveragePercent < 0.4) {
    issues.push({
      id: 'lineage-blackout',
      severity: 'warning',
      category: 'lineage-blackout',
      title: 'Lineage Blackout',
      description: `Only ${(lineageCoverage.coveragePercent * 100).toFixed(0)}% of assets have lineage. Root cause analysis and impact assessment are impossible.`,
      affectedFields: ['lineage'],
      recommendation: 'Verify all connectors are configured for lineage extraction. Check transformation tool integrations (dbt, Spark). Consider manual lineage for critical dashboards.',
    });
  }

  // Check for glossary ghost town
  const glossaryCoverage = audit.fieldCoverage.find(f => f.field === 'glossaryTerms');
  if (glossaryCoverage && glossaryCoverage.coveragePercent < 0.1) {
    issues.push({
      id: 'glossary-ghost-town',
      severity: 'info',
      category: 'glossary-ghost-town',
      title: 'Glossary Ghost Town',
      description: `Only ${(glossaryCoverage.coveragePercent * 100).toFixed(0)}% of assets are linked to glossary terms. Business terminology is not standardized.`,
      affectedFields: ['glossaryTerms'],
      recommendation: 'Start with KPI definitions - these have highest business impact. Build glossary incrementally around actual user questions.',
    });
  }

  // Check for certificate status gaps
  const certCoverage = audit.fieldCoverage.find(f => f.field === 'certificateStatus');
  if (certCoverage && certCoverage.coveragePercent < 0.25) {
    issues.push({
      id: 'certification-gap',
      severity: 'info',
      category: 'stale-metadata',
      title: 'Certification Gap',
      description: `Only ${(certCoverage.coveragePercent * 100).toFixed(0)}% of assets have certification status. Users cannot distinguish trusted from untrusted data.`,
      affectedFields: ['certificateStatus'],
      recommendation: 'Establish certification criteria. Start by certifying golden datasets and critical reports. Use certification workflow to scale.',
    });
  }

  return issues.sort((a, b) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Validate field coverage against audit data
 */
export function validateFieldCoverage(fieldCoverage: FieldCoverage[]): ValidationIssue[] {
  const mockAudit: AuditResult = {
    timestamp: new Date(),
    tenantId: 'validation',
    summary: {
      totalAssets: fieldCoverage[0]?.totalAssets || 0,
      assetsWithOwner: 0,
      assetsWithDescription: 0,
      assetsWithTags: 0,
      assetsWithGlossary: 0,
      assetsWithLineage: 0,
      overallCompletenessScore: 0,
    },
    fieldCoverage,
    assetBreakdown: [],
  };

  return validateMetadataModel(mockAudit);
}

/**
 * Get recommended fixes in priority order
 */
export function getRecommendedFixes(issues: ValidationIssue[]): RecommendedFix[] {
  return issues.map(issue => ({
    issue,
    quickWin: issue.category === 'orphan-assets' || issue.category === 'description-desert',
    estimatedEffort: getEffortEstimate(issue.category),
    dependencies: getDependencies(issue.category),
  }));
}

function getEffortEstimate(category: AntiPatternCategory): string {
  const estimates: Record<AntiPatternCategory, string> = {
    'orphan-assets': '1-2 weeks',
    'description-desert': '2-4 weeks',
    'classification-chaos': '3-6 weeks',
    'lineage-blackout': '2-4 weeks (mostly configuration)',
    'glossary-ghost-town': '4-8 weeks',
    'owner-overload': '1-2 weeks',
    'stale-metadata': '1 week + ongoing process',
  };
  return estimates[category];
}

function getDependencies(category: AntiPatternCategory): string[] {
  const deps: Record<AntiPatternCategory, string[]> = {
    'orphan-assets': [],
    'description-desert': [],
    'classification-chaos': ['Classification taxonomy defined'],
    'lineage-blackout': ['Connector configurations verified'],
    'glossary-ghost-town': ['Glossary structure defined', 'Business stakeholder buy-in'],
    'owner-overload': ['Org structure mapped'],
    'stale-metadata': ['Freshness SLAs defined'],
  };
  return deps[category];
}

/**
 * Get issues by severity
 */
export function getIssuesBySeverity(
  issues: ValidationIssue[],
  severity: 'error' | 'warning' | 'info'
): ValidationIssue[] {
  return issues.filter(i => i.severity === severity);
}

/**
 * Get issues affecting a specific field
 */
export function getIssuesForField(
  issues: ValidationIssue[],
  field: MetadataFieldType
): ValidationIssue[] {
  return issues.filter(i => i.affectedFields.includes(field));
}

/**
 * Check if there are any critical issues
 */
export function hasCriticalIssues(issues: ValidationIssue[]): boolean {
  return issues.some(i => i.severity === 'error');
}

/**
 * Get quick wins from issues
 */
export function getQuickWinFixes(issues: ValidationIssue[]): RecommendedFix[] {
  return getRecommendedFixes(issues).filter(fix => fix.quickWin);
}

/**
 * Calculate risk score based on issues
 */
export function calculateRiskScore(issues: ValidationIssue[]): number {
  let score = 100; // Start at 100 (no risk)

  for (const issue of issues) {
    switch (issue.severity) {
      case 'error':
        score -= 25;
        break;
      case 'warning':
        score -= 10;
        break;
      case 'info':
        score -= 5;
        break;
    }
  }

  return Math.max(0, score);
}

/**
 * Get summary of validation results
 */
export function getValidationSummary(issues: ValidationIssue[]): {
  errors: number;
  warnings: number;
  info: number;
  riskScore: number;
  criticalFields: MetadataFieldType[];
} {
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const info = issues.filter(i => i.severity === 'info').length;
  const riskScore = calculateRiskScore(issues);

  // Get unique critical fields from error-level issues
  const criticalFields = [...new Set(
    issues
      .filter(i => i.severity === 'error')
      .flatMap(i => i.affectedFields)
  )];

  return { errors, warnings, info, riskScore, criticalFields };
}
