/**
 * Wizard Step 0: Strategy Scout (VVM)
 * 
 * Value vs Viability Matrix to determine where to pilot
 * Based on Module A from spec v2
 */

import { useState } from 'react';
import { useAssistantStore } from '../../stores/assistantStore';
import { analyzeDomainsForPilot } from '../../data/strategy-scout';
import { Target, TrendingUp, Users, FileCheck, Zap, CheckCircle2 } from 'lucide-react';

export function WizardStep0StrategyScout() {
  const { updateWizardProfile } = useAssistantStore();
  const [domains, setDomains] = useState<Array<{
    name: string;
    businessImpact: number;
    userReach: number;
    regulatoryPressure: number;
    leadershipSponsorship: number;
    smeAvailability: number;
    existingDocumentation: number;
    toolingReadiness: number;
  }>>([
    {
      name: 'Finance',
      businessImpact: 3,
      userReach: 3,
      regulatoryPressure: 3,
      leadershipSponsorship: 3,
      smeAvailability: 3,
      existingDocumentation: 3,
      toolingReadiness: 3,
    },
  ]);
  
  const [analysisResult, setAnalysisResult] = useState<ReturnType<typeof analyzeDomainsForPilot> | null>(null);
  
  const handleAddDomain = () => {
    setDomains([
      ...domains,
      {
        name: '',
        businessImpact: 3,
        userReach: 3,
        regulatoryPressure: 3,
        leadershipSponsorship: 3,
        smeAvailability: 3,
        existingDocumentation: 3,
        toolingReadiness: 3,
      },
    ]);
  };
  
  const handleAnalyze = () => {
    const validDomains = domains.filter(d => d.name.trim() !== '');
    if (validDomains.length === 0) return;
    
    const result = analyzeDomainsForPilot(validDomains.map(d => ({
      domain: d.name,
      businessImpact: d.businessImpact,
      userReach: d.userReach,
      regulatoryPressure: d.regulatoryPressure,
      leadershipSponsorship: d.leadershipSponsorship,
      smeAvailability: d.smeAvailability,
      existingDocumentation: d.existingDocumentation,
      toolingReadiness: d.toolingReadiness,
    })));
    
    setAnalysisResult(result);
    
    // Update wizard profile with recommended domain
    updateWizardProfile({
      domains: [result.recommendedPilot],
    });
  };
  
  const getClassificationColor = (classification: 'Quick Win' | 'Big Bet' | 'Game Changer' | 'Backlog') => {
    const colors = {
      'Quick Win': 'bg-emerald-100 text-emerald-700 border-emerald-300',
      'Big Bet': 'bg-amber-100 text-amber-700 border-amber-300',
      'Game Changer': 'bg-blue-100 text-blue-700 border-blue-300',
      'Backlog': 'bg-slate-100 text-slate-700 border-slate-300',
    };
    return colors[classification];
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Strategy Scout: Where to Start?</h2>
        <p className="text-slate-600">
          Avoid "boiling the ocean" – use the Value vs Viability Matrix to find your ideal pilot domain.
        </p>
      </div>
      
      {/* Scoring Guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">Scoring Guide (0-5 scale)</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold text-blue-900 mb-1">Value Dimensions</div>
            <ul className="space-y-1 text-blue-800">
              <li><TrendingUp className="inline w-4 h-4 mr-1" />Business Impact: Revenue/cost/risk reduction</li>
              <li><Users className="inline w-4 h-4 mr-1" />User Reach: How many people benefit?</li>
              <li><FileCheck className="inline w-4 h-4 mr-1" />Regulatory Pressure: Audit/compliance needs</li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-blue-900 mb-1">Viability Dimensions</div>
            <ul className="space-y-1 text-blue-800">
              <li><Target className="inline w-4 h-4 mr-1" />Leadership Sponsorship: Executive support</li>
              <li><Users className="inline w-4 h-4 mr-1" />SME Availability: Steward time & knowledge</li>
              <li><FileCheck className="inline w-4 h-4 mr-1" />Existing Documentation: Current metadata state</li>
              <li><Zap className="inline w-4 h-4 mr-1" />Tooling Readiness: Connectors & lineage working</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* Domain Scoring */}
      <div className="space-y-4">
        {domains.map((domain, idx) => (
          <div key={idx} className="bg-white border border-slate-200 rounded-lg p-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Domain Name
              </label>
              <input
                type="text"
                value={domain.name}
                onChange={(e) => {
                  const updated = [...domains];
                  updated[idx].name = e.target.value;
                  setDomains(updated);
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                placeholder="e.g., Finance, Marketing, Sales"
              />
            </div>
            
            <div className="grid md:grid-cols-4 gap-4">
              {/* Value dimensions */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Business Impact
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.businessImpact}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].businessImpact = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.businessImpact}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  User Reach
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.userReach}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].userReach = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.userReach}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Regulatory Pressure
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.regulatoryPressure}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].regulatoryPressure = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.regulatoryPressure}</div>
              </div>
              
              <div className="border-l border-slate-200 pl-4">
                <div className="text-xs font-semibold text-blue-700 mb-1">Value Score</div>
                <div className="text-2xl font-bold text-blue-700">
                  {domain.businessImpact + domain.userReach + domain.regulatoryPressure}
                  <span className="text-sm text-slate-500">/15</span>
                </div>
              </div>
            </div>
            
            <div className="grid md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-200">
              {/* Viability dimensions */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Leadership
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.leadershipSponsorship}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].leadershipSponsorship = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.leadershipSponsorship}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  SME Availability
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.smeAvailability}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].smeAvailability = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.smeAvailability}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Documentation
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.existingDocumentation}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].existingDocumentation = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.existingDocumentation}</div>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Tooling
                </label>
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={domain.toolingReadiness}
                  onChange={(e) => {
                    const updated = [...domains];
                    updated[idx].toolingReadiness = Number(e.target.value);
                    setDomains(updated);
                  }}
                  className="w-full"
                />
                <div className="text-center text-sm font-semibold text-slate-900">{domain.toolingReadiness}</div>
              </div>
              
              <div className="border-l border-slate-200 pl-4">
                <div className="text-xs font-semibold text-emerald-700 mb-1">Viability Score</div>
                <div className="text-2xl font-bold text-emerald-700">
                  {domain.leadershipSponsorship + domain.smeAvailability + domain.existingDocumentation + domain.toolingReadiness}
                  <span className="text-sm text-slate-500">/20</span>
                </div>
              </div>
            </div>
          </div>
        ))}
        
        <button
          onClick={handleAddDomain}
          className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-slate-400 hover:text-slate-700"
        >
          + Add Another Domain
        </button>
      </div>
      
      <div className="flex justify-center">
        <button
          onClick={handleAnalyze}
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          Analyze Domains →
        </button>
      </div>
      
      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <h3 className="font-semibold text-slate-900">Analysis Results</h3>
          
          {/* Recommendation */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mt-0.5" />
              <div>
                <div className="font-medium text-emerald-900 mb-1">Recommended Pilot</div>
                <p className="text-emerald-800">{analysisResult.recommendation}</p>
              </div>
            </div>
          </div>
          
          {/* Domain Classifications */}
          <div className="grid gap-3">
            {analysisResult.domains.map((domain) => (
              <div
                key={domain.domain}
                className={`border rounded-lg p-3 ${getClassificationColor(domain.classification)}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold">{domain.domain}</div>
                  <div className="px-2 py-1 bg-white/50 rounded text-sm font-medium">
                    {domain.classification}
                  </div>
                </div>
                <div className="text-sm opacity-90">{domain.rationale}</div>
                <div className="mt-2 flex gap-4 text-xs">
                  <span>Value: {domain.valueScore}/15</span>
                  <span>Viability: {domain.viabilityScore}/20</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
