/**
 * Wizard Step 1: Profile & Input
 * 
 * Collect industry, domains, use cases, connectors, team size, and maturity level.
 */

import { useState, useEffect } from 'react';
import { useAssistantStore } from '../../stores/assistantStore';
import { getDomains } from '../../services/atlanApi';
import { Loader2, RefreshCw } from 'lucide-react';
import type { Industry, UseCase, WizardState } from '../../types/metadata-assistant';

type TeamSize = NonNullable<WizardState['profile']['teamSize']>;
type Maturity = NonNullable<WizardState['profile']['maturity']>;

const INDUSTRIES: Industry[] = [
  'Financial Services',
  'Healthcare',
  'Manufacturing/HVAC',
  'Retail/E-commerce',
  'Technology',
  'Telecommunications',
  'Media/Entertainment',
  'Other',
];

const USE_CASES: UseCase[] = [
  'Data Discovery',
  'Trusted Metrics',
  'Compliance',
  'Root Cause Analysis',
  'Impact Analysis',
  'Metrics Catalog',
  'Data Compliance',
  'Cost Optimization',
  'Lifecycle Management',
  'Data Products',
];

const CONNECTORS = [
  'Snowflake',
  'Tableau',
  'PowerBI',
  'dbt',
  'Looker',
  'Databricks',
  'BigQuery',
  'Redshift',
  'Postgres',
  'MySQL',
  'Sigma',
  'Mode',
  'Airflow',
];

