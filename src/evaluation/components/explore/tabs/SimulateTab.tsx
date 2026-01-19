// ============================================
// SIMULATE TAB
// Impact simulation from PriorityDashboard
// ============================================

import { useState, useMemo } from 'react';
import { Target, WifiOff } from 'lucide-react';
import { ImpactSimulator, QuickSimulator } from '../../priority/ImpactSimulator';
import { matchPatterns } from '../../../engines/pattern-matcher';
import type { MetadataFieldType, PatternTemplate } from '../../../types/priority';
import type { ExploreDataState } from '../../../hooks/useExploreData';

interface SimulateTabProps {
  data: ExploreDataState;
  initialField?: MetadataFieldType | null;
}

export function SimulateTab({ data, initialField }: SimulateTabProps) {
  const [simulatingField, setSimulatingField] = useState<MetadataFieldType | null>(
    initialField || null
  );
  const { fieldCoverage, mode } = data;

  // Get best matching pattern for context
  const patternMatches = useMemo(
    () => matchPatterns(fieldCoverage),
    [fieldCoverage]
  );

  const bestPattern: PatternTemplate | null = useMemo(() => {
    if (patternMatches.length === 0) return null;
    // Find the pattern with highest match score
    const best = patternMatches.reduce((a, b) =>
      a.matchScore > b.matchScore ? a : b
    );
    return best.matchScore > 0.5 ? best.pattern : null;
  }, [patternMatches]);

  if (mode === 'none') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <WifiOff size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Connection Required
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Impact simulation requires metadata coverage data. Import assets or connect to Atlan to simulate improvements.
          </p>
        </div>
      </div>
    );
  }

  if (fieldCoverage.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Target size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No Coverage Data
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Field coverage data is needed for impact simulation. Ensure your data source has coverage information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fadeIn">
      {simulatingField ? (
        <ImpactSimulator
          field={simulatingField}
          audit={fieldCoverage}
          pattern={bestPattern}
          onClose={() => setSimulatingField(null)}
        />
      ) : (
        <QuickSimulator
          audit={fieldCoverage}
          pattern={bestPattern}
          onFieldSelect={setSimulatingField}
        />
      )}
    </div>
  );
}

export default SimulateTab;
