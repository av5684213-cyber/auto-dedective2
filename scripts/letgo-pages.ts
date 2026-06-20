import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

interface ScrapedListing {
  sourceName: string;
  sourceUrl: string;
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number | null;
  city: string | null;
  imageUrl: string | null;
  sellerType: string | null;
}

async function scrapeAllLetgoPages() {
  const allListings: ScrapedListing[] = [];
  
  // Try multiple pages
  for (let page = 0; page < 5; page++) {
    const offset = page * 26;
    let url = 'https://www.letgo.com/arabalar_c15706';
    if (page > 0) url += `?offset=${offset}`;
    
    console.log(`\n📄 Sayfa ${page + 1}: ${url}`);
    
    try {
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA, 'Accept-Language': 'tr-TR,tr;q=0.9' },
        timeout: 20000,
      });
      
      const $ = cheerio.load(res.data);
      const items = $('[data-testid*="item"]');
      console.log(`   ${items.length} ilan kartı bulundu`);
      
      if (items.length === 0) {
        console.log("   Daha fazla sayfa yok, durduruluyor.");
        break;
      }
      
      items.each((_, el) => {
        const $el = $(el);
        const allText = $el.text().trim();
        
        // Link
        const link = $el.find('a[href*="/item/"]').first().attr('href') || '';
        
        // Image
        const img = $el.find('img').first();
        const imgSrc = img.attr('src') || '';
        const alt = img.attr('alt') || '';
        
        // Title from alt text (format: "Renault MEGANE")
        const titleStr = alt || '';
        const parts = titleStr.split(' ');
        const make = parts[0] || '';
        const model = parts.slice(1).join(' ') || '';
        
        // Price - find pattern like "485.000 TL" or "1.250.000 TL"
        const priceMatch = allText.match(/([0-9]{1,3}(\.[0-9]{3})+)\s*TL/);
        let price = 0;
        if (priceMatch) {
          price = parseInt(priceMatch[1].replace(/\./g, '')) || 0;
        }
        
        // Year and KM - pattern like "2008 - 311.000 KM" or "2016 - 170.000 KM"
        const yearKmMatch = allText.match(/(\d{4})\s*-\s*([0-9.]+)\s*KM/);
        let year = 0;
        let mileageKm: number | null = null;
        if (yearKmMatch) {
          year = parseInt(yearKmMatch[1]) || 0;
          mileageKm = parseInt(yearKmMatch[2].replace(/\./g, '')) || null;
        }
        
        // City
        const cityMatch = allText.match(/(İstanbul|Ankara|İzmir|Bursa|Antalya|Adana|Konya|Gaziantep|Mersin|Kayseri|Eskişehir|Samsun|Denizli|Trabzon|Muğla|Aydın|Balıkesir)/);
        const city = cityMatch ? cityMatch[1] : null;
        
        // Seller type
        const isPlus = allText.includes('Plus Satıcı');
        const sellerType = isPlus ? 'Galeri' : 'Sahibinden';
        
        if (make && price > 0) {
          allListings.push({
            sourceName: 'letgo',
            sourceUrl: link ? `https://www.letgo.com${link}` : '',
            make, model, year, price, mileageKm, city,
            imageUrl: imgSrc || null,
            sellerType,
          });
        }
      });
      
      // Be polite - wait between pages
      if (page < 4) {
        await new Promise(r => setTimeout(r, 2000));
      }
      
    } catch (e: any) {
      console.log(`   HATA: ${e.message.substring(0, 60)}`);
      break;
    }
  }
  
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`TOPLAM: ${allListings.length} gerçek ilan Letgo'dan çekildi`);
  console.log(`${'═'.repeat(60)}\n`);
  
  // Summary
  const makes: Record<string, number> = {};
  for (const l of allListings) {
    makes[l.make] = (makes[l.make] || 0) + 1;
  }
  console.log("Marka dağılımı:");
  for (const [m, c] of Object.entries(makes).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${m}: ${c}`);
  }
  
  const avgPrice = allListings.reduce((s, l) => s + l.price, 0) / (allListings.length || 1);
  console.log(`\nOrtalama fiyat: ${Math.round(avgPrice).toLocaleString('tr-TR')} ₺`);
  console.log(`Fiyat aralığı: ${Math.min(...allListings.map(l => l.price)).toLocaleString('tr-TR')} ₺ - ${Math.max(...allListings.map(l => l.price)).toLocaleString('tr-TR')} ₺`);
  
  return allListings;
}

scrapeAllLetgoPages();
