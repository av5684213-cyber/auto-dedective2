import axios from 'axios';
import * as cheerio from 'cheerio';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Try different Wayback URL formats for the same listing
const realUrl = 'https://www.arabam.com/ilan/galeriden-satilik-bmw-5-serisi-520d-m-sport/atik-motors-2012-degisensiz-kusursuz-nbt-m-direksiyon-makam-vs/27277069';

const waybackUrls = [
  `https://web.archive.org/web/2025/${realUrl}`,
  `https://web.archive.org/web/2024/${realUrl}`,
  `https://web.archive.org/web/20241221/${realUrl}`,
];

for (const wurl of waybackUrls) {
  console.log(`\n=== Trying: ${wurl.substring(0, 120)}... ===`);
  try {
    const res = await axios.get(wurl, {
      headers: { 'User-Agent': UA },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    console.log(`  HTTP ${res.status}, length: ${res.data?.length || 0}`);
    if (res.status === 200 && res.data.length > 50000) {
      const $ = cheerio.load(res.data);
      // Check what's actually in the page
      console.log(`  Title: ${$('title').text().trim().substring(0, 100)}`);
      console.log(`  .product-name-container: ${$('.product-name-container').length}`);
      console.log(`  .product-price: ${$('.product-price').length}`);
      console.log(`  .property-item: ${$('.property-item').length}`);
      console.log(`  .product-properties-details: ${$('.product-properties-details').length}`);
      console.log(`  #tab-description: ${$('#tab-description').length}`);
      console.log(`  .swiper-slide img: ${$('.swiper-slide img').length}`);
      console.log(`  .advert-owner-name: ${$('.advert-owner-name').length}`);
      console.log(`  .product-location: ${$('.product-location').length}`);
      
      // Check JSON-LD
      let jsonldCount = 0;
      let hasVehicleJsonLd = false;
      $('script[type="application/ld+json"]').each((_, el) => {
        jsonldCount++;
        const text = $(el).text();
        if (text.includes('"Vehicle"') || text.includes('"Car"')) {
          hasVehicleJsonLd = true;
          console.log(`  ✓ Vehicle JSON-LD found!`);
          try {
            const parsed = JSON.parse(text);
            console.log(`    Preview: ${JSON.stringify(parsed).substring(0, 500)}`);
          } catch {}
        }
      });
      console.log(`  JSON-LD scripts: ${jsonldCount}, Vehicle: ${hasVehicleJsonLd}`);
      
      // Check if page is wayback error
      if (res.data.includes('Wayback Machine') && res.data.includes('not been archived')) {
        console.log(`  ⚠️ Wayback says: not archived`);
      }
      
      break; // Stop after first successful
    } else if (res.status === 404) {
      console.log(`  404 - no snapshot`);
    }
  } catch (e: any) {
    console.log(`  Error: ${e.message.substring(0, 80)}`);
  }
}
