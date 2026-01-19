// ============================================
// CONNECTOR SELECTOR
// Select which connector/data source to audit
// ============================================

import { useState } from 'react';
import {
  Database,
  Snowflake,
  Cloud,
  BarChart3,
  Package,
  Wind,
  ArrowRightLeft,
  ChevronDown,
  Check,
  Loader2,
} from 'lucide-react';

interface ConnectorInfo {
  id: string;
  name: string;
  icon?: string;
  assetCount?: number;
  isActive: boolean;
}

interface ConnectorSelectorProps {
  connectors: ConnectorInfo[];
  activeConnectors: string[];
  selectedConnector: string | null;
  onSelect: (connector: string | null) => void;
  loading?: boolean;
  disabled?: boolean;
}

// Render icon based on name
function ConnectorIcon({ name, className }: { name: string; className?: string }) {
  const props = { size: 16, className };

  switch (name) {
    case 'Snowflake':
      return <Snowflake {...props} />;
    case 'Cloud':
      return <Cloud {...props} />;
    case 'BarChart':
      return <BarChart3 {...props} />;
    case 'Package':
      return <Package {...props} />;
    case 'Wind':
      return <Wind {...props} />;
    case 'ArrowRightLeft':
      return <ArrowRightLeft {...props} />;
    default:
      return <Database {...props} />;
  }
}

export function ConnectorSelector({
  connectors,
  activeConnectors,
  selectedConnector,
  onSelect,
  loading = false,
  disabled = false,
}: ConnectorSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get active connectors only
  const activeConnectorsList = connectors.filter((c) => c.isActive);

  // Find selected connector info
  const selected = connectors.find((c) => c.id === selectedConnector);

  const handleSelect = (connectorId: string | null) => {
    onSelect(connectorId);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium transition-colors hover:border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ minWidth: '180px' }}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-slate-400" />
        ) : selected ? (
          <>
            <ConnectorIcon name={selected.icon || selected.name} className="text-blue-500" />
            <span className="text-slate-900">{selected.name}</span>
            {selected.assetCount !== undefined && (
              <span className="ml-auto px-1.5 py-0.5 text-xs rounded bg-blue-50 text-blue-600">
                {selected.assetCount.toLocaleString()}
              </span>
            )}
          </>
        ) : (
          <>
            <Database size={16} className="text-slate-400" />
            <span className="text-slate-500">All Connectors</span>
            <span className="ml-auto px-1.5 py-0.5 text-xs rounded bg-slate-100 text-slate-500">
              {activeConnectors.length}
            </span>
          </>
        )}
        <ChevronDown
          size={16}
          className={`ml-auto transition-transform text-slate-400 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />

          {/* Menu */}
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden animate-slideIn">
            {/* All Connectors Option */}
            <button
              onClick={() => handleSelect(null)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors"
            >
              <Database size={18} className="text-slate-400" />
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-900">
                  All Connectors
                </div>
                <div className="text-xs text-slate-400">
                  Audit all data sources
                </div>
              </div>
              {selectedConnector === null && (
                <Check size={16} className="text-blue-500" />
              )}
            </button>

            {/* Divider */}
            {activeConnectorsList.length > 0 && (
              <div className="border-t border-slate-100 my-1" />
            )}

            {/* Active Connectors */}
            {activeConnectorsList.length > 0 ? (
              <div className="max-h-64 overflow-y-auto">
                <div className="px-3 py-1.5 text-xs font-medium text-slate-400">
                  ACTIVE CONNECTORS
                </div>
                {activeConnectorsList.map((connector) => {
                  const isSelected = selectedConnector === connector.id;

                  return (
                    <button
                      key={connector.id}
                      onClick={() => handleSelect(connector.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <ConnectorIcon
                        name={connector.icon || connector.name}
                        className={isSelected ? 'text-blue-500' : 'text-slate-400'}
                      />
                      <div className="flex-1 min-w-0">
                        <div
                          className={`text-sm font-medium truncate ${
                            isSelected ? 'text-blue-600' : 'text-slate-900'
                          }`}
                        >
                          {connector.name}
                        </div>
                        {connector.assetCount !== undefined && (
                          <div className="text-xs text-slate-400">
                            {connector.assetCount.toLocaleString()} assets
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={16} className="text-blue-500" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-3 py-4 text-center">
                <div className="text-sm text-slate-400">
                  No active connectors found
                </div>
                <div className="text-xs mt-1 text-slate-400">
                  Connect to Atlan to see your data sources
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
