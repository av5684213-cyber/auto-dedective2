import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function scrapeLetgo() {
  console.log("\n🚗 LETGO - Gerçek Scraping Testi\n");
  
  const res = await axios.get('https://www.letgo.com/araba_c15705', {
    headers: {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
    },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  
  // Check for __NEXT_DATA__ (Next.js SSR data)
  let nextData: any = null;
  $('script').each((_: any, el: any) => {
    const text = $(el).text() || '';
    if (text.includes('__NEXT_DATA__')) {
      try {
        const match = text.match(/__NEXT_DATA__\s*=\s*({.+?})\s*;?\s*$/s);
        if (match) nextData = JSON.parse(match[1]);
      } catch {}
    }
  });

  if (nextData) {
    console.log("📦 __NEXT_DATA__ bulundu!");
    const props = nextData.props?.pageProps;
    if (props) {
      console.log(`   Page keys: ${Object.keys(props).join(', ')}`);
      // Try to find listings in the data
      const searchStr = JSON.stringify(props).substring(0, 500);
      console.log(`   Data preview: ${searchStr}`);
    }
  }

  // Try to extract from HTML directly
  console.log("\n📋 HTML'den İlan Çıkarma:");
  
  // Find all links that look like listings
  const listingLinks: string[] = [];
  $('a[href*="/item/"], a[href*="/araba/"], a[href*="ilan"]').each((_: any, el: any) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().substring(0, 50);
    if (href && !listingLinks.includes(href)) {
      listingLinks.push(href);
      if (listingLinks.length <= 10) {
        console.log(`   🔗 ${href}`);
        console.log(`      "${text}"`);
      }
    }
  });
  console.log(`   Toplam link: ${listingLinks.length}`);

  // Find price patterns
  console.log("\n💰 Fiyat Kalıpları:");
  const pricePatterns = res.data.match(/[0-9]{1,3}(\.[0-9]{3})*(\s*)(₺|TL|TRY)/g) || [];
  const uniquePrices = [...new Set(pricePatterns)].slice(0, 10);
  console.log(`   Bulunan fiyatlar: ${uniquePrices.join(', ')}`);

  // Find car brand mentions
  console.log("\n🚘 Marka Adları:");
  const brands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Toyota', 'Honda', 'Hyundai', 
                   'Ford', 'Renault', 'Fiat', 'Peugeot', 'Opel', 'Volvo', 'Kia', 'Nissan',
                   'Skoda', 'Seat', 'Mazda', 'Mini', 'Jeep'];
  const foundBrands: Record<string, number> = {};
  for (const brand of brands) {
    const regex = new RegExp(brand, 'gi');
    const matches = res.data.match(regex);
    if (matches) foundBrands[brand] = matches.length;
  }
  for (const [brand, count] of Object.entries(foundBrands).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${brand}: ${count} geçim`);
  }
}

scrapeLetgo().catch(console.error);
