/**
 * Signal Dashboard
 *
 * A new dashboard view powered by the unified assessment system.
 * Shows signal-based coverage rather than individual field coverage,
 * and provides drill-down into field evidence.
 */

import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Target,
  Layers,
  Users,
  ChevronDown,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Sparkles,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';
import { useUnifiedAssessment, useUseCaseProfiles } from '../../hooks/useUnifiedAssessment';
import { EvidenceDrawer, SignalEvidenceDrawer } from '../evidence';
import type { FieldCoverage, PersonaType } from '../../types/priority';
import type { SignalType } from '../../../assessment/packages/domain/src/catalog/types';
import { PERSONA_VIEWS } from '../../types/priority';

// =============================================================================
// SIGNAL CARD
// =============================================================================

interface SignalCardProps {
  signal: SignalType;
  displayName: string;
  description: string;
  coveragePercent: number;
  severity: 'HIGH' | 'MED' | 'LOW';
  workstream: string;
  onClick: () => void;
}

function SignalCard({
  signal,
  displayName,
  description,
  coveragePercent,
  severity,
  workstream,
  onClick,
}: SignalCardProps) {
  const severityColors = {
    HIGH: 'border-l-red-500',
    MED: 'border-l-yellow-500',
    LOW: 'border-l-green-500',
  };

  const coverageColor = useMemo(() => {
    if (coveragePercent >= 80) return 'text-green-600';
    if (coveragePercent >= 50) return 'text-yellow-600';
    return 'text-red-600';
  }, [coveragePercent]);

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all border-l-4 ${severityColors[severity]}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">{displayName}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{workstream}</p>
        </div>
        <div className={`text-2xl font-bold ${coverageColor}`}>
          {Math.round(coveragePercent * 100)}%
        </div>
      </div>
      <p className="text-sm text-gray-600 line-clamp-2">{description}</p>
      <div className="mt-3 flex items-center justify-between">
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mr-4">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${coveragePercent * 100}%`,
              backgroundColor:
                coveragePercent >= 0.8
                  ? '#10b981'
                  : coveragePercent >= 0.5
                    ? '#f59e0b'
                    : '#ef4444',
            }}
          />
        </div>
        <ArrowRight size={16} className="text-gray-400 flex-shrink-0" />
      </div>
    </button>
  );
}

// =============================================================================
// USE CASE READINESS CARD
// =============================================================================

interface UseCaseReadinessCardProps {
  useCaseId: string;
  displayName: string;
  readinessScore: number;
  status: 'ready' | 'partial' | 'not_ready';
  topGaps: string[];
  onClick: () => void;
  isSelected: boolean;
}

function UseCaseReadinessCard({
  useCaseId,
  displayName,
  readinessScore,
  status,
  topGaps,
  onClick,
  isSelected,
}: UseCaseReadinessCardProps) {
  const statusConfig = {
    ready: {
      icon: CheckCircle,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      label: 'Ready',
    },
    partial: {
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      label: 'Partial',
    },
    not_ready: {
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      label: 'Not Ready',
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isSelected
          ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200'
          : 'bg-white border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-gray-900">{displayName}</h3>
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.color}`}
        >
          <StatusIcon size={12} />
          <span>{config.label}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 mb-2">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${readinessScore}%`,
              backgroundColor:
                status === 'ready'
                  ? '#10b981'
                  : status === 'partial'
                    ? '#f59e0b'
                    : '#ef4444',
            }}
          />
        </div>
        <span className="text-sm font-medium text-gray-700">
          {Math.round(readinessScore)}%
        </span>
      </div>
      {topGaps.length > 0 && (
        <div className="text-xs text-gray-500">
          Gaps: {topGaps.join(', ')}
        </div>
      )}
    </button>
  );
}

// =============================================================================
// ADOPTION PHASE BANNER
// =============================================================================

interface AdoptionPhaseBannerProps {
  phase: 'Seeding' | 'Gamification' | 'Operationalization';
  recommendation: string;
  tactics: string[];
}

