import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const archived = JSON.parse(fs.readFileSync('/tmp/archived-details.json', 'utf-8'));
// Pick first 3 to test
const testUrls = archived.slice(0, 3);

for (const item of testUrls) {
  const waybackUrl = `https://web.archive.org/web/${item.timestamp}/${item.url}`;
  console.log(`\n=== ${item.url.substring(50)} ===`);
  console.log(`Wayback: ${waybackUrl.substring(0, 100)}...`);
  
  try {
    const res = await axios.get(waybackUrl, {
      headers: { 'User-Agent': UA },
      timeout: 30000,
      validateStatus: () => true,
      maxRedirects: 5,
    });
    console.log(`HTTP ${res.status}, length: ${res.data?.length || 0}`);
    
    if (res.status === 200 && res.data.length > 50000) {
      const $ = cheerio.load(res.data);
      
      // Check selectors
      console.log(`  Title tag: ${$('title').text().trim().substring(0, 80)}`);
      console.log(`  .product-name-container: ${$('.product-name-container').length}`);
      console.log(`  .product-price: ${$('.product-price').length}`);
      console.log(`  .property-item: ${$('.property-item').length}`);
      console.log(`  .product-properties-details: ${$('.product-properties-details').length}`);
      console.log(`  #tab-description: ${$('#tab-description').length}`);
      console.log(`  .tab-description: ${$('.tab-description').length}`);
      console.log(`  .swiper-slide img: ${$('.swiper-slide img').length}`);
      console.log(`  .advert-owner-name: ${$('.advert-owner-name').length}`);
      console.log(`  .product-location: ${$('.product-location').length}`);
      console.log(`  table tr: ${$('tr').length}`);
      
      // JSON-LD
      let vehicleJsonLd: any = null;
      $('script[type="application/ld+json"]').each((_, el) => {
        const text = $(el).text();
        if (text.includes('"Vehicle"') || text.includes('"Car"')) {
          try {
            const parsed = JSON.parse(text);
            const arr = Array.isArray(parsed) ? parsed : [parsed];
            for (const v of arr) {
              if (v['@type'] === 'Vehicle' || v['@type'] === 'Car') {
                vehicleJsonLd = v;
                return false;
              }
            }
          } catch {}
        }
      });
      if (vehicleJsonLd) {
        console.log(`  ✓ JSON-LD Vehicle found:`);
        console.log(`    manufacturer: ${vehicleJsonLd.manufacturer}`);
        console.log(`    model: ${vehicleJsonLd.model}`);
        console.log(`    productionDate: ${vehicleJsonLd.productionDate || vehicleJsonLd.vehicleModelDate}`);
        console.log(`    mileage: ${JSON.stringify(vehicleJsonLd.mileageFromOdometer)}`);
        console.log(`    fuelType: ${vehicleJsonLd.vehicleEngine?.fuelType || vehicleJsonLd.fuelType}`);
        console.log(`    transmission: ${vehicleJsonLd.vehicleTransmission}`);
        console.log(`    color: ${vehicleJsonLd.color}`);
        console.log(`    price: ${vehicleJsonLd.offers?.price}`);
        console.log(`    name: ${vehicleJsonLd.name}`);
        console.log(`    description: ${vehicleJsonLd.description?.substring(0, 100)}`);
      } else {
        console.log(`  ✗ No Vehicle JSON-LD`);
      }
      
      // Look at first .property-item content
      if ($('.property-item').length > 0) {
        console.log(`  First 3 .property-item contents:`);
        $('.property-item').slice(0, 3).each((i, el) => {
          console.log(`    ${i+1}. ${$(el).text().replace(/\s+/g, ' ').trim().substring(0, 100)}`);
        });
      }
      
      // Dump some HTML structure to see what's there
      const body = $('body');
      console.log(`  Body classes: ${body.attr('class') || 'none'}`);
      console.log(`  Main containers: ${$('main, .main, #main, [role="main"]').length}`);
      
      // Check for h1 with title
      const h1 = $('h1').first().text().trim();
      if (h1) console.log(`  H1: ${h1.substring(0, 100)}`);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message.substring(0, 80)}`);
  }
}
