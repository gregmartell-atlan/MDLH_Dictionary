// ============================================
// VALIDATION TAB
// Validation issues and recommended fixes from PriorityDashboard
// ============================================

import { useMemo } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { ValidationPanel, ValidationSummary } from '../../priority/ValidationPanel';
import { validateMetadataModel, getRecommendedFixes, getValidationSummary } from '../../../engines/validation-engine';
import type { ExploreDataState } from '../../../hooks/useExploreData';

interface ValidationTabProps {
  data: ExploreDataState;
}

export function ValidationTab({ data }: ValidationTabProps) {
  const { audit, mode } = data;

  // Compute validation issues
  const validationIssues = useMemo(
    () => (audit ? validateMetadataModel(audit) : []),
    [audit]
  );

  const recommendedFixes = useMemo(
    () => getRecommendedFixes(validationIssues),
    [validationIssues]
  );

  const validationSummary = useMemo(
    () => getValidationSummary(validationIssues),
    [validationIssues]
  );

  if (mode === 'none') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <WifiOff size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Connection Required
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Validation requires audit data. Connect to Atlan to run validation checks.
          </p>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            No Audit Data
          </h3>
          <p className="text-sm text-gray-500 max-w-md">
            Audit data is needed to run validation. This is only available when connected to a live Atlan instance.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      <ValidationSummary
        errors={validationSummary.errors}
        warnings={validationSummary.warnings}
        infos={validationSummary.info}
        riskScore={validationSummary.riskScore}
      />
      <ValidationPanel issues={validationIssues} fixes={recommendedFixes} />
    </div>
  );
}

export default ValidationTab;
