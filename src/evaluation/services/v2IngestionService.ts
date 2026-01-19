// ============================================
// V2 Ingestion Service
// Integrates with existing Atlan API to fetch assets and create evidence signals
// ============================================

import type { AtlanAssetSummary } from './atlanApi';
import { fetchAssetsForModel, fetchFullLineage } from './atlanApi';
import { prisma } from './v2Db';

export interface IngestionOptions {
  runId: string;
  scope?: {
    domainQualifiedName?: string;
    connectionQualifiedName?: string;
    schemaQualifiedName?: string;
    query?: string;
  };
  capabilities?: string[];
}

/**
 * Deep link to Atlan asset
 */
function deepLink(baseUrl: string, guid: string): string {
  return `${baseUrl}/assets/${encodeURIComponent(guid)}`;
}

/**
 * Extract domain from asset
 */
function extractDomain(asset: AtlanAssetSummary): string | null {
  // Try to get domain from atlanTags or other attributes
  const tags = asset.attributes?.atlanTags || [];
  const domainTag = tags.find((tag: any) => 
    tag.typeName?.toLowerCase().includes('domain') || 
    tag.displayText?.toLowerCase().includes('domain')
  );
  if (domainTag) {
    return domainTag.displayText || domainTag.typeName;
  }
  
  // Could also check meanings or other domain-related fields
  return null;
}

/**
 * Extract source system from asset
 */
function extractSourceSystem(asset: AtlanAssetSummary): string | null {
  return asset.connectorName || asset.attributes?.connectorName as string | undefined || null;
}

/**
 * Ingest assets for a run
 */
