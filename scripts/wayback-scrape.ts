#!/usr/bin/env bun
/**
 * Wayback Machine scraper — Cloudflare-korumalı siteler için.
 * Arabam ve sahibinden'in web.archive.org üzerindeki snapshot'larını çeker.
 *
 * NOT: Letgo'ya DOKUNMAZ — Letgo zaten kendi adapter'ıyla çalışıyor.
 * UPSERT anahtarı sourceUrl olduğu için, Letgo kayıtları korunur.
 *
 * Kullanım:
 *   bun run scripts/wayback-scrape.ts --site=arabam
 *   bun run scripts/wayback-scrape.ts --site=sahibinden
 *   bun run scripts/wayback-scrape.ts --site=all
 */
import axios from 'axios';
import * as cheerio from 'cheerio';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function arg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

const SITE = arg('site', 'all')!;

// ── Site configs ─────────────────────────────────────────────────────
const SITES = {
  arabam: {
    sourceName: 'arabam',
    name: 'arabam.com',
    baseUrl: 'https://www.arabam.com',
    // Wayback snapshot'ları — sayfalama ve arama varyasyonları
    // Her snapshot ~20 unique ilan getirir
    snapshotUrls: [
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=2',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=3',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=4',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=5',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=6',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?page=7',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=renault',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=ford',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=fiat',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=bmw',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=volkswagen',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=audi',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=mercedes',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=toyota',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=hyundai',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=opel',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=peugeot',
      'https://web.archive.org/web/2024/https://www.arabam.com/ikinci-el/otomobil?searchText=nissan',
    ],
    // Parse listing cards from archived HTML
    parse: ($: any, baseUrl: string): RawListing[] => {
      const listings: RawListing[] = [];
      $('a[href*="/ilan/"]').each((_: any, el: any) => {
        try {
          const $el = $(el);
          const $card = $el.closest('div, li, article, tr');
          if (!$card.length) return;

          // Extract original URL (strip web.archive.org prefix)
          const archiveHref = $el.attr('href') || '';
          const match = archiveHref.match(/\/web\/\d+\/(https?:\/\/.+)/);
          if (!match) return;
          const sourceUrl = match[1];

          // Title from link text or nearby
          const title = ($el.text().trim() || $card.find('.listing-title, .title, h3').first().text().trim()).substring(0, 200);
          if (!title) return;

          // Card text
          const cardText = $card.text();

          // Price
          const priceMatch = cardText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, '')) : 0;
          if (!price) return;

          // Year
          const yearMatch = cardText.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? parseInt(yearMatch[0]) : 0;

          // KM
          const kmMatch = cardText.match(/([0-9]{1,3}(\.[0-9]{3})*)\s*km/i);
          const mileageKm = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : undefined;

          // City
          const cityMatch = cardText.match(/(İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir|Sakarya|Kocaeli|Tekirdağ|Hatay)/);
          const city = cityMatch ? cityMatch[1] : undefined;

          // Image
          const imgEl = $card.find('img').first();
          const imgSrc = imgEl.attr('src') || imgEl.attr('data-src') || '';
          let imageUrl: string | undefined;
          if (imgSrc) {
            if (imgSrc.startsWith('http')) imageUrl = imgSrc;
            else if (imgSrc.startsWith('/web/')) imageUrl = `https://web.archive.org${imgSrc}`;
            else imageUrl = `${baseUrl}${imgSrc}`;
          }

          // Make/model from title
          const parts = title.split(/\s+/);
          let make = parts[0] || '';
          let model = parts.slice(1).join(' ');
          // Clean: remove "satilik" words etc
          if (/satilik|satılık|galeriden/i.test(make)) {
            make = parts[1] || '';
            model = parts.slice(2).join(' ');
          }

          if (make && price > 0) {
            listings.push({
              sourceName: 'arabam',
              sourceUrl,
              make,
              model,
              year,
              price,
              currency: 'TRY',
              mileageKm,
              city,
              imageUrl,
              imageUrls: imageUrl ? [imageUrl] : [],
            });
          }
        } catch {}
      });
      return listings;
    },
  },

  sahibinden: {
    sourceName: 'sahibinden',
    name: 'sahibinden.com',
    baseUrl: 'https://www.sahibinden.com',
    snapshotUrls: [
      'https://web.archive.org/web/2024/https://www.sahibinden.com/kategori/otomobil',
      'https://web.archive.org/web/2024/https://www.sahibinden.com/ikinci-el-araba',
    ],
    parse: ($: any, baseUrl: string): RawListing[] => {
      const listings: RawListing[] = [];
      // Sahibinden uses table rows
      $('a[href*="/ilan/"]').each((_: any, el: any) => {
        try {
          const $el = $(el);
          const $row = $el.closest('tr, .searchResultsItem, .listing-item');
          if (!$row.length) return;

          const archiveHref = $el.attr('href') || '';
          const match = archiveHref.match(/\/web\/\d+\/(https?:\/\/.+)/);
          if (!match) return;
          const sourceUrl = match[1];

          const title = $el.attr('title') || $el.text().trim();
          if (!title) return;

          const rowText = $row.text();

          // Price
          const priceMatch = rowText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
          const price = priceMatch ? parseInt(priceMatch[1].replace(/\./g, '')) : 0;
          if (!price) return;

          // Year
          const yearMatch = rowText.match(/\b(19|20)\d{2}\b/);
          const year = yearMatch ? parseInt(yearMatch[0]) : 0;

          // KM
          const kmMatch = rowText.match(/([0-9]{1,3}(\.[0-9]{3})*)\s*km/i);
          const mileageKm = kmMatch ? parseInt(kmMatch[1].replace(/\./g, '')) : undefined;

          // City
          const cityMatch = rowText.match(/(İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir|Sakarya|Kocaeli|Tekirdağ|Hatay)/);
          const city = cityMatch ? cityMatch[1] : undefined;

          const parts = title.split(/\s+/);
          let make = parts[0] || '';
          let model = parts.slice(1).join(' ');
          if (/satilik|satılık|galeriden/i.test(make)) {
            make = parts[1] || '';
            model = parts.slice(2).join(' ');
          }

          if (make && price > 0) {
            listings.push({
              sourceName: 'sahibinden',
              sourceUrl,
              make,
              model,
              year,
              price,
              currency: 'TRY',
              mileageKm,
              city,
            });
          }
        } catch {}
      });
      return listings;
    },
  },
};

