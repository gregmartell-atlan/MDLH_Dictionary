import { AssetEvidence, Tri } from '@atlan/assessment-lib';
import { CanonicalSignals, SignalValue } from '../models/signals';

/**
 * Maps AssetEvidence (from scoring library) to CanonicalSignals
 * Converts evidence fields to the 7 canonical signal presence flags
 */
export function mapEvidenceToSignals(evidence: AssetEvidence): CanonicalSignals {
  return {
    OWNERSHIP: mapOwnershipSignal(evidence),
    LINEAGE: mapLineageSignal(evidence),
    SEMANTICS: mapSemanticsSignal(evidence),
    SENSITIVITY: mapSensitivitySignal(evidence),
    ACCESS: mapAccessSignal(evidence),
    USAGE: mapUsageSignal(evidence),
    FRESHNESS: mapFreshnessSignal(evidence),
  };
}

/**
 * OWNERSHIP signal: Asset has assigned owners
 */
function mapOwnershipSignal(evidence: AssetEvidence): SignalValue {
  return triToSignalValue(evidence.ownerPresent);
}

/**
 * LINEAGE signal: Upstream/downstream relationships documented
 */
function mapLineageSignal(evidence: AssetEvidence): SignalValue {
  // Use relationshipsPresent as primary, fallback to hasUpstream || hasDownstream
  if (evidence.relationshipsPresent !== undefined) {
    return triToSignalValue(evidence.relationshipsPresent);
  }

  // If either upstream or downstream exists, lineage is partially present
  const hasUpstream = triToBool(evidence.hasUpstream);
  const hasDownstream = triToBool(evidence.hasDownstream);

  if (hasUpstream === 'UNKNOWN' && hasDownstream === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasUpstream === true || hasDownstream === true) {
    return true;
  }

  if (hasUpstream === false && hasDownstream === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * SEMANTICS signal: Descriptions, glossary terms, documentation present
 */
function mapSemanticsSignal(evidence: AssetEvidence): SignalValue {
  const hasDescription = triToBool(evidence.descriptionPresent);
  const hasRunbook = triToBool(evidence.runbookPresent);

  // If either description or runbook exists, semantics are partially present
  if (hasDescription === 'UNKNOWN' && hasRunbook === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasDescription === true || hasRunbook === true) {
    return true;
  }

  if (hasDescription === false && hasRunbook === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * SENSITIVITY signal: Classification tags and data sensitivity markers
 */
function mapSensitivitySignal(evidence: AssetEvidence): SignalValue {
  // Sensitivity is present if there are classified fields (regardless of protection)
  // Protection status is checked separately for gap detection
  return triToSignalValue(evidence.hasClassifiedFields);
}

/**
 * ACCESS signal: Access policies and permissions defined
 * NOTE: In MVP, this is always UNKNOWN as access metadata is not yet observable
 */
function mapAccessSignal(_evidence: AssetEvidence): SignalValue {
  // MVP: ACCESS signal not yet available in evidence
  // Future: Check for policies, ACLs, etc.
  return 'UNKNOWN';
}

/**
 * USAGE signal: Usage telemetry and popularity metrics available
 */
function mapUsageSignal(evidence: AssetEvidence): SignalValue {
  return triToSignalValue(evidence.usageTelemetryPresent);
}

/**
 * FRESHNESS signal: Data freshness SLAs and quality monitoring
 */
function mapFreshnessSignal(evidence: AssetEvidence): SignalValue {
  const hasFreshnessSla = triToBool(evidence.freshnessSlaPass);
  const hasDqSignals = triToBool(evidence.dqSignalsPresent);

  // If either SLA or DQ signals exist, freshness monitoring is partially present
  if (hasFreshnessSla === 'UNKNOWN' && hasDqSignals === 'UNKNOWN') {
    return 'UNKNOWN';
  }

  if (hasFreshnessSla === true || hasDqSignals === true) {
    return true;
  }

  if (hasFreshnessSla === false && hasDqSignals === false) {
    return false;
  }

  return 'UNKNOWN';
}

/**
 * Converts Tri to SignalValue (direct mapping)
 */
function triToSignalValue(tri: Tri | undefined): SignalValue {
  if (tri === undefined) return 'UNKNOWN';
  if (tri === 'UNKNOWN') return 'UNKNOWN';
  return tri;
}

/**
 * Converts Tri to boolean or UNKNOWN
 */
function triToBool(tri: Tri | undefined): boolean | 'UNKNOWN' {
  if (tri === undefined) return 'UNKNOWN';
  if (tri === 'UNKNOWN') return 'UNKNOWN';
  return tri;
}

/**
 * Maps all assets in an evidence bundle to canonical signals
 */
export function mapEvidenceBundleToSignals(
  assets: AssetEvidence[]
): Map<string, CanonicalSignals> {
  const signalsMap = new Map<string, CanonicalSignals>();

  for (const asset of assets) {
    signalsMap.set(asset.assetId, mapEvidenceToSignals(asset));
  }

  return signalsMap;
}

/**
 * Checks if a signal is explicitly present (true)
 */
export function isSignalPresent(signalValue: SignalValue): boolean {
  return signalValue === true;
}

/**
 * Checks if a signal is explicitly absent (false)
 */
export function isSignalAbsent(signalValue: SignalValue): boolean {
  return signalValue === false;
}

/**
 * Checks if a signal is unknown
 */
export function isSignalUnknown(signalValue: SignalValue): boolean {
  return signalValue === 'UNKNOWN';
}
