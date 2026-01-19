// ============================================
// CANVAS AUDIT PANEL
// Shows metadata completeness for all canvas entities
// ============================================

import { useMemo } from 'react';
import {
  User,
  FileText,
  Tag,
  Shield,
  Database,
  Layers,
  Table2,
  Eye,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
} from 'lucide-react';
import { useModelStore } from '../../stores/modelStore';
import { useUIStore } from '../../stores/uiStore';
import type { EntityDefinition, AtlanAssetType } from '../../types';

const EMPTY_ARRAY: any[] = [];

// ============================================
// TYPES
// ============================================

interface FieldCompleteness {
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  complete: number;
  total: number;
  percent: number;
}

interface TypeBreakdown {
  type: AtlanAssetType;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  count: number;
  completeness: number;
}

interface EntityCompleteness {
  entity: EntityDefinition;
  completeness: number;
  missing: string[];
}

// ============================================
// HELPERS
// ============================================

const TYPE_ICONS: Partial<Record<AtlanAssetType, React.ComponentType<{ size?: number; className?: string }>>> = {
  Database: Database,
  Schema: Layers,
  Table: Table2,
  View: Eye,
};

function hasOwner(entity: EntityDefinition): boolean {
  const ownerAttr = entity.attributes.find(a =>
    a.name === 'ownerUsers' || a.name === 'ownerGroups' || a.name === 'owner'
  );
  return !!(ownerAttr?.value && String(ownerAttr.value).trim() !== '');
}

function hasDescription(entity: EntityDefinition): boolean {
  const descAttr = entity.attributes.find(a =>
    a.name === 'description' || a.name === 'userDescription'
  );
  return !!(descAttr?.value && String(descAttr.value).trim() !== '');
}

function hasTags(entity: EntityDefinition): boolean {
  const tagsAttr = entity.attributes.find(a =>
    a.name === 'atlanTags' || a.name === 'tags' || a.name === 'glossaryTerms'
  );
  return !!(tagsAttr?.value && String(tagsAttr.value).trim() !== '');
}

function hasCertificate(entity: EntityDefinition): boolean {
  const certAttr = entity.attributes.find(a => a.name === 'certificateStatus');
  return !!(certAttr?.value && String(certAttr.value).trim() !== '');
}

function hasCustomMetadata(entity: EntityDefinition): boolean {
  const cmAttr = entity.attributes.find(a => a.name === 'customMetadata');
  return !!(cmAttr?.value && String(cmAttr.value).trim() !== '');
}

function calculateEntityCompleteness(entity: EntityDefinition): number {
  const checks = [
    hasOwner(entity),
    hasDescription(entity),
    hasTags(entity),
    hasCertificate(entity),
    hasCustomMetadata(entity),
  ];
  const complete = checks.filter(Boolean).length;
  return Math.round((complete / checks.length) * 100);
}

function getMissingFields(entity: EntityDefinition): string[] {
  const missing: string[] = [];
  if (!hasOwner(entity)) missing.push('Owner');
  if (!hasDescription(entity)) missing.push('Description');
  if (!hasTags(entity)) missing.push('Tags');
  if (!hasCertificate(entity)) missing.push('Certificate');
  if (!hasCustomMetadata(entity)) missing.push('Custom Metadata');
  return missing;
}

// ============================================
// COMPONENT
// ============================================

