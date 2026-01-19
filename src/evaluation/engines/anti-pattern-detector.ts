// ============================================
// ANTI-PATTERN DETECTION ENGINE
// Analyzes audit data to identify metadata governance issues
// ============================================

import type {
  AuditResult,
  FieldCoverage,
  MetadataFieldType,
  
} from '../types/priority';

// ============================================
// TYPES
// ============================================

export type AntiPatternSeverity = 'critical' | 'warning' | 'info';

export type AntiPatternCategory =
  | 'ownership'
  | 'documentation'
  | 'classification'
  | 'lineage'
  | 'glossary'
  | 'structure';

export interface AntiPatternDetectionResult {
  detected: boolean;
  severity: AntiPatternSeverity;
  affectedCount: number;
  percentage: number;
  threshold: number;
  details: string;
  trend?: {
    direction: 'improving' | 'worsening' | 'stable';
    change: number;
  };
}

export interface AntiPattern {
  id: string;
  name: string;
  description: string;
  severity: AntiPatternSeverity;
  category: AntiPatternCategory;
  check: (audit: AuditResult, fieldCoverage: FieldCoverage[]) => AntiPatternDetectionResult | null;
  designImplication: string;
  recommendation: string;
  affectedFields?: MetadataFieldType[];
}

export interface DetectedAntiPattern {
  pattern: AntiPattern;
  result: AntiPatternDetectionResult;
}

// ============================================
// ANTI-PATTERN DEFINITIONS
// ============================================

