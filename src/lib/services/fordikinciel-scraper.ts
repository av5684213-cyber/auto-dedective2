import axios, { type AxiosRequestConfig } from 'axios';
import * as cheerio from 'cheerio';
import type { ListingRaw } from '@/lib/adapters/base';

const BASE_URL = 'https://www.fordikinciel.com';
const UA = 'OtodedektifBot/1.0';

const KNOWN_MAKES = ['bmw','mercedes','audi','volkswagen','vw','toyota','honda','hyundai','ford','renault','fiat','peugeot','opel','citroen','volvo','mazda','nissan','kia','skoda','seat','suzuki','mitsubishi','chevrolet','jeep','lexus','infiniti','dacia','tofas','chery','mini','land-rover','range-rover','cupra','byd','daihatsu','ds_automobiles','alfa_romeo'];
const MAKE_MAP: Record<string,string> = {'vw':'Volkswagen','mercedes':'Mercedes-Benz','bmw':'BMW','audi':'Audi','toyota':'Toyota','honda':'Honda','hyundai':'Hyundai','ford':'Ford','renault':'Renault','fiat':'Fiat','peugeot':'Peugeot','opel':'Opel','citroen':'Citroen','volvo':'Volvo','mazda':'Mazda','nissan':'Nissan','kia':'Kia','skoda':'Skoda','seat':'Seat','suzuki':'Suzuki','mitsubishi':'Mitsubishi','chevrolet':'Chevrolet','jeep':'Jeep','lexus':'Lexus','infiniti':'Infiniti','dacia':'Dacia','tofas':'Tofaş','chery':'Chery','mini':'Mini','land-rover':'Land Rover','range-rover':'Land Rover','cupra':'Cupra','byd':'BYD','daihatsu':'Daihatsu','ds_automobiles':'DS Automobiles','alfa_romeo':'Alfa Romeo'};
const FUEL_MAP: Record<string,string> = {'benzin':'Benzin','dizel':'Dizel','lpg':'Benzin + LPG','elektrik':'Elektrik','hibrit':'Hybrid'};
const TRANS_MAP: Record<string,string> = {'otomatik':'Otomatik','manuel':'Manuel','yarı_otomatik':'Yarı Otomatik'};
const PRICE_RE = /([0-9]{1,3}(?:\.[0-9]{3})+)\s*TL/;

function cfg(): AxiosRequestConfig { return { timeout: 15000, headers: { 'User-Agent': UA } }; }

function parseUrl(url: string) {
  const m = url.match(/\/([^/]+)-araba-(\d+)$/);
  if (!m) return null;
  const parts = m[1].split('-');
  const mi = parts.findIndex(p => KNOWN_MAKES.includes(p.toLowerCase()));
  if (mi === -1) return null;
  const make = MAKE_MAP[parts[mi].toLowerCase()] || parts[mi];
  let year = 0, yi = -1;
  for (let i = parts.length - 1; i >= 0; i--) { const y = parseInt(parts[i]); if (y >= 1990 && y <= 2030) { year = y; yi = i; break; } }
  if (!year) return null;
  const fuel = parts.find(p => FUEL_MAP[p.toLowerCase()]) ? FUEL_MAP[parts.find(p => FUEL_MAP[p.toLowerCase()])!.toLowerCase()] : undefined;
  const fi = parts.findIndex(p => FUEL_MAP[p.toLowerCase()]);
  const trans = parts.find(p => TRANS_MAP[p.toLowerCase()]) ? TRANS_MAP[parts.find(p => TRANS_MAP[p.toLowerCase()])!.toLowerCase()] : undefined;
  const ti = parts.findIndex(p => TRANS_MAP[p.toLowerCase()]);
  const ks = Math.min(...[fi, ti, yi].filter(x => x >= 0));
  const model = parts.slice(mi + 1, ks).join(' ').replace(/_/g, ' ').trim();
  return { make, model: model || 'Bilinmiyor', year, fuelType: fuel, transmission: trans };
}

export async function bulkScrapeFordikinciel(maxListings: number = 200) {
  const allUrls = new Set<string>();
  for (let p = 1; p <= 20; p++) {
    try {
      const res = await axios.get(`${BASE_URL}/araba-fiyatlari?p=${p}`, cfg());
      const matches = res.data.match(/href="(/[^"]*-araba-\d+)"/g) || [];
      matches.forEach((m: string) => { const url = m.match(/href="([^"]+)"/)?.[1]; if (url) allUrls.add(`${BASE_URL}${url}`); });
    } catch { break; }
  }

  const parsed = [...allUrls].map(u => ({ url: u, slug: parseUrl(u) })).filter(x => x.slug).slice(0, maxListings);
  const listings: ListingRaw[] = [];
  const queue = [...parsed];
  const workers: Promise<void>[] = [];
  for (let w = 0; w < 8; w++) {
    workers.push((async () => {
      while (queue.length) {
        const item = queue.shift(); if (!item) break;
        try {
          const res = await axios.get(item.url, cfg());
          const prices = res.data.match(PRICE_RE);
          const price = prices ? parseInt(prices[1].replace(/\./g, '')) : 0;
          if (price < 10000) continue;
          const imgM = res.data.match(/<img[^>]+src="([^"]*\.(?:jpg|png|webp)[^"]*)"/i);
          let img = imgM?.[1]; if (img?.startsWith('/')) img = `${BASE_URL}${img}`;
          listings.push({ sourceName: 'fordikinciel', sourceUrl: item.url, make: item.slug!.make, model: item.slug!.model, year: item.slug!.year, price, currency: 'TRY', fuelType: item.slug!.fuelType, transmission: item.slug!.transmission, sellerType: 'Galeri', imageUrl: img, imageUrls: img ? [img] : [] });
        } catch {}
      }
    })());
  }
  await Promise.all(workers);
  return { listings, totalUrls: allUrls.size };
}
