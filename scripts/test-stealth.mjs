import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

const browser = await chromium.launch({
  headless: false,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled',
  ],
});

const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  locale: 'tr-TR',
  timezoneId: 'Europe/Istanbul',
});

const page = await context.newPage();

console.log('Navigating to arabam with stealth...');
await page.goto('https://www.arabam.com/ikinci-el/otomobil', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});

console.log(`Initial title: ${await page.title()}`);

// Wait for Cloudflare to pass
let passed = false;
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(5000);
  const t = await page.title();
  const h = await page.content();
  console.log(`  ${(i + 1) * 5}s: title="${t}", html=${h.length}`);
  if (!t.includes('moment') && !t.includes('dakika') && !h.includes('Cloudflare') && h.length > 50000) {
    console.log('  ✓ Cloudflare passed!');
    passed = true;
    break;
  }
}

if (passed) {
  const listings = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/ilan/"]')).slice(0, 10).map((a) => {
      const href = a.getAttribute('href') || '';
      const text = (a.textContent || '').trim().substring(0, 100);
      return { text, href };
    });
  });
  console.log(`\nListings: ${listings.length}`);
  listings.forEach((l, i) => console.log(`  ${i + 1}. ${l.text} → ${l.href}`));
} else {
  console.log('\n✗ Cloudflare not passed');
}

await browser.close();
