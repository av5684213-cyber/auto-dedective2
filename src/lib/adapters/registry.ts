// apps/scraper/src/adapters/registry.ts
// AracıKıyas - Adapter Registry: Centralized management of all scraping adapters

import { BaseAdapter, type ListingRaw, type AdapterResult, type SearchFilters } from './base';
import { LetgoAdapter } from './letgo';

// ── Adapter Info ───────────────────────────────────────────────────────

export interface AdapterInfo {
  name: string;
  displayName: string;
  baseUrl: string;
  isActive: boolean;
  lastScrapedAt: Date | null;
  lastStatus: 'success' | 'failed' | 'never';
  lastItemsFound: number;
  lastItemsSaved: number;
  lastDurationMs: number;
  totalScrapes: number;
  totalSuccesses: number;
  totalFailures: number;
}

// ── All available adapters ─────────────────────────────────────────────

/**
 * Adapter registry: maps source names to adapter instances.
 * Only adapters that can provide REAL data are included.
 */
const ADAPTER_REGISTRY: Map<string, BaseAdapter> = new Map();

// Register adapters
ADAPTER_REGISTRY.set('letgo', new LetgoAdapter());

// ── Registry Functions ─────────────────────────────────────────────────

/**
 * Get an adapter by source name.
 * Returns undefined if no adapter is registered for the source.
 */
export function getAdapter(sourceName: string): BaseAdapter | undefined {
  return ADAPTER_REGISTRY.get(sourceName);
}

/**
 * Get all registered adapter instances.
 */
export function getAllAdapters(): BaseAdapter[] {
  return Array.from(ADAPTER_REGISTRY.values());
}

/**
 * Get all registered adapter source names.
 */
export function getRegisteredSources(): string[] {
  return Array.from(ADAPTER_REGISTRY.keys());
}

/**
 * Check if a source name has a registered adapter.
 */
export function isSourceRegistered(sourceName: string): boolean {
  return ADAPTER_REGISTRY.has(sourceName);
}

/**
 * Get adapter info for all registered sources, including last scrape stats.
 * Queries the ScrapeLog table for statistics.
 */
export async function getAllAdapterInfo(): Promise<AdapterInfo[]> {
  const { db } = await import('@/lib/db');
  const infos: AdapterInfo[] = [];

  for (const [name, adapter] of ADAPTER_REGISTRY) {
    // Get last scrape log for this source
    const lastLog = await db.scrapeLog.findFirst({
      where: { sourceName: name },
      orderBy: { startTime: 'desc' },
    });

    // Get total stats
    const totalScrapes = await db.scrapeLog.count({
      where: { sourceName: name },
    });

    const totalSuccesses = await db.scrapeLog.count({
      where: { sourceName: name, status: 'success' },
    });

    const totalFailures = await db.scrapeLog.count({
      where: { sourceName: name, status: 'failed' },
    });

    infos.push({
      name,
      displayName: adapter.sourceName,
      baseUrl: adapter.baseUrl,
      isActive: true,
      lastScrapedAt: lastLog ? lastLog.startTime : null,
      lastStatus: lastLog ? (lastLog.status as 'success' | 'failed') : 'never',
      lastItemsFound: lastLog?.itemsFound ?? 0,
      lastItemsSaved: lastLog?.itemsSaved ?? 0,
      lastDurationMs: lastLog?.durationMs ?? 0,
      totalScrapes,
      totalSuccesses,
      totalFailures,
    });
  }

  return infos;
}

/**
 * Run a specific adapter by source name.
 * Throws if the source is not registered.
 */
export async function runRegisteredAdapter(
  sourceName: string,
  filters?: SearchFilters,
): Promise<AdapterResult> {
  const adapter = ADAPTER_REGISTRY.get(sourceName);
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${sourceName}`);
  }
  return adapter.scrape(filters);
}

/**
 * Run all registered adapters sequentially.
 * Returns a map of source name → AdapterResult.
 */
export async function runAllRegisteredAdapters(
  filters?: SearchFilters,
): Promise<Map<string, AdapterResult>> {
  const results = new Map<string, AdapterResult>();

  for (const [name, adapter] of ADAPTER_REGISTRY) {
    try {
      const result = await adapter.scrape(filters);
      results.set(name, result);
    } catch (error) {
      results.set(name, {
        success: false,
        listings: [],
        totalFound: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: 0,
      });
    }
  }

  return results;
}
