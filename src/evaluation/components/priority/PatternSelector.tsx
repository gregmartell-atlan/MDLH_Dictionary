import { Check, ChevronRight, Clock, AlertCircle } from 'lucide-react';
import type {
  PatternTemplate,
  PatternMatch,
} from '../../types/priority';
import {
  PATTERN_TEMPLATES,
  formatFieldName,
} from '../../types/priority';

interface PatternSelectorProps {
  matches: PatternMatch[];
  selectedPattern: PatternTemplate | null;
  onSelect: (pattern: PatternTemplate) => void;
}

export function PatternSelector({
  matches,
  selectedPattern,
  onSelect,
}: PatternSelectorProps) {
  return (
    <div className="space-y-3">
      {matches.map((match) => {
        const isSelected = selectedPattern?.id === match.pattern.id;

        return (
          <button
            key={match.pattern.id}
            onClick={() => onSelect(match.pattern)}
            className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-100 hover:border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <h3
                  className="font-semibold"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {match.pattern.name}
                </h3>
                {match.readyToImplement && (
                  <span className="badge badge-green text-xs">Ready</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-medium ${
                    match.matchScore >= 70
                      ? 'text-green-600'
                      : match.matchScore >= 40
                      ? 'text-amber-600'
                      : 'text-red-600'
                  }`}
                >
                  {match.matchScore}%
                </span>
                {isSelected && (
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--primary-blue)' }}
                  >
                    <Check size={12} className="text-white" />
                  </div>
                )}
              </div>
            </div>

            <p
              className="text-sm mb-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              {match.pattern.description}
            </p>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${match.matchScore}%`,
                  backgroundColor:
                    match.matchScore >= 70
                      ? '#22c55e'
                      : match.matchScore >= 40
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              />
            </div>

            {/* Gaps summary */}
            {(match.requiredGaps.length > 0 || match.recommendedGaps.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {match.requiredGaps.map((field) => (
                  <span
                    key={field}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--error-bg-color)',
                      color: 'var(--error-color)',
                    }}
                  >
                    {formatFieldName(field)}
                  </span>
                ))}
                {match.recommendedGaps.slice(0, 2).map((field) => (
                  <span
                    key={field}
                    className="text-xs px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: 'var(--warning-bg-color)',
                      color: 'var(--warning-color)',
                    }}
                  >
                    {formatFieldName(field)}
                  </span>
                ))}
                {match.recommendedGaps.length > 2 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full bg-gray-100"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    +{match.recommendedGaps.length - 2} more
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

interface PatternDetailProps {
  pattern: PatternTemplate;
  match?: PatternMatch;
  onViewPlan?: () => void;
}

export function PatternDetail({ pattern, match, onViewPlan }: PatternDetailProps) {
  const requiredFields = pattern.fields.filter(f => f.requirement === 'required');
  const recommendedFields = pattern.fields.filter(f => f.requirement === 'recommended');
  const optionalFields = pattern.fields.filter(f => f.requirement === 'optional');

  return (
    <div className="card p-5 space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            {pattern.name}
          </h2>
          {match && (
            <span
              className={`badge ${
                match.matchScore >= 70
                  ? 'badge-green'
                  : match.matchScore >= 40
                  ? 'bg-amber-100 text-amber-700'
                  : 'badge-red'
              }`}
            >
              {match.matchScore}% match
            </span>
          )}
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {pattern.description}
        </p>
      </div>

      <div className="p-3 rounded-lg" style={{ backgroundColor: '#f9fafb' }}>
        <div className="flex items-center gap-2 mb-1">
          <AlertCircle size={14} style={{ color: 'var(--text-secondary)' }} />
          <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            USE CASE
          </span>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
          {pattern.useCase}
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <Clock size={14} style={{ color: 'var(--text-muted)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>
            {pattern.suggestedTimeline}
          </span>
        </div>
        {pattern.prerequisites.length > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertCircle size={14} style={{ color: 'var(--warning-color)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>
              {pattern.prerequisites.length} prerequisites
            </span>
          </div>
        )}
      </div>

      {/* Prerequisites */}
      {pattern.prerequisites.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Prerequisites
          </h4>
          <ul className="space-y-1.5">
            {pattern.prerequisites.map((prereq, i) => (
              <li
                key={i}
                className="flex items-center gap-2 text-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                {prereq}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Required Fields */}
      {requiredFields.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Required Fields
          </h4>
          <div className="space-y-2">
            {requiredFields.map((field) => (
              <div
                key={field.field}
                className="p-3 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--error-color)' }}
                  />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {formatFieldName(field.field)}
                  </span>
                  {match?.requiredGaps.includes(field.field) && (
                    <span className="badge badge-red text-xs">Gap</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {field.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommended Fields */}
      {recommendedFields.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Recommended Fields
          </h4>
          <div className="space-y-2">
            {recommendedFields.map((field) => (
              <div
                key={field.field}
                className="p-3 rounded-lg border border-gray-100"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--warning-color)' }}
                  />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {formatFieldName(field.field)}
                  </span>
                  {match?.recommendedGaps.includes(field.field) && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Gap
                    </span>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {field.rationale}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional Fields */}
      {optionalFields.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            Optional Fields
          </h4>
          <div className="flex flex-wrap gap-2">
            {optionalFields.map((field) => (
              <span
                key={field.field}
                className="text-xs px-2.5 py-1 rounded-full bg-gray-100"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatFieldName(field.field)}
              </span>
            ))}
          </div>
        </div>
      )}

      {onViewPlan && (
        <button
          onClick={onViewPlan}
          className="btn-primary w-full justify-center"
        >
          View Implementation Plan
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

interface PatternGalleryProps {
  onSelect: (pattern: PatternTemplate) => void;
}

export function PatternGallery({ onSelect }: PatternGalleryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {PATTERN_TEMPLATES.map((pattern) => (
        <button
          key={pattern.id}
          onClick={() => onSelect(pattern)}
          className="card p-4 text-left hover:shadow-md transition-all group"
        >
          <h3
            className="font-semibold mb-1 group-hover:text-blue-600 transition-colors"
            style={{ color: 'var(--text-primary)' }}
          >
            {pattern.name}
          </h3>
          <p
            className="text-sm mb-3 line-clamp-2"
            style={{ color: 'var(--text-secondary)' }}
          >
            {pattern.description}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {pattern.suggestedTimeline}
            </span>
            <ChevronRight
              size={16}
              className="text-gray-400 group-hover:text-blue-600 transition-colors"
            />
          </div>
        </button>
      ))}
    </div>
  );
}
