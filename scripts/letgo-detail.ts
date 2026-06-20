import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function testDetail() {
  // Test a single listing detail page
  const slug = 'renault-megane-iid-1729688231';
  console.log(`\n🔍 Letgo İlan Detay Testi: ${slug}\n`);
  
  try {
    const res = await axios.get(`https://www.letgo.com/item/${slug}`, {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 15000,
    });
    
    const $ = cheerio.load(res.data);
    console.log(`HTML boyutu: ${res.data.length.toLocaleString()}`);
    console.log(`Başlık: ${$('title').text().trim()}`);
    
    // Check for __NEXT_DATA__
    $('script').each((_, el) => {
      const text = $(el).text() || '';
      if (text.includes('__NEXT_DATA__')) {
        try {
          const jsonStr = text.replace(/^.*__NEXT_DATA__\s*=\s*/, '').replace(/;?\s*$/, '');
          const data = JSON.parse(jsonStr);
          const pp = data?.props?.pageProps;
          if (pp) {
            console.log("\n📦 __NEXT_DATA__ pageProps keys:", Object.keys(pp));
            
            // Find item details
            const findItem = (obj: any, path: string, depth: number): any => {
              if (depth > 8 || !obj) return null;
              if (typeof obj === 'object' && !Array.isArray(obj) && obj !== null) {
                if (obj.title && obj.price) {
                  console.log(`\n✅ İlan objesi bulundu @ ${path}`);
                  return obj;
                }
                if (obj.name && (obj.price || obj.value)) {
                  console.log(`\n✅ İlan objesi bulundu @ ${path}`);
                  return obj;
                }
                for (const [k, v] of Object.entries(obj)) {
                  const result = findItem(v, `${path}.${k}`, depth + 1);
                  if (result) return result;
                }
              }
              return null;
            };
            
            const item = findItem(pp, 'pageProps', 0);
            if (item) {
              console.log(JSON.stringify(item, null, 2).substring(0, 1500));
            } else {
              // Print first 2000 chars of pageProps
              console.log("\npageProps önizleme:", JSON.stringify(pp).substring(0, 2000));
            }
          }
        } catch (e: any) {
          console.log(`Parse hatası: ${e.message.substring(0, 60)}`);
        }
      }
    });
  } catch (e: any) {
    console.log(`HATA: ${e.message.substring(0, 80)}`);
  }
}

testDetail();
