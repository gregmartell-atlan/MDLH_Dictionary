// ============================================
// ENTITY AUDIT PANEL
// Shows metadata completeness for a single entity
// ============================================

import { useMemo } from 'react';
import {
  User,
  FileText,
  Tag,
  Shield,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import type { EntityDefinition } from '../../types';

// ============================================
// TYPES
// ============================================

interface AuditField {
  name: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  isComplete: boolean;
  value?: string | null;
  importance: 'critical' | 'important' | 'nice-to-have';
}

interface EntityAuditPanelProps {
  entity: EntityDefinition;
}

// ============================================
// HELPERS
// ============================================

function getAttrValue(entity: EntityDefinition, ...names: string[]): string | null {
  for (const name of names) {
    const attr = entity.attributes.find(a => a.name === name);
    if (attr?.value && String(attr.value).trim()) {
      return String(attr.value);
    }
  }
  return null;
}

// ============================================
// COMPONENT
// ============================================

export function EntityAuditPanel({ entity }: EntityAuditPanelProps) {
  // Calculate field completeness
  const auditFields = useMemo((): AuditField[] => {
    const owner = getAttrValue(entity, 'ownerUsers', 'ownerGroups', 'owner');
    const description = getAttrValue(entity, 'description', 'userDescription');
    const tags = getAttrValue(entity, 'atlanTags', 'tags');
    const terms = getAttrValue(entity, 'glossaryTerms', 'meanings');
    const certificate = getAttrValue(entity, 'certificateStatus');
    const customMetadata = getAttrValue(entity, 'customMetadata');

    return [
      {
        name: 'owner',
        label: 'Owner',
        icon: User,
        isComplete: !!owner,
        value: owner,
        importance: 'critical',
      },
      {
        name: 'description',
        label: 'Description',
        icon: FileText,
        isComplete: !!description,
        value: description ? (description.length > 100 ? description.substring(0, 100) + '...' : description) : null,
        importance: 'critical',
      },
      {
        name: 'tags',
        label: 'Classifications/Tags',
        icon: Tag,
        isComplete: !!(tags || terms),
        value: tags || terms,
        importance: 'important',
      },
      {
        name: 'certificate',
        label: 'Certificate',
        icon: Shield,
        isComplete: !!certificate,
        value: certificate,
        importance: 'important',
      },
      {
        name: 'customMetadata',
        label: 'Custom Metadata',
        icon: Database,
        isComplete: !!customMetadata,
        value: customMetadata ? 'Populated' : null,
        importance: 'nice-to-have',
      },
    ];
  }, [entity]);

  // Calculate completeness score
  const completenessScore = useMemo(() => {
    const weights = {
      critical: 3,
      important: 2,
      'nice-to-have': 1,
    };

    let totalWeight = 0;
    let completedWeight = 0;

    auditFields.forEach(field => {
      const weight = weights[field.importance];
      totalWeight += weight;
      if (field.isComplete) {
        completedWeight += weight;
      }
    });

    return Math.round((completedWeight / totalWeight) * 100);
  }, [auditFields]);

  // Get color based on score
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 border-green-200';
    if (score >= 50) return 'bg-amber-100 border-amber-200';
    return 'bg-red-100 border-red-200';
  };

  const criticalFields = auditFields.filter(f => f.importance === 'critical');
  const importantFields = auditFields.filter(f => f.importance === 'important');
  const niceToHaveFields = auditFields.filter(f => f.importance === 'nice-to-have');

  const renderField = (field: AuditField) => (
    <div
      key={field.name}
      className={`flex items-start gap-3 p-3 rounded-lg border ${
        field.isComplete
          ? 'bg-green-50/50 border-green-200'
          : 'bg-red-50/50 border-red-200'
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        field.isComplete ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
      }`}>
        <field.icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-gray-900">{field.label}</span>
          {field.isComplete ? (
            <CheckCircle2 size={16} className="text-green-500" />
          ) : (
            <XCircle size={16} className="text-red-500" />
          )}
        </div>
        {field.isComplete && field.value ? (
          <p className="text-xs text-gray-600 truncate">{field.value}</p>
        ) : (
          <p className="text-xs text-red-600">Missing - add this metadata</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      {/* Completeness Score */}
      <div className={`rounded-lg border p-4 ${getScoreBgColor(completenessScore)}`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart3 size={18} className={getScoreColor(completenessScore)} />
            <span className="text-sm font-semibold text-gray-700">Metadata Completeness</span>
          </div>
          <span className={`text-2xl font-bold ${getScoreColor(completenessScore)}`}>
            {completenessScore}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${
              completenessScore >= 80 ? 'bg-green-500' :
              completenessScore >= 50 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${completenessScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 mt-2">
          {completenessScore >= 80
            ? 'Great job! This asset is well-documented.'
            : completenessScore >= 50
            ? 'Some metadata is missing. Consider adding more details.'
            : 'This asset needs attention. Critical metadata is missing.'}
        </p>
      </div>

      {/* Critical Fields */}
      {criticalFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            <AlertTriangle size={12} className="text-red-500" />
            Critical ({criticalFields.filter(f => f.isComplete).length}/{criticalFields.length})
          </h4>
          <div className="space-y-2">
            {criticalFields.map(renderField)}
          </div>
        </div>
      )}

      {/* Important Fields */}
      {importantFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            Important ({importantFields.filter(f => f.isComplete).length}/{importantFields.length})
          </h4>
          <div className="space-y-2">
            {importantFields.map(renderField)}
          </div>
        </div>
      )}

      {/* Nice to Have Fields */}
      {niceToHaveFields.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
            Nice to Have ({niceToHaveFields.filter(f => f.isComplete).length}/{niceToHaveFields.length})
          </h4>
          <div className="space-y-2">
            {niceToHaveFields.map(renderField)}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="border-t pt-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 bg-green-50 rounded-lg border border-green-200">
            <div className="text-lg font-bold text-green-600">
              {auditFields.filter(f => f.isComplete).length}
            </div>
            <div className="text-[10px] text-green-700 uppercase">Complete</div>
          </div>
          <div className="p-2 bg-red-50 rounded-lg border border-red-200">
            <div className="text-lg font-bold text-red-600">
              {auditFields.filter(f => !f.isComplete).length}
            </div>
            <div className="text-[10px] text-red-700 uppercase">Missing</div>
          </div>
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-lg font-bold text-gray-600">
              {auditFields.length}
            </div>
            <div className="text-[10px] text-gray-700 uppercase">Total</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EntityAuditPanel;
