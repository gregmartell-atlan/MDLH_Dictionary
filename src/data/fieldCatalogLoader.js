/**
 * Field Catalog Loader
 * 
 * Loads and exports the field catalog data.
 */

import catalog from './fieldCatalog.json';

export const fieldCatalog = catalog;

export const signalCatalog = fieldCatalog.signalCatalog || { signals: {}, measureMap: {} };
export const relationshipFields = fieldCatalog.relationshipFields || [];

export function getSignalKeyForMeasure(measureId) {
  return (signalCatalog.measureMap || {})[measureId];
}

export function getSignalDefinition(signalKey) {
  return (signalCatalog.signals || {})[signalKey];
}

export default fieldCatalog;
