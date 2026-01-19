// ============================================
// DATA SOURCE BANNER
// Shows current data source mode and connection prompts
// ============================================

import {
  Database,
  Download,
  WifiOff,


} from 'lucide-react';
import type { DataSourceMode } from '../../../hooks/useExploreData';

interface DataSourceBannerProps {
  mode: DataSourceMode;
  connector?: string | null;
  importedAt?: string | null;
  username?: string;
  dataSource?: 'atlan' | 'mdlh' | null;
  lastUpdated?: Date | null;
  onConnect?: () => void;
}

export function DataSourceBanner({
  mode,
  connector,
  importedAt,
  username,
  dataSource,
  lastUpdated,
  onConnect,
}: DataSourceBannerProps) {
  if (mode === 'none') {
    return (
      <div className="explore-banner explore-banner-warning">
        <div className="flex items-center gap-3">
          <WifiOff size={18} />
          <div>
            <span className="text-sm font-medium">No Data Available</span>
            <span className="text-sm ml-2 opacity-80">
              Import assets or connect to Atlan to explore your metadata
            </span>
          </div>
        </div>
        {onConnect && (
          <button
            onClick={onConnect}
            className="px-4 py-1.5 text-sm font-medium rounded-lg transition-colors"
            style={{
              background: 'rgba(191, 135, 0, 0.15)',
            }}
          >
            Connect to Atlan
          </button>
        )}
      </div>
    );
  }

  if (mode === 'imported') {
    return (
      <div className="explore-banner explore-banner-info">
        <div className="flex items-center gap-3">
          <Download size={18} />
          <div>
            <span className="text-sm font-medium">Imported Data</span>
            {connector && (
              <span className="text-sm ml-2 opacity-80">
                from {connector}
              </span>
            )}
            {importedAt && (
              <span className="text-sm ml-2 opacity-70">
                on {new Date(importedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info text-xs">
            <Download size={12} className="mr-1" />
            Imported
          </span>
        </div>
      </div>
    );
  }

  if (mode === 'hybrid') {
    return (
      <div className="explore-banner explore-banner-success">
        <div className="flex items-center gap-3">
          <Database size={18} />
          <div>
            <span className="text-sm font-medium">
              Connected to {dataSource === 'atlan' ? 'Atlan' : 'MDLH'}
            </span>
            {username && (
              <span className="text-sm ml-2 opacity-80">
                as {username}
              </span>
            )}
            {lastUpdated && (
              <span className="text-sm ml-2 opacity-70">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {connector && (
              <span className="text-sm ml-2 opacity-70">
                • Imported baseline: {connector}
              </span>
            )}
            {importedAt && (
              <span className="text-sm ml-2 opacity-70">
                on {new Date(importedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge badge-info text-xs">
            <Download size={12} className="mr-1" />
            Imported
          </span>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          <span className="text-xs font-medium">Live</span>
        </div>
      </div>
    );
  }

  // mode === 'live'
  return (
    <div className="explore-banner explore-banner-success">
      <div className="flex items-center gap-3">
        <Database size={18} />
        <div>
          <span className="text-sm font-medium">
            Connected to {dataSource === 'atlan' ? 'Atlan' : 'MDLH'}
          </span>
          {username && (
            <span className="text-sm ml-2 opacity-80">
              as {username}
            </span>
          )}
          {lastUpdated && (
            <span className="text-sm ml-2 opacity-70">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
        <span className="text-xs font-medium">Live</span>
      </div>
    </div>
  );
}

// Compact version for header
export function DataSourceIndicator({
  mode,
  dataSource,
  isConnecting,
  onClick,
}: {
  mode: DataSourceMode;
  dataSource?: 'atlan' | 'mdlh' | null;
  isConnecting?: boolean;
  onClick?: () => void;
}) {
  const getStatusColor = () => {
    if (isConnecting) return 'bg-blue-500';
    if (mode === 'live' || mode === 'hybrid') return 'bg-green-500';
    if (mode === 'imported') return 'bg-blue-500';
    return 'bg-gray-300';
  };

  const getLabel = () => {
    if (isConnecting) return 'Connecting...';
    if (mode === 'live') return `Connected (${dataSource})`;
    if (mode === 'hybrid') return `Connected (${dataSource}) + Imported`;
    if (mode === 'imported') return 'Imported';
    return 'Not Connected';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
        mode !== 'none'
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
      }`}
    >
      {isConnecting ? (
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
      ) : (
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
      )}
      <Database size={14} />
      <span className="text-sm font-medium">{getLabel()}</span>
    </button>
  );
}

export default DataSourceBanner;
