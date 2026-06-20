import { db } from '@/lib/db';
import { runAllAdapters, runAdapter } from '@/lib/adapters';
import { normalizeListing } from './normalizer';
import { RawListing, ScrapeResult, SearchFilters } from '@/lib/types';
import type { SearchFilters as AdapterSearchFilters } from '@/lib/adapters';

// ── Main Scraping Orchestrator ─────────────────────────────────────────

/**
 * Run scraping for all adapters, normalize, and UPSERT into database.
 * Returns per-source scrape results with items saved counts.
 */
export async function scrapeAll(filters?: SearchFilters): Promise<ScrapeResult[]> {
  const adapterFilters = filters as AdapterSearchFilters | undefined;
  const { listings: allRawListings, results: rawResults } = await runAllAdapters(adapterFilters);

  // Group raw listings by source
  const listingsBySource = new Map<string, RawListing[]>();
  for (const listing of allRawListings) {
    const source = listing.sourceName;
    if (!listingsBySource.has(source)) {
      listingsBySource.set(source, []);
    }
    listingsBySource.get(source)!.push(listing);
  }

  // Process each source and update results with actual save counts
  const finalResults: ScrapeResult[] = [];

  for (const rawResult of rawResults) {
    if (rawResult.status === 'failed') {
      // Log the failure to ScrapeLog
      await logScrapeResult(rawResult);
      finalResults.push(rawResult);
      continue;
    }

    const sourceListings = listingsBySource.get(rawResult.sourceName) ?? [];
    const { itemsSaved } = await processListings(sourceListings, rawResult.sourceName);

    const updatedResult: ScrapeResult = {
      ...rawResult,
      itemsSaved,
    };

    await logScrapeResult(updatedResult);
    finalResults.push(updatedResult);
  }

  return finalResults;
}

/**
 * Run scraping for a single adapter, normalize, and UPSERT into database.
 */
export async function scrapeSingle(sourceName: string, filters?: SearchFilters): Promise<ScrapeResult> {
  const adapterFilters = filters as AdapterSearchFilters | undefined;
  const { listings: rawListings, result: rawResult } = await runAdapter(sourceName, adapterFilters);

  if (rawResult.status === 'failed') {
    await logScrapeResult(rawResult);
    return rawResult;
  }

  const { itemsSaved } = await processListings(rawListings, sourceName);

  const finalResult: ScrapeResult = {
    ...rawResult,
    itemsSaved,
  };

  await logScrapeResult(finalResult);
  return finalResult;
}

// ── Internal Processing ────────────────────────────────────────────────

/**
 * Process raw listings: normalize each one and UPSERT into database.
 *
 * For each listing:
 * 1. Normalize using the full normalization pipeline
 * 2. UPSERT into Listing table based on sourceUrl (unique key)
 * 3. If listing already exists and price changed, create a PriceHistory entry
 * 4. Update lastSeenAt for existing listings
 */
async function processListings(
  rawListings: RawListing[],
  sourceName: string,
): Promise<{ itemsFound: number; itemsSaved: number }> {
  const itemsFound = rawListings.length;
  let itemsSaved = 0;

  for (const raw of rawListings) {
    try {
      // Step 1: Normalize the raw listing
      const normalized = normalizeListing(raw) as any;

      // Step 2: Check if listing already exists by sourceUrl
      const existing = await db.listing.findUnique({
        where: { sourceUrl: normalized.sourceUrl },
        select: { id: true, price: true },
      });

      if (existing) {
        // Listing exists — check for price change
        if (existing.price !== normalized.price) {
          // Price changed — create PriceHistory entry for the OLD price
          await db.priceHistory.create({
            data: {
              listingId: existing.id,
              price: existing.price,
            },
          });

          // Update listing with new price and other fields, refresh lastSeenAt
          await db.listing.update({
            where: { id: existing.id },
            data: {
              price: normalized.price,
              mileageKm: normalized.mileageKm ?? null,
              fuelType: normalized.fuelType ?? null,
              transmission: normalized.transmission ?? null,
              bodyType: normalized.bodyType ?? null,
              color: normalized.color ?? null,
              city: normalized.city ?? null,
              district: normalized.district ?? null,
              sellerType: normalized.sellerType ?? null,
              imageUrl: normalized.imageUrl ?? null,
              imageUrls: normalized.imageUrls
                ? JSON.stringify(normalized.imageUrls)
                : '[]',
              description: normalized.description ?? null,
              lastSeenAt: new Date(),
              isActive: true,
              isDeleted: false,
            },
          });
        } else {
          // No price change — just update lastSeenAt
          await db.listing.update({
            where: { id: existing.id },
            data: {
              lastSeenAt: new Date(),
              isActive: true,
              isDeleted: false,
            },
          });
        }

        itemsSaved++;
      } else {
        // New listing — create it
        await db.listing.create({
          data: {
            sourceName: normalized.sourceName,
            sourceUrl: normalized.sourceUrl,
            vin: normalized.vin ?? null,
            make: normalized.make,
            model: normalized.model,
            trim: normalized.trim ?? null,
            year: normalized.year,
            price: normalized.price,
            currency: normalized.currency,
            mileageKm: normalized.mileageKm ?? null,
            fuelType: normalized.fuelType ?? null,
            transmission: normalized.transmission ?? null,
            bodyType: normalized.bodyType ?? null,
            color: normalized.color ?? null,
            city: normalized.city ?? null,
            district: normalized.district ?? null,
            sellerType: normalized.sellerType ?? null,
            imageUrl: normalized.imageUrl ?? null,
            imageUrls: normalized.imageUrls
              ? JSON.stringify(normalized.imageUrls)
              : '[]',
            description: normalized.description ?? null,
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });

        itemsSaved++;
      }
    } catch (error) {
      console.error(
        `[scraper] Error processing listing from ${sourceName}:`,
        error instanceof Error ? error.message : error,
      );
      // Continue processing other listings even if one fails
    }
  }

  return { itemsFound, itemsSaved };
}

/**
 * Log a scrape result to the ScrapeLog table.
 */
async function logScrapeResult(result: ScrapeResult): Promise<void> {
  try {
    await db.scrapeLog.create({
      data: {
        sourceName: result.sourceName,
        startTime: new Date(Date.now() - result.durationMs),
        endTime: new Date(),
        status: result.status === 'success' ? 'success' : 'failed',
        itemsFound: result.itemsFound,
        itemsSaved: result.itemsSaved,
        errorMsg: result.errorMsg ?? null,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error(
      '[scraper] Error logging scrape result:',
      error instanceof Error ? error.message : error,
    );
  }
}
