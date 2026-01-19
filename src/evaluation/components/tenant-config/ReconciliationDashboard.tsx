/**
 * Reconciliation Dashboard
 *
 * Main dashboard for tenant field configuration.
 * Shows discovery status, completeness metrics, and field mapping management.
 */

import React, { useState } from 'react';
import { useTenantConfigStore } from '../../stores/tenantConfigStore';
import { FieldMappingTable } from './FieldMappingTable';
import { FieldMappingEditor } from './FieldMappingEditor';
import { CustomFieldsPanel } from './CustomFieldsPanel';
import { ClassificationsPanel } from './ClassificationsPanel';
import { MDLHSchemaViewer } from './MDLHSchemaViewer';

// ============================================
// STATS CARD
// ============================================

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

function StatsCard({ title, value, subtitle, color = 'blue' }: StatsCardProps) {
  const colorStyles = {
    blue: 'bg-blue-50 border-blue-100',
    green: 'bg-green-50 border-green-100',
    yellow: 'bg-yellow-50 border-yellow-100',
    red: 'bg-red-50 border-red-100',
    gray: 'bg-gray-50 border-gray-100',
  };

  const textColors = {
    blue: 'text-blue-700',
    green: 'text-green-700',
    yellow: 'text-yellow-700',
    red: 'text-red-700',
    gray: 'text-gray-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorStyles[color]}`}>
      <div className="text-sm font-medium text-gray-600">{title}</div>
      <div className={`text-2xl font-bold mt-1 ${textColors[color]}`}>{value}</div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}

// ============================================
// COMPLETENESS RING
// ============================================

interface CompletenessRingProps {
  score: number;
  size?: number;
}

function CompletenessRing({ score, size = 120 }: CompletenessRingProps) {
  const percent = Math.round(score * 100);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score * circumference);

  const getColor = () => {
    if (percent >= 90) return '#10b981'; // green
    if (percent >= 70) return '#3b82f6'; // blue
    if (percent >= 50) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold" style={{ color: getColor() }}>
          {percent}%
        </span>
      </div>
    </div>
  );
}

// ============================================
// DISCOVERY STATUS
// ============================================

function DiscoveryStatus() {
  const { discoveryProgress, schemaSnapshot, config } = useTenantConfigStore();

  if (discoveryProgress.phase === 'idle' && !schemaSnapshot) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <h4 className="font-medium text-yellow-800">No Schema Discovered</h4>
            <p className="text-sm text-yellow-700 mt-1">
              Run tenant schema discovery to detect custom metadata, classifications, and domains.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (discoveryProgress.phase === 'discovering' || discoveryProgress.phase === 'reconciling') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
          <div>
            <h4 className="font-medium text-blue-800">
              {discoveryProgress.phase === 'discovering' ? 'Discovering Schema...' : 'Reconciling Fields...'}
            </h4>
            {discoveryProgress.message && (
              <p className="text-sm text-blue-700 mt-1">{discoveryProgress.message}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (schemaSnapshot) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <h4 className="font-medium text-green-800">Schema Discovered</h4>
            <div className="text-sm text-green-700 mt-1 grid grid-cols-3 gap-4">
              <div>
                <span className="font-medium">{schemaSnapshot.customMetadata.length}</span> Custom Metadata
              </div>
              <div>
                <span className="font-medium">{schemaSnapshot.classifications.length}</span> Classifications
              </div>
              <div>
                <span className="font-medium">{schemaSnapshot.domains.length}</span> Domains
              </div>
            </div>
            <p className="text-xs text-green-600 mt-2">
              Discovered at {new Date(schemaSnapshot.discoveredAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ============================================
// OVERVIEW PANEL
// ============================================

function OverviewPanel() {
  const { config, getConfigCompleteness } = useTenantConfigStore();
  const completeness = getConfigCompleteness();

  if (!config) {
    return (
      <div className="p-6 text-center text-gray-500">
        No configuration loaded
      </div>
    );
  }

  const totalMappings = config.fieldMappings.length;

  return (
    <div className="p-6 space-y-6">
      <DiscoveryStatus />

      <div className="flex items-center gap-8">
        <CompletenessRing score={completeness.score} />

        <div className="flex-1 grid grid-cols-2 gap-4">
          <StatsCard
            title="Confirmed"
            value={completeness.confirmed}
            subtitle="Manually verified"
            color="green"
          />
          <StatsCard
            title="Auto-Mapped"
            value={completeness.auto}
            subtitle="High confidence"
            color="blue"
          />
          <StatsCard
            title="Pending Review"
            value={completeness.pending}
            subtitle="Needs attention"
            color="yellow"
          />
          <StatsCard
            title="Rejected"
            value={completeness.rejected}
            subtitle="Explicitly rejected"
            color="red"
          />
        </div>
      </div>

      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900">Configuration Info</h4>
        <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Tenant ID:</span>{' '}
            <span className="font-mono">{config.tenantId}</span>
          </div>
          <div>
            <span className="text-gray-500">Version:</span>{' '}
            <span className="font-mono">{config.version}</span>
          </div>
          <div>
            <span className="text-gray-500">Total Fields:</span>{' '}
            <span className="font-medium">{totalMappings}</span>
          </div>
          <div>
            <span className="text-gray-500">Excluded:</span>{' '}
            <span className="font-medium">{completeness.excluded}</span>
          </div>
          <div>
            <span className="text-gray-500">Custom Fields:</span>{' '}
            <span className="font-medium">{config.customFields.length}</span>
          </div>
          <div>
            <span className="text-gray-500">Updated:</span>{' '}
            <span>{new Date(config.updatedAt).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD
// ============================================

type TabId = 'overview' | 'mappings' | 'custom' | 'classifications' | 'schema';

export function ReconciliationDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { selectedFieldId, setSelectedField, config, schemaSnapshot } = useTenantConfigStore();

  const tabs: Array<{ id: TabId; label: string; count?: number }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'mappings', label: 'Field Mappings', count: config?.fieldMappings.length },
    { id: 'custom', label: 'Custom Fields', count: config?.customFields.length || schemaSnapshot?.customMetadata.length },
    { id: 'classifications', label: 'Classifications', count: config?.classificationMappings.length || schemaSnapshot?.classifications.length },
    { id: 'schema', label: 'MDLH Schema', count: (schemaSnapshot as any)?.tables?.length },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h1 className="text-xl font-semibold text-gray-900">Tenant Field Configuration</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure how canonical fields map to your Atlan instance
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b px-6">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-gray-100 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-auto ${selectedFieldId ? 'border-r' : ''}`}>
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'mappings' && (
            <FieldMappingTable onSelectField={setSelectedField} />
          )}
          {activeTab === 'custom' && <CustomFieldsPanel />}
          {activeTab === 'classifications' && <ClassificationsPanel />}
          {activeTab === 'schema' && <MDLHSchemaViewer />}
        </div>

        {/* Editor Panel */}
        {selectedFieldId && (
          <div className="w-96 border-l bg-gray-50">
            <FieldMappingEditor
              fieldId={selectedFieldId}
              onClose={() => setSelectedField(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default ReconciliationDashboard;
