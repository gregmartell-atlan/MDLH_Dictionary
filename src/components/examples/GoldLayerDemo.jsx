/**
 * Gold Layer Demo - Visual examples of Gold Badge components and queries
 * 
 * This file demonstrates how Gold Layer queries appear throughout the app
 * with their distinctive badges and styling.
 */

import React, { useState } from 'react';
import { 
  GoldBadge, 
  GoldQueryIndicator, 
  GoldLayerBanner, 
  GoldRecommendationCard,
  isGoldLayerQuery,
  getGoldTablesFromQuery
} from '../ui/GoldBadge';
import { GOLD_LAYER_QUERIES } from '../../data/goldLayerQueries';

export default function GoldLayerDemo() {
  const [selectedQuery, setSelectedQuery] = useState(null);
  
  // Example Gold Layer query
  const exampleGoldQuery = `-- General asset slice from Gold Layer
USE DATABASE context_store;
SELECT 
    ASSET_NAME, 
    GUID, 
    ASSET_TYPE, 
    ASSET_QUALIFIED_NAME, 
    DESCRIPTION,
    STATUS, 
    CERTIFICATE_STATUS, 
    OWNER_USERS, 
    TAGS, 
    POPULARITY_SCORE, 
    HAS_LINEAGE
FROM GOLD.ASSETS
WHERE ASSET_TYPE IN ('Table','View') 
  AND CONNECTOR_NAME = 'snowflake'
LIMIT 100;`;

  const exampleRawQuery = `-- Raw entity query (not Gold Layer)
SELECT 
    NAME,
    GUID,
    TYPENAME,
    QUALIFIEDNAME,
    STATUS
FROM TABLE_ENTITY
WHERE CONNECTORNAME = 'snowflake'
LIMIT 100;`;

  return (
    <div className="p-8 bg-slate-50 min-h-screen space-y-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Gold Layer Integration Examples
        </h1>
        <p className="text-slate-600 mb-8">
          Visual examples of how Gold Layer queries appear throughout the MDLH Explorer app
        </p>

        {/* ============================================================
            Example 1: Gold Layer Banner
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            1. Gold Layer Banner (Landing Page)
          </h2>
          <GoldLayerBanner 
            title="Gold Layer Queries"
            subtitle="Curated, production-ready queries using optimized GOLD schema views"
            onExplore={() => alert('Navigate to Gold Layer category')}
            compact={false}
          />
        </section>

        {/* ============================================================
            Example 2: Gold Badge Variants
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            2. Gold Badge Variants
          </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Default:</span>
                <GoldBadge />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Compact:</span>
                <GoldBadge variant="compact" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Dot:</span>
                <GoldBadge variant="dot" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Inline:</span>
                <GoldBadge variant="inline" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Glow:</span>
                <GoldBadge variant="glow" animated />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Outlined:</span>
                <GoldBadge variant="outlined" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Premium:</span>
                <GoldBadge variant="premium" />
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            Example 3: Query Card with Gold Badge
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            3. Query Card with Gold Badge
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {/* Card Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {/* Gold Badge appears here */}
                  <GoldBadge variant="default" size="xs" />
                  <h4 className="font-medium text-slate-900 text-sm">
                    General Asset Slice
                  </h4>
                  <span className="w-2 h-2 rounded-full bg-emerald-500" title="Valid" />
                </div>
                <p className="text-slate-500 text-xs mt-0.5">
                  Browse Snowflake tables and views with key metadata from GOLD.ASSETS
                  <span className="ml-2 text-amber-600 font-mono">
                    (ASSETS, README)
                  </span>
                </p>
              </div>
              <button className="px-3 py-1.5 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-full">
                Run
              </button>
            </div>
            
            {/* Query Preview */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100">
              <pre className="text-xs text-slate-700 font-mono overflow-x-auto">
{exampleGoldQuery}
              </pre>
            </div>
          </div>
        </section>

        {/* ============================================================
            Example 4: Query Editor Template Selector
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            4. Query Editor Template Selector
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg">
            {/* Dropdown Header */}
            <div className="px-3 py-2 border-b border-slate-100 bg-slate-50">
              <div className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-1.5 rounded">
                ⭐ Gold Layer (Curated)
              </div>
            </div>
            
            {/* Gold Query Items */}
            {GOLD_LAYER_QUERIES.slice(0, 3).map((query) => (
              <button
                key={query.id}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-amber-50 transition-colors group border-l-2 border-transparent hover:border-amber-400"
              >
                <GoldBadge variant="compact" size="xs" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-amber-800 group-hover:text-amber-900">
                    ⭐ {query.name}
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {query.description}
                  </div>
                </div>
                <span className="text-amber-500 opacity-0 group-hover:opacity-100 text-xs">▶</span>
              </button>
            ))}
            
            {/* Regular Query Section */}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wide bg-slate-50 border-t border-slate-100">
              Structure
            </div>
            <button className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-blue-50 transition-colors group">
              <span className="w-3.5 h-3.5 text-slate-400">📊</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 group-hover:text-blue-700">
                  Popular Tables
                </div>
                <div className="text-xs text-slate-500 truncate">
                  Tables ranked by usage
                </div>
              </div>
            </button>
          </div>
        </section>

        {/* ============================================================
            Example 5: Gold Query Indicator
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            5. Gold Query Indicator (Shows Tables Used)
          </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-600 mb-2">Query using GOLD.ASSETS and GOLD.README:</p>
                <GoldQueryIndicator 
                  tables={['GOLD.ASSETS', 'GOLD.README']}
                  showTables={true}
                  size="sm"
                />
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Query using multiple Gold tables:</p>
                <GoldQueryIndicator 
                  tables={['GOLD.ASSETS', 'GOLD.FULL_LINEAGE', 'GOLD.ASSET_LOOKUP_TABLE', 'GOLD.TAGS']}
                  showTables={true}
                  size="sm"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            Example 6: Gold Recommendation Card
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            6. Gold Recommendation Card (Smart Suggestions)
          </h2>
          <GoldRecommendationCard
            originalQuery={exampleRawQuery}
            goldQuery={GOLD_LAYER_QUERIES.find(q => q.id === 'gold-general-assets')}
            onUseGold={() => alert('Switching to Gold Layer query...')}
            onDismiss={() => alert('Keeping original query')}
          />
        </section>

        {/* ============================================================
            Example 7: Query Comparison
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            7. Raw Query vs Gold Layer Query
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Raw Query */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium text-slate-600">Raw Entity Query</span>
                <span className="w-2 h-2 rounded-full bg-slate-300" />
              </div>
              <pre className="text-xs text-slate-700 font-mono bg-slate-50 p-3 rounded overflow-x-auto">
{exampleRawQuery}
              </pre>
              <p className="text-xs text-slate-500 mt-2">
                Requires manual joins, more complex
              </p>
            </div>

            {/* Gold Query */}
            <div className="bg-white rounded-xl border-2 border-amber-300 p-4 relative">
              <div className="absolute -top-2 -right-2">
                <GoldBadge variant="glow" size="xs" animated />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <GoldBadge variant="compact" size="xs" />
                <span className="text-xs font-medium text-amber-700">Gold Layer Query</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
              </div>
              <pre className="text-xs text-slate-700 font-mono bg-amber-50 p-3 rounded overflow-x-auto">
{exampleGoldQuery}
              </pre>
              <p className="text-xs text-amber-700 mt-2 font-medium">
                ✓ Pre-joined, optimized, production-ready
              </p>
            </div>
          </div>
        </section>

        {/* ============================================================
            Example 8: Helper Functions Demo
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            8. Helper Functions
          </h2>
          <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                isGoldLayerQuery() - Detects Gold queries:
              </p>
              <div className="bg-slate-50 p-3 rounded font-mono text-xs">
                <div className="text-emerald-600">
                  ✓ "{exampleGoldQuery.substring(0, 50)}..." → true
                </div>
                <div className="text-slate-500 mt-1">
                  ✗ "{exampleRawQuery.substring(0, 50)}..." → false
                </div>
              </div>
            </div>
            
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                getGoldTablesFromQuery() - Extracts Gold tables:
              </p>
              <div className="bg-slate-50 p-3 rounded font-mono text-xs">
                {JSON.stringify(getGoldTablesFromQuery(exampleGoldQuery), null, 2)}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            Example 9: All Gold Queries List
            ============================================================ */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">
            9. All Gold Layer Queries ({GOLD_LAYER_QUERIES.length} total)
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              {GOLD_LAYER_QUERIES.map((query, idx) => (
                <div
                  key={query.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-amber-50/50 transition-colors ${
                    selectedQuery?.id === query.id ? 'bg-amber-50' : ''
                  }`}
                  onClick={() => setSelectedQuery(query)}
                >
                  <div className="pt-0.5">
                    <GoldBadge variant="compact" size="sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-900 text-sm">
                        {query.name}
                      </h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        query.frequency === 'Starter' ? 'bg-green-100 text-green-700' :
                        query.frequency === 'Common' ? 'bg-blue-100 text-blue-700' :
                        query.frequency === 'Advanced' ? 'bg-purple-100 text-purple-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {query.frequency}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2">
                      {query.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {query.goldTables?.slice(0, 3).map(table => (
                        <span
                          key={table}
                          className="text-[10px] font-mono px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded"
                        >
                          {table}
                        </span>
                      ))}
                      {query.goldTables?.length > 3 && (
                        <span className="text-[10px] text-slate-500">
                          +{query.goldTables.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Selected Query Details */}
        {selectedQuery && (
          <section className="mb-12">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">
              Selected Query: {selectedQuery.name}
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">SQL Query:</h3>
                  <pre className="text-xs text-slate-800 font-mono bg-slate-50 p-4 rounded overflow-x-auto border border-slate-200">
{selectedQuery.sql}
                  </pre>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Metadata:</h3>
                    <dl className="text-xs space-y-1">
                      <dt className="font-medium text-slate-600">Category:</dt>
                      <dd className="text-slate-800">{selectedQuery.category}</dd>
                      <dt className="font-medium text-slate-600">Frequency:</dt>
                      <dd className="text-slate-800">{selectedQuery.frequency}</dd>
                      <dt className="font-medium text-slate-600">Source:</dt>
                      <dd className="text-slate-800">{selectedQuery.source}</dd>
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2">Gold Tables:</h3>
                    <ul className="text-xs space-y-1">
                      {selectedQuery.goldTables?.map(table => (
                        <li key={table} className="font-mono text-amber-700">
                          {table}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
