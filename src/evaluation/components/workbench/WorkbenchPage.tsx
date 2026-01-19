/**
 * WorkbenchPage - Placeholder Component
 * 
 * This component is under development. The full implementation
 * requires hooks and stores that are not yet complete.
 * 
 * This placeholder allows the app to load while the full workbench
 * is being developed.
 */

import { Database, Layers, AlertTriangle, Wrench } from 'lucide-react';
import { useConnection } from '../../../hooks/useSnowflake';

export function WorkbenchPage() {
  const { status } = useConnection();
  const isConnected = status?.connected === true;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Workbench</h1>
        <p className="text-gray-500 mt-2">
          Review and manage metadata issues, evidence, and stakeholders.
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
          <Wrench className="text-amber-600 flex-shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-amber-800">Under Development</h3>
            <p className="text-sm text-amber-700 mt-2">
              The Workbench is currently being developed. This will include:
            </p>
            <ul className="text-sm text-amber-700 mt-3 space-y-1 list-disc list-inside">
              <li>Anti-pattern detection and review</li>
              <li>Evidence collection and management</li>
              <li>Stakeholder assignment and tracking</li>
              <li>Issue remediation workflows</li>
              <li>Field coverage analysis</li>
            </ul>
            <p className="text-sm text-amber-700 mt-4">
              In the meantime, please use the <strong>Assessment</strong> and <strong>Modeling</strong> tools 
              for metadata evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkbenchPage;
