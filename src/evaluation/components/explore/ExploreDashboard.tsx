/**
 * ExploreDashboard - Placeholder Component
 * 
 * This component is under development. The full implementation
 * requires additional tabs and modules that are not yet complete.
 * 
 * This placeholder allows the app to load while the full dashboard
 * is being developed.
 */

import { Database, Layers, AlertTriangle } from 'lucide-react';
import { useConnection } from '../../../hooks/useSnowflake';

interface ExploreDashboardProps {
  onNavigate?: (view: string) => void;
}

export function ExploreDashboard({ onNavigate }: ExploreDashboardProps) {
  const { status } = useConnection();
  const isConnected = status?.connected === true;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Explore Dashboard</h1>
        <p className="text-gray-500 mt-2">
          Unified dashboard for exploring metadata, assets, and patterns.
        </p>
      </div>

      {/* Connection Context */}
      <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mb-6 flex items-center gap-3">
        <Database size={18} className="text-gray-500" />
        <span className="text-sm text-gray-600">MDLH Context:</span>
        <span className="font-mono text-sm px-2 py-1 bg-white border rounded">
          {status?.database || 'Not connected'}.{status?.schema || ''}
        </span>
        {isConnected ? (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-emerald-600">
            <span className="w-2 h-2 bg-emerald-500 rounded-full" />
            Connected
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-amber-600">
            <span className="w-2 h-2 bg-amber-500 rounded-full" />
            Disconnected
          </span>
        )}
      </div>

      {/* Coming Soon Notice */}
      <div className="bg-amber-50 border border-amber-200 p-6 rounded-lg">
        <div className="flex items-start gap-4">
          <AlertTriangle className="text-amber-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-amber-800">Under Development</h3>
            <p className="text-sm text-amber-700 mt-2">
              The Explore Dashboard is currently being developed. This will include:
            </p>
            <ul className="text-sm text-amber-700 mt-3 space-y-1 list-disc list-inside">
              <li>Asset overview and browsing</li>
              <li>Pattern detection and analysis</li>
              <li>Validation rules and scoring</li>
              <li>Enrichment plan simulation</li>
              <li>Plan management and execution</li>
            </ul>
            <p className="text-sm text-amber-700 mt-4">
              In the meantime, please use the <strong>Assessment</strong> and <strong>Modeling</strong> tools 
              for metadata evaluation and model building.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate?.('modeling')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
        >
          <Layers className="text-blue-600 mb-2" size={24} />
          <h4 className="font-semibold text-gray-900">Metadata Modeling</h4>
          <p className="text-sm text-gray-500 mt-1">
            Build metadata models and check field presence across schemas.
          </p>
        </button>
        <button
          onClick={() => onNavigate?.('evaluation')}
          className="p-4 bg-white border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors text-left"
        >
          <Database className="text-purple-600 mb-2" size={24} />
          <h4 className="font-semibold text-gray-900">Assessment</h4>
          <p className="text-sm text-gray-500 mt-1">
            Run evaluations and generate assessment reports.
          </p>
        </button>
      </div>
    </div>
  );
}

export default ExploreDashboard;