export async function ingestRun(options: IngestionOptions): Promise<{ ingested: number }> {
  const { runId, scope } = options;
  
  // Get base URL from config (if available)
  const baseUrl = typeof window !== 'undefined' 
    ? sessionStorage.getItem('atlan_base_url') || 'https://atlan.com'
    : process.env.ATLAN_BASE_URL || 'https://atlan.com';

  // Build base fetch options from scope
  const baseOptions: Parameters<typeof fetchAssetsForModel>[0] = {};

  // Use domainQualifiedName for domain filtering (via __atlanBoundary.keyword)
  if (scope?.domainQualifiedName) {
    baseOptions.domainQualifiedName = scope.domainQualifiedName;
  }

  // Use connectionQualifiedName for connection-level filtering
  if (scope?.connectionQualifiedName) {
    baseOptions.connectionQualifiedName = scope.connectionQualifiedName;
  }

  // Use schemaQualifiedName for schema-level filtering
  if (scope?.schemaQualifiedName) {
    baseOptions.schemaQualifiedName = scope.schemaQualifiedName;
  }

  // Fetch assets from Atlan with pagination
  const pageSize = 200;
  let allAssets: AtlanAssetSummary[] = [];
  let from = 0;
  let hasMore = true;
  let approximateCount: number | undefined;
  const maxAssets = 10000; // Safety limit
  
  console.log(`[v2Ingestion] Starting asset fetch for run ${runId} with scope:`, scope);
  
  while (hasMore) {
    const pageOptions = { ...baseOptions, size: pageSize, from };
    const result = await fetchAssetsForModel(pageOptions);
    
    allAssets = allAssets.concat(result.assets);
    
    // Store approximateCount from first page (most accurate)
    if (approximateCount === undefined && result.approximateCount !== undefined) {
      approximateCount = result.approximateCount;
      console.log(`[v2Ingestion] Total assets in scope: ~${approximateCount}`);
    }
    
    console.log(`[v2Ingestion] Fetched page: ${result.assets.length} assets (total so far: ${allAssets.length}${approximateCount ? ` / ~${approximateCount}` : ''})`);
    
    // Use hasMore flag from API response (more reliable than guessing)
    hasMore = result.hasMore;
    
    // Safety limit check
    if (allAssets.length >= maxAssets) {
      console.warn(`[v2Ingestion] Reached safety limit of ${maxAssets} assets. Stopping pagination.`);
      hasMore = false;
    } else if (hasMore) {
      from += pageSize;
    }
  }
  
  console.log(`[v2Ingestion] Total assets fetched: ${allAssets.length}${approximateCount ? ` (of ~${approximateCount} total)` : ''}`);

  // No post-fetch filtering needed - Atlan API handles filtering via qualifiedNames
  const filteredAssets = allAssets;

  // Store assets in cache and extract evidence
  console.log(`[v2Ingestion] Processing ${filteredAssets.length} assets for evidence extraction...`);
  let processedCount = 0;
  let ownershipCount = 0;
  let semanticsCount = 0;
  let sensitivityCount = 0;
  let lineageCount = 0;
  
  for (const asset of filteredAssets) {
    processedCount++;
    if (processedCount % 100 === 0) {
      console.log(`[v2Ingestion] Processed ${processedCount}/${filteredAssets.length} assets...`);
    }
    // Extract domain from asset for display (actual filtering was done by API)
    const domain = extractDomain(asset) || scope?.domainQualifiedName || (scope as any)?.domain || null;
    const sourceSystem = extractSourceSystem(asset) || (scope as any)?.system || null;
    const atlanUrl = deepLink(baseUrl, asset.guid);

    await prisma.assets_cache.create({
      runId,
      assetGuid: asset.guid,
      name: asset.name,
      type: asset.typeName,
      qualifiedName: asset.qualifiedName,
      domain,
      sourceSystem,
      atlanUrl
    });

    // Extract evidence signals

    // 1. OWNERSHIP signal
    const ownerUsers = asset.attributes?.ownerUsers as string[] | undefined;
    const ownerGroups = asset.attributes?.ownerGroups as string[] | undefined;
    const owner = ownerUsers?.[0] || ownerGroups?.[0] || null;
    if (owner) {
      ownershipCount++;
      await prisma.evidence_signals.create({
        runId,
        assetGuid: asset.guid,
        signalType: 'OWNERSHIP',
        valueJson: { owner, ownerUsers, ownerGroups },
        source: 'atlan',
        atlanUrl
      });
    }

    // 2. SEMANTICS signal
    const description = asset.attributes?.description as string | undefined || 
                       asset.attributes?.userDescription as string | undefined;
    if (description) {
      semanticsCount++;
      await prisma.evidence_signals.create({
        runId,
        assetGuid: asset.guid,
        signalType: 'SEMANTICS',
        valueJson: { descriptionPresent: true, description },
        source: 'atlan',
        atlanUrl
      });
    }

    // 3. SENSITIVITY signal
    const atlanTags = asset.attributes?.atlanTags as Array<{ typeName: string }> | undefined;
    const certificateStatus = asset.attributes?.certificateStatus as string | undefined;
    const classifications = atlanTags?.map(tag => tag.typeName) || [];
    if (classifications.length > 0 || certificateStatus) {
      sensitivityCount++;
      await prisma.evidence_signals.create({
        runId,
        assetGuid: asset.guid,
        signalType: 'SENSITIVITY',
        valueJson: { classifications, certificateStatus },
        source: 'atlan',
        atlanUrl
      });
    }

    // 4. LINEAGE signal
    try {
      const lineageRes = await fetchFullLineage(asset.guid, 1, 10);
      const hasLineage = Boolean(
        lineageRes?.upstream?.length > 0 || 
        lineageRes?.downstream?.length > 0
      );
      if (hasLineage) {
        lineageCount++;
        await prisma.evidence_signals.create({
          runId,
          assetGuid: asset.guid,
          signalType: 'LINEAGE',
          valueJson: { hasLineage: true, upstreamCount: lineageRes.upstream.length, downstreamCount: lineageRes.downstream.length },
          source: 'atlan',
          atlanUrl
        });
      }
    } catch (err) {
      // Lineage remains UNKNOWN if not retrievable; do not infer
      console.warn(`[v2Ingestion] Failed to fetch lineage for asset ${asset.guid}:`, err);
    }
  }

  console.log(`[v2Ingestion] ✅ Ingestion complete!`);
  console.log(`[v2Ingestion] Summary:`);
  console.log(`[v2Ingestion]   - Assets scanned: ${filteredAssets.length}`);
  console.log(`[v2Ingestion]   - Evidence signals extracted:`);
  console.log(`[v2Ingestion]     • OWNERSHIP: ${ownershipCount} assets`);
  console.log(`[v2Ingestion]     • SEMANTICS: ${semanticsCount} assets`);
  console.log(`[v2Ingestion]     • SENSITIVITY: ${sensitivityCount} assets`);
  console.log(`[v2Ingestion]     • LINEAGE: ${lineageCount} assets`);
  console.log(`[v2Ingestion]   - Total signals: ${ownershipCount + semanticsCount + sensitivityCount + lineageCount}`);
  
  return { ingested: filteredAssets.length };
}

