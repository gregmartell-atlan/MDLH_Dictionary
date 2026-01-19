/**
 * Wizard Step 1: Profile Configuration
 * 
 * Collect project name, industry, domains, and connectors.
 */

import React, { useState } from 'react';
import { useAssistantStore } from '../../../stores/assistantStore';
import { Building2, Layers, Database, X, Plus } from 'lucide-react';

const INDUSTRIES = [
  'Financial Services',
  'Healthcare',
  'Manufacturing',
  'Retail/E-commerce',
  'Technology',
  'Telecommunications',
  'Media/Entertainment',
  'Energy',
  'Government',
  'Other',
];

const COMMON_DOMAINS = [
  'Sales',
  'Marketing',
  'Finance',
  'Operations',
  'Customer',
  'Product',
  'Supply Chain',
  'HR',
  'Analytics',
  'Engineering',
];

const CONNECTORS = [
  'Snowflake',
  'Databricks',
  'BigQuery',
  'Redshift',
  'PostgreSQL',
  'MySQL',
  'Tableau',
  'PowerBI',
  'Looker',
  'dbt',
  'Airflow',
  'Sigma',
];

export function WizardStep1Profile() {
  const { wizardState, updateWizardProfile } = useAssistantStore();
  const { profile } = wizardState;
  const [domainInput, setDomainInput] = useState('');

  const handleIndustryChange = (industry) => {
    updateWizardProfile({ industry });
  };

  const handleAddDomain = (domain) => {
    if (domain && !profile.domains.includes(domain)) {
      updateWizardProfile({ domains: [...profile.domains, domain] });
    }
    setDomainInput('');
  };

  const handleRemoveDomain = (domain) => {
    updateWizardProfile({ domains: profile.domains.filter(d => d !== domain) });
  };

  const handleToggleConnector = (connector) => {
    const connectors = profile.connectors.includes(connector)
      ? profile.connectors.filter(c => c !== connector)
      : [...profile.connectors, connector];
    updateWizardProfile({ connectors });
  };

  return (
    <div className="space-y-8">
      {/* Project Name */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-700">
          Project Name
        </label>
        <input
          type="text"
          value={profile.projectName || ''}
          onChange={(e) => updateWizardProfile({ projectName: e.target.value })}
          placeholder="e.g., Data Governance Initiative Q1 2026"
          className="w-full px-4 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Industry */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Building2 className="w-4 h-4 text-slate-400" />
          Industry
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {INDUSTRIES.map(industry => (
            <button
              key={industry}
              onClick={() => handleIndustryChange(industry)}
              className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                profile.industry === industry
                  ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {industry}
            </button>
          ))}
        </div>
      </div>

      {/* Domains */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Layers className="w-4 h-4 text-slate-400" />
          Data Domains
        </label>
        
        {/* Selected domains */}
        {profile.domains.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {profile.domains.map(domain => (
              <span
                key={domain}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm"
              >
                {domain}
                <button
                  onClick={() => handleRemoveDomain(domain)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        
        {/* Domain input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDomain(domainInput);
              }
            }}
            placeholder="Type a domain name..."
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => handleAddDomain(domainInput)}
            disabled={!domainInput}
            className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {/* Common domain suggestions */}
        <div className="flex flex-wrap gap-2 pt-2">
          {COMMON_DOMAINS.filter(d => !profile.domains.includes(d)).slice(0, 8).map(domain => (
            <button
              key={domain}
              onClick={() => handleAddDomain(domain)}
              className="px-2.5 py-1 text-xs bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
            >
              + {domain}
            </button>
          ))}
        </div>
      </div>

      {/* Connectors */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Database className="w-4 h-4 text-slate-400" />
          Connected Systems
        </label>
        <p className="text-xs text-slate-500">
          Select the connectors you have configured in Atlan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {CONNECTORS.map(connector => (
            <button
              key={connector}
              onClick={() => handleToggleConnector(connector)}
              className={`px-3 py-2 text-sm rounded-lg border transition-all ${
                profile.connectors.includes(connector)
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-medium'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {connector}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="p-4 bg-slate-100 rounded-lg">
        <h3 className="text-sm font-medium text-slate-700 mb-2">Profile Summary</h3>
        <ul className="text-sm text-slate-600 space-y-1">
          <li>• Industry: {profile.industry || 'Not selected'}</li>
          <li>• Domains: {profile.domains.length > 0 ? profile.domains.join(', ') : 'None selected'}</li>
          <li>• Connectors: {profile.connectors.length > 0 ? profile.connectors.join(', ') : 'None selected'}</li>
        </ul>
      </div>
    </div>
  );
}

export default WizardStep1Profile;