function AdoptionPhaseBanner({
  phase,
  recommendation,
  tactics,
}: AdoptionPhaseBannerProps) {
  const phaseConfig = {
    Seeding: {
      color: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-800',
      icon: Sparkles,
    },
    Gamification: {
      color: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      icon: Target,
    },
    Operationalization: {
      color: 'bg-green-50 border-green-200',
      textColor: 'text-green-800',
      icon: TrendingUp,
    },
  };

  const config = phaseConfig[phase];
  const PhaseIcon = config.icon;

  return (
    <div className={`rounded-xl border p-4 ${config.color}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-white/60 ${config.textColor}`}>
          <PhaseIcon size={20} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-semibold ${config.textColor}`}>
              {phase} Phase
            </h3>
          </div>
          <p className={`text-sm ${config.textColor} opacity-90`}>
            {recommendation}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tactics.slice(0, 3).map((tactic, idx) => (
              <span
                key={idx}
                className="text-xs px-2 py-1 bg-white/60 rounded-md"
              >
                {tactic}
              </span>
            ))}
            {tactics.length > 3 && (
              <span className="text-xs px-2 py-1 text-gray-600">
                +{tactics.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN SIGNAL DASHBOARD
// =============================================================================

interface SignalDashboardProps {
  fieldCoverage: FieldCoverage[];
}

export function SignalDashboard({ fieldCoverage }: SignalDashboardProps) {
  const [activeView, setActiveView] = useState<'signals' | 'usecases'>('signals');

  const {
    signalCoverage,
    filteredSignalCoverage,
    useCaseReadiness,
    selectedUseCaseReadiness,
    adoptionPhase,
    selectedFieldEvidence,
    selectedSignalEvidence,
    selectedPersona,
    selectedUseCaseId,
    setPersona,
    selectUseCase,
    selectField,
    selectSignal,
  } = useUnifiedAssessment(fieldCoverage);

  const useCaseProfiles = useUseCaseProfiles();

  // Calculate overall signal score
  const overallScore = useMemo(() => {
    if (signalCoverage.length === 0) return 0;
    return Math.round(
      (signalCoverage.reduce((sum, s) => sum + s.coveragePercent, 0) /
        signalCoverage.length) *
        100
    );
  }, [signalCoverage]);

  // Group signals by workstream
  const signalsByWorkstream = useMemo(() => {
    const groups: Record<string, typeof filteredSignalCoverage> = {};
    for (const signal of filteredSignalCoverage) {
      if (!groups[signal.workstream]) {
        groups[signal.workstream] = [];
      }
      groups[signal.workstream].push(signal);
    }
    return groups;
  }, [filteredSignalCoverage]);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Signal-Based Assessment
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Unified view of metadata health across all signals
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Persona Selector */}
            <div className="relative">
              <select
                value={selectedPersona}
                onChange={(e) => setPersona(e.target.value as PersonaType)}
                className="form-select pl-9 pr-8"
              >
                <option value="all">All Roles</option>
                {PERSONA_VIEWS.map((p) => (
                  <option key={p.persona} value={p.persona}>
                    {p.name}
                  </option>
                ))}
              </select>
              <Users
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-4">
          <button
            onClick={() => setActiveView('signals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'signals'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <BarChart3 size={16} />
            Signals
          </button>
          <button
            onClick={() => setActiveView('usecases')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeView === 'usecases'
                ? 'bg-blue-50 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Target size={16} />
            Use Case Readiness
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Score Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Overall Score
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-50">
                <BarChart3 size={16} className="text-blue-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">{overallScore}%</div>
            <div className="text-xs text-gray-500 mt-1">
              Across {filteredSignalCoverage.length} signals
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Critical Signals
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-red-50">
                <AlertTriangle size={16} className="text-red-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {signalCoverage.filter((s) => s.severity === 'HIGH').length}
            </div>
            <div className="text-xs text-gray-500 mt-1">High severity signals</div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Use Cases Ready
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-green-50">
                <CheckCircle size={16} className="text-green-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {useCaseReadiness.filter((r) => r.status === 'ready').length}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              of {useCaseReadiness.length} use cases
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-600">
                Total Assets
              </span>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-purple-50">
                <Layers size={16} className="text-purple-600" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {signalCoverage[0]?.totalAssets.toLocaleString() || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1">In scope</div>
          </div>
        </div>

        {/* Adoption Phase Banner */}
        <div className="mb-6">
          <AdoptionPhaseBanner
            phase={adoptionPhase.phase}
            recommendation={adoptionPhase.recommendation}
            tactics={adoptionPhase.tactics}
          />
        </div>

        {/* Signal Cards or Use Case Cards */}
        {activeView === 'signals' ? (
          <div className="space-y-6">
            {Object.entries(signalsByWorkstream).map(([workstream, signals]) => (
              <div key={workstream}>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  {workstream.replace(/_/g, ' ')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {signals.map((signal) => (
                    <SignalCard
                      key={signal.signal}
                      signal={signal.signal}
                      displayName={signal.displayName}
                      description={signal.description}
                      coveragePercent={signal.coveragePercent}
                      severity={signal.severity}
                      workstream={signal.workstream}
                      onClick={() => selectSignal(signal.signal)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {useCaseReadiness.map((readiness) => (
              <UseCaseReadinessCard
                key={readiness.useCaseId}
                useCaseId={readiness.useCaseId}
                displayName={readiness.displayName}
                readinessScore={readiness.readinessScore}
                status={readiness.status}
                topGaps={readiness.topGaps}
                onClick={() => selectUseCase(readiness.useCaseId)}
                isSelected={selectedUseCaseId === readiness.useCaseId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Evidence Drawers */}
      <EvidenceDrawer
        evidence={selectedFieldEvidence}
        isOpen={!!selectedFieldEvidence}
        onClose={() => selectField(null)}
      />
      <SignalEvidenceDrawer
        evidence={selectedSignalEvidence}
        isOpen={!!selectedSignalEvidence}
        onClose={() => selectSignal(null)}
        onFieldClick={(fieldId) => {
          selectSignal(null);
          selectField(fieldId);
        }}
      />
    </div>
  );
}

export default SignalDashboard;
