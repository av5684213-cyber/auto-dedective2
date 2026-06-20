import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

async function discover() {
  // Letgo - we know this works with cheerio
  console.log("═══ LETGO - Araba Kategorisi ═══");
  try {
    const res = await axios.get('https://www.letgo.com/araba_c15705', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 15000,
    });
    const $ = cheerio.load(res.data);
    
    // Find __NEXT_DATA__
    let listings: any[] = [];
    $('script').each((_, el) => {
      const text = $(el).text() || '';
      if (text.includes('__NEXT_DATA__')) {
        try {
          const jsonStr = text.replace(/^.*__NEXT_DATA__\s*=\s*/, '').replace(/\s*;?\s*$/, '');
          const data = JSON.parse(jsonStr);
          // Navigate the data structure to find listings
          const props = data?.props?.pageProps;
          console.log("  __NEXT_DATA__ keys:", JSON.stringify(Object.keys(props || {})));
          
          // Search for arrays that could be listings
          const searchDeep = (obj: any, path: string, depth: number) => {
            if (depth > 5 || !obj) return;
            if (Array.isArray(obj) && obj.length > 0) {
              console.log(`  📦 ${path}: Array[${obj.length}]`, typeof obj[0] === 'object' ? Object.keys(obj[0]).slice(0,8) : typeof obj[0]);
              if (obj.length > 0 && typeof obj[0] === 'object' && (obj[0].title || obj[0].name || obj[0].price || obj[0].id || obj[0].itemId)) {
                listings = obj;
                console.log(`  ✅ LISTINGS FOUND at ${path}!`);
                console.log(`  Sample:`, JSON.stringify(obj[0]).substring(0, 300));
              }
            }
            if (typeof obj === 'object' && !Array.isArray(obj)) {
              for (const [k, v] of Object.entries(obj)) {
                searchDeep(v, `${path}.${k}`, depth + 1);
              }
            }
          };
          searchDeep(props, 'pageProps', 0);
        } catch (e: any) {
          console.log("  __NEXT_DATA__ parse error:", e.message.substring(0, 50));
        }
      }
    });

    // Also try direct HTML parsing for listing cards
    console.log("\n  HTML İlan Kartları:");
    const cardSelectors = ['[class*="feed-card"]', '[class*="item-card"]', '[class*="listing"]', '[data-testid*="item"]', 'article'];
    for (const sel of cardSelectors) {
      const els = $(sel);
      if (els.length > 0) {
        console.log(`  ${sel}: ${els.length} elements`);
        // Try to extract data from first element
        const first = els.first();
        const title = first.find('a, h2, h3, [class*="title"]').first().text().trim().substring(0, 60);
        const price = first.find('[class*="price"]').first().text().trim();
        console.log(`    İlk: "${title}" ${price ? `— ${price}` : ''}`);
      }
    }

    // Find all item links
    const itemLinks: string[] = [];
    $('a[href*="/item/"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href && !itemLinks.includes(href)) itemLinks.push(href);
    });
    console.log(`  /item/ linkleri: ${itemLinks.length}`);
    if (itemLinks.length > 0) {
      console.log(`  İlk 5: ${itemLinks.slice(0, 5).join(', ')}`);
    }
  } catch (e: any) {
    console.log("  HATA:", e.message.substring(0, 60));
  }

  // Try VavaCars API
  console.log("\n═══ VAVACARS - API Keşfi ═══");
  try {
    const apiRes = await axios.get('https://www.vavacars.com/api/v1/vehicles?page=1&limit=10', {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      timeout: 10000,
      validateStatus: () => true,
    });
    console.log(`  API /vehicles: ${apiRes.status}`, typeof apiRes.data === 'object' ? JSON.stringify(apiRes.data).substring(0, 200) : String(apiRes.data).substring(0, 200));
  } catch (e: any) {
    console.log(`  API /vehicles: HATA - ${e.message.substring(0, 50)}`);
  }

  // Try VavaCars search API
  try {
    const apiRes2 = await axios.get('https://www.vavacars.com/api/v2/listings?page=1', {
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      timeout: 10000,
      validateStatus: () => true,
    });
    console.log(`  API /listings: ${apiRes2.status}`, String(typeof apiRes2.data === 'object' ? JSON.stringify(apiRes2.data) : apiRes2.data).substring(0, 200));
  } catch (e: any) {
    console.log(`  API /listings: HATA - ${e.message.substring(0, 50)}`);
  }

  // Try Garenta second-hand car page
  console.log("\n═══ GARENTA - Sayfa Keşfi ═══");
  try {
    const res = await axios.get('https://www.garenta.com.tr', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const carLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('satilik') || href.includes('ikinci') || href.includes('arac-satis') || 
          href.includes('hasarli') || href.includes('pert') || href.includes('filo-satis') ||
          href.includes('b2c') || href.includes('used')) {
        if (!carLinks.includes(href)) carLinks.push(href);
      }
    });
    console.log(`  Araç satış linkleri: ${carLinks.length > 0 ? carLinks.join(', ') : 'Bulunamadı'}`);
    
    // Check for __NEXT_DATA__
    $('script').each((_, el) => {
      const text = $(el).text() || '';
      if (text.includes('__NEXT_DATA__')) {
        console.log("  📦 __NEXT_DATA__ bulundu!");
      }
    });
  } catch (e: any) {
    console.log("  HATA:", e.message.substring(0, 60));
  }

  // Try Sixt car sales
  console.log("\n═══ SIXT - Sayfa Keşfi ═══");
  try {
    const res = await axios.get('https://www.sixt.com.tr', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    const carLinks: string[] = [];
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (href.includes('satilik') || href.includes('ikinci') || href.includes('arac-satis') || 
          href.includes('used') || href.includes('sale') || href.includes('b2c')) {
        if (!carLinks.includes(href)) carLinks.push(href);
      }
    });
    console.log(`  Araç satış linkleri: ${carLinks.length > 0 ? carLinks.join(', ') : 'Bulunamadı'}`);
  } catch (e: any) {
    console.log("  HATA:", e.message.substring(0, 60));
  }

  // Try Pert Dünyasi deeper
  console.log("\n═══ PERT DÜNYASI - İçerik Keşfi ═══");
  try {
    const res = await axios.get('https://www.pertdunyasi.com', {
      headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
      timeout: 10000,
    });
    const $ = cheerio.load(res.data);
    // Check for API calls in scripts
    const apiEndpoints: string[] = [];
    $('script').each((_, el) => {
      const text = $(el).text() || '';
      const src = $(el).attr('src') || '';
      // Look for API endpoints
      const apiMatches = text.match(/['"]\/api\/[^'"]+['"]/g) || [];
      const fetchMatches = text.match(/fetch\(['"]([^'"]+)['"]/g) || [];
      for (const m of [...apiMatches, ...fetchMatches]) {
        const clean = m.replace(/['"]/g, '').replace('fetch(', '');
        if (!apiEndpoints.includes(clean)) apiEndpoints.push(clean);
      }
    });
    console.log(`  API endpoints: ${apiEndpoints.length > 0 ? apiEndpoints.slice(0, 10).join(', ') : 'Bulunamadı'}`);
    
    // Look for wincar links
    const wincarLinks: string[] = [];
    $('a[href*="wincar"], a[href*="arac"], a[href*="ilan"]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text().trim().substring(0, 40);
      if (href && !wincarLinks.includes(href)) {
        wincarLinks.push(href);
        console.log(`  🔗 ${href} — "${text}"`);
      }
    });
  } catch (e: any) {
    console.log("  HATA:", e.message.substring(0, 60));
  }
}

discover().catch(console.error);
