import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Test all known Letgo car sub-categories
const categories: [string, string][] = [
  ['otomobil-suv', 'https://www.letgo.com/otomobil-suv_c15711'],
  ['sedan', 'https://www.letgo.com/sedan-araba_c15712'],
  ['hatchback', 'https://www.letgo.com/hatchback-araba_c15713'],
  ['arazi', 'https://www.letgo.com/arazi-araci_c15714'],
  ['cabrio', 'https://www.letgo.com/cabrio-araba_c15715'],
  ['station-wagon', 'https://www.letgo.com/station-wagon_c15716'],
  ['mpv-minivan', 'https://www.letgo.com/mpv-minivan_c15717'],
  ['klasik', 'https://www.letgo.com/klasik-araba_c15718'],
  ['elektrikli', 'https://www.letgo.com/elektrikli-araba_c15743'],
  ['pickup', 'https://www.letgo.com/pickup_c15744'],
  ['ticari', 'https://www.letgo.com/ticari-arac_c15707'],
  ['minibus', 'https://www.letgo.com/otobus-minibus_c15708'],
];

const seen = new Set<string>();

for (const [name, url] of categories) {
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    
    // Use the same parsing logic as the adapter
    const items = $('[data-testid*="item"]');
    let listingsFound = 0;
    let listingsWithPrice = 0;
    let listingsWithYear = 0;
    let newCount = 0;
    
    items.each((_, el) => {
      const $el = $(el);
      const allText = $el.text().trim();
      const img = $el.find('img').first();
      const alt = img.attr('alt') || '';
      const link = $el.find('a[href*="/item/"]').first().attr('href') || '';
      
      if (!alt || alt === 'Letgo' || alt === 'chevron-down' || alt.includes('Logo') || alt.includes('Icon') || alt.includes('Damgası')) return;
      
      const priceMatch = allText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
      const yearKmMatch = allText.match(/(\d{4})\s*-\s*([0-9.]+)\s*KM/);
      
      listingsFound++;
      if (priceMatch) listingsWithPrice++;
      if (yearKmMatch) listingsWithYear++;
      
      if (link) {
        const fullUrl = `https://www.letgo.com${link}`;
        if (!seen.has(fullUrl)) {
          seen.add(fullUrl);
          newCount++;
        }
      }
    });
    
    console.log(`${name}: HTTP ${res.status}, HTML ${res.data.length}, items ${items.length}, valid ${listingsFound}, withPrice ${listingsWithPrice}, withYear ${listingsWithYear}, new ${newCount}`);
  } catch (e: any) {
    console.log(`${name}: ${e.message.substring(0, 80)}`);
  }
}

console.log(`\n=== Total unique URLs: ${seen.size} ===`);
