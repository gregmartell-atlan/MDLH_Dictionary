import { useMemo } from 'react';
import type { EntityDefinition } from '../../types';

interface EntityStatsProps {
  entity: EntityDefinition;
}

export default function EntityStats({ entity }: EntityStatsProps) {
  const stats = useMemo(() => {
    const totalAttributes = entity.attributes.length;
    const requiredAttributes = entity.attributes.filter(a => a.required).length;
    const optionalAttributes = totalAttributes - requiredAttributes;
    const attributesWithValues = entity.attributes.filter(a => a.value !== undefined && a.value !== null && a.value !== '').length;
    const completeness = totalAttributes > 0 ? Math.round((attributesWithValues / totalAttributes) * 100) : 0;
    const totalRelationships = entity.relationships.length;

    return {
      totalAttributes,
      requiredAttributes,
      optionalAttributes,
      attributesWithValues,
      completeness,
      totalRelationships,
    };
  }, [entity]);

  return (
    <div className="p-4 border-b border-gray-100 bg-gray-50">
      <h3 className="text-xs font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
        Statistics
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Attributes</div>
          <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.totalAttributes}
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.requiredAttributes} required
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Relationships</div>
          <div className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {stats.totalRelationships}
          </div>
        </div>
        <div className="bg-white rounded-lg p-3 border border-gray-200 col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Completeness</div>
            <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
              {stats.completeness}%
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${stats.completeness}%`,
                backgroundColor: stats.completeness === 100 
                  ? 'var(--success-color)' 
                  : stats.completeness >= 50 
                  ? 'var(--primary-blue)' 
                  : 'var(--warning-color)',
              }}
            />
          </div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {stats.attributesWithValues} of {stats.totalAttributes} attributes filled
          </div>
        </div>
      </div>
    </div>
  );
}




