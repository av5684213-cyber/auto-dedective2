import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const TESTS = [
  { name: 'Letgo',       urls: ['https://www.letgo.com', 'https://www.letgo.com/tr', 'https://www.letgo.com/turkiye'] },
  { name: 'VavaCars',    urls: ['https://www.vavacars.com', 'https://www.vavacars.com/tr', 'https://www.vavacars.com/tr/'] },
  { name: 'Garenta',     urls: ['https://www.garenta.com.tr', 'https://www.garenta.com.tr/', 'https://www.garenta.com.tr/tr'] },
  { name: 'Sixt',        urls: ['https://www.sixt.com.tr', 'https://www.sixt.com.tr/', 'https://www.sixt.com.tr/tr'] },
  { name: 'PertDunyasi', urls: ['https://www.pertdunyasi.com', 'https://www.pertdunyasi.com/', 'https://www.pertdunyasi.com/tr'] },
  { name: 'Sahibinden',  urls: ['https://www.sahibinden.com', 'https://www.sahibinden.com/'] },
];

async function test() {
  console.log("\n🔍 Gerçek Site URL Keşfi\n");
  
  for (const t of TESTS) {
    console.log(`\n─ ${t.name} ─`);
    for (const url of t.urls) {
      try {
        const res = await axios.get(url, {
          headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
          timeout: 10000,
          maxRedirects: 5,
          validateStatus: () => true,
        });
        
        const $ = cheerio.load(res.data || '');
        const title = $('title').text().trim().substring(0, 50);
        
        // Find car-related links
        const carLinks: string[] = [];
        $('a[href]').each((_: any, el: any) => {
          const href = $(el).attr('href') || '';
          if (href.includes('araba') || href.includes('arac') || href.includes('car') || 
              href.includes('ikinci') || href.includes('vehicle') || href.includes('otomobil') ||
              href.includes('ikinci-el') || href.includes('used') || href.includes('pert') ||
              href.includes('hasar')) {
            if (carLinks.length < 5 && !carLinks.includes(href)) {
              carLinks.push(href);
            }
          }
        });
        
        console.log(`  ${url} → ${res.status} | "${title}"`);
        if (carLinks.length > 0) {
          console.log(`  🔗 Araç linkleri: ${carLinks.join(', ')}`);
        }
      } catch (err: any) {
        console.log(`  ${url} → HATA: ${err.message.substring(0, 40)}`);
      }
    }
  }
}

test();
