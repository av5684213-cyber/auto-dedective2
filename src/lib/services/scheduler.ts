// apps/scraper/src/scheduler.ts
// AracıKıyas - Cron-based scraping scheduler

import { scrapeAll, scrapeSingle } from './scraper';
import { valueAllListings } from './valuator';
import { estimateAllCosts } from './cost-estimator';
import { runDeduplication } from './deduplicator';
import { cache } from './cache';
import { db } from '@/lib/db';
import type { ScrapeResult } from '@/lib/types';
import { spawn } from 'child_process';
import path from 'path';

// ── Types ──────────────────────────────────────────────────────────────

interface ScheduleConfig {
  /** Cron expression or interval label */
  schedule: string;
  /** Which sources to scrape; empty = all */
  sources: string[];
  /** Whether to run valuation after scraping */
  runValuation: boolean;
  /** Whether to run cost estimation after scraping */
  runCostEstimation: boolean;
  /** Whether to run deduplication after scraping */
  runDeduplication: boolean;
  /** Whether the schedule is active */
  enabled: boolean;
}

interface SchedulerStatus {
  isRunning: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  lastResult: SchedulerRunResult | null;
}

interface SchedulerRunResult {
  startTime: Date;
  endTime: Date;
  scrapeResults: Array<{
    sourceName: string;
    itemsFound: number;
    itemsSaved: number;
    status: string;
  }>;
  valuationUpdated: number;
  costsEstimated: number;
  dedupGroupsCreated: number;
  durationMs: number;
}

// ── Default Schedule Configs ───────────────────────────────────────────

const DEFAULT_CONFIGS: ScheduleConfig[] = [
  {
    schedule: '*/30 * * * *', // Every 30 minutes
    sources: [], // All sources
    runValuation: true,
    runCostEstimation: true,
    runDeduplication: true,
    enabled: true,
  },
];

// ── Scheduler Class ────────────────────────────────────────────────────

export class Scheduler {
  private static instance: Scheduler | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastRunAt: Date | null = null;
  private nextRunAt: Date | null = null;
  private lastResult: SchedulerRunResult | null = null;
  private configs: ScheduleConfig[];
  private intervalMs: number;

  private constructor(configs: ScheduleConfig[] = DEFAULT_CONFIGS, intervalMs: number = 30 * 60 * 1000) {
    this.configs = configs;
    this.intervalMs = intervalMs;
  }

  /** Get or create the singleton scheduler instance */
  static getInstance(configs?: ScheduleConfig[], intervalMs?: number): Scheduler {
    if (!Scheduler.instance) {
      Scheduler.instance = new Scheduler(configs, intervalMs);
    }
    return Scheduler.instance;
  }

  /** Start the scheduler */
  start(): void {
    if (this.intervalId) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log(`[Scheduler] Starting with interval: ${this.intervalMs}ms (${this.intervalMs / 60000} minutes)`);

    // Calculate next run time
    this.nextRunAt = new Date(Date.now() + this.intervalMs);

    this.intervalId = setInterval(async () => {
      await this.runPipeline();
    }, this.intervalMs);

    // Run immediately on start
    this.runPipeline();
  }

