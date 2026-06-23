// Otodedektif - Adapter Registry: Centralized management of all scraping adapters
//
// NOTE: This file is a thin wrapper around src/lib/adapters/index.ts.
// The canonical adapter registry is ALL_ADAPTERS / ADAPTER_MAP in index.ts.

import { BaseAdapter, type AdapterResult, type SearchFilters } from './base';
import { ALL_ADAPTERS, ADAPTER_MAP, ADAPTER_STATUSES, type AdapterStatusEntry } from './index';

// ── Adapter Info ───────────────────────────────────────────────────────

export interface AdapterInfo extends AdapterStatusEntry {
  lastScrapedAt: Date | null;
  lastStatus: 'success' | 'failed' | 'never';
  lastItemsFound: number;
  lastItemsSaved: number;
  lastDurationMs: number;
  totalScrapes: number;
  totalSuccesses: number;
  totalFailures: number;
  isRegistered: boolean;
}

// ── Registry Functions (delegates to index.ts) ────────────────────────

export function getAdapter(sourceName: string): BaseAdapter | undefined {
  return ADAPTER_MAP[sourceName];
}

export function getAllAdapters(): BaseAdapter[] {
  return ALL_ADAPTERS;
}

export function getRegisteredSources(): string[] {
  return Object.keys(ADAPTER_MAP);
}

export function isSourceRegistered(sourceName: string): boolean {
  return sourceName in ADAPTER_MAP;
}

export async function getAllAdapterInfo(): Promise<AdapterInfo[]> {
  const { db } = await import('@/lib/db');
  const infos: AdapterInfo[] = [];

  for (const status of ADAPTER_STATUSES) {
    const adapter = ADAPTER_MAP[status.name];
    const isRegistered = !!adapter;

    if (!isRegistered) {
      infos.push({
        ...status,
        lastScrapedAt: null, lastStatus: 'never',
        lastItemsFound: 0, lastItemsSaved: 0, lastDurationMs: 0,
        totalScrapes: 0, totalSuccesses: 0, totalFailures: 0,
        isRegistered: false,
      });
      continue;
    }

    let lastLog: any = null;
    let totalScrapes = 0;
    let totalSuccesses = 0;
    let totalFailures = 0;

    try {
      lastLog = await db.scrapeLog.findFirst({
        where: { sourceName: status.name },
        orderBy: { startTime: 'desc' },
      });
      totalScrapes = await db.scrapeLog.count({ where: { sourceName: status.name } });
      totalSuccesses = await db.scrapeLog.count({ where: { sourceName: status.name, status: 'success' } });
      totalFailures = await db.scrapeLog.count({ where: { sourceName: status.name, status: 'failed' } });
    } catch (e) { /* ignore DB errors */ }

    infos.push({
      ...status,
      lastScrapedAt: lastLog ? lastLog.startTime : null,
      lastStatus: lastLog ? (lastLog.status as 'success' | 'failed') : 'never',
      lastItemsFound: lastLog?.itemsFound ?? 0,
      lastItemsSaved: lastLog?.itemsSaved ?? 0,
      lastDurationMs: lastLog?.durationMs ?? 0,
      totalScrapes, totalSuccesses, totalFailures,
      isRegistered: true,
    });
  }

  return infos;
}

export async function runRegisteredAdapter(
  sourceName: string,
  filters?: SearchFilters,
): Promise<AdapterResult> {
  const adapter = ADAPTER_MAP[sourceName];
  if (!adapter) {
    throw new Error(`No adapter registered for source: ${sourceName}`);
  }
  return adapter.scrape(filters);
}

export async function runAllRegisteredAdapters(
  filters?: SearchFilters,
): Promise<Map<string, AdapterResult>> {
  const results = new Map<string, AdapterResult>();
  for (const [name, adapter] of Object.entries(ADAPTER_MAP)) {
    try {
      const result = await adapter.scrape(filters);
      results.set(name, result);
    } catch (error) {
      results.set(name, {
        success: false, listings: [], totalFound: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        durationMs: 0,
      });
    }
  }
  return results;
}
