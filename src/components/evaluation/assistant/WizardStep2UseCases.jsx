/**
 * Wizard Step 2: Use Case Selection
 * 
 * Select target use cases that determine required metadata fields.
 */

import React from 'react';
import { useAssistantStore } from '../../../stores/assistantStore';
import { 
  Search, 
  Shield, 
  TrendingUp, 
  GitBranch, 
  Users, 
  Bot,
  FileText,
  Scale,
  Gauge,
  CheckCircle2
} from 'lucide-react';

const USE_CASES = [
  {
    id: 'self_service_discovery',
    name: 'Self-Service Data Discovery',
    description: 'Enable users to find and understand data assets independently',
    icon: Search,
    requiredSignals: ['OWNERSHIP', 'SEMANTICS'],
    category: 'Discovery',
  },
  {
    id: 'data_governance',
    name: 'Data Governance',
    description: 'Establish ownership, stewardship, and certification processes',
    icon: Shield,
    requiredSignals: ['OWNERSHIP', 'TRUST', 'SENSITIVITY'],
    category: 'Governance',
  },
  {
    id: 'impact_analysis',
    name: 'Impact Analysis',
    description: 'Understand downstream effects of changes to data assets',
    icon: GitBranch,
    requiredSignals: ['LINEAGE'],
    category: 'Operations',
  },
  {
    id: 'dsar_retention',
    name: 'DSAR & Data Retention',
    description: 'Support data subject access requests and retention policies',
    icon: Scale,
    requiredSignals: ['SENSITIVITY', 'ACCESS', 'OWNERSHIP'],
    category: 'Compliance',
  },
  {
    id: 'ai_agents',
    name: 'AI/ML Readiness',
    description: 'Prepare data for AI agents and machine learning workloads',
    icon: Bot,
    requiredSignals: ['SEMANTICS', 'QUALITY', 'SENSITIVITY', 'ACCESS'],
    category: 'AI',
  },
  {
    id: 'text_to_sql',
    name: 'Text-to-SQL',
    description: 'Enable natural language querying of data assets',
    icon: FileText,
    requiredSignals: ['SEMANTICS', 'LINEAGE'],
    category: 'AI',
  },
  {
    id: 'rag',
    name: 'RAG Applications',
    description: 'Support retrieval-augmented generation applications',
    icon: Bot,
    requiredSignals: ['SEMANTICS', 'QUALITY', 'TRUST'],
    category: 'AI',
  },
  {
    id: 'cost_optimization',
    name: 'Cost Optimization',
    description: 'Identify unused or underutilized data assets',
    icon: TrendingUp,
    requiredSignals: ['USAGE'],
    category: 'Operations',
  },
  {
    id: 'data_quality',
    name: 'Data Quality Monitoring',
    description: 'Track and improve data quality across assets',
    icon: Gauge,
    requiredSignals: ['QUALITY', 'FRESHNESS'],
    category: 'Quality',
  },
  {
    id: 'collaboration',
    name: 'Cross-Team Collaboration',
    description: 'Enable teams to share and discover each other\'s data',
    icon: Users,
    requiredSignals: ['OWNERSHIP', 'SEMANTICS'],
    category: 'Discovery',
  },
];

export function WizardStep2UseCases() {
  const { wizardState, updateWizardProfile } = useAssistantStore();
  const { profile } = wizardState;
  const selectedUseCases = profile.useCases || [];

  const handleToggleUseCase = (useCaseId) => {
    const useCases = selectedUseCases.includes(useCaseId)
      ? selectedUseCases.filter(uc => uc !== useCaseId)
      : [...selectedUseCases, useCaseId];
    updateWizardProfile({ useCases });
  };

  const isSelected = (useCaseId) => selectedUseCases.includes(useCaseId);

  // Group use cases by category
  const categories = [...new Set(USE_CASES.map(uc => uc.category))];

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-900">
          What do you want to achieve?
        </h2>
        <p className="text-sm text-slate-500">
          Select the use cases that matter most to your organization. 
          This helps us recommend the right metadata fields and enrichment strategies.
        </p>
      </div>

      {/* Use case cards by category */}
      {categories.map(category => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-medium text-slate-700 uppercase tracking-wide">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {USE_CASES.filter(uc => uc.category === category).map(useCase => {
              const Icon = useCase.icon;
              const selected = isSelected(useCase.id);
              
              return (
                <button
                  key={useCase.id}
                  onClick={() => handleToggleUseCase(useCase.id)}
                  className={`relative p-4 text-left rounded-lg border-2 transition-all ${
                    selected
                      ? 'bg-blue-50 border-blue-500'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Selection indicator */}
                  {selected && (
                    <div className="absolute top-3 right-3">
                      <CheckCircle2 className="w-5 h-5 text-blue-600" />
                    </div>
                  )}
                  
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      selected ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      <Icon className={`w-5 h-5 ${
                        selected ? 'text-blue-600' : 'text-slate-500'
                      }`} />
                    </div>
                    <div className="flex-1 pr-6">
                      <h4 className={`font-medium ${
                        selected ? 'text-blue-900' : 'text-slate-900'
                      }`}>
                        {useCase.name}
                      </h4>
                      <p className={`text-sm mt-1 ${
                        selected ? 'text-blue-700' : 'text-slate-500'
                      }`}>
                        {useCase.description}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {useCase.requiredSignals.map(signal => (
                          <span
                            key={signal}
                            className={`text-xs px-2 py-0.5 rounded ${
                              selected
                                ? 'bg-blue-200 text-blue-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Summary */}
      <div className="p-4 bg-slate-100 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 mb-2">
          Selected Use Cases ({selectedUseCases.length})
        </h3>
        {selectedUseCases.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {selectedUseCases.map(ucId => {
              const useCase = USE_CASES.find(uc => uc.id === ucId);
              return useCase ? (
                <span
                  key={ucId}
                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-white text-slate-700 rounded-full text-sm border border-slate-200"
                >
                  {useCase.name}
                </span>
              ) : null;
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No use cases selected. Select at least one to continue.
          </p>
        )}
      </div>

      {/* Required signals summary */}
      {selectedUseCases.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            Required Signals for Selected Use Cases
          </h3>
          <div className="flex flex-wrap gap-2">
            {[...new Set(
              selectedUseCases.flatMap(ucId => {
                const useCase = USE_CASES.find(uc => uc.id === ucId);
                return useCase?.requiredSignals || [];
              })
            )].map(signal => (
              <span
                key={signal}
                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default WizardStep2UseCases;
