import { NextResponse } from 'next/server';
import { scrapeAll, scrapeSingle } from '@/lib/services/scraper';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import { runDeduplication } from '@/lib/services/deduplicator';
import { cache } from '@/lib/services/cache';
import type { SearchFilters } from '@/lib/types';
import { scrapeBodySchema, safeParse } from '@/lib/validation/schemas';
import { bulkScrapeLetgo } from '@/lib/services/letgo-sitemap-scraper';
import { bulkScrapeOtosor } from '@/lib/services/otosor-scraper';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDurationSeconds = 300;

// ── POST Handler ───────────────────────────────────────────────────────
//
// Body:
//   sourceName?: string    — "letgo-sitemap" for bulk sitemap scrape
//   filters?: SearchFilters
//   maxListings?: number   — for sitemap bulk (default: 500)
//   sitemapCount?: number  — for sitemap bulk (default: 5)
//
// Auth: protected by middleware (ADMIN_TOKEN/CRON_SECRET bearer).

export async function POST(request: Request) {
  try {
    const rawBody = await request.json().catch(() => ({}));
    const body = safeParse(scrapeBodySchema, rawBody, {}, 'scrapeBody');
    const sourceName: string | undefined = body.sourceName;
    const filters: SearchFilters | undefined = body.filters as SearchFilters | undefined;

    // ── Special: bulk sitemap scrape for Letgo ──
    if (sourceName === 'letgo-sitemap') {
      const maxListings = (rawBody as { maxListings?: number })?.maxListings ?? 500;
      const sitemapCount = (rawBody as { sitemapCount?: number })?.sitemapCount ?? 5;

      const scrapeResult = await bulkScrapeLetgo(maxListings, sitemapCount);

      let saved = 0;
      let updated = 0;
      for (const listing of scrapeResult.listings) {
        try {
          const existing = await db.listing.findUnique({
            where: { sourceUrl: listing.sourceUrl },
            select: { id: true, price: true },
          });

          if (existing) {
            if (existing.price !== listing.price) {
              try {
                await db.priceHistory.create({ data: { listingId: existing.id, price: existing.price } });
              } catch (e) { /* ignore */ }
              await db.listing.update({
                where: { id: existing.id },
                data: {
                  price: listing.price,
                  mileageKm: listing.mileageKm ?? null,
                  fuelType: listing.fuelType ?? null,
                  transmission: listing.transmission ?? null,
                  city: listing.city ?? null,
                  district: listing.district ?? null,
                  sellerType: listing.sellerType ?? null,
                  imageUrl: listing.imageUrl ?? null,
                  imageUrls: listing.imageUrls ? JSON.stringify(listing.imageUrls) : '[]',
                  description: listing.description ?? null,
                  lastSeenAt: new Date(), isActive: true, isDeleted: false,
                },
              });
            } else {
              await db.listing.update({
                where: { id: existing.id },
                data: { lastSeenAt: new Date(), isActive: true, isDeleted: false },
              });
            }
            updated++;
          } else {
            await db.listing.create({
              data: {
                sourceName: listing.sourceName, sourceUrl: listing.sourceUrl,
                make: listing.make, model: listing.model, trim: listing.trim ?? null,
                year: listing.year, price: listing.price,
                currency: listing.currency ?? 'TRY',
                mileageKm: listing.mileageKm ?? null,
                fuelType: listing.fuelType ?? null,
                transmission: listing.transmission ?? null,
                city: listing.city ?? null, district: listing.district ?? null,
                sellerType: listing.sellerType ?? null,
                imageUrl: listing.imageUrl ?? null,
                imageUrls: listing.imageUrls ? JSON.stringify(listing.imageUrls) : '[]',
                description: listing.description ?? null,
                lastSeenAt: new Date(), isActive: true, isDeleted: false,
              },
            });
            saved++;
          }
        } catch (err) {
          console.error(`[scrape] UPSERT failed for ${listing.sourceUrl}:`, err);
        }
      }

      let valuationUpdated = 0;
      try {
        const v = await valueAllListings();
        valuationUpdated = v.updated;
      } catch (e) { /* ignore */ }

      try { await cache.clear(); } catch (e) { /* ignore */ }

      return NextResponse.json({
        success: true,
        source: 'letgo-sitemap',
        scannedSitemaps: scrapeResult.scannedSitemaps,
        totalUrlsScanned: scrapeResult.totalUrls,
        carUrlsFound: scrapeResult.carUrls,
        listingsScraped: scrapeResult.listings.length,
        listingsCreated: saved,
        listingsUpdated,
        valuationUpdated,
      });
    }

    // ── Special: bulk scrape for Otosor ──
    if (sourceName === 'otosor-sitemap') {
      const maxListings = (rawBody as { maxListings?: number })?.maxListings ?? 200;

      const scrapeResult = await bulkScrapeOtosor(maxListings);

      let saved = 0;
      let updated = 0;
      for (const listing of scrapeResult.listings) {
        try {
          const existing = await db.listing.findUnique({
            where: { sourceUrl: listing.sourceUrl },
            select: { id: true, price: true },
          });

          if (existing) {
            if (existing.price !== listing.price) {
              try {
                await db.priceHistory.create({ data: { listingId: existing.id, price: existing.price } });
              } catch (e) { /* ignore */ }
              await db.listing.update({
                where: { id: existing.id },
                data: {
                  price: listing.price,
                  mileageKm: listing.mileageKm ?? null,
                  fuelType: listing.fuelType ?? null,
                  transmission: listing.transmission ?? null,
                  city: listing.city ?? null,
                  district: listing.district ?? null,
                  sellerType: listing.sellerType ?? null,
                  imageUrl: listing.imageUrl ?? null,
                  imageUrls: listing.imageUrls ? JSON.stringify(listing.imageUrls) : '[]',
                  description: listing.description ?? null,
                  lastSeenAt: new Date(), isActive: true, isDeleted: false,
                },
              });
            } else {
              await db.listing.update({
                where: { id: existing.id },
                data: { lastSeenAt: new Date(), isActive: true, isDeleted: false },
              });
            }
            updated++;
          } else {
            await db.listing.create({
              data: {
                sourceName: listing.sourceName, sourceUrl: listing.sourceUrl,
                make: listing.make, model: listing.model, trim: listing.trim ?? null,
                year: listing.year, price: listing.price,
                currency: listing.currency ?? 'TRY',
                mileageKm: listing.mileageKm ?? null,
                fuelType: listing.fuelType ?? null,
                transmission: listing.transmission ?? null,
                city: listing.city ?? null, district: listing.district ?? null,
                sellerType: listing.sellerType ?? null,
                imageUrl: listing.imageUrl ?? null,
                imageUrls: listing.imageUrls ? JSON.stringify(listing.imageUrls) : '[]',
                description: listing.description ?? null,
                lastSeenAt: new Date(), isActive: true, isDeleted: false,
              },
            });
            saved++;
          }
        } catch (err) {
          console.error(`[scrape] UPSERT failed for ${listing.sourceUrl}:`, err);
        }
      }

      let valuationUpdated = 0;
      try { const v = await valueAllListings(); valuationUpdated = v.updated; } catch (e) { /* ignore */ }
      try { await cache.clear(); } catch (e) { /* ignore */ }

      return NextResponse.json({
        success: true,
        source: 'otosor-sitemap',
        pagesScanned: scrapeResult.pagesScanned,
        totalUrls: scrapeResult.totalUrls,
        listingsScraped: scrapeResult.listings.length,
        listingsCreated: saved,
        listingsUpdated,
        valuationUpdated,
      });
    }

    // ── Standard adapter scrape ──
    let scrapeResults;
    if (sourceName) {
      const result = await scrapeSingle(sourceName, filters);
      scrapeResults = [result];
    } else {
      scrapeResults = await scrapeAll(filters);
    }

    const valuationResults = await valueAllListings();
    const costResults = await estimateAllCosts();
    const dedupResults = await runDeduplication();

    try { await cache.clear(); } catch (e) { /* ignore */ }

    return NextResponse.json({
      success: true,
      scrape: scrapeResults,
      valuation: valuationResults,
      costs: costResults,
      deduplication: dedupResults,
    });
  } catch (error) {
    console.error('[API /admin/scrape] Error:', error);
    return NextResponse.json({ error: 'Scraping failed' }, { status: 500 });
  }
}
