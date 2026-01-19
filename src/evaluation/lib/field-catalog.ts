import catalog from '../../../specs/field-catalog.json';

export type FieldCatalog = typeof catalog;

export const fieldCatalog = catalog as FieldCatalog;

export const signalCatalog = fieldCatalog.signalCatalog || { signals: {}, measureMap: {} };
export const relationshipFields = fieldCatalog.relationshipFields || [];

export function getSignalKeyForMeasure(measureId: string): string | undefined {
  return (signalCatalog.measureMap as Record<string, string> || {})[measureId];
}

export interface SignalDefinition {
  label?: string;
  requirement?: string;
  action?: string;
  fieldIds?: string[];
  measureIds?: string[];
  workstream?: string;
}

export function getSignalDefinition(signalKey: string): SignalDefinition | undefined {
  return (signalCatalog.signals as Record<string, SignalDefinition> || {})[signalKey];
}
