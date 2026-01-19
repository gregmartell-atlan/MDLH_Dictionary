import { X, AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { catalogApi } from '../../services/evaluationApi';

interface Signal {
  id: string;
  signalType: string;
  signalValue: unknown;
  signalSource: string;
  observedAt: string | null;
  atlanUrl?: string;
}

interface AssetWithSignals {
  guid: string;
  name: string;
  qualifiedName: string;
  typeName: string;
  connector: string;
  attributes: {
    ownerUsers?: string[];
    description?: string | null;
    tags?: string[];
    termGuids?: string[];
    hasLineage?: boolean;
    certificateStatus?: string | null;
    popularityScore?: number | null;
  };
}

interface EvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  assetQualifiedName: string;
  assetName: string;
  runId: string;
}

export function EvidenceDrawer({ isOpen, onClose, assetQualifiedName, assetName, runId }: EvidenceDrawerProps) {
  const [asset, setAsset] = useState<AssetWithSignals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !runId || !assetQualifiedName) return;

    const fetchAssetData = async () => {
      setLoading(true);
      setError(null);
      try {
        const catalogData = await catalogApi.getAssets(runId);
        const foundAsset = catalogData.find((a) => a.qualifiedName === assetQualifiedName);
        if (foundAsset) {
          setAsset(foundAsset as unknown as AssetWithSignals);
        } else {
          setError('Asset not found in catalog');
        }
      } catch (err) {
        console.error('Failed to fetch asset data:', err);
        setError('Failed to load asset evidence');
      } finally {
        setLoading(false);
      }
    };

    fetchAssetData();
  }, [isOpen, runId, assetQualifiedName]);

  if (!isOpen) return null;

  // Build signals from asset attributes
  const buildSignals = (asset: AssetWithSignals): Signal[] => {
    const signals: Signal[] = [];
    const attrs = asset.attributes || {};
    
    // Ownership signal
    signals.push({
      id: 'ownership',
      signalType: 'OWNERSHIP',
      signalValue: attrs.ownerUsers || [],
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    // Semantics signal (description + terms)
    signals.push({
      id: 'semantics',
      signalType: 'SEMANTICS',
      signalValue: {
        description: attrs.description,
        termGuids: attrs.termGuids || [],
      },
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    // Lineage signal
    signals.push({
      id: 'lineage',
      signalType: 'LINEAGE',
      signalValue: attrs.hasLineage ?? false,
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    // Sensitivity signal (tags)
    signals.push({
      id: 'sensitivity',
      signalType: 'SENSITIVITY',
      signalValue: attrs.tags || [],
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    // Trust signal (certificate)
    signals.push({
      id: 'trust',
      signalType: 'TRUST',
      signalValue: attrs.certificateStatus,
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    // Usage signal (popularity)
    signals.push({
      id: 'usage',
      signalType: 'USAGE',
      signalValue: attrs.popularityScore,
      signalSource: 'MDLH Catalog',
      observedAt: new Date().toISOString(),
    });

    return signals;
  };

  const getSignalTypeColor = (type: string) => {
    switch (type) {
      case 'OWNERSHIP': return 'bg-purple-100 text-purple-800';
      case 'SEMANTICS': return 'bg-blue-100 text-blue-800';
      case 'LINEAGE': return 'bg-green-100 text-green-800';
      case 'SENSITIVITY': return 'bg-red-100 text-red-800';
      case 'TRUST': return 'bg-yellow-100 text-yellow-800';
      case 'USAGE': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSignalStatus = (signal: Signal): { present: boolean; label: string } => {
    const value = signal.signalValue;
    
    switch (signal.signalType) {
      case 'OWNERSHIP':
        const owners = Array.isArray(value) ? value : [];
        return { 
          present: owners.length > 0, 
          label: owners.length > 0 ? `${owners.length} owner(s)` : 'No owners' 
        };
      case 'SEMANTICS':
        const semantics = value as { description?: string | null; termGuids?: string[] };
        const hasDesc = !!semantics?.description;
        const hasTerms = (semantics?.termGuids || []).length > 0;
        return { 
          present: hasDesc || hasTerms, 
          label: hasDesc && hasTerms ? 'Description + Terms' : hasDesc ? 'Description only' : hasTerms ? 'Terms only' : 'Missing' 
        };
      case 'LINEAGE':
        return { 
          present: value === true, 
          label: value === true ? 'Has lineage' : 'No lineage' 
        };
      case 'SENSITIVITY':
        const tags = Array.isArray(value) ? value : [];
        return { 
          present: tags.length > 0, 
          label: tags.length > 0 ? `${tags.length} tag(s)` : 'No tags' 
        };
      case 'TRUST':
        const cert = value as string | null;
        return { 
          present: !!cert && cert !== 'NONE', 
          label: cert && cert !== 'NONE' ? cert : 'Not certified' 
        };
      case 'USAGE':
        const pop = value as number | null;
        return { 
          present: (pop || 0) > 0, 
          label: pop ? `Score: ${pop}` : 'No usage data' 
        };
      default:
        return { present: false, label: 'Unknown' };
    }
  };

  const signals = asset ? buildSignals(asset) : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
        aria-hidden="true" 
      />
      
      <div 
        className="relative bg-white w-full max-w-2xl shadow-xl overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
      >
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 id="evidence-drawer-title" className="text-xl font-bold text-gray-900">
              {assetName}
            </h2>
            <p className="text-sm text-gray-500 break-all">{assetQualifiedName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
            aria-label="Close drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading evidence...</div>
          ) : error ? (
            <div className="flex items-center gap-2 text-red-600 py-12 justify-center">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          ) : signals.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No evidence signals found</div>
          ) : (
            <div className="space-y-4">
              {/* Signal summary grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {signals.map((signal) => {
                  const status = getSignalStatus(signal);
                  return (
                    <div 
                      key={signal.id} 
                      className={`p-3 rounded-lg border ${status.present ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSignalTypeColor(signal.signalType)}`}>
                        {signal.signalType}
                      </span>
                      <div className={`mt-2 text-sm ${status.present ? 'text-green-700' : 'text-gray-500'}`}>
                        {status.present ? '✓' : '✗'} {status.label}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Detailed signal cards */}
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Signal Details</h3>
              {signals.map((signal) => (
                <div key={signal.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${getSignalTypeColor(signal.signalType)}`}>
                      {signal.signalType}
                    </span>
                    <span className="text-xs text-gray-500">
                      {signal.observedAt ? new Date(signal.observedAt).toLocaleString() : 'Not observed'}
                    </span>
                  </div>
                  
                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">Source</div>
                    <div className="text-sm text-gray-600">{signal.signalSource}</div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-medium text-gray-700 mb-1">Value</div>
                    <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto max-h-32">
                      {JSON.stringify(signal.signalValue, null, 2)}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