export const ANTI_PATTERNS: AntiPattern[] = [
  // ============================================
  // OWNERSHIP ANTI-PATTERNS
  // ============================================
  {
    id: 'orphan-assets',
    name: 'Orphan Assets',
    description: 'Assets without any owner assigned',
    severity: 'critical',
    category: 'ownership',
    affectedFields: ['ownerUsers', 'ownerGroups'],
    designImplication:
      'Without ownership, there is no accountability for data quality, access requests, or issue resolution. This creates bottlenecks and delays.',
    recommendation:
      'Implement bulk owner assignment starting with critical data assets. Consider domain-based ownership where a single steward owns assets in their domain. Use automated assignment based on source system or schema patterns.',
    check: (_audit: AuditResult, fieldCoverage: FieldCoverage[]) => {
      const ownerCoverage = fieldCoverage.find((f) => f.field === 'ownerUsers');
      if (!ownerCoverage) return null;

      const orphanPercentage = (1 - ownerCoverage.coveragePercent) * 100;
      const threshold = 50; // Critical if > 50% are orphaned

      if (orphanPercentage <= threshold) return null;

      return {
        detected: true,
        severity: 'critical',
        affectedCount: ownerCoverage.totalAssets - ownerCoverage.populatedAssets,
        percentage: orphanPercentage,
        threshold,
        details: `${orphanPercentage.toFixed(0)}% of assets (${(ownerCoverage.totalAssets - ownerCoverage.populatedAssets).toLocaleString()}) have no owner assigned`,
        trend: ownerCoverage.trend
          ? {
              direction:
                ownerCoverage.trend.direction === 'up'
                  ? 'improving'
                  : ownerCoverage.trend.direction === 'down'
                  ? 'worsening'
                  : 'stable',
              change: ownerCoverage.trend.changePercent,
            }
          : undefined,
      };
    },
  },

  {
    id: 'owner-concentration',
    name: 'Owner Concentration',
    description: 'Too many assets owned by a single person',
    severity: 'warning',
    category: 'ownership',
    affectedFields: ['ownerUsers'],
    designImplication:
      'Concentrated ownership creates single points of failure and bottlenecks. When that person is unavailable, no one can make decisions about the data.',
    recommendation:
      'Distribute ownership across teams. Define domain boundaries and assign domain stewards. For shared services, consider group ownership instead of individual ownership.',
    check: () => {
      // This would require detailed owner distribution data
      // For now, we check if we have breakdown by owner (placeholder)
      // In a real implementation, you'd analyze the distribution of owners

      // This is a placeholder - actual implementation would need owner distribution data
      // from the audit that tracks which owners own how many assets
      return null; // Not detectable without detailed owner distribution data
    },
  },

  {
    id: 'stale-owners',
    name: 'Stale Owners',
    description: 'Owners who may have left the organization',
    severity: 'info',
    category: 'ownership',
    affectedFields: ['ownerUsers'],
    designImplication:
      'Stale ownership leads to misdirected questions and delays. It also indicates the metadata is not being actively maintained.',
    recommendation:
      'Implement periodic owner validation workflows. Integrate with HR systems to automatically flag departed employees. Establish ownership succession plans.',
    check: () => {
      // This requires integration with HR/identity systems
      // Placeholder for future implementation
      return null;
    },
  },

  // ============================================
  // DOCUMENTATION ANTI-PATTERNS
  // ============================================
  {
    id: 'description-desert',
    name: 'Description Desert',
    description: 'Less than 30% of assets have descriptions',
    severity: 'critical',
    category: 'documentation',
    affectedFields: ['description', 'userDescription'],
    designImplication:
      'Users cannot understand what data means without descriptions. This leads to incorrect assumptions, wasted time, and potential misuse of data.',
    recommendation:
      'Enable user-contributed descriptions to crowdsource documentation. Start with the top 100 most-queried assets. Consider AI-assisted description generation for tables with clear column names. Create description templates for different asset types.',
    check: (_audit: AuditResult, fieldCoverage: FieldCoverage[]) => {
      const descCoverage = fieldCoverage.find((f) => f.field === 'description');
      if (!descCoverage) return null;

      const percentage = descCoverage.coveragePercent * 100;
      const threshold = 30;

      if (percentage >= threshold) return null;

      return {
        detected: true,
        severity: 'critical',
        affectedCount: descCoverage.totalAssets - descCoverage.populatedAssets,
        percentage: 100 - percentage,
        threshold: 100 - threshold,
        details: `Only ${percentage.toFixed(0)}% of assets (${descCoverage.populatedAssets.toLocaleString()} of ${descCoverage.totalAssets.toLocaleString()}) have descriptions`,
        trend: descCoverage.trend
          ? {
              direction:
                descCoverage.trend.direction === 'up'
                  ? 'improving'
                  : descCoverage.trend.direction === 'down'
                  ? 'worsening'
                  : 'stable',
              change: descCoverage.trend.changePercent,
            }
          : undefined,
      };
    },
  },

  {
    id: 'description-decay',
    name: 'Description Decay',
    description: 'Descriptions may be outdated',
    severity: 'info',
    category: 'documentation',
    affectedFields: ['description', 'userDescription'],
    designImplication:
      'Outdated descriptions are worse than no descriptions - they actively mislead users and create wrong assumptions about data meaning.',
    recommendation:
      'Implement freshness indicators for descriptions. Add "last verified" dates. Create periodic review workflows for critical asset descriptions. Encourage users to flag outdated content.',
    check: () => {
      // This requires timestamp tracking on descriptions
      // Placeholder for future implementation
      return null;
    },
  },

  // ============================================
  // CLASSIFICATION ANTI-PATTERNS
  // ============================================
  {
    id: 'classification-chaos',
    name: 'Classification Chaos',
    description: 'Less than 20% of assets are classified with tags',
    severity: 'warning',
    category: 'classification',
    affectedFields: ['atlanTags'],
    designImplication:
      'Without classification, compliance is impossible. You cannot enforce data policies, identify sensitive data, or meet regulatory requirements like GDPR or HIPAA.',
    recommendation:
      'Define classification taxonomy first (PII, confidential, public, etc.). Use auto-classification rules for PII detection based on column names. Prioritize columns in customer-facing databases. Start with data security classifications before moving to business classifications.',
    check: (_audit: AuditResult, fieldCoverage: FieldCoverage[]) => {
      const tagCoverage = fieldCoverage.find((f) => f.field === 'atlanTags');
      if (!tagCoverage) return null;

      const percentage = tagCoverage.coveragePercent * 100;
      const threshold = 20;

      if (percentage >= threshold) return null;

      return {
        detected: true,
        severity: 'warning',
        affectedCount: tagCoverage.totalAssets - tagCoverage.populatedAssets,
        percentage: 100 - percentage,
        threshold: 100 - threshold,
        details: `Only ${percentage.toFixed(0)}% of assets (${tagCoverage.populatedAssets.toLocaleString()} of ${tagCoverage.totalAssets.toLocaleString()}) are classified`,
        trend: tagCoverage.trend
          ? {
              direction:
                tagCoverage.trend.direction === 'up'
                  ? 'improving'
                  : tagCoverage.trend.direction === 'down'
                  ? 'worsening'
                  : 'stable',
              change: tagCoverage.trend.changePercent,
            }
          : undefined,
      };
    },
  },

  {
    id: 'tag-explosion',
    name: 'Tag Explosion',
    description: 'Too many tags with low usage',
    severity: 'warning',
    category: 'classification',
    affectedFields: ['atlanTags'],
    designImplication:
      'Tag proliferation defeats the purpose of classification. Users cannot find data when there are hundreds of inconsistent tags with overlapping meanings.',
    recommendation:
      'Audit and consolidate your tag taxonomy. Merge synonymous tags. Archive unused tags. Establish governance for new tag creation. Document tag definitions and usage guidelines.',
    check: () => {
      // This requires tag distribution statistics
      // Placeholder for future implementation
      return null;
    },
  },

  {
    id: 'pii-ungoverned',
    name: 'Ungoverned PII',
    description: 'Columns likely containing PII are not tagged',
    severity: 'critical',
    category: 'classification',
    affectedFields: ['atlanTags'],
    designImplication:
      'Untagged PII is a compliance ticking time bomb. You cannot control access, track usage, or meet regulatory requirements for sensitive personal information.',
    recommendation:
      'Run PII detection scans on column names (email, ssn, phone, etc.) and sample data. Tag all detected PII columns immediately. Implement column-level access controls. Set up monitoring for PII access patterns.',
    check: () => {
      // This requires column-level analysis with PII detection
      // Placeholder for future implementation
      return null;
    },
  },

  // ============================================
  // LINEAGE ANTI-PATTERNS
  // ============================================
  {
    id: 'lineage-blackout',
    name: 'Lineage Blackout',
    description: 'Less than 40% of assets have lineage coverage',
    severity: 'warning',
    category: 'lineage',
    affectedFields: ['lineage'],
    designImplication:
      'Without lineage, root cause analysis is impossible. When a data quality issue occurs, you cannot trace it back to the source. Impact analysis for changes is guesswork.',
    recommendation:
      'Verify all connectors are configured for lineage extraction. Check transformation tool integrations (dbt, Spark, Airflow). Consider manual lineage for critical dashboards. Focus on end-to-end lineage for key business metrics first.',
    check: (_audit: AuditResult, fieldCoverage: FieldCoverage[]) => {
      const lineageCoverage = fieldCoverage.find((f) => f.field === 'lineage');
      if (!lineageCoverage) return null;

      const percentage = lineageCoverage.coveragePercent * 100;
      const threshold = 40;

      if (percentage >= threshold) return null;

      return {
        detected: true,
        severity: 'warning',
        affectedCount: lineageCoverage.totalAssets - lineageCoverage.populatedAssets,
        percentage: 100 - percentage,
        threshold: 100 - threshold,
        details: `Only ${percentage.toFixed(0)}% of assets (${lineageCoverage.populatedAssets.toLocaleString()} of ${lineageCoverage.totalAssets.toLocaleString()}) have lineage`,
        trend: lineageCoverage.trend
          ? {
              direction:
                lineageCoverage.trend.direction === 'up'
                  ? 'improving'
                  : lineageCoverage.trend.direction === 'down'
                  ? 'worsening'
                  : 'stable',
              change: lineageCoverage.trend.changePercent,
            }
          : undefined,
      };
    },
  },

  {
    id: 'dashboard-no-upstream',
    name: 'Disconnected Dashboards',
    description: 'Dashboards without source lineage',
    severity: 'warning',
    category: 'lineage',
    affectedFields: ['lineage'],
    designImplication:
      'Dashboards without upstream lineage leave business users in the dark. They cannot understand data freshness, trust issues in source data, or identify why metrics changed.',
    recommendation:
      'Prioritize lineage for BI tools (Tableau, PowerBI, Looker). Enable dashboard-to-dataset connectors. For legacy dashboards, document lineage manually in README or links fields.',
    check: (audit: AuditResult) => {
      // Check if we have dashboard assets without lineage
      const dashboardBreakdown = audit.assetBreakdown.find(
        (b) =>
          b.assetType.toLowerCase().includes('dashboard') ||
          b.assetType.toLowerCase().includes('report')
      );

      if (!dashboardBreakdown) return null;

      // Get lineage coverage for the overall catalog
      const lineageField = audit.fieldCoverage.find((f) => f.field === 'lineage');
      if (!lineageField) return null;

      const percentage = lineageField.coveragePercent * 100;
      const threshold = 50;

      // If overall lineage is poor and we have dashboards, flag this
      if (percentage >= threshold) return null;

      return {
        detected: true,
        severity: 'warning',
        affectedCount: Math.round(dashboardBreakdown.count * (1 - lineageField.coveragePercent)),
        percentage: 100 - percentage,
        threshold: 100 - threshold,
        details: `Approximately ${Math.round(dashboardBreakdown.count * (1 - lineageField.coveragePercent))} dashboards may lack upstream lineage`,
      };
    },
  },

  // ============================================
  // GLOSSARY ANTI-PATTERNS
  // ============================================
  {
    id: 'glossary-ghost-town',
    name: 'Glossary Ghost Town',
    description: 'Less than 10% of assets linked to glossary terms',
    severity: 'info',
    category: 'glossary',
    affectedFields: ['glossaryTerms'],
    designImplication:
      'Without glossary links, business terminology is not standardized. Different teams use different names for the same concept, leading to confusion and duplicate work.',
    recommendation:
      'Start with KPI definitions - these have highest business impact. Build glossary incrementally around actual user questions. Link terms to assets as you create them. Use term propagation to auto-link related assets.',
    check: (_audit: AuditResult, fieldCoverage: FieldCoverage[]) => {
      const glossaryCoverage = fieldCoverage.find((f) => f.field === 'glossaryTerms');
      if (!glossaryCoverage) return null;

      const percentage = glossaryCoverage.coveragePercent * 100;
      const threshold = 10;

      if (percentage >= threshold) return null;

      return {
        detected: true,
        severity: 'info',
        affectedCount: glossaryCoverage.totalAssets - glossaryCoverage.populatedAssets,
        percentage: 100 - percentage,
        threshold: 100 - threshold,
        details: `Only ${percentage.toFixed(0)}% of assets (${glossaryCoverage.populatedAssets.toLocaleString()} of ${glossaryCoverage.totalAssets.toLocaleString()}) are linked to glossary terms`,
        trend: glossaryCoverage.trend
          ? {
              direction:
                glossaryCoverage.trend.direction === 'up'
                  ? 'improving'
                  : glossaryCoverage.trend.direction === 'down'
                  ? 'worsening'
                  : 'stable',
              change: glossaryCoverage.trend.changePercent,
            }
          : undefined,
      };
    },
  },

  {
    id: 'orphan-terms',
    name: 'Orphan Terms',
    description: 'Glossary terms with no linked assets',
    severity: 'info',
    category: 'glossary',
    affectedFields: ['glossaryTerms'],
    designImplication:
      'Unlinked glossary terms provide no value. They exist in isolation and users cannot discover related data assets. This indicates the glossary is aspirational rather than practical.',
    recommendation:
      'Review and link or archive unlinked terms. When creating new terms, immediately link them to relevant assets. Consider term usage reports to identify terms that need attention.',
    check: () => {
      // This requires glossary-level data about term linkage
      // Placeholder for future implementation
      return null;
    },
  },

  // ============================================
  // STRUCTURE ANTI-PATTERNS
  // ============================================
  {
    id: 'no-domains',
    name: 'No Domain Structure',
    description: 'No domain organization defined',
    severity: 'info',
    category: 'structure',
    designImplication:
      'Without domains, you cannot organize ownership, delegate governance, or create bounded contexts. Everything becomes a flat, unmanageable list.',
    recommendation:
      'Define domain boundaries based on business capabilities or data sources. Assign domain stewards. Use domains to scope permissions and workflows. Start with 3-7 high-level domains.',
    check: () => {
      // This requires domain structure data from Atlan
      // Placeholder for future implementation
      return null;
    },
  },

  {
    id: 'unbalanced-domains',
    name: 'Unbalanced Domains',
    description: 'Some domains are 10x larger than others',
    severity: 'info',
    category: 'structure',
    designImplication:
      'Imbalanced domains indicate poor domain boundaries. Large domains become unmanageable bottlenecks while small domains waste governance overhead.',
    recommendation:
      'Review domain definitions. Split large domains by sub-capability or system. Merge small domains that share ownership. Aim for relatively balanced sizes to distribute governance work.',
    check: (audit: AuditResult) => {
      // Analyze asset breakdown to detect imbalances
      const breakdown = audit.assetBreakdown;
      if (breakdown.length < 2) return null;

      // Calculate size ratios
      const counts = breakdown.map((b) => b.count).sort((a, b) => b - a);
      const largest = counts[0];
      const smallest = counts[counts.length - 1];

      const ratio = largest / smallest;
      const threshold = 10;

      if (ratio < threshold) return null;

      return {
        detected: true,
        severity: 'info',
        affectedCount: breakdown.length,
        percentage: ratio,
        threshold,
        details: `Asset distribution is highly imbalanced - largest category has ${ratio.toFixed(1)}x more assets than smallest`,
      };
    },
  },
];

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Run all anti-pattern checks against audit data
 */
