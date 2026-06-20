import { LetgoAdapter } from '../src/lib/adapters/letgo';

async function check() {
  const adapter = new LetgoAdapter();
  const result = await adapter.search({});
  
  console.log(`Toplam dönen ilan: ${result.listings.length}`);
  
  // Check for duplicate sourceUrls
  const urls = result.listings.map(l => l.sourceUrl);
  const uniqueUrls = new Set(urls);
  console.log(`Benzersiz URL: ${uniqueUrls.size}`);
  console.log(`Duplicate URL: ${urls.length - uniqueUrls.size}`);
  
  // Show first 10
  console.log('\nİlk 10 ilan:');
  for (const l of result.listings.slice(0, 10)) {
    console.log(`  ${l.make} ${l.model} ${l.year} - ${l.price.toLocaleString('tr-TR')} ₺ - ${l.sourceUrl}`);
  }
  
  // Show URL distribution
  const urlCounts: Record<string, number> = {};
  for (const u of urls) {
    urlCounts[u] = (urlCounts[u] || 0) + 1;
  }
  const dupes = Object.entries(urlCounts).filter(([_, c]) => c > 1);
  console.log(`\nDuplicate URL'ler: ${dupes.length}`);
  for (const [url, count] of dupes.slice(0, 5)) {
    console.log(`  ${url}: ${count} kez`);
  }
}

check().catch(console.error);
