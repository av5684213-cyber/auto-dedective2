import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';
import { valueAllListings } from '@/lib/services/valuator';
import { bulkScrapeLetgo } from '@/lib/services/letgo-sitemap-scraper';
import { bulkScrapeOtosor } from '@/lib/services/otosor-scraper';
import { bulkScrapeIntercity2 } from '@/lib/services/intercity2-scraper';
import { bulkScrapeFordikinciel } from '@/lib/services/fordikinciel-scraper';
import axios from 'axios';

export const dynamic = 'force-dynamic';
export const maxDurationSeconds = 300;

// ── POST /api/admin/cron ────────────────────────────────────────────────
//
// Vercel Cron calls this every night at 03:00 UTC.
//   1. Marks stale listings as inactive (not seen in 7 days)
//   2. Checks if existing listings are still alive (HTTP HEAD)
//   3. Scrapes new listings from all 4 active sources
//   4. Runs valuation
//   5. Clears cache

export async function POST(request: Request) {
  const auth = request.headers.get('authorization') || '';
  const expected = process.env.CRON_SECRET || process.env.ADMIN_TOKEN;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    staleDeactivated: 0,
    deadDeactivated: 0,
    newScraped: { letgo: 0, otosor: 0, intercity2: 0, fordikinciel: 0 },
    valuationUpdated: 0,
    totalActive: 0,
  };

  // Step 1: Mark stale listings (not seen in 7 days)
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const staleResult = await db.listing.updateMany({
      where: { lastSeenAt: { lt: sevenDaysAgo }, isActive: true },
      data: { isActive: false },
    });
    results.staleDeactivated = staleResult.count;
  } catch (e) { console.error('[cron] Stale:', e); }

  // Step 2: Check if existing listings are still alive (sample 50)
  try {
    const sample = await db.listing.findMany({
      where: { isActive: true },
      select: { id: true, sourceUrl: true },
      take: 50,
      orderBy: { lastSeenAt: 'asc' },
    });
    let dead = 0;
    for (const l of sample) {
      try {
        const res = await axios.head(l.sourceUrl, {
          timeout: 8000,
          headers: { 'User-Agent': 'OtodedektifBot/1.0' },
          maxRedirects: 3,
          validateStatus: (s) => s < 500,
        });
        if (res.status === 404 || res.status === 410) {
          await db.listing.update({ where: { id: l.id }, data: { isActive: false } });
          dead++;
        }
      } catch {}
    }
    results.deadDeactivated = dead;
  } catch (e) { console.error('[cron] Dead:', e); }

  // Step 3: Scrape all 4 sources
  const sources = [
    { name: 'letgo', fn: () => bulkScrapeLetgo(100, 3) },
    { name: 'otosor', fn: () => bulkScrapeOtosor(100) },
    { name: 'intercity2', fn: () => bulkScrapeIntercity2(118) },
    { name: 'fordikinciel', fn: () => bulkScrapeFordikinciel(100) },
  ] as const;

  for (const src of sources) {
    try {
      const scrapeResult = await src.fn();
      let saved = 0;
      for (const listing of scrapeResult.listings) {
        try {
          const existing = await db.listing.findUnique({
            where: { sourceUrl: listing.sourceUrl },
            select: { id: true },
          });
          if (!existing) {
            await db.listing.create({
              data: {
                sourceName: listing.sourceName, sourceUrl: listing.sourceUrl,
                make: listing.make, model: listing.model,
                year: listing.year, price: listing.price,
                currency: 'TRY',
                mileageKm: (listing as any).mileageKm ?? null,
                fuelType: (listing as any).fuelType ?? null,
                transmission: (listing as any).transmission ?? null,
                city: (listing as any).city ?? null,
                sellerType: (listing as any).sellerType ?? 'Galeri',
                imageUrl: (listing as any).imageUrl ?? null,
                imageUrls: (listing as any).imageUrls ? JSON.stringify((listing as any).imageUrls) : '[]',
                lastSeenAt: new Date(), isActive: true, isDeleted: false,
                dealTag: 'Değerlendirilemedi', comparableCount: 0,
              },
            });
            saved++;
          } else {
            await db.listing.update({
              where: { sourceUrl: listing.sourceUrl },
              data: { lastSeenAt: new Date(), isActive: true },
            });
          }
        } catch {}
      }
      (results.newScraped as any)[src.name] = saved;
    } catch (e) { console.error(`[cron] ${src.name} failed:`, e); }
  }

  // Step 4: Valuation
  try { const v = await valueAllListings(); results.valuationUpdated = v.updated; } catch {}

  // Step 5: Check saved search alerts
  let alertsTriggered = 0;
  try {
    const savedSearches = await db.savedSearch.findMany({
      where: { isActive: true },
      include: { user: true },
    });

    for (const search of savedSearches) {
      try {
        const filters = JSON.parse(search.filters);
        const where: Record<string, unknown> = {
          isActive: true,
          isDeleted: false,
          firstSeenAt: { gt: search.lastCheckedAt },
        };

        if (filters.make) where.make = { equals: filters.make };
        if (filters.model) where.model = { equals: filters.model };
        if (filters.yearMin || filters.yearMax) {
          const y: Record<string, number> = {};
          if (filters.yearMin) y.gte = filters.yearMin;
          if (filters.yearMax) y.lte = filters.yearMax;
          where.year = y;
        }
        if (filters.priceMin || filters.priceMax) {
          const p: Record<string, number> = {};
          if (filters.priceMin) p.gte = filters.priceMin;
          if (filters.priceMax) p.lte = filters.priceMax;
          where.price = p;
        }
        if (filters.fuelType) where.fuelType = { equals: filters.fuelType };
        if (filters.transmission) where.transmission = { equals: filters.transmission };
        if (filters.city) where.city = { equals: filters.city };

        const newMatches = await db.listing.findMany({
          where: where as any,
          select: { id: true, make: true, model: true, year: true, price: true, imageUrl: true, sourceUrl: true },
          take: 20,
        });

        if (newMatches.length > 0) {
          // Yeni eşleşmeler var — bildirim gönder
          // (Şimdilik sadece log + DB güncelle, email entegrasyonu sonra)
          console.log(`[cron] Alert "${search.name}" for ${search.user.email}: ${newMatches.length} new matches`);

          // notifiedListingIds güncelle
          const alreadyNotified: string[] = JSON.parse(search.notifiedListingIds || '[]');
          const newIds = newMatches.map(m => m.id).filter(id => !alreadyNotified.includes(id));

          if (newIds.length > 0) {
            await db.savedSearch.update({
              where: { id: search.id },
              data: {
                lastCheckedAt: new Date(),
                notifiedListingIds: JSON.stringify([...alreadyNotified, ...newIds].slice(-100)),
              },
            });
            alertsTriggered++;
          }
        } else {
          // Eşleşme yok, sadece lastCheckedAt güncelle
          await db.savedSearch.update({
            where: { id: search.id },
            data: { lastCheckedAt: new Date() },
          });
        }
      } catch (e) {
        console.error(`[cron] Alert check failed for ${search.id}:`, e);
      }
    }
  } catch (e) {
    console.error('[cron] Alert check failed:', e);
  }
  (results as any).alertsTriggered = alertsTriggered;

  // Step 6: Clear cache
  try { await cache.clear(); } catch {}

  try { results.totalActive = await db.listing.count({ where: { isActive: true } }); } catch {}

  return NextResponse.json({ success: true, runAt: new Date().toISOString(), ...results });
}
