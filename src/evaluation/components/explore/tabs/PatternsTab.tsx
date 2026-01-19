// ============================================
// PATTERNS TAB
// Pattern selection and matching from PriorityDashboard
// ============================================

import { useState, useMemo, useCallback } from 'react';
import { Layers, WifiOff } from 'lucide-react';
import { PatternSelector, PatternDetail } from '../../priority/PatternSelector';
import { matchPatterns } from '../../../engines/pattern-matcher';
import type { PatternTemplate } from '../../../types/priority';
import type { ExploreDataState } from '../../../hooks/useExploreData';
import { templatesById } from '../../../templates/canvas';
import { useModelStore } from '../../../stores/modelStore';

interface PatternsTabProps {
  data: ExploreDataState;
  onNavigate?: (view: string) => void;
}

const PATTERN_TO_CANVAS_TEMPLATE_ID: Partial<Record<PatternTemplate['id'], string>> = {
  'quick-discovery': 'quick-discovery',
  'trusted-metrics': 'trusted-metrics',
  'root-cause-analysis': 'root-cause-analysis',
  'compliance-ready': 'compliance',
  'data-product': 'data-mesh',
};

export function PatternsTab({ data, onNavigate }: PatternsTabProps) {
  const [selectedPattern, setSelectedPattern] = useState<PatternTemplate | null>(null);
  const { fieldCoverage, mode } = data;
  const applyTemplateToNewPage = useModelStore((state) => state.applyTemplateToNewPage);

  // Calculate pattern matches
  const patternMatches = useMemo(
    () => matchPatterns(fieldCoverage),
    [fieldCoverage]
  );

  const canvasTemplate = useMemo(() => {
    if (!selectedPattern) return null;
    const templateId = PATTERN_TO_CANVAS_TEMPLATE_ID[selectedPattern.id];
    return templateId ? (templatesById[templateId] || null) : null;
  }, [selectedPattern]);

  const handleApplyTemplate = useCallback(() => {
    if (!canvasTemplate) return;
    applyTemplateToNewPage(canvasTemplate);
    onNavigate?.('designer');
  }, [applyTemplateToNewPage, canvasTemplate, onNavigate]);

  if (mode === 'none') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <WifiOff size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Connection Required
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Pattern matching requires metadata coverage data. Import assets or connect to Atlan to analyze patterns.
          </p>
        </div>
      </div>
    );
  }

  if (fieldCoverage.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Layers size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No Coverage Data
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Metadata coverage data is needed to match patterns. Ensure your data source has field coverage information.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fadeIn">
      <div>
        <h3
          className="font-semibold mb-4"
          style={{ color: 'var(--explore-text-primary)' }}
        >
          Select a Pattern
        </h3>
        <PatternSelector
          matches={patternMatches}
          selectedPattern={selectedPattern}
          onSelect={setSelectedPattern}
        />
      </div>
      {selectedPattern && (
        <div className="space-y-3">
          <PatternDetail
            pattern={selectedPattern}
            match={patternMatches.find((m) => m.pattern.id === selectedPattern.id)}
          />
          {canvasTemplate && (
            <button
              onClick={handleApplyTemplate}
              className="btn-secondary w-full justify-center"
            >
              Apply Matching Canvas Template (New Page)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default PatternsTab;
