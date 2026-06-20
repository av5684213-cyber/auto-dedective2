import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function scrapeLetgoCars() {
  console.log("\n🚗 LETGO - Gerçek Araç İlanlarını Çekme\n");
  
  // Letgo arabalar kategorisi
  const res = await axios.get('https://www.letgo.com/arabalar_c15706', {
    headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
    timeout: 15000,
  });
  
  const $ = cheerio.load(res.data);
  console.log(`HTML boyutu: ${res.data.length.toLocaleString()} karakter`);
  console.log(`Başlık: ${$('title').text().trim()}`);
  
  // Find listing cards with data-testid
  const items = $('[data-testid*="item"]');
  console.log(`\n[data-testid*="item"] eleman sayısı: ${items.length}`);
  
  // Try to extract structured data from each card
  const listings: any[] = [];
  
  items.each((idx, el) => {
    const $el = $(el);
    
    // Get all text content
    const allText = $el.text().trim();
    
    // Find link
    const link = $el.find('a[href*="/item/"]').first().attr('href') || '';
    
    // Find image
    const img = $el.find('img').first();
    const imgSrc = img.attr('src') || img.attr('data-src') || '';
    const alt = img.attr('alt') || '';
    
    // Find price (look for ₺ or TL)
    let price = 0;
    const priceText = $el.find('[class*="price"]').first().text().trim();
    if (priceText) {
      const numMatch = priceText.replace(/[^0-9.,]/g, '').replace(/\./g, '').replace(/,/g, '.');
      price = parseFloat(numMatch) || 0;
    }
    
    // Try to get price from allText
    if (!price) {
      const priceMatch = allText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*(₺|TL)/);
      if (priceMatch) {
        price = parseInt(priceMatch[1].replace(/\./g, '')) || 0;
      }
    }
    
    // Get title
    const title = alt || $el.find('h2, h3, [class*="title"]').first().text().trim();
    
    if (link || title) {
      listings.push({
        title: title.substring(0, 80),
        link,
        price,
        imgSrc: imgSrc.substring(0, 80),
        allText: allText.substring(0, 120),
      });
    }
  });
  
  console.log(`\n📋 Çıkarılan İlanlar (${listings.length}):\n`);
  for (const l of listings.slice(0, 20)) {
    console.log(`  🚗 ${l.title}`);
    console.log(`     Fiyat: ${l.price ? l.price.toLocaleString('tr-TR') + ' ₺' : '—'}`);
    console.log(`     Link: ${l.link}`);
    console.log(`     Metin: ${l.allText.substring(0, 80)}`);
    console.log();
  }

  // Also check __NEXT_DATA__ for structured data
  console.log("📦 __NEXT_DATA__ Kontrolü:");
  $('script').each((_, el) => {
    const text = $(el).text() || '';
    if (text.includes('__NEXT_DATA__')) {
      try {
        const jsonStr = text.replace(/^.*__NEXT_DATA__\s*=\s*/, '').replace(/;?\s*$/, '');
        const data = JSON.parse(jsonStr);
        const pp = data?.props?.pageProps;
        if (pp) {
          // Recursively find arrays with items
          const findArrays = (obj: any, path: string, depth: number) => {
            if (depth > 6 || !obj) return;
            if (Array.isArray(obj) && obj.length > 2) {
              const sample = obj[0];
              if (typeof sample === 'object' && sample !== null) {
                const keys = Object.keys(sample);
                console.log(`  ${path}: Array[${obj.length}] keys=${keys.slice(0,10).join(',')}`);
                if (keys.some(k => ['price','title','name','imageUrl','id','itemId','categoryId'].includes(k))) {
                  console.log(`  ✅ İlan dizisi bulundu! ${obj.length} ilan`);
                  console.log(`  Örnek: ${JSON.stringify(sample).substring(0, 300)}`);
                }
              }
            }
            if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null) {
              for (const [k, v] of Object.entries(obj)) {
                findArrays(v, `${path}.${k}`, depth + 1);
              }
            }
          };
          findArrays(pp, 'pageProps', 0);
        }
      } catch (e: any) {
        console.log(`  Parse hatası: ${e.message.substring(0, 50)}`);
      }
    }
  });
}

scrapeLetgoCars().catch(console.error);
