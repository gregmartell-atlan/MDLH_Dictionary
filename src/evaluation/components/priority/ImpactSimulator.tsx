import { useState } from 'react';
import { Calculator, TrendingUp, Clock, Target } from 'lucide-react';
import type {
  MetadataFieldType,
  FieldCoverage,
  PatternTemplate,
  ImpactSimulation,
} from '../../types/priority';
import { formatFieldName } from '../../types/priority';
import { simulateImpact } from '../../engines/impact-simulator';

interface ImpactSimulatorProps {
  field: MetadataFieldType;
  audit: FieldCoverage[];
  pattern: PatternTemplate | null;
  onClose?: () => void;
}

export function ImpactSimulator({
  field,
  audit,
  pattern,
  onClose,
}: ImpactSimulatorProps) {
  const currentCoverage = audit.find(a => a.field === field)?.coveragePercent || 0;
  const [targetCoverage, setTargetCoverage] = useState(
    Math.min(currentCoverage + 0.25, 1)
  );
  const [simulation, setSimulation] = useState<ImpactSimulation | null>(null);

  const runSimulation = () => {
    try {
      const result = simulateImpact(audit, field, targetCoverage, pattern);
      setSimulation(result);
    } catch (error) {
      console.error('Simulation failed:', error);
    }
  };

  const presets = [
    { label: '+25%', value: Math.min(currentCoverage + 0.25, 1) },
    { label: '+50%', value: Math.min(currentCoverage + 0.5, 1) },
    { label: '100%', value: 1 },
  ];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--primary-blue-light)' }}
          >
            <Calculator size={16} style={{ color: 'var(--primary-blue)' }} />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Impact Simulator
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {formatFieldName(field)}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <span className="sr-only">Close</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Current Coverage */}
        <div className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
          <div className="flex justify-between text-sm mb-1">
            <span style={{ color: 'var(--text-secondary)' }}>Current Coverage</span>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {(currentCoverage * 100).toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-gray-400"
              style={{ width: `${currentCoverage * 100}%` }}
            />
          </div>
        </div>

        {/* Target Slider */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: 'var(--text-secondary)' }}>Target Coverage</span>
            <span
              className="font-semibold"
              style={{ color: 'var(--primary-blue)' }}
            >
              {(targetCoverage * 100).toFixed(0)}%
            </span>
          </div>

          <input
            type="range"
            min={currentCoverage}
            max={1}
            step={0.05}
            value={targetCoverage}
            onChange={(e) => {
              setTargetCoverage(parseFloat(e.target.value));
              setSimulation(null);
            }}
            className="w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--primary-blue) 0%, var(--primary-blue) ${
                ((targetCoverage - currentCoverage) / (1 - currentCoverage)) * 100
              }%, #e5e7eb ${
                ((targetCoverage - currentCoverage) / (1 - currentCoverage)) * 100
              }%, #e5e7eb 100%)`,
            }}
          />

          {/* Presets */}
          <div className="flex gap-2 mt-2">
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  setTargetCoverage(preset.value);
                  setSimulation(null);
                }}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  targetCoverage === preset.value
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={{
                  backgroundColor:
                    targetCoverage === preset.value
                      ? 'var(--primary-blue)'
                      : 'transparent',
                  border:
                    targetCoverage === preset.value
                      ? 'none'
                      : '1px solid #e5e7eb',
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Calculate Button */}
        <button
          onClick={runSimulation}
          className="btn-primary w-full"
        >
          <Calculator size={16} />
          Calculate Impact
        </button>

        {/* Results */}
        {simulation && (
          <div className="space-y-3 pt-4 border-t border-gray-100 animate-fadeIn">
            <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Projected Impact
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-bg-color)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <Target size={14} style={{ color: 'var(--success-color)' }} />
                  <span className="text-xs" style={{ color: 'var(--success-color)' }}>
                    Priority Impact
                  </span>
                </div>
                <span className="text-lg font-semibold" style={{ color: 'var(--success-color)' }}>
                  -{simulation.scoreImpact} pts
                </span>
              </div>

              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--primary-blue-light)' }}>
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={14} style={{ color: 'var(--primary-blue)' }} />
                  <span className="text-xs" style={{ color: 'var(--primary-blue)' }}>
                    Completeness
                  </span>
                </div>
                <span className="text-lg font-semibold" style={{ color: 'var(--primary-blue)' }}>
                  +{simulation.completenessImpact.toFixed(1)} pts
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={14} style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Estimated Effort
                  </span>
                </div>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {simulation.effortHours.toFixed(1)} hours
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg border-2" style={{ borderColor: 'var(--primary-blue)' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  ROI Score
                </span>
                <span
                  className="text-lg font-bold"
                  style={{ color: 'var(--primary-blue)' }}
                >
                  {simulation.roi.toFixed(2)}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Higher is better (impact per hour of effort)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface QuickSimulatorProps {
  audit: FieldCoverage[];
  pattern: PatternTemplate | null;
  onFieldSelect?: (field: MetadataFieldType) => void;
}

export function QuickSimulator({ audit, pattern, onFieldSelect }: QuickSimulatorProps) {
  const [selectedField, setSelectedField] = useState<MetadataFieldType | null>(null);

  if (selectedField) {
    return (
      <ImpactSimulator
        field={selectedField}
        audit={audit}
        pattern={pattern}
        onClose={() => setSelectedField(null)}
      />
    );
  }

  return (
    <div className="card p-4">
      <h3 className="font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        Simulate Improvement
      </h3>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        Select a field to simulate the impact of improving its coverage.
      </p>
      <div className="space-y-2">
        {audit.slice(0, 5).map((coverage) => (
          <button
            key={coverage.field}
            onClick={() => {
              setSelectedField(coverage.field);
              onFieldSelect?.(coverage.field);
            }}
            className="w-full p-3 text-left rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatFieldName(coverage.field)}
              </span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {(coverage.coveragePercent * 100).toFixed(0)}%
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