export function WizardStep1Profile() {
  const { wizardState, updateWizardProfile } = useAssistantStore();
  const { profile } = wizardState;
  const [atlanDomains, setAtlanDomains] = useState<{ name: string; guid: string }[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(false);
  const [domainInput, setDomainInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch initial list of domains
  useEffect(() => {
    const fetchDomains = async () => {
      setIsLoadingDomains(true);
      try {
        const domains = await getDomains();
        setAtlanDomains(domains);
      } catch (error) {
        console.error('Failed to fetch domains from Atlan', error);
      } finally {
        setIsLoadingDomains(false);
      }
    };
    fetchDomains();
  }, []);

  // Search domains when typing (debounced)
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (domainInput.length > 1) {
        setIsLoadingDomains(true);
        try {
          const domains = await getDomains(domainInput);
          setAtlanDomains(domains);
        } catch (error) {
          console.error('Failed to search domains', error);
        } finally {
          setIsLoadingDomains(false);
        }
      } else if (domainInput.length === 0) {
        // Reset to default list
        const domains = await getDomains();
        setAtlanDomains(domains);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [domainInput]);

  const toggleUseCase = (useCase: UseCase) => {
    const current = profile.useCases || [];
    const updated = current.includes(useCase)
      ? current.filter((uc) => uc !== useCase)
      : [...current, useCase];
    updateWizardProfile({ useCases: updated });
  };

  const toggleConnector = (connector: string) => {
    const current = profile.connectors || [];
    const updated = current.includes(connector)
      ? current.filter((c) => c !== connector)
      : [...current, connector];
    updateWizardProfile({ connectors: updated });
  };



  const addDomain = (domainName: string) => {
    const current = profile.domains || [];
    if (!current.includes(domainName)) {
      updateWizardProfile({ domains: [...current, domainName] });
    }
  };

  const removeDomain = (domainName: string) => {
    const current = profile.domains || [];
    updateWizardProfile({ domains: current.filter(d => d !== domainName) });
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Tell us about your organization</h2>
        <p className="text-slate-600">
          We'll use this information to recommend user stories and metadata model templates from similar customers.
        </p>
      </div>

      {/* Project Name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Project Name
        </label>
        <input
          type="text"
          placeholder="e.g., Enterprise Data Mesh 2026"
          value={profile.projectName || ''}
          onChange={(e) => updateWizardProfile({ projectName: e.target.value })}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Industry / Vertical
        </label>
        <select
          value={profile.industry || ''}
          onChange={(e) => updateWizardProfile({ industry: e.target.value as Industry })}
          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select an industry...</option>
          {INDUSTRIES.map((industry) => (
            <option key={industry} value={industry}>
              {industry}
            </option>
          ))}
        </select>
      </div>

      {/* Domains */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-slate-700">
            Business Domains
          </label>
          {isLoadingDomains && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-3 h-3 animate-spin" />
              Fetching from Atlan...
            </div>
          )}
        </div>
        
        <div className="space-y-3 relative">
          {/* Selected Domains Tags */}
          <div className="flex flex-wrap gap-2 min-h-[38px] p-2 border border-slate-300 rounded-md bg-white">
            {(profile.domains || []).map(domain => (
              <span key={domain} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                {domain}
                <button
                  type="button"
                  onClick={() => removeDomain(domain)}
                  className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full text-blue-400 hover:bg-blue-200 hover:text-blue-600 focus:outline-none"
                >
                  <span className="sr-only">Remove {domain}</span>
                  &times;
                </button>
              </span>
            ))}
            <input
              type="text"
              value={domainInput}
              onChange={(e) => {
                setDomainInput(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder={profile.domains?.length ? "" : "Type to search or add domain..."}
              className="flex-1 min-w-[120px] border-none focus:ring-0 p-0 text-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = domainInput.trim();
                  if (val) {
                    addDomain(val);
                    setDomainInput('');
                    setShowSuggestions(false);
                  }
                }
              }}
            />
          </div>

          {/* Atlan Suggestions Dropdown */}
          {showSuggestions && atlanDomains.length > 0 && (
            <div className="absolute z-10 w-full max-w-md bg-white shadow-lg rounded-md border border-slate-200 max-h-60 overflow-y-auto mt-1">
              <div className="p-2 text-xs font-semibold text-slate-500 bg-slate-50 border-b border-slate-100 flex items-center gap-2 sticky top-0">
                <RefreshCw className="w-3 h-3" />
                Available in Atlan
              </div>
              {atlanDomains
                .filter(d => !profile.domains?.includes(d.name))
                .map(domain => (
                  <button
                    key={domain.guid}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent blur
                      addDomain(domain.name);
                      setDomainInput('');
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between group"
                  >
                    <span>{domain.name}</span>
                    <span className="text-xs text-slate-400 group-hover:text-blue-400">Add +</span>
                  </button>
                ))}
                {atlanDomains.filter(d => !profile.domains?.includes(d.name)).length === 0 && (
                  <div className="p-4 text-center text-sm text-slate-500">
                    No matching domains found. Press Enter to create new.
                  </div>
                )}
            </div>
          )}

          {/* Helper Text */}
          <p className="text-sm text-slate-500 mt-1">
            Search for existing domains in Atlan or type a new name to define your scope.
          </p>
        </div>
      </div>

      {/* Use Cases */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Primary Use Cases (select all that apply)
        </label>
        <div className="grid grid-cols-2 gap-3">
          {USE_CASES.map((useCase) => (
            <label
              key={useCase}
              className="flex items-center space-x-2 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={profile.useCases?.includes(useCase) || false}
                onChange={() => toggleUseCase(useCase)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{useCase}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Connectors */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Data Stack / Connectors (select all that apply)
        </label>
        <div className="grid grid-cols-3 gap-3">
          {CONNECTORS.map((connector) => (
            <label
              key={connector}
              className="flex items-center space-x-2 p-3 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={profile.connectors?.includes(connector) || false}
                onChange={() => toggleConnector(connector)}
                className="rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-700">{connector}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Team Size */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Team Size</label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'small', label: 'Small (1-10)', desc: 'Centralized team' },
            { value: 'medium', label: 'Medium (10-50)', desc: 'Starting to scale' },
            { value: 'large', label: 'Large (50+)', desc: 'Federated teams' },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex flex-col p-4 border-2 rounded-md cursor-pointer hover:bg-slate-50 ${
                profile.teamSize === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="teamSize"
                value={option.value}
                checked={profile.teamSize === option.value}
                onChange={(e) => updateWizardProfile({ teamSize: e.target.value as TeamSize })}
                className="sr-only"
              />
              <span className="text-sm font-medium text-slate-900">{option.label}</span>
              <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Maturity */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Governance Maturity
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'starting', label: 'Just Starting', desc: 'Little to no metadata' },
            { value: 'scaling', label: 'Scaling Up', desc: 'Some metadata, need consistency' },
            { value: 'optimizing', label: 'Optimizing', desc: 'Good coverage, refining' },
          ].map((option) => (
            <label
              key={option.value}
              className={`flex flex-col p-4 border-2 rounded-md cursor-pointer hover:bg-slate-50 ${
                profile.maturity === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name="maturity"
                value={option.value}
                checked={profile.maturity === option.value}
                onChange={(e) => updateWizardProfile({ maturity: e.target.value as Maturity })}
                className="sr-only"
              />
              <span className="text-sm font-medium text-slate-900">{option.label}</span>
              <span className="text-xs text-slate-500 mt-1">{option.desc}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
