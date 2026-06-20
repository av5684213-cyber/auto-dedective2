// apps/scraper/src/normalizer.ts

import { ListingRaw } from '../adapters/base';
import { RawListing } from '@/lib/types';

export class Normalizer {
  // Tüm Türkiye pazarına uygun normalizasyon
  static normalize(raw: ListingRaw): any {
    return {
      sourceName: raw.sourceName,
      sourceUrl: raw.sourceUrl,
      vin: raw.vin || null,
      make: this.normalizeMake(raw.make),
      model: this.normalizeModel(raw.model),
      trim: raw.trim || null,
      year: raw.year,
      price: raw.price,
      currency: raw.currency || 'TRY',
      mileageKm: raw.mileageKm || null,
      fuelType: this.normalizeFuel(raw.fuelType ?? ''),
      transmission: this.normalizeTransmission(raw.transmission ?? ''),
      bodyType: this.normalizeBodyType(raw.bodyType ?? ''),
      color: raw.color || null,
      city: this.normalizeCity(raw.city ?? ''),
      district: raw.district || null,
      sellerType: this.normalizeSellerType(raw.sellerType ?? ''),
      imageUrl: raw.imageUrl || null,
      imageUrls: raw.imageUrls || [],
      description: raw.description || null,
      firstSeenAt: raw.firstSeenAt || new Date(),
      lastSeenAt: raw.lastSeenAt || new Date(),
      isActive: raw.isActive !== undefined ? raw.isActive : true
    };
  }

  // Şehir normalizasyonu (Türkiye için)
  private static normalizeCity(value: string): string {
    if (!value) return '';
    const map: Record<string, string> = {
      'istanbul': 'istanbul',
      'ankara': 'ankara',
      'izmir': 'izmir',
      'antalya': 'antalya',
      'bursa': 'bursa',
      'adana': 'adana',
      'konya': 'konya',
      'gaziantep': 'gaziantep',
      'mersin': 'mersin',
      'kayseri': 'kayseri',
      'eskişehir': 'eskisehir',
      'malatya': 'malatya',
      'samsun': 'samsun',
      'trabzon': 'trabzon',
      'erzurum': 'erzurum',
      'diyarbakır': 'diyarbakir',
      'şanlıurfa': 'sanliurfa',
      'kocaeli': 'kocaeli',
      'sakarya': 'sakarya',
      'denizli': 'denizli'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  // Marka normalizasyonu (genişletilmiş)
  static normalizeMake(value: string): string {
    if (!value) return '';
    const map: Record<string, string> = {
      'ford': 'ford',
      'opel': 'opel',
      'vw': 'volkswagen',
      'volkswagen': 'volkswagen',
      'bmw': 'bmw',
      'mercedes': 'mercedes-benz',
      'mercedes-benz': 'mercedes-benz',
      'audi': 'audi',
      'toyota': 'toyota',
      'renault': 'renault',
      'fiat': 'fiat',
      'hyundai': 'hyundai',
      'nissan': 'nissan',
      'honda': 'honda',
      'peugeot': 'peugeot',
      'citroen': 'citroen',
      'skoda': 'skoda',
      'seat': 'seat',
      'kia': 'kia',
      'mazda': 'mazda',
      'volvo': 'volvo',
      'land rover': 'land-rover',
      'jaguar': 'jaguar',
      'porsche': 'porsche',
      'ferrari': 'ferrari',
      'lamborghini': 'lamborghini',
      'maserati': 'maserati',
      'bentley': 'bentley',
      'rolls-royce': 'rolls-royce',
      'mini': 'mini',
      'smart': 'smart',
      'subaru': 'subaru',
      'suzuki': 'suzuki',
      'mitsubishi': 'mitsubishi',
      'dacia': 'dacia',
      'chery': 'chery',
      'togg': 'togg',
      'tesla': 'tesla',
      'alfa romeo': 'alfa-romeo',
      'abarth': 'abarth',
      'lancia': 'lancia',
      'dodge': 'dodge',
      'chevrolet': 'chevrolet',
      'chrysler': 'chrysler',
      'jeep': 'jeep',
      'cadillac': 'cadillac',
      'infiniti': 'infiniti',
      'acura': 'acura',
      'lexus': 'lexus',
      'mg': 'mg'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  static normalizeModel(value: string): string {
    if (!value) return '';
    const map: Record<string, string> = {
      'focus': 'focus',
      'corsa': 'corsa',
      'astra': 'astra',
      'insignia': 'insignia',
      'golf': 'golf',
      'passat': 'passat',
      'polo': 'polo',
      '3 serisi': '3-series',
      '5 serisi': '5-series',
      'a3': 'a3',
      'a4': 'a4',
      'a6': 'a6',
      'corolla': 'corolla',
      'camry': 'camry',
      'megane': 'megane',
      'clio': 'clio',
      'punto': 'punto',
      'egea': 'egea'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  static normalizeFuel(value: string): string {
    if (!value) return 'unknown';
    const map: Record<string, string> = {
      'benzin': 'petrol',
      'dizel': 'diesel',
      'lpg': 'lpg',
      'elektrik': 'electric',
      'hibrit': 'hybrid',
      'benzin+lpg': 'petrol-lpg'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  static normalizeTransmission(value: string): string {
    if (!value) return 'unknown';
    const map: Record<string, string> = {
      'manuel': 'manual',
      'otomatik': 'automatic',
      'yarı otomatik': 'semi-automatic',
      'cvt': 'cvt',
      'dsg': 'dsg',
      'triptonic': 'triptonic'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  static normalizeBodyType(value: string): string {
    if (!value) return 'unknown';
    const map: Record<string, string> = {
      'sedan': 'sedan',
      'hatchback': 'hatchback',
      'suv': 'suv',
      'pick-up': 'pickup',
      'coupe': 'coupe',
      'cabrio': 'convertible',
      'station wagon': 'station-wagon',
      'minivan': 'minivan',
      'mpv': 'mpv'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }

  static normalizeSellerType(value: string): string {
    if (!value) return 'unknown';
    const map: Record<string, string> = {
      'sahibinden': 'private',
      'galeri': 'dealer',
      'kurumsal': 'corporate',
      'firma': 'corporate',
      'yetkili bayi': 'authorized-dealer'
    };
    return map[value.toLowerCase().trim()] || value.toLowerCase().trim();
  }
}

/**
 * Convenience wrapper: normalize a RawListing (from DB/types) into a shape
 * ready for upsert. Accepts both ListingRaw (adapter) and RawListing (types).
 */
export function normalizeListing(raw: RawListing | ListingRaw): Record<string, unknown> {
  // ListingRaw and RawListing share the same fields; Normalizer.normalize expects ListingRaw
  return Normalizer.normalize(raw as ListingRaw);
}
