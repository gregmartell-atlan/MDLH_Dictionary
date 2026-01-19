// ============================================
// ATLAN CONNECTION MODAL
// Connect to Atlan via API or MDLH
// ============================================

import { useState } from 'react';
import {
  X,
  Database,
  Snowflake,
  Loader2,
  CheckCircle,
  AlertCircle,
  Key,
  Zap,
  Server,
} from 'lucide-react';
import { getSavedAtlanBaseUrl } from '../../services/atlanApi';

type DataSourceType = 'atlan' | 'mdlh';

interface AtlanConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectAtlan: (apiKey: string, baseUrl: string) => Promise<boolean>;
  onConnectMDLH: (config?: { apiUrl?: string }) => Promise<boolean>;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  dataSource: DataSourceType | 'sample';
  username?: string;
}

export function AtlanConnectionModal({
  isOpen,
  onClose,
  onConnectAtlan,
  onConnectMDLH,
  isConnected,
  isConnecting,
  error,
  dataSource,
  username,
}: AtlanConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<DataSourceType>('atlan');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(() => getSavedAtlanBaseUrl() || '');
  const [mdlhUrl, setMdlhUrl] = useState('http://localhost:3002');

  if (!isOpen) return null;

  const handleConnectAtlan = async () => {
    const success = await onConnectAtlan(apiKey, baseUrl);
    if (success) {
      onClose();
    }
  };

  const handleConnectMDLH = async () => {
    const success = await onConnectMDLH({ apiUrl: mdlhUrl });
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-blue-light)' }}
            >
              <Database size={20} style={{ color: 'var(--primary-blue)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Connect to Atlan
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Scan your metadata for audit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Status */}
        {isConnected && (
          <div
            className="mb-4 p-3 rounded-lg flex items-center gap-3"
            style={{ backgroundColor: 'var(--success-bg-color)' }}
          >
            <CheckCircle size={18} style={{ color: 'var(--success-color)' }} />
            <div>
              <span className="text-sm font-medium" style={{ color: 'var(--success-color)' }}>
                Connected via {dataSource === 'atlan' ? 'Atlan API' : 'MDLH'}
              </span>
              {username && (
                <span className="text-sm ml-2" style={{ color: 'var(--success-color)' }}>
                  as {username}
                </span>
              )}
            </div>
          </div>
        )}

        {error && (
          <div
            className="mb-4 p-3 rounded-lg flex items-center gap-3"
            style={{ backgroundColor: 'var(--error-bg-color)' }}
          >
            <AlertCircle size={18} style={{ color: 'var(--error-color)' }} />
            <span className="text-sm" style={{ color: 'var(--error-color)' }}>
              {error}
            </span>
          </div>
        )}

        {/* Tabs */}
        <div className="tabs mb-4">
          <button
            className={`tab ${activeTab === 'atlan' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('atlan')}
          >
            <Key size={14} />
            Atlan API
          </button>
          <button
            className={`tab ${activeTab === 'mdlh' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('mdlh')}
          >
            <Snowflake size={14} />
            MDLH
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'atlan' ? (
          <div className="space-y-4">
            {/* Info */}
            <div
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ backgroundColor: 'var(--color-slate-50)' }}
            >
              <Zap size={16} className="mt-0.5" style={{ color: 'var(--primary-blue)' }} />
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium mb-1">Recommended for most users</p>
                <p>
                  Connect directly to Atlan using your API key. Works with any Atlan instance.
                </p>
              </div>
            </div>

            {/* Form */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Atlan Instance URL
              </label>
              <input
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-instance.atlan.com"
                className="input-clean"
              />
            </div>

            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Atlan API key"
                className="input-clean"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Generate an API key in Atlan Admin {'>'} API Tokens
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleConnectAtlan}
                disabled={isConnecting || !baseUrl || !apiKey}
                className="btn-primary flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : isConnected && dataSource === 'atlan' ? (
                  <>
                    <CheckCircle size={16} />
                    Reconnect
                  </>
                ) : (
                  <>
                    <Key size={16} />
                    Connect
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Info */}
            <div
              className="p-3 rounded-lg flex items-start gap-2"
              style={{ backgroundColor: 'var(--color-slate-50)' }}
            >
              <Server size={16} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <p className="font-medium mb-1">For MDLH Users</p>
                <p>
                  Connect to your Metadata Lakehouse via the MDLH backend service.
                  Requires Snowflake access.
                </p>
              </div>
            </div>

            {/* Form */}
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                MDLH Backend URL
              </label>
              <input
                type="url"
                value={mdlhUrl}
                onChange={(e) => setMdlhUrl(e.target.value)}
                placeholder="http://localhost:3002"
                className="input-clean"
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                URL of your MDLH FastAPI backend
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                onClick={handleConnectMDLH}
                disabled={isConnecting}
                className="btn-primary flex-1"
              >
                {isConnecting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Connecting...
                  </>
                ) : isConnected && dataSource === 'mdlh' ? (
                  <>
                    <CheckCircle size={16} />
                    Reconnect
                  </>
                ) : (
                  <>
                    <Snowflake size={16} />
                    Connect
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
