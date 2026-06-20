#!/usr/bin/env bun
/**
 * PlaywrightScraper — SPA/WAF-protected sitelerden gerçek ilan çeker.
 *
 * Hedef kaynaklar:
 *   - arabam.com
 *   - vavacars.com.tr
 *   - sahibinden.com (statik fallback)
 *
 * NOT: letgo.com bu script'te YOK. Letgo verisi ayrı adapter üzerinden
 *      çalışmaya devam eder ve bu script letgo kayıtlarına DOKUNMAZ.
 *      UPSERT anahtarı sourceUrl olduğu için yeni kaynakların kayıtları
 *      kendi URL'leriyle eklenir; Letgo URL'leri korunur.
 *
 * Kullanım:
 *   bun run scripts/playwright-scrape.ts --site=arabam --pages=2
 *   bun run scripts/playwright-scrape.ts --site=vavacars --pages=3
 *   bun run scripts/playwright-scrape.ts --site=sahibinden --pages=2
 *   bun run scripts/playwright-scrape.ts --site=all --pages=2
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { db } from '@/lib/db';
import { normalizeListing } from '@/lib/services/normalizer';
import { valueAllListings } from '@/lib/services/valuator';
import { estimateAllCosts } from '@/lib/services/cost-estimator';
import type { RawListing } from '@/lib/types';

// ── CLI Args ──────────────────────────────────────────────────────────
function arg(name: string, fallback?: string): string | undefined {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  return found ? found.slice(flag.length) : fallback;
}

const SITE = arg('site', 'all')!;
const MAX_PAGES = parseInt(arg('pages', '2')!, 10);
const MAX_TOTAL = parseInt(arg('max', '200')!, 10);

// ── Site Configurations ──────────────────────────────────────────────
interface SiteConfig {
  name: string;
  sourceName: string; // DB'de tutulan sourceName
  baseUrl: string;
  pagination: (page: number) => string;
  selectors: {
    listings: string;
    title: string;
    price: string;
    year: string;
    km: string;
    fuel: string;
    transmission: string;
    city: string;
    image: string;
    link: string;
  };
}

const SITES: Record<string, SiteConfig> = {
  arabam: {
    name: 'arabam.com',
    sourceName: 'arabam',
    baseUrl: 'https://www.arabam.com',
    pagination: (p) =>
      p === 1
        ? 'https://www.arabam.com/ikinci-el/otomobil'
        : `https://www.arabam.com/ikinci-el/otomobil?page=${p}`,
    selectors: {
      listings: '.listing-item, .car-card, .vehicle-item, .ad-item, [data-testid="listing-card"], .listing',
      title: '.title, .listing-title, .car-name, h3, .card-title',
      price: '.price, .listing-price, .car-price, .price-value',
      year: '.year, .model-year, .car-year',
      km: '.km, .mileage, .car-mileage',
      fuel: '.fuel, .fuel-type, .car-fuel',
      transmission: '.transmission, .gear, .car-gear',
      city: '.city, .location, .car-location',
      image: 'img',
      link: 'a[href*="/ilan/"], a[href*="/araba/"], a.listing-link, a',
    },
  },
  vavacars: {
    name: 'vavacars.com.tr',
    sourceName: 'vavacars',
    baseUrl: 'https://www.vavacars.com.tr',
    pagination: (p) => `https://www.vavacars.com.tr/araba?page=${p}`,
    selectors: {
      listings: '.vehicle-card, .car-item, .listing-item, [data-testid="vehicle-card"], .vehicle-list-item',
      title: '.title, .vehicle-title, .car-name, h3',
      price: '.price, .vehicle-price, .car-price',
      year: '.year, .vehicle-year',
      km: '.km, .vehicle-mileage',
      fuel: '.fuel, .vehicle-fuel',
      transmission: '.transmission, .vehicle-gear',
      city: '.city, .location',
      image: 'img',
      link: 'a[href*="/araba/"], a[href*="/ilan/"], a.vehicle-link, a',
    },
  },
  sahibinden: {
    name: 'sahibinden.com',
    sourceName: 'sahibinden',
    baseUrl: 'https://www.sahibinden.com',
    pagination: (p) => {
      const offset = (p - 1) * 50;
      return `https://www.sahibinden.com/kategori/otomobil?pagingOffset=${offset}`;
    },
    selectors: {
      listings: '.searchResultsItem, .listing-item, .search-result-item, tbody tr',
      title: '.listing-title, .title, .searchResultsTitle, .classifiedTitle, h3',
      price: '.price, .listing-price, .searchResultsPrice, .classified-price',
      year: '.year, .listing-year, .searchResultsYearValue',
      km: '.km, .mileage, .searchResultsAttributeValue',
      fuel: '.fuel, .fuel-type',
      transmission: '.transmission, .gear',
      city: '.city, .location, .searchResultsLocationValue',
      image: 'img',
      link: 'a[href*="/ilan/"], a.classifiedTitle, a',
    },
  },
};

// ── Scraper ──────────────────────────────────────────────────────────
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MAKES = [
  'ford', 'opel', 'vw', 'volkswagen', 'bmw', 'mercedes', 'audi',
  'toyota', 'renault', 'fiat', 'hyundai', 'nissan', 'honda', 'peugeot',
  'citroen', 'skoda', 'seat', 'kia', 'mazda', 'volvo', 'mini', 'smart',
  'subaru', 'suzuki', 'mitsubishi', 'dacia', 'chery', 'togg', 'tesla',
  'alfa', 'romeo', 'abarth', 'lancia', 'dodge', 'chevrolet', 'chrysler',
  'jeep', 'cadillac', 'infiniti', 'acura', 'lexus',
];

function extractMakeModel(title: string): { make: string; model: string } {
  if (!title) return { make: '', model: '' };
  const parts = title.trim().split(/\s+/);
  if (parts.length >= 2) {
    const twoWord = `${parts[0].toLowerCase()} ${parts[1].toLowerCase()}`;
    if (twoWord === 'alfa romeo' || twoWord === 'land rover') {
      return { make: `${parts[0]} ${parts[1]}`, model: parts.slice(2).join(' ') };
    }
    if (MAKES.includes(parts[0].toLowerCase())) {
      return { make: parts[0], model: parts.slice(1).join(' ') };
    }
  }
  return { make: parts[0] || '', model: parts.slice(1).join(' ') };
}

class PlaywrightScraper {
  browser: Browser | null = null;
  context: BrowserContext | null = null;
  page: Page | null = null;

  async init() {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
    });
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: randomUA(),
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
      extraHTTPHeaders: {
        'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });
    this.page = await this.context.newPage();

    // Stealth: hide webdriver / chrome automation flags
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      Object.defineProperty(navigator, 'languages', {
        get: () => ['tr-TR', 'tr', 'en-US', 'en'],
      });
      Object.defineProperty(navigator, 'platform', { get: () => 'Win32' });
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
      if (window.chrome) {
        Object.defineProperty(window.chrome, 'runtime', { get: () => undefined });
      }
    });
  }

  async close() {
    if (this.browser) await this.browser.close();
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /** Simulate human behavior to evade bot detection */
  async humanBehavior() {
    if (!this.page) return;
    try {
      await this.page.waitForTimeout(randInt(2500, 5000));
      const scrollCount = randInt(2, 4);
      for (let i = 0; i < scrollCount; i++) {
        const dir = Math.random() > 0.5 ? 1 : -1;
        const amt = randInt(150, 450);
        await this.page.evaluate((d, a) => window.scrollBy({ top: d * a, behavior: 'smooth' }), dir, amt);
        await this.page.waitForTimeout(randInt(400, 900));
      }
      // Random mouse move
      for (let i = 0; i < 2; i++) {
        await this.page.mouse.move(randInt(150, 1200), randInt(150, 600), { steps: randInt(5, 12) });
        await this.page.waitForTimeout(randInt(200, 500));
      }
      if (Math.random() > 0.7) {
        await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        await this.page.waitForTimeout(randInt(300, 600));
      }
    } catch {
      // ignore
    }
  }

  /** Parse one page */
  async scrapePage(cfg: SiteConfig, pageNum: number): Promise<RawListing[]> {
    const url = cfg.pagination(pageNum);
    if (!this.page) return [];
    console.log(`\n  📄 Sayfa ${pageNum}: ${url}`);

    try {
      await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await this.humanBehavior();

      // Detect blocks
      const html = await this.page.content();
      if (html.includes('403') && html.length < 5000) {
        console.log('  🚫 403 Forbidden algılandı');
        return [];
      }
      if (html.includes('cf-browser-verification') || html.includes('Cloudflare')) {
        console.log('  ☁️ Cloudflare koruması — atlanıyor');
        return [];
      }

      // Try to wait for listing containers
      try {
        await this.page.waitForSelector(cfg.selectors.listings, { timeout: 15000 });
      } catch {
        console.log('  ⚠️ İlan konteyneri bulunamadı, yine de parse denenecek');
      }

      // Extract listings inside the browser context
      const items = await this.page.evaluate(
        (sel, base, siteName) => {
          const out: any[] = [];
          const selectorList = sel.listings.split(',').map((s) => s.trim());
          let elements: Element[] = [];
          for (const s of selectorList) {
            const found = Array.from(document.querySelectorAll(s));
            if (found.length > 0) {
              elements = found;
              break;
            }
          }
          if (elements.length === 0) {
            // Last resort: try all <a> with /ilan/ in href, group by parent
            const links = Array.from(document.querySelectorAll('a[href*="/ilan/"]'));
            elements = links.map((a) => a.closest('li, tr, div, article') || a);
          }
          const seen = new Set<string>();
          for (const el of elements) {
            try {
              const linkEl =
                el.querySelector(sel.link) ||
                el.querySelector('a[href*="/ilan/"]') ||
                el.querySelector('a');
              let link = linkEl ? linkEl.getAttribute('href') || '' : '';
              if (link && !link.startsWith('http')) {
                link = base + (link.startsWith('/') ? '' : '/') + link;
              }
              if (!link || seen.has(link)) continue;
              seen.add(link);

              const titleEl = el.querySelector(sel.title);
              const title = titleEl ? (titleEl.textContent || '').trim() : '';

              const priceEl = el.querySelector(sel.price);
              let price = 0;
              if (priceEl) {
                const t = (priceEl.textContent || '').trim();
                const cleaned = t.replace(/[^0-9,.]/g, '').replace(/\./g, '').replace(/,/g, '.');
                price = parseFloat(cleaned) || 0;
              }

              const yearEl = el.querySelector(sel.year);
              let year = yearEl ? parseInt((yearEl.textContent || '').replace(/[^0-9]/g, ''), 10) : 0;
              if (!year || year < 1950 || year > new Date().getFullYear() + 1) {
                // Try to find year in title or elsewhere
                const ym = title.match(/\b(19|20)\d{2}\b/);
                if (ym) year = parseInt(ym[0], 10);
              }

              const kmEl = el.querySelector(sel.km);
              let km: number | undefined;
              if (kmEl) {
                const t = (kmEl.textContent || '').replace(/[^0-9]/g, '');
                km = t ? parseInt(t, 10) : undefined;
              }

              const fuelEl = el.querySelector(sel.fuel);
              const fuel = fuelEl ? (fuelEl.textContent || '').trim() : '';

              const transEl = el.querySelector(sel.transmission);
              const trans = transEl ? (transEl.textContent || '').trim() : '';

              const cityEl = el.querySelector(sel.city);
              const city = cityEl ? (cityEl.textContent || '').trim() : '';

              const imgEl = el.querySelector(sel.image);
              let imageUrl = '';
              if (imgEl) {
                imageUrl =
                  imgEl.getAttribute('src') ||
                  imgEl.getAttribute('data-src') ||
                  imgEl.getAttribute('srcset')?.split(' ')[0] ||
                  '';
              }

              if (price > 0 || title) {
                out.push({
                  sourceName: siteName,
                  sourceUrl: link,
                  make: '',
                  model: '',
                  title,
                  year: year || 0,
                  price,
                  currency: 'TRY',
                  mileageKm: km,
                  fuelType: fuel || undefined,
                  transmission: trans || undefined,
                  city: city || undefined,
                  imageUrl: imageUrl || undefined,
                  imageUrls: imageUrl ? [imageUrl] : [],
                });
              }
            } catch {
              // skip
            }
          }
          return out;
        },
        cfg.selectors,
        cfg.baseUrl,
        cfg.sourceName,
      );

      // Extract make/model from title client-side logic
      for (const it of items) {
        const { make, model } = extractMakeModel(it.title || '');
        it.make = make;
        it.model = model;
      }

      console.log(`  ✅ ${items.length} ilan çekildi`);
      return items as RawListing[];
    } catch (e: any) {
      console.log(`  ❌ Sayfa hatası: ${e.message}`);
      return [];
    }
  }

  /** Scrape multiple pages of a single site */
  async scrapeSite(cfg: SiteConfig, maxPages: number, maxTotal: number): Promise<RawListing[]> {
    const all: RawListing[] = [];
    for (let p = 1; p <= maxPages; p++) {
      if (all.length >= maxTotal) break;
      const pageItems = await this.scrapePage(cfg, p);
      if (pageItems.length === 0) {
        console.log('  ⚠️ Bu sayfada ilan yok, sonraki sayfaya geçiliyor');
        if (p >= 2) break; // If 2nd page also empty, stop
      }
      all.push(...pageItems.slice(0, maxTotal - all.length));
      console.log(`  📦 Toplam: ${all.length}/${maxTotal}`);
      if (p < maxPages && all.length < maxTotal) {
        await this.page!.waitForTimeout(randInt(6000, 9000));
      }
    }
    return all;
  }
}

