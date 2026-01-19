/**
 * PatternWizard - Interactive questionnaire to help users pick metadata fields
 *
 * Features:
 * - Existing view: Shows field coverage from canvas entities
 * - Design view: Multi-step questionnaire with pattern recommendations
 * - Field grid with requirement levels
 * - Export to requirements matrix
 */

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Sparkles,
  Target,
  Shield,
  GitBranch,
  Package,
  Search,
  Clock,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  BarChart3,
} from 'lucide-react';
import {
  METADATA_FIELDS,
  QUESTIONNAIRE_QUESTIONS,
  recommendPatterns,
  getRequiredFields,
  getRecommendedFields,
} from '../../types/model-designer';
import type {
  MetadataFieldType,
  PatternTemplate,
  RequirementType,
} from '../../types/model-designer';
import { ViewModeToggle, type ModuleViewMode } from './ViewModeToggle';
import { useCanvasData } from '../../hooks/useCanvasData';

// Pattern icons
const PATTERN_ICONS: Record<string, typeof Target> = {
  'quick-discovery': Search,
  'trusted-metrics': Target,
  'compliance-ready': Shield,
  'root-cause-analysis': GitBranch,
  'data-product': Package,
};

interface PatternWizardProps {
  onComplete?: (result: PatternWizardResult) => void;
  initialPattern?: PatternTemplate;
  initialStep?: 'questionnaire' | 'patterns' | 'fields';
}

export interface PatternWizardResult {
  selectedPattern: PatternTemplate | null;
  fieldRequirements: Map<MetadataFieldType, RequirementType>;
  answers: Record<string, string | string[]>;
}

