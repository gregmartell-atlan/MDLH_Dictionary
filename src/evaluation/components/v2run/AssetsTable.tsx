import type { KeyboardEvent } from 'react';
import { Check, HelpCircle } from 'lucide-react';

export type SignalStatus = 'OBSERVED' | 'UNKNOWN';
export const SignalStatus = {
  OBSERVED: 'OBSERVED',
  UNKNOWN: 'UNKNOWN'
} as const;

interface AssetEvidence {
  assetQualifiedName: string;
  assetName: string;
  assetTypeName: string;
  signals: {
    ownership: SignalStatus;
    semantics: SignalStatus;
    lineage: SignalStatus;
    sensitivity: SignalStatus;
  };
  impactScore: number | null;
  qualityScore: number | null;
}

interface AssetsTableProps {
  assets: AssetEvidence[];
  onAssetClick: (asset: AssetEvidence) => void;
}

export function AssetsTable({ assets, onAssetClick }: AssetsTableProps) {
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, asset: AssetEvidence) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onAssetClick(asset);
    }
  };

  const renderSignal = (status: SignalStatus) => {
    if (status === 'OBSERVED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-semibold">
          <Check size={14} /> Observed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-semibold">
        <HelpCircle size={14} /> Unknown
      </span>
    );
  };

  return (
    <table className="min-w-[900px] w-full text-left" aria-label="Asset signals table">
      <thead className="bg-gray-50 border-b">
        <tr>
          <th scope="col" className="p-4 font-medium text-gray-500">Asset</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Type</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Ownership</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Semantics</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Lineage</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Sensitivity</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Impact</th>
          <th scope="col" className="p-4 font-medium text-gray-500">Quality</th>
        </tr>
      </thead>
      <tbody className="divide-y">
        {assets.map((asset) => (
          <tr 
            key={asset.assetQualifiedName} 
            className="hover:bg-gray-50 cursor-pointer"
            onClick={() => onAssetClick(asset)}
            onKeyDown={(event) => handleRowKeyDown(event, asset)}
            role="button"
            tabIndex={0}
            aria-label={`View asset ${asset.assetName}`}
          >
            <td className="p-4">
              <div className="font-semibold text-blue-600 hover:underline">{asset.assetName}</div>
              <div className="text-xs text-gray-500">{asset.assetQualifiedName}</div>
            </td>
            <td className="p-4 text-sm text-gray-600">{asset.assetTypeName}</td>
            <td className="p-4">{renderSignal(asset.signals.ownership)}</td>
            <td className="p-4">{renderSignal(asset.signals.semantics)}</td>
            <td className="p-4">{renderSignal(asset.signals.lineage)}</td>
            <td className="p-4">{renderSignal(asset.signals.sensitivity)}</td>
            <td className="p-4 text-sm text-gray-600">{asset.impactScore?.toFixed(0) ?? '—'}</td>
            <td className="p-4 text-sm text-gray-600">{asset.qualityScore?.toFixed(0) ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