// ── DB Save (Letgo verisine DOKUNMAZ — sadece sourceUrl UPSERT) ──────
async function saveListings(raws: RawListing[]): Promise<{ saved: number; updated: number }> {
  let saved = 0;
  let updated = 0;
  for (const raw of raws) {
    try {
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
              fuelType: normalized.fuelType ?? null,
              transmission: normalized.transmission ?? null,
              city: normalized.city ?? null,
              district: normalized.district ?? null,
              sellerType: normalized.sellerType ?? null,
              imageUrl: normalized.imageUrl ?? null,
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
            description: normalized.description ?? null,
            lastSeenAt: new Date(),
            isActive: true,
            isDeleted: false,
          },
        });
        saved++;
      }
    } catch (e: any) {
      console.error(`  ✗ Kaydetme hatası: ${e.message}`);
    }
  }
  return { saved, updated };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Playwright Scraper — Arabam / VavaCars / Sahibinden');
  console.log('  ⚠️  Letgo verisine DOKUNULMAZ (kaynak URL farklı)');
  console.log('═══════════════════════════════════════════════════════\n');

  const siteKeys = SITE === 'all' ? Object.keys(SITES) : [SITE];
  const scraper = new PlaywrightScraper();
  await scraper.init();

  const allResults: { source: string; found: number; saved: number; updated: number; durationMs: number }[] = [];

  for (const key of siteKeys) {
    const cfg = SITES[key];
    if (!cfg) {
      console.log(`⚠️ Bilinmeyen site: ${key}`);
      continue;
    }
    console.log(`\n🚗 Scraping: ${cfg.name} (max ${MAX_PAGES} sayfa, ${MAX_TOTAL} ilan)`);
    const t0 = Date.now();

    let listings: RawListing[] = [];
    try {
      listings = await scraper.scrapeSite(cfg, MAX_PAGES, MAX_TOTAL);
    } catch (e: any) {
      console.log(`  ❌ Site hatası: ${e.message}`);
    }

    console.log(`  💾 Kaydediliyor...`);
    const { saved, updated } = await saveListings(listings);
    const durationMs = Date.now() - t0;
    console.log(`  ✓ Yeni: ${saved}, Güncellenen: ${updated}, Toplam bulunan: ${listings.length}, Süre: ${(durationMs / 1000).toFixed(1)}s`);

    allResults.push({ source: cfg.sourceName, found: listings.length, saved, updated, durationMs });

    // ScrapeLog
    try {
      await db.scrapeLog.create({
        data: {
          sourceName: cfg.sourceName,
          startTime: new Date(t0),
          endTime: new Date(),
          status: listings.length > 0 ? 'success' : 'failed',
          itemsFound: listings.length,
          itemsSaved: saved,
          durationMs,
        },
      });
    } catch {
      // ignore
    }
  }

  await scraper.close();

  // ── Re-run valuation + cost estimation ──────────────────────────────
  console.log('\n📊 Tüm ilanlar için valuation çalıştırılıyor...');
  try {
    const v = await valueAllListings();
    console.log(`  ✓ ${v.processed} ilan değerlendi`);
  } catch (e: any) {
    console.error(`  Valuation hatası: ${e.message}`);
  }

  console.log('💰 Maliyet hesaplanıyor...');
  try {
    const c = await estimateAllCosts();
    console.log(`  ✓ ${c.processed} ilan için maliyet hesaplandı`);
  } catch (e: any) {
    console.error(`  Cost est hatası: ${e.message}`);
  }

  // ── Summary ─────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  ÖZET');
  console.log('═══════════════════════════════════════════════════════');
  for (const r of allResults) {
    console.log(`  ${r.source}: ${r.found} bulundu, ${r.saved} yeni, ${r.updated} güncellendi`);
  }

  // Source breakdown in DB
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