export function PatternWizard({ onComplete, initialPattern, initialStep = 'questionnaire' }: PatternWizardProps) {
  const [viewMode, setViewMode] = useState<ModuleViewMode>('existing');
  const [step, setStep] = useState<'questionnaire' | 'patterns' | 'fields'>(initialStep);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [selectedPattern, setSelectedPattern] = useState<PatternTemplate | null>(initialPattern || null);
  const [fieldOverrides, setFieldOverrides] = useState<Map<MetadataFieldType, RequirementType>>(new Map());

  // Get canvas data for Existing view
  const canvasData = useCanvasData();

  // Get recommended patterns based on answers
  const recommendedPatterns = useMemo(() => {
    return recommendPatterns(answers);
  }, [answers]);

  // Compute field requirements from pattern + overrides
  const fieldRequirements = useMemo(() => {
    const reqs = new Map<MetadataFieldType, RequirementType>();

    // Start with all fields as optional
    METADATA_FIELDS.forEach(f => reqs.set(f.id, 'optional'));

    // Apply pattern requirements
    if (selectedPattern) {
      selectedPattern.fields.forEach(f => {
        reqs.set(f.field, f.requirement);
      });
    }

    // Apply user overrides
    fieldOverrides.forEach((req, field) => {
      reqs.set(field, req);
    });

    return reqs;
  }, [selectedPattern, fieldOverrides]);

  const handleAnswer = (questionId: string, optionId: string) => {
    const question = QUESTIONNAIRE_QUESTIONS.find(q => q.id === questionId);
    if (!question) return;

    if (question.multiSelect) {
      const current = (answers[questionId] as string[]) || [];
      const updated = current.includes(optionId)
        ? current.filter(id => id !== optionId)
        : [...current, optionId];
      setAnswers({ ...answers, [questionId]: updated });
    } else {
      setAnswers({ ...answers, [questionId]: optionId });
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < QUESTIONNAIRE_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setStep('patterns');
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
    }
  };

  const handleSelectPattern = (pattern: PatternTemplate) => {
    setSelectedPattern(pattern);
    setStep('fields');
  };

  const handleFieldRequirementChange = (field: MetadataFieldType, requirement: RequirementType) => {
    const newOverrides = new Map(fieldOverrides);
    newOverrides.set(field, requirement);
    setFieldOverrides(newOverrides);
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete({
        selectedPattern,
        fieldRequirements,
        answers,
      });
    }
  };

  // ============================================
  // EXISTING VIEW - Field Coverage from Canvas
  // ============================================
  if (viewMode === 'existing') {
    const populatedFields = canvasData.fieldCoverage.filter(f => f.populatedCount > 0);
    const avgCoverage = canvasData.fieldCoverage.length > 0
      ? Math.round(canvasData.fieldCoverage.reduce((sum, f) => sum + f.coveragePercent, 0) / canvasData.fieldCoverage.length)
      : 0;

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header with View Toggle */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Field Coverage</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Metadata field population across {canvasData.totalEntities} canvas entities
              </p>
            </div>
            <ViewModeToggle
              mode={viewMode}
              onModeChange={setViewMode}
              existingCount={populatedFields.length}
              existingLabel="Coverage"
              designLabel="Plan Fields"
            />
          </div>

          {/* Summary Stats */}
          {canvasData.totalEntities > 0 && (
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                <BarChart3 size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{avgCoverage}% avg coverage</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
                <CheckCircle size={16} className="text-green-600" />
                <span className="text-sm font-medium text-green-700">{populatedFields.length} fields populated</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 rounded-lg">
                <XCircle size={16} className="text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {canvasData.fieldCoverage.length - populatedFields.length} fields empty
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Field Coverage List */}
        <div className="flex-1 overflow-y-auto p-6">
          {canvasData.totalEntities === 0 ? (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-700 mb-2">No entities on canvas</h3>
              <p className="text-sm text-slate-500 mb-4">
                Import assets from Atlan or create entities to see field coverage
              </p>
              <button
                onClick={() => setViewMode('design')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Plan Field Requirements
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {canvasData.fieldCoverage.map(field => (
                <div
                  key={field.fieldName}
                  className="p-4 rounded-lg border border-slate-200 hover:border-slate-300"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">{field.fieldDisplayName}</span>
                      <span className="text-xs text-slate-500">({field.fieldName})</span>
                    </div>
                    <span className={`text-sm font-medium ${
                      field.coveragePercent >= 80 ? 'text-green-600' :
                      field.coveragePercent >= 50 ? 'text-amber-600' :
                      field.coveragePercent > 0 ? 'text-orange-600' : 'text-slate-400'
                    }`}>
                      {field.coveragePercent}%
                    </span>
                  </div>

                  {/* Coverage Bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        field.coveragePercent >= 80 ? 'bg-green-500' :
                        field.coveragePercent >= 50 ? 'bg-amber-500' :
                        field.coveragePercent > 0 ? 'bg-orange-500' : 'bg-slate-200'
                      }`}
                      style={{ width: `${field.coveragePercent}%` }}
                    />
                  </div>

                  <div className="text-xs text-slate-500">
                    {field.populatedCount} of {field.totalCount} entities have this field populated
                  </div>

                  {/* Sample Values (collapsed by default, could expand) */}
                  {field.values.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {field.values.slice(0, 3).map((v, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                          {String(v.value).slice(0, 20)}{String(v.value).length > 20 ? '...' : ''}
                        </span>
                      ))}
                      {field.values.length > 3 && (
                        <span className="px-2 py-0.5 text-slate-400 text-xs">
                          +{field.values.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200">
          <button
            onClick={() => setViewMode('design')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Sparkles size={16} />
            Plan Field Requirements
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // DESIGN VIEW - Questionnaire Flow
  // ============================================

  // Render questionnaire step
  if (step === 'questionnaire') {
    const question = QUESTIONNAIRE_QUESTIONS[currentQuestion];
    const selectedAnswers = question.multiSelect
      ? (answers[question.id] as string[]) || []
      : answers[question.id];

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Progress */}
        <div className="px-6 py-4 border-b border-slate-200">
          {/* View Mode Toggle */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Field Requirements</h2>
            <ViewModeToggle
              mode={viewMode}
              onModeChange={setViewMode}
              existingCount={canvasData.fieldCoverage.filter(f => f.populatedCount > 0).length}
              existingLabel="Coverage"
              designLabel="Plan Fields"
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Question {currentQuestion + 1} of {QUESTIONNAIRE_QUESTIONS.length}
            </span>
            <span className="text-sm text-slate-500">
              {Math.round(((currentQuestion + 1) / QUESTIONNAIRE_QUESTIONS.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / QUESTIONNAIRE_QUESTIONS.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">
            {question.question}
          </h2>

          <div className="space-y-3">
            {question.options.map(option => {
              const isSelected = question.multiSelect
                ? (selectedAnswers as string[])?.includes(option.id)
                : selectedAnswers === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleAnswer(question.id, option.id)}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500'
                          : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <div className="font-medium text-slate-900">{option.label}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{option.description}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
          <button
            onClick={handlePrevQuestion}
            disabled={currentQuestion === 0}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={18} />
            Back
          </button>
          <button
            onClick={handleNextQuestion}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {currentQuestion === QUESTIONNAIRE_QUESTIONS.length - 1 ? 'See Recommendations' : 'Next'}
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Render pattern selection step
  if (step === 'patterns') {
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2 text-amber-600 mb-1">
            <Sparkles size={18} />
            <span className="text-sm font-medium">Recommended for you</span>
          </div>
          <h2 className="text-xl font-semibold text-slate-900">
            Choose a metadata pattern
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Based on your answers, we recommend starting with one of these patterns
          </p>
        </div>

        {/* Patterns */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {recommendedPatterns.map((pattern, index) => {
              const Icon = PATTERN_ICONS[pattern.id] || Target;
              const requiredFields = getRequiredFields(pattern);
              const recommendedFields = getRecommendedFields(pattern);

              return (
                <button
                  key={pattern.id}
                  onClick={() => handleSelectPattern(pattern)}
                  className={`w-full p-5 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                    index === 0
                      ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                        index === 0 ? 'bg-blue-100' : 'bg-slate-100'
                      }`}
                    >
                      <Icon size={24} className={index === 0 ? 'text-blue-600' : 'text-slate-600'} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{pattern.name}</h3>
                        {index === 0 && (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Best Match
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-1">{pattern.description}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {requiredFields.slice(0, 3).map(field => (
                          <span
                            key={field}
                            className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded"
                          >
                            {METADATA_FIELDS.find(f => f.id === field)?.displayName}
                          </span>
                        ))}
                        {recommendedFields.slice(0, 2).map(field => (
                          <span
                            key={field}
                            className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded"
                          >
                            {METADATA_FIELDS.find(f => f.id === field)?.displayName}
                          </span>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {pattern.suggestedTimeline}
                        </span>
                        {pattern.prerequisites.length > 0 && (
                          <span className="flex items-center gap-1">
                            <AlertCircle size={12} />
                            {pattern.prerequisites.length} prerequisite(s)
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-400 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => {
              setSelectedPattern(null);
              setStep('fields');
            }}
            className="w-full mt-4 p-4 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-center"
          >
            Skip patterns - I'll choose fields manually
          </button>
        </div>

        {/* Navigation */}
        <div className="px-6 py-4 border-t border-slate-200">
          <button
            onClick={() => {
              setStep('questionnaire');
              setCurrentQuestion(QUESTIONNAIRE_QUESTIONS.length - 1);
            }}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft size={18} />
            Back to questions
          </button>
        </div>
      </div>
    );
  }

  // Render fields configuration step
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">
          Configure Field Requirements
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {selectedPattern
            ? `Based on ${selectedPattern.name} pattern. Adjust as needed.`
            : 'Select which fields are required, recommended, or optional for your organization.'}
        </p>
      </div>

      {/* Field Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="space-y-3">
          {METADATA_FIELDS.map(field => {
            const requirement = fieldRequirements.get(field.id) || 'optional';
            const patternField = selectedPattern?.fields.find(f => f.field === field.id);

            return (
              <div
                key={field.id}
                className="p-4 rounded-lg border border-slate-200 hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-slate-900">{field.displayName}</h3>
                      {field.autoPopulated && (
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded">
                          Auto
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{field.purpose}</p>
                    {patternField?.rationale && (
                      <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                        <Info size={12} />
                        {patternField.rationale}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {(['required', 'recommended', 'optional', 'not-applicable'] as RequirementType[]).map(req => (
                      <button
                        key={req}
                        onClick={() => handleFieldRequirementChange(field.id, req)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          requirement === req
                            ? req === 'required'
                              ? 'bg-red-100 text-red-700 ring-2 ring-red-500'
                              : req === 'recommended'
                              ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-500'
                              : req === 'optional'
                              ? 'bg-slate-100 text-slate-700 ring-2 ring-slate-500'
                              : 'bg-slate-50 text-slate-400 ring-2 ring-slate-300'
                            : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {req === 'not-applicable' ? 'N/A' : req.charAt(0).toUpperCase() + req.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary & Actions */}
      <div className="px-6 py-4 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-slate-600">
            <span className="font-medium text-red-600">
              {Array.from(fieldRequirements.values()).filter(r => r === 'required').length}
            </span>{' '}
            required,{' '}
            <span className="font-medium text-amber-600">
              {Array.from(fieldRequirements.values()).filter(r => r === 'recommended').length}
            </span>{' '}
            recommended
          </div>
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => setStep('patterns')}
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ChevronLeft size={18} />
            Back to patterns
          </button>
          <button
            onClick={handleComplete}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Apply to Requirements Matrix
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
