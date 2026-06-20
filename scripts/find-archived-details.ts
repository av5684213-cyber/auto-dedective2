import axios from 'axios';
import fs from 'fs';

// Query CDX API for /ilan/{slug}/{dealer}/{id} URLs archived in 2025+
// Filter to only 200 OK responses
const cdxUrl = 'https://web.archive.org/cdx/search/cdx?url=arabam.com/ilan/galeriden-satilik-*&output=json&limit=500&from=20250601&filter=statuscode:200&collapse=urlkey';

console.log('Querying CDX for archived detail pages...');
const res = await axios.get(cdxUrl, { timeout: 60000 });
const entries = (res.data as any[][]).slice(1);
console.log(`Found ${entries.length} total entries`);

// Filter for real listing detail URLs (must have /ilan/{type}-satilik-{slug}/{dealer}/{id})
const detailUrls: { timestamp: string; url: string; id: string }[] = [];
const seen = new Set<string>();
for (const row of entries) {
  const url: string = row[2];
  const m = url.match(/^https?:\/\/(?:www\.)?arabam\.com\/ilan\/(galeriden|sahibinden)-satilik-[^/]+\/[^/]+\/(\d+)\/?$/);
  if (m && !seen.has(url)) {
    seen.add(url);
    detailUrls.push({ timestamp: row[1], url, id: m[2] });
  }
}
console.log(`Unique listing detail URLs: ${detailUrls.length}`);
detailUrls.slice(0, 30).forEach((d, i) => {
  console.log(`  ${i+1}. ${d.timestamp} - ${d.url}`);
});

fs.writeFileSync('/tmp/archived-details.json', JSON.stringify(detailUrls, null, 2));
console.log(`\nSaved to /tmp/archived-details.json`);
