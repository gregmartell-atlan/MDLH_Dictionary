import { useState } from 'react';
import { X, Database, Loader2, CheckCircle, AlertCircle, Snowflake } from 'lucide-react';
import type { MDLHConfig } from '../../services/mdlhService';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (config: Partial<MDLHConfig>) => Promise<boolean>;
  currentConfig: MDLHConfig;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export function ConnectionModal({
  isOpen,
  onClose,
  onConnect,
  currentConfig,
  isConnected,
  isConnecting,
  error,
}: ConnectionModalProps) {
  const [apiUrl, setApiUrl] = useState(currentConfig.apiUrl);
  const [database, setDatabase] = useState(currentConfig.database);
  const [schema, setSchema] = useState(currentConfig.schema);

  if (!isOpen) return null;

  const handleConnect = async () => {
    const success = await onConnect({ apiUrl, database, schema });
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-slideIn">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: 'var(--primary-blue-light)' }}
            >
              <Snowflake size={20} style={{ color: 'var(--primary-blue)' }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Connect to MDLH
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Connect to your Atlan Metadata Lakehouse
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
            <span className="text-sm font-medium" style={{ color: 'var(--success-color)' }}>
              Connected to {database}.{schema}
            </span>
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

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              MDLH Backend URL
            </label>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3002"
              className="input-clean"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              URL of your MDLH FastAPI backend
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Database
              </label>
              <input
                type="text"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="ATLAN_..."
                className="input-clean"
              />
            </div>
            <div>
              <label
                className="block text-sm font-medium mb-1.5"
                style={{ color: 'var(--text-secondary)' }}
              >
                Schema
              </label>
              <input
                type="text"
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder="PUBLIC"
                className="input-clean"
              />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div
          className="mt-4 p-3 rounded-lg"
          style={{ backgroundColor: '#f9fafb' }}
        >
          <div className="flex items-start gap-2">
            <Database size={16} className="mt-0.5" style={{ color: 'var(--text-muted)' }} />
            <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <p className="font-medium mb-1">Required: MDLH Backend</p>
              <p>
                This connects to your MDLH FastAPI backend which queries Snowflake.
                Make sure the backend is running and has valid Snowflake credentials.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button
            onClick={handleConnect}
            disabled={isConnecting || !apiUrl}
            className="btn-primary flex-1"
          >
            {isConnecting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Connecting...
              </>
            ) : isConnected ? (
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
    </div>
  );
}
