import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const TESTS = [
  { name: 'Letgo', url: 'https://www.letgo.com/araba_c15705' },
  { name: 'VavaCars', url: 'https://www.vavacars.com' },  // SPA, needs JS
  { name: 'PertDunyasi', url: 'https://www.pertdunyasi.com/wincar' },
  { name: 'PertDunyasi Araçlar', url: 'https://www.pertdunyasi.com/wincar/araclar' },
];

async function test() {
  console.log("\n🚗 Derin Scraping Testi - Gerçek İlan Sayfaları\n");
  console.log("Kaynak             │ HTTP │ HTML Boyutu │ Başlık                       │ İlan Kartı");
  console.log("───────────────────┼──────┼─────────────┼──────────────────────────────┼────────────────");

  for (const t of TESTS) {
    try {
      const res = await axios.get(t.url, {
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'tr-TR,tr;q=0.9,en;q=0.8',
        },
        timeout: 15000,
        maxRedirects: 5,
        validateStatus: () => true,
      });

      const html: string = res.data || '';
      const $ = cheerio.load(html);
      const title = $('title').text().trim().substring(0, 29) || '—';

      // Try many selectors
      const selectors = [
        '.car-card', '.vehicle-card', '.listing-item', '.listing-card', '.feed-card',
        '.ad-item', '.product-card', '.item-card', '.ad-card', '.classified-item',
        '[class*="listing"]', '[class*="vehicle"]', '[class*="car-"]', '[class*="product"]',
        '[class*="feed-item"]', '[class*="search-result"]', '[data-testid*="card"]',
        '[data-testid*="listing"]', '[data-testid*="item"]', 'article', '.card',
      ];

      let found = '—';
      for (const sel of selectors) {
        try {
          const els = $(sel);
          if (els.length > 0 && els.length < 500) {
            found = `${sel} → ${els.length} adet`;
            break;
          }
        } catch {}
      }

      // Also check for JSON data in script tags (common in SPAs)
      let jsonData = '';
      $('script').each((_: any, el: any) => {
        const text = $(el).text() || '';
        if (text.includes('__NEXT_DATA__') || text.includes('__NUXT__') || text.includes('"listings"')) {
          const preview = text.substring(0, 80).replace(/\n/g, ' ');
          jsonData = `📦 JSON data bulundu: ${preview}...`;
        }
      });

      const httpStr = `${res.status}`.padEnd(4);
      const sizeStr = html.length.toLocaleString().padStart(9);
      console.log(`${t.name.padEnd(19)}│ ${httpStr} │ ${sizeStr} │ ${title.padEnd(29)}│ ${found}`);
      if (jsonData) {
        console.log(`                    │      │             │                              │ ${jsonData.substring(0, 60)}`);
      }

    } catch (err: any) {
      console.log(`${t.name.padEnd(19)}│ HATA │           — │ —                            │ ${err.message.substring(0, 30)}`);
    }
  }
  console.log("───────────────────┴──────┴─────────────┴──────────────────────────────┴────────────────\n");
}

test();