// ── Fetch with retries ───────────────────────────────────────────────
async function fetchSnapshot(url: string, retries = 2): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
        timeout: 45000,
        validateStatus: () => true,
      });
      if (res.status === 200 && res.data.length > 10000) {
        return res.data;
      }
      console.log(`  ⚠️ Attempt ${attempt + 1}: HTTP ${res.status}, len ${res.data?.length || 0}`);
    } catch (e: any) {
      console.log(`  ⚠️ Attempt ${attempt + 1}: ${e.message}`);
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 5000));
  }
  return '';
}

// ── Save to DB (Letgo'ya DOKUNMAZ) ───────────────────────────────────
async function saveListings(raws: RawListing[]): Promise<{ saved: number; updated: number }> {
  let saved = 0;
  let updated = 0;
  const seen = new Set<string>();
  for (const raw of raws) {
    try {
      if (seen.has(raw.sourceUrl)) continue;
      seen.add(raw.sourceUrl);

      const normalized = normalizeListing(raw) as any;
      if (!normalized.sourceUrl || !normalized.make) continue;

      const existing = await db.listing.findUnique({
        where: { sourceUrl: normalized.sourceUrl },
        select: { id: true, price: true },
      });

      if (existing) {
        if (existing.price !== normalized.price) {
          await db.priceHistory.create({
            data: { listingId: existing.id, price: existing.price },
          });
          await db.listing.update({
            where: { id: existing.id },
            data: {
              price: normalized.price,
              mileageKm: normalized.mileageKm ?? null,
              city: normalized.city ?? null,
              lastSeenAt: new Date(),
              isActive: true,
              isDeleted: false,
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
            sourceName: normalized.sourceName,
            sourceUrl: normalized.sourceUrl,
            make: normalized.make,
            model: normalized.model,
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
            imageUrls: normalized.imageUrls ? JSON.stringify(normalized.imageUrls) : '[]',
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });
        saved++;
      }
    } catch (e: any) {
      // silent
    }
  }
  return { saved, updated };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Wayback Machine Scraper');
  console.log('  Letgo verisine DOKUNULMAZ');
  console.log('═══════════════════════════════════════════════════════\n');

  const siteKeys = SITE === 'all' ? Object.keys(SITES) : [SITE];
  const allResults: { source: string; found: number; saved: number; updated: number; durationMs: number }[] = [];

  for (const key of siteKeys) {
    const cfg = (SITES as any)[key];
    if (!cfg) continue;

    console.log(`\n🚗 Scraping: ${cfg.name}`);
    const t0 = Date.now();
    const allListings: RawListing[] = [];

    for (const snapUrl of cfg.snapshotUrls) {
      console.log(`  📄 ${snapUrl}`);
      const html = await fetchSnapshot(snapUrl);
      if (!html) {
        console.log('    ✗ Failed to fetch');
        continue;
      }
      const $ = cheerio.load(html);
      const listings = cfg.parse($, cfg.baseUrl);
      console.log(`    ✓ ${listings.length} listings parsed`);
      allListings.push(...listings);
      await new Promise((r) => setTimeout(r, 2000));
    }

    // Dedup by sourceUrl
    const seen = new Set<string>();
    const unique: RawListing[] = [];
    for (const l of allListings) {
      if (!seen.has(l.sourceUrl)) {
        seen.add(l.sourceUrl);
        unique.push(l);
      }
    }
    console.log(`  📦 Total unique: ${unique.length}`);

    // Save
    console.log(`  💾 Saving to DB...`);
    const { saved, updated } = await saveListings(unique);
    const durationMs = Date.now() - t0;
    console.log(`  ✓ Saved: ${saved} new, ${updated} updated, ${(durationMs / 1000).toFixed(1)}s`);
    allResults.push({ source: cfg.sourceName, found: unique.length, saved, updated, durationMs });

    // ScrapeLog
    try {
      await db.scrapeLog.create({
        data: {
          sourceName: cfg.sourceName,
          startTime: new Date(t0),
          endTime: new Date(),
          status: unique.length > 0 ? 'success' : 'failed',
          itemsFound: unique.length,
          itemsSaved: saved,
          durationMs,
        },
      });
    } catch {}
  }

  // Valuation + cost estimation
  console.log('\n📊 Valuation çalıştırılıyor...');
  try {
    const v = await valueAllListings();
    console.log(`  ✓ Tamamlandı`);
  } catch (e: any) {
    console.error(`  Hata: ${e.message}`);
  }

  console.log('💰 Maliyet hesaplanıyor...');
  try {
    const c = await estimateAllCosts();
    console.log(`  ✓ Tamamlandı`);
  } catch (e: any) {
    console.error(`  Hata: ${e.message}`);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ÖZET');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of allResults) {
    console.log(`  ${r.source}: ${r.found} bulundu, ${r.saved} yeni, ${r.updated} güncellendi`);
  }
  const bySource = await db.listing.groupBy({
    by: ['sourceName'],
    where: { isActive: true },
    _count: true,
  });
  console.log('\n📦 DB kaynağa göre:');
  for (const s of bySource) {
    console.log(`  ${s.sourceName}: ${s._count} aktif ilan`);
  }
  console.log('═══════════════════════════════════════════════════════');

  await db.$disconnect();
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
