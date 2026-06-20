import axios from 'axios';
import { db } from '@/lib/db';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Get all arabam listings
const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  select: { id: true, sourceUrl: true, make: true, model: true, year: true, price: true },
});
console.log(`Total arabam listings to check: ${listings.length}\n`);

// Check each URL's accessibility (with concurrency limit)
const CONCURRENCY = 5;
const DEAD: string[] = [];  // listing IDs to delete
const ALIVE: string[] = [];

async function checkOne(listing: { id: string; sourceUrl: string; make: string; model: string; year: number; price: number }): Promise<{ id: string; alive: boolean; status: number; finalUrl?: string }> {
  try {
    const res = await axios.get(listing.sourceUrl, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 15000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    
    // 200 = OK, detail page loaded
    // 404 = listing removed
    // 403 = Cloudflare — can't verify, treat as alive (assume it's there)
    // 301/302 = redirect (probably to listing page if listing is gone)
    
    let alive = false;
    let finalUrl = res.request?.res?.responseUrl || listing.sourceUrl;
    
    if (res.status === 200) {
      // Check if it's a detail page or got redirected to listing page
      const html = typeof res.data === 'string' ? res.data : '';
      if (html.includes('product-properties-details') || html.includes('product-price') || html.includes('application/ld+json')) {
        alive = true;
      } else if (html.includes('ikinci-el/otomobil') || html.includes('searchResults')) {
        // Redirected to listing page → listing is gone
        alive = false;
      } else {
        // Probably still a detail page
        alive = true;
      }
    } else if (res.status === 403) {
      // Cloudflare — can't tell, assume alive
      alive = true;
    } else if (res.status === 404) {
      alive = false;
    } else {
      // Other status — assume alive to be safe
      alive = true;
    }
    
    return { id: listing.id, alive, status: res.status, finalUrl };
  } catch (e: any) {
    // Network error — assume alive
    return { id: listing.id, alive: true, status: 0 };
  }
}

// Process with concurrency
let processed = 0;
const batchSize = CONCURRENCY;
for (let i = 0; i < listings.length; i += batchSize) {
  const batch = listings.slice(i, i + batchSize);
  const results = await Promise.all(batch.map(checkOne));
  
  for (const r of results) {
    processed++;
    if (r.alive) {
      ALIVE.push(r.id);
    } else {
      DEAD.push(r.id);
    }
    
    if (processed % 10 === 0 || processed === listings.length) {
      console.log(`  [${processed}/${listings.length}] Alive=${ALIVE.length} Dead=${DEAD.length} (last status: ${results[results.length - 1].status})`);
    }
  }
}

console.log(`\n=== RESULT ===`);
console.log(`Alive (accessible): ${ALIVE.length}`);
console.log(`Dead (404/redirected): ${DEAD.length}`);

// Delete dead listings
if (DEAD.length > 0) {
  console.log(`\nDeleting ${DEAD.length} dead listings...`);
  // First delete price history
  const phResult = await db.priceHistory.deleteMany({
    where: { listingId: { in: DEAD } },
  });
  console.log(`  Deleted ${phResult.count} price history entries`);
  
  // Then delete listings
  const result = await db.listing.deleteMany({
    where: { id: { in: DEAD } },
  });
  console.log(`  Deleted ${result.count} dead listings`);
}

// Final count
const finalCount = await db.listing.count({ where: { sourceName: 'arabam', isActive: true } });
console.log(`\nFinal arabam count: ${finalCount}`);

await db.$disconnect();