export function CanvasAuditPanel() {
  const entities = useModelStore((state) => state.getActiveEntities());
  const edges = useModelStore((state) => {
    const activePage = state.model.pages.find(p => p.id === state.model.activePageId);
    return activePage?.edges || EMPTY_ARRAY;
  });
  const selectEntity = useUIStore((state) => state.selectEntity);

  const importedCount = useMemo(
    () => entities.filter((e) => !!e.atlanGuid).length,
    [entities]
  );

  // Calculate field completeness
  const fieldCompleteness = useMemo((): FieldCompleteness[] => {
    const total = entities.length;
    if (total === 0) return [];

    return [
      {
        label: 'Owner',
        icon: User,
        complete: entities.filter(hasOwner).length,
        total,
        percent: Math.round((entities.filter(hasOwner).length / total) * 100),
      },
      {
        label: 'Desc',
        icon: FileText,
        complete: entities.filter(hasDescription).length,
        total,
        percent: Math.round((entities.filter(hasDescription).length / total) * 100),
      },
      {
        label: 'Tags/Terms',
        icon: Tag,
        complete: entities.filter(hasTags).length,
        total,
        percent: Math.round((entities.filter(hasTags).length / total) * 100),
      },
      {
        label: 'Cert',
        icon: Shield,
        complete: entities.filter(hasCertificate).length,
        total,
        percent: Math.round((entities.filter(hasCertificate).length / total) * 100),
      },
      {
        label: 'CM',
        icon: Database,
        complete: entities.filter(hasCustomMetadata).length,
        total,
        percent: Math.round((entities.filter(hasCustomMetadata).length / total) * 100),
      },
    ];
  }, [entities]);

  // Calculate by-type breakdown
  const typeBreakdown = useMemo((): TypeBreakdown[] => {
    const byType = new Map<AtlanAssetType, EntityDefinition[]>();

    entities.forEach((entity) => {
      const type = entity.assetType || 'CustomEntity';
      if (!byType.has(type)) {
        byType.set(type, []);
      }
      byType.get(type)!.push(entity);
    });

    return Array.from(byType.entries())
      .map(([type, typeEntities]) => ({
        type,
        icon: TYPE_ICONS[type] || Database,
        count: typeEntities.length,
        completeness: Math.round(
          typeEntities.reduce((sum, e) => sum + calculateEntityCompleteness(e), 0) / typeEntities.length
        ),
      }))
      .sort((a, b) => a.completeness - b.completeness);
  }, [entities]);

  // Find lowest completeness entities
  const lowestCompleteness = useMemo((): EntityCompleteness[] => {
    return entities
      .map((entity) => ({
        entity,
        completeness: calculateEntityCompleteness(entity),
        missing: getMissingFields(entity),
      }))
      .filter((e) => e.completeness < 100)
      .sort((a, b) => a.completeness - b.completeness)
      .slice(0, 5);
  }, [entities]);

  // Overall completeness
  const overallCompleteness = useMemo(() => {
    if (entities.length === 0) return 0;
    return Math.round(
      entities.reduce((sum, e) => sum + calculateEntityCompleteness(e), 0) / entities.length
    );
  }, [entities]);

  if (entities.length === 0) {
    return (
      <div className="p-6 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Database size={28} className="text-gray-400" />
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">No entities on canvas</p>
        <p className="text-xs text-gray-500">
          Drag assets from the explorer<br />to start your audit
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-900">Canvas Audit</h2>
          <span className="text-lg font-bold text-blue-600">{overallCompleteness}%</span>
        </div>
        <p className="text-xs text-gray-500">
          {importedCount} imported node(s) • Required completeness...
        </p>
      </div>

      {/* Field Completeness Grid */}
      <div className="p-4 border-b border-gray-200">
        <div className="grid grid-cols-5 gap-2">
          {fieldCompleteness.map((field) => (
            <div
              key={field.label}
              className="flex flex-col items-center p-2 rounded-lg bg-gray-50 border border-gray-100"
            >
              <field.icon size={14} className="text-gray-400 mb-1" />
              <span className="text-[10px] text-gray-500 mb-1">{field.label}</span>
              <span
                className={`text-sm font-bold ${
                  field.percent === 100
                    ? 'text-green-600'
                    : field.percent >= 50
                    ? 'text-blue-600'
                    : field.percent > 0
                    ? 'text-amber-600'
                    : 'text-gray-400'
                }`}
              >
                {field.percent}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* By Type */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          By type
        </h3>
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 text-[10px] text-gray-400 uppercase tracking-wider px-2">
            <span>TYPE</span>
            <span className="text-center">COUNT</span>
            <span className="text-right">REQ%</span>
          </div>
          {typeBreakdown.map((item) => (
            <div
              key={item.type}
              className="grid grid-cols-3 gap-2 items-center p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <item.icon size={14} className="text-gray-400" />
                <span className="text-sm text-gray-700 truncate">{item.type}</span>
              </div>
              <span className="text-sm text-gray-600 text-center">{item.count}</span>
              <span
                className={`text-sm font-medium text-right ${
                  item.completeness === 100
                    ? 'text-green-600'
                    : item.completeness >= 50
                    ? 'text-blue-600'
                    : 'text-amber-600'
                }`}
              >
                {item.completeness}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lowest Completeness */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Lowest completeness
        </h3>
        {lowestCompleteness.length === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200">
            <CheckCircle2 size={16} className="text-green-600" />
            <span className="text-sm text-green-700">All entities are complete!</span>
          </div>
        ) : (
          <div className="space-y-2">
            {lowestCompleteness.map((item) => {
              const Icon = TYPE_ICONS[item.entity.assetType || 'CustomEntity'] || Database;
              return (
                <button
                  key={item.entity.id}
                  onClick={() => selectEntity(item.entity.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 transition-colors text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.entity.displayName}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 flex items-center gap-1">
                      <AlertCircle size={10} className="text-amber-500" />
                      {item.entity.assetType} • missing {item.missing.length}/{5}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`text-sm font-bold ${
                        item.completeness >= 50 ? 'text-blue-600' : 'text-amber-600'
                      }`}
                    >
                      {item.completeness}%
                    </span>
                    <ChevronRight
                      size={16}
                      className="text-gray-300 group-hover:text-blue-500 transition-colors"
                    />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{entities.length} entities</span>
          <span>{edges.length} relationships</span>
        </div>
      </div>
    </div>
  );
}

export default CanvasAuditPanel;