  /** Stop the scheduler */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Stopped');
    }
  }

  /** Get current scheduler status */
  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      lastRunAt: this.lastRunAt,
      nextRunAt: this.nextRunAt,
      lastResult: this.lastResult,
    };
  }

  /** Manually trigger the full pipeline */
  async runPipeline(): Promise<SchedulerRunResult> {
    if (this.isRunning) {
      console.log('[Scheduler] Pipeline already running, skipping...');
      throw new Error('Pipeline already running');
    }

    this.isRunning = true;
    const startTime = new Date();
    this.lastRunAt = startTime;

    console.log('[Scheduler] Starting pipeline...');

    try {
      // Step 1: Scrape
      const scrapeResults = await this.runScrapeStep();

      // Step 1b: Playwright scrape (Cloudflare-protected sources)
      // Does NOT touch Letgo — Letgo already handled by step 1
      try {
        await this.runPlaywrightScrape();
      } catch (e) {
        console.error('[Scheduler] Playwright scrape failed:', e);
      }

      // Step 2: Valuation
      let valuationUpdated = 0;
      const activeConfig = this.configs.find(c => c.enabled);
      if (activeConfig?.runValuation) {
        try {
          const valResult = await valueAllListings();
          valuationUpdated = valResult.updated;
          console.log(`[Scheduler] Valuation: ${valResult.updated} updated, ${valResult.skipped} skipped`);
        } catch (error) {
          console.error('[Scheduler] Valuation failed:', error);
        }
      }

      // Step 3: Cost Estimation
      let costsEstimated = 0;
      if (activeConfig?.runCostEstimation) {
        try {
          const costResult = await estimateAllCosts();
          costsEstimated = costResult.estimated;
          console.log(`[Scheduler] Cost estimation: ${costResult.estimated} estimated, ${costResult.skipped} skipped`);
        } catch (error) {
          console.error('[Scheduler] Cost estimation failed:', error);
        }
      }

      // Step 4: Deduplication
      let dedupGroupsCreated = 0;
      if (activeConfig?.runDeduplication) {
        try {
          const dedupResult = await runDeduplication();
          dedupGroupsCreated = dedupResult.groupsCreated;
          console.log(`[Scheduler] Deduplication: ${dedupResult.groupsCreated} groups created, ${dedupResult.totalGroups} total`);
        } catch (error) {
          console.error('[Scheduler] Deduplication failed:', error);
        }
      }

      // Step 5: Clear cache
      cache.clear();
      console.log('[Scheduler] Cache cleared');

      // Step 6: Mark stale listings as inactive
      await this.markStaleListings();

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const result: SchedulerRunResult = {
        startTime,
        endTime,
        scrapeResults: scrapeResults.map(r => ({
          sourceName: r.sourceName,
          itemsFound: r.itemsFound,
          itemsSaved: r.itemsSaved,
          status: r.status,
        })),
        valuationUpdated,
        costsEstimated,
        dedupGroupsCreated,
        durationMs,
      };

      this.lastResult = result;
      this.nextRunAt = new Date(Date.now() + this.intervalMs);

      console.log(`[Scheduler] Pipeline completed in ${durationMs}ms`);
      return result;
    } catch (error) {
      console.error('[Scheduler] Pipeline failed:', error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /** Run Playwright scraper for SPA/WAF-protected sources.
   *  Letgo verisine dokunmaz — farklı sourceName ile ayrı kayıtlar ekler. */
  private async runPlaywrightScrape(): Promise<void> {
    const scriptPath = path.join(process.cwd(), 'scripts', 'playwright-scrape.ts');
    const args = ['run', scriptPath, '--site=all', '--pages=1', '--max=50'];

    console.log('[Scheduler] Running Playwright scrape (arabam/vavacars/sahibinden)...');
    await new Promise<void>((resolve) => {
      const proc = spawn('bun', args, {
        cwd: process.cwd(),
        env: { ...process.env },
        stdio: 'pipe',
      });
      let stderr = '';
      proc.stderr?.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) => {
        if (code !== 0) {
          console.warn(`[Scheduler] Playwright scrape exited with code ${code}`);
          if (stderr) console.warn(`[Scheduler] stderr (last 500 chars): ${stderr.slice(-500)}`);
        }
        resolve();
      });
      proc.on('error', (err) => {
        console.warn(`[Scheduler] Playwright spawn error: ${err.message}`);
        resolve();
      });
    });
  }

  /** Run scraping for configured sources */
  private async runScrapeStep() {
    const activeConfig = this.configs.find(c => c.enabled);
    const sources = activeConfig?.sources ?? [];

    if (sources.length === 0) {
      // Scrape all sources
      return await scrapeAll();
    } else {
      // Scrape specific sources
      const results: ScrapeResult[] = [];
      for (const sourceName of sources) {
        try {
          const result = await scrapeSingle(sourceName);
          results.push(result);
        } catch (error) {
          console.error(`[Scheduler] Failed to scrape ${sourceName}:`, error);
          results.push({
            sourceName,
            itemsFound: 0,
            itemsSaved: 0,
            durationMs: 0,
            status: 'failed' as const,
            errorMsg: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
      return results;
    }
  }

  /** Mark listings as inactive that haven't been seen in 7 days */
  private async markStaleListings(): Promise<void> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const result = await db.listing.updateMany({
      where: {
        lastSeenAt: { lt: sevenDaysAgo },
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    if (result.count > 0) {
      console.log(`[Scheduler] Marked ${result.count} stale listings as inactive`);
    }
  }
}

// ── Convenience Exports ────────────────────────────────────────────────

/** Start the scheduler with default configuration */
export function startScheduler(intervalMs?: number): Scheduler {
  const scheduler = Scheduler.getInstance(undefined, intervalMs);
  scheduler.start();
  return scheduler;
}

/** Stop the scheduler */
export function stopScheduler(): void {
  const scheduler = Scheduler.getInstance();
  scheduler.stop();
}

/** Get scheduler status */
export function getSchedulerStatus(): SchedulerStatus {
  const scheduler = Scheduler.getInstance();
  return scheduler.getStatus();
}