export function detectAntiPatterns(
  _audit: AuditResult,
  fieldCoverage: FieldCoverage[]
): DetectedAntiPattern[] {
  const detected: DetectedAntiPattern[] = [];

  for (const pattern of ANTI_PATTERNS) {
    const result = pattern.check(_audit, fieldCoverage);
    if (result) {
      detected.push({ pattern, result });
    }
  }

  // Sort by severity (critical -> warning -> info) and then by affected count
  return detected.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    const severityDiff = severityOrder[a.pattern.severity] - severityOrder[b.pattern.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.result.affectedCount - a.result.affectedCount;
  });
}

/**
 * Get anti-patterns by severity
 */
export function getAntiPatternsBySeverity(
  detectedPatterns: DetectedAntiPattern[],
  severity: AntiPatternSeverity
): DetectedAntiPattern[] {
  return detectedPatterns.filter((p) => p.pattern.severity === severity);
}

/**
 * Get anti-patterns by category
 */
export function getAntiPatternsByCategory(
  detectedPatterns: DetectedAntiPattern[],
  category: AntiPatternCategory
): DetectedAntiPattern[] {
  return detectedPatterns.filter((p) => p.pattern.category === category);
}

/**
 * Calculate governance risk score based on detected anti-patterns
 */
export function calculateGovernanceRisk(detectedPatterns: DetectedAntiPattern[]): {
  score: number; // 0-100, where 100 is maximum risk
  level: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
} {
  let riskScore = 0;

  for (const { pattern, result } of detectedPatterns) {
    // Weight by severity and percentage of assets affected
    const severityWeight = pattern.severity === 'critical' ? 30 : pattern.severity === 'warning' ? 15 : 5;
    const impact = (result.percentage / 100) * severityWeight;
    riskScore += impact;
  }

  // Normalize to 0-100
  riskScore = Math.min(100, riskScore);

  let level: 'low' | 'medium' | 'high' | 'critical';
  let summary: string;

  if (riskScore >= 75) {
    level = 'critical';
    summary = 'Critical governance issues detected. Immediate action required.';
  } else if (riskScore >= 50) {
    level = 'high';
    summary = 'Significant governance gaps. Prioritize remediation.';
  } else if (riskScore >= 25) {
    level = 'medium';
    summary = 'Moderate governance issues. Address systematically.';
  } else {
    level = 'low';
    summary = 'Minor governance issues. Monitor and improve gradually.';
  }

  return { score: Math.round(riskScore), level, summary };
}

/**
 * Get statistics about detected anti-patterns
 */
export function getAntiPatternStats(detectedPatterns: DetectedAntiPattern[]): {
  total: number;
  bySeverity: Record<AntiPatternSeverity, number>;
  byCategory: Record<AntiPatternCategory, number>;
  totalAffectedAssets: number;
} {
  const stats = {
    total: detectedPatterns.length,
    bySeverity: {
      critical: 0,
      warning: 0,
      info: 0,
    } as Record<AntiPatternSeverity, number>,
    byCategory: {
      ownership: 0,
      documentation: 0,
      classification: 0,
      lineage: 0,
      glossary: 0,
      structure: 0,
    } as Record<AntiPatternCategory, number>,
    totalAffectedAssets: 0,
  };

  for (const { pattern, result } of detectedPatterns) {
    stats.bySeverity[pattern.severity]++;
    stats.byCategory[pattern.category]++;
    stats.totalAffectedAssets += result.affectedCount;
  }

  return stats;
}
