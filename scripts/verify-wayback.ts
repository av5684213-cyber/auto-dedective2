import axios from 'axios';
import { db } from '@/lib/db';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const listings = await db.listing.findMany({
  where: { sourceName: 'arabam', isActive: true },
  select: { id: true, sourceUrl: true, make: true, model: true, year: true, price: true },
});
console.log(`Verifying ${listings.length} arabam listings via Wayback CDX...\n`);

// Extract listing ID from URL
function extractId(url: string): string | null {
  const m = url.match(/\/(\d+)(?:\/?$)/);
  return m ? m[1] : null;
}

// Check CDX API if this URL has any snapshot
async function hasWaybackSnapshot(url: string): Promise<boolean> {
  try {
    const cdxUrl = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&limit=1&filter=statuscode:200`;
    const res = await axios.get(cdxUrl, { timeout: 20000 });
    const data = res.data as any[];
    return data.length > 1; // First row is header
  } catch {
    return false;
  }
}

const VERIFIED: string[] = [];
const UNVERIFIED: string[] = [];
const CONCURRENCY = 5;
let processed = 0;

async function verifyOne(listing: any): Promise<void> {
  const hasSnapshot = await hasWaybackSnapshot(listing.sourceUrl);
  if (hasSnapshot) {
    VERIFIED.push(listing.id);
  } else {
    UNVERIFIED.push(listing.id);
  }
  processed++;
  if (processed % 5 === 0 || processed === listings.length) {
    console.log(`  [${processed}/${listings.length}] Verified=${VERIFIED.length} Unverified=${UNVERIFIED.length}`);
  }
}

// Process with concurrency
for (let i = 0; i < listings.length; i += CONCURRENCY) {
  const batch = listings.slice(i, i + CONCURRENCY);
  await Promise.all(batch.map(verifyOne));
}

console.log(`\n=== RESULT ===`);
console.log(`Verified (has Wayback snapshot = was live): ${VERIFIED.length}`);
console.log(`Unverified (no snapshot = may be removed): ${UNVERIFIED.length}`);

// Delete unverified listings
if (UNVERIFIED.length > 0) {
  console.log(`\nDeleting ${UNVERIFIED.length} unverified listings...`);
  await db.priceHistory.deleteMany({ where: { listingId: { in: UNVERIFIED } } });
  const result = await db.listing.deleteMany({ where: { id: { in: UNVERIFIED } } });
  console.log(`✓ Deleted ${result.count} unverified listings`);
}

const finalCount = await db.listing.count({ where: { sourceName: 'arabam', isActive: true } });
console.log(`\nFinal arabam count: ${finalCount}`);

await db.$disconnect();
