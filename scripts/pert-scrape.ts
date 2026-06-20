import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function scrapePert() {
  console.log("\n🔧 PERT DÜNYASI - Gerçek Scraping Testi\n");
  
  const res = await axios.get('https://www.pertdunyasi.com', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
    timeout: 15000,
  });

  const $ = cheerio.load(res.data);
  
  console.log("📋 Sayfa Yapısı:");
  console.log(`   Başlık: ${$('title').text().trim()}`);
  console.log(`   HTML Boyutu: ${res.data.length.toLocaleString()} karakter`);
  
  // Find listing-like elements
  const listingItems: { title: string; link: string; price?: string }[] = [];
  $('[class*="listing"] a, [class*="vehicle"] a, [class*="car"] a, .card a').each((_: any, el: any) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().substring(0, 60);
    if (text && href && text.length > 5) {
      listingItems.push({ title: text, link: href });
    }
  });

  console.log(`\n🔗 Bulunan İlan/Bağlantı Elemanları (${listingItems.length}):`);
  for (const item of listingItems.slice(0, 8)) {
    console.log(`   "${item.title}"`);
    console.log(`     → ${item.link}`);
  }

  // Price patterns
  const prices = res.data.match(/[0-9]{1,3}(\.[0-9]{3})*(\s*)(₺|TL|TRY)/g) || [];
  const uniquePrices = [...new Set(prices)].slice(0, 8);
  console.log(`\n💰 Fiyatlar: ${uniquePrices.join(', ')}`);

  // Brand mentions
  console.log("\n🚘 Marka Adları:");
  const brands = ['BMW', 'Mercedes', 'Audi', 'Volkswagen', 'Toyota', 'Hyundai', 'Ford', 'Renault', 'Fiat', 'Opel', 'Honda'];
  for (const brand of brands) {
    const count = (res.data.match(new RegExp(brand, 'gi')) || []).length;
    if (count > 0) console.log(`   ${brand}: ${count} geçim`);
  }
}

scrapePert().catch(console.error);
