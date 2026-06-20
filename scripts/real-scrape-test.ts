import axios from 'axios';
import * as cheerio from 'cheerio';

const TESTS = [
  { name: 'Letgo',       url: 'https://www.letgo.com/turkiye/ikinci-el-araclar-arananlar' },
  { name: 'VavaCars',    url: 'https://www.vavacars.com/tr/ikinci-el-araba' },
  { name: 'Garenta',     url: 'https://www.garenta.com.tr/ikinci-el-arac' },
  { name: 'Sixt',        url: 'https://www.sixt.com.tr/ikinci-el-araba' },
  { name: 'PertDunyasi', url: 'https://www.pertdunyasi.com/pert-araba' },
];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function testRealScrape() {
  console.log("\n🔍 Gerçek Scraping Testi (Erişilebilir Siteler)\n");
  console.log("Kaynak       │ HTTP │ HTML Uzunluğu │ Başlık                    │ İlan Kartı Bulundu");
  console.log("─────────────┼──────┼───────────────┼───────────────────────────┼──────────────────────");

  for (const t of TESTS) {
    try {
      const res = await axios.get(t.url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const httpOk = res.status >= 200 && res.status < 400;
      const htmlLen = res.data?.length || 0;
      
      // Try to parse
      const $ = cheerio.load(res.data || '');
      const title = $('title').text().trim().substring(0, 26) || '—';
      
      // Try various selectors for car listings
      const selectors = ['.car-card', '.vehicle-card', '.listing-item', '.listing-card', 
                          '.feed-card', '.ad-item', '.product-card', '.item-card',
                          '[class*="listing"]', '[class*="vehicle"]', '[class*="car-"]'];
      
      let foundSelector = '—';
      let foundCount = 0;
      for (const sel of selectors) {
        const els = $(sel);
        if (els.length > 0) {
          foundSelector = `${sel} (${els.length})`;
          foundCount = els.length;
          break;
        }
      }

      const httpStr = httpOk ? `${res.status} OK` : `${res.status} ERR`;
      console.log(`${t.name.padEnd(13)}│ ${httpStr.padEnd(5)}│ ${(htmlLen.toLocaleString()).padStart(13)} │ ${title.padEnd(26)}│ ${foundSelector}`);

    } catch (err: any) {
      console.log(`${t.name.padEnd(13)}│ HATA │             — │ —                         │ ${err.message.substring(0, 25)}`);
    }
  }
  console.log("─────────────┴──────┴───────────────┴───────────────────────────┴──────────────────────\n");
}

testRealScrape();
