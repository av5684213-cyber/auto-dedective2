import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';
import { SearchFilters, SearchResult, ListingWithScore, SearchAggregations } from '@/lib/types';
import { listingsQuerySchema, safeParse, type ListingsQuery } from '@/lib/validation/schemas';
import { transformListing } from '@/lib/utils/transform-listing';
import { queryFallbackListings } from '@/lib/services/fallback-data';
import { liveScrapeLetgo } from '@/lib/services/letgo-sitemap-scraper';

// ── Helper: Parse query params with Zod ────────────────────────────────

function parseFilters(searchParams: URLSearchParams): SearchFilters {
  const raw: Record<string, string> = {};
  for (const key of searchParams.keys()) {
    const value = searchParams.get(key);
    if (value !== null) raw[key] = value;
  }

  const parsed: ListingsQuery = safeParse(
    listingsQuerySchema,
    raw,
    {
      make: undefined, model: undefined, trim: undefined,
      yearMin: undefined, yearMax: undefined,
      priceMin: undefined, priceMax: undefined,
      mileageMin: undefined, mileageMax: undefined,
      fuelType: undefined, transmission: undefined, bodyType: undefined,
      color: undefined, colorExclude: undefined,
      city: undefined, district: undefined,
      sellerType: undefined, accidentStatus: undefined,
      dealTag: undefined, dealScoreMin: undefined,
      q: undefined,
      sortBy: 'deal_score_desc', page: 1, limit: 20,
    } as ListingsQuery,
    'listingsQuery',
  );

  return {
    make: parsed.make, model: parsed.model, trim: parsed.trim,
    yearMin: parsed.yearMin, yearMax: parsed.yearMax,
    priceMin: parsed.priceMin, priceMax: parsed.priceMax,
    mileageMin: parsed.mileageMin, mileageMax: parsed.mileageMax,
    fuelType: parsed.fuelType, transmission: parsed.transmission,
    bodyType: parsed.bodyType,
    color: parsed.color, colorExclude: parsed.colorExclude,
    city: parsed.city, district: parsed.district,
    sellerType: parsed.sellerType, accidentStatus: parsed.accidentStatus,
    dealTag: parsed.dealTag, dealScoreMin: parsed.dealScoreMin,
    q: parsed.q,
    sortBy: parsed.sortBy as SearchFilters['sortBy'],
    page: parsed.page, limit: parsed.limit,
  };
}

// ── Helper: Array'i Prisma where clause'ına çevir ────────────────────────
// Boş array → filtre yok
// Tek eleman → { equals: val, mode: 'insensitive' }
// Çoklu → { in: [...], mode: 'insensitive' }
function buildMultiFilter(values: string[] | string | undefined) {
  if (!values) return undefined;
  const arr = Array.isArray(values) ? values.filter(Boolean) : [values];
  if (arr.length === 0) return undefined;
  if (arr.length === 1) return { equals: arr[0], mode: 'insensitive' as const };
  return { in: arr, mode: 'insensitive' as const };
}

// Build "içerir" filtresi (model, trim için partial match)
function buildContainsFilter(value: string | undefined) {
  if (!value) return undefined;
  return { contains: value, mode: 'insensitive' as const };
}

function getCacheKey(filters: SearchFilters): string {
  const parts: string[] = ['listings'];
  const arr = (v: any) => Array.isArray(v) ? v.join(',') : (v || '');
  if (filters.make) parts.push(`make:${arr(filters.make)}`);
  if (filters.model) parts.push(`model:${arr(filters.model)}`);
  if (filters.trim) parts.push(`trim:${filters.trim}`);
  if (filters.yearMin) parts.push(`yearMin:${filters.yearMin}`);
  if (filters.yearMax) parts.push(`yearMax:${filters.yearMax}`);
  if (filters.priceMin) parts.push(`priceMin:${filters.priceMin}`);
  if (filters.priceMax) parts.push(`priceMax:${filters.priceMax}`);
  if (filters.mileageMin) parts.push(`mileageMin:${filters.mileageMin}`);
  if (filters.mileageMax) parts.push(`mileageMax:${filters.mileageMax}`);
  if (filters.fuelType) parts.push(`fuelType:${arr(filters.fuelType)}`);
  if (filters.transmission) parts.push(`transmission:${arr(filters.transmission)}`);
  if (filters.bodyType) parts.push(`bodyType:${arr(filters.bodyType)}`);
  if (filters.color) parts.push(`color:${arr(filters.color)}`);
  if (filters.colorExclude) parts.push(`colorExclude:${arr(filters.colorExclude)}`);
  if (filters.city) parts.push(`city:${arr(filters.city)}`);
  if (filters.district) parts.push(`district:${arr(filters.district)}`);
  if (filters.sellerType) parts.push(`sellerType:${arr(filters.sellerType)}`);
  if (filters.accidentStatus) parts.push(`accidentStatus:${arr(filters.accidentStatus)}`);
  if (filters.dealTag) parts.push(`dealTag:${arr(filters.dealTag)}`);
  if (filters.dealScoreMin) parts.push(`dealScoreMin:${filters.dealScoreMin}`);
  if (filters.q) parts.push(`q:${filters.q}`);
  parts.push(`sortBy:${filters.sortBy || 'newest'}`);
  parts.push(`page:${filters.page || 1}`);
  parts.push(`limit:${filters.limit || 20}`);
  return parts.join('|');
}

function buildWhereClause(filters: SearchFilters) {
  const where: Record<string, unknown> = {
    isActive: true,
    isDeleted: false,
  };

  // Marka — çoklu seçim, case-insensitive (exact match)
  const makeFilter = buildMultiFilter(filters.make);
  if (makeFilter) where.make = makeFilter;

  // Model — HER ZAMAN partial match (contains), case-insensitive
  // "320i" yazınca "3 serisi 320i m sport" eşleşir
  // Çoklu model seçilse bile her biri contains olarak OR ile birleştirilir
  if (filters.model) {
    const models = Array.isArray(filters.model) ? filters.model.filter(Boolean) : [filters.model];
    const cleanModels = models.filter(Boolean);
    if (cleanModels.length === 1) {
      where.model = { contains: cleanModels[0], mode: 'insensitive' };
    } else if (cleanModels.length > 1) {
      // Çoklu model → OR ile contains birleştir
      if (where.OR) {
        // Mevcut OR varsa (q'dan), genişlet
        where.OR = [...where.OR, ...cleanModels.map(m => ({ model: { contains: m, mode: 'insensitive' as const } }))];
      } else {
        where.OR = cleanModels.map(m => ({ model: { contains: m, mode: 'insensitive' as const } }));
      }
    }
  }

  // Trim — partial match (contains)
  if (filters.trim) {
    where.trim = buildContainsFilter(filters.trim);
  }

  // Yıl aralığı
  if (filters.yearMin || filters.yearMax) {
    const yearCondition: Record<string, number> = {};
    if (filters.yearMin) yearCondition.gte = filters.yearMin;
    if (filters.yearMax) yearCondition.lte = filters.yearMax;
    where.year = yearCondition;
  }

  // Fiyat aralığı
  if (filters.priceMin || filters.priceMax) {
    const priceCondition: Record<string, number> = {};
    if (filters.priceMin) priceCondition.gte = filters.priceMin;
    if (filters.priceMax) priceCondition.lte = filters.priceMax;
    where.price = priceCondition;
  }

  // KM aralığı (min + max)
  if (filters.mileageMin || filters.mileageMax) {
    const kmCondition: Record<string, number> = {};
    if (filters.mileageMin) kmCondition.gte = filters.mileageMin;
    if (filters.mileageMax) kmCondition.lte = filters.mileageMax;
    where.mileageKm = kmCondition;
  }

  // Yakıt, vites, kasa — çoklu seçim
  const fuelFilter = buildMultiFilter(filters.fuelType);
  if (fuelFilter) where.fuelType = fuelFilter;

  const transFilter = buildMultiFilter(filters.transmission);
  if (transFilter) where.transmission = transFilter;

  const bodyFilter = buildMultiFilter(filters.bodyType);
  if (bodyFilter) where.bodyType = bodyFilter;

  // Renk — çoklu seçim, contains (Beyaz → "Beyaz" ve "Beyaz/Siyah" eşleşir)
  if (filters.color) {
    const colors = Array.isArray(filters.color) ? filters.color : [filters.color];
    const cleanColors = colors.filter(Boolean);
    if (cleanColors.length === 1) {
      where.color = { contains: cleanColors[0], mode: 'insensitive' };
    } else if (cleanColors.length > 1) {
      // Çoklu renk → OR ile birleştir
      where.OR = cleanColors.map(c => ({ color: { contains: c, mode: 'insensitive' as const } }));
    }
  }

  // Renk hariç tutma — NOT (color in [...])
  if (filters.colorExclude) {
    const excludeColors = Array.isArray(filters.colorExclude) ? filters.colorExclude : [filters.colorExclude];
    const cleanExclude = excludeColors.filter(Boolean);
    if (cleanExclude.length > 0) {
      where.NOT = cleanExclude.map(c => ({ color: { contains: c, mode: 'insensitive' as const } }));
    }
  }

  // Şehir — contains (case-insensitive), Türkçe karakter normalize
  // "İstanbul" → "istanbul" ile eşleşir, "istanbul atasehir" de eşleşir
  if (filters.city) {
    const normalizeTr = (s: string) => s
      .replace(/İ/g, 'I').replace(/ı/g, 'i')
      .replace(/Ş/g, 'S').replace(/ş/g, 's')
      .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
      .replace(/Ü/g, 'U').replace(/ü/g, 'u')
      .replace(/Ö/g, 'O').replace(/ö/g, 'o')
      .replace(/Ç/g, 'C').replace(/ç/g, 'c')
      .toLowerCase();
    const cities = Array.isArray(filters.city) ? filters.city.filter(Boolean) : [filters.city];
    const cleanCities = cities.filter(Boolean).map(normalizeTr);
    if (cleanCities.length === 1) {
      // DB'deki veriyi de normalize etmek için raw SQL gerekir,
      // ama Prisma contains insensitive Türkçe İ'yi I'ya çevirmiyor.
      // Çözüm: hem orijinal hem normalize edilmiş halleri OR ile dene
      const original = (Array.isArray(filters.city) ? filters.city[0] : filters.city) || '';
      where.OR = [
        { city: { contains: original, mode: 'insensitive' as const } },
        { city: { contains: cleanCities[0], mode: 'insensitive' as const } },
      ];
    } else if (cleanCities.length > 1) {
      const originals = (Array.isArray(filters.city) ? filters.city : [filters.city]).filter(Boolean) as string[];
      const ors: any[] = [];
      for (let i = 0; i < originals.length; i++) {
        ors.push({ city: { contains: originals[i], mode: 'insensitive' as const } });
        ors.push({ city: { contains: cleanCities[i], mode: 'insensitive' as const } });
      }
      if (where.OR) {
        where.OR = [...where.OR, ...ors];
      } else {
        where.OR = ors;
      }
    }
  }

  // İlçe — çoklu seçim, exact match (ilçe adları daha standart)
  const districtFilter = buildMultiFilter(filters.district);
  if (districtFilter) where.district = districtFilter;

  // Satıcı tipi — çoklu seçim
  const sellerFilter = buildMultiFilter(filters.sellerType);
  if (sellerFilter) where.sellerType = sellerFilter;

  // Kazalı durumu — çoklu seçim
  const accidentFilter = buildMultiFilter(filters.accidentStatus);
  if (accidentFilter) where.accidentStatus = accidentFilter;

  // Fırsat etiketi — çoklu seçim
  const dealTagFilter = buildMultiFilter(filters.dealTag);
  if (dealTagFilter) where.dealTag = dealTagFilter;

  // DealScore min (yıldız) — dealScore 0-100, 5 yıldıza normalize: score/20
  if (filters.dealScoreMin && filters.dealScoreMin > 0) {
    // 5 yıldız = 100, 4 yıldız = 80, 3 yıldız = 60, 2 yıldız = 40, 1 yıldız = 20
    where.dealScore = { gte: filters.dealScoreMin * 20 };
  }

  // Serbest arama (q) — make + model + trim içinde OR
  if (filters.q && filters.q.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { make: { contains: q, mode: 'insensitive' } },
      { model: { contains: q, mode: 'insensitive' } },
      { trim: { contains: q, mode: 'insensitive' } },
    ];
  }

  return where;
}

function buildOrderBy(sortBy?: string | null) {
  switch (sortBy) {
    case 'price_asc': return { price: 'asc' as const };
    case 'price_desc': return { price: 'desc' as const };
    case 'year_desc': return { year: 'desc' as const };
    case 'year_asc': return { year: 'asc' as const };
    case 'mileage_asc': return { mileageKm: 'asc' as const };
    case 'deal_score_desc': return { dealScore: 'desc' as const };
    case 'newest':
    default: return { lastSeenAt: 'desc' as const };
  }
}

async function buildAggregations(baseWhere: Record<string, unknown>): Promise<SearchAggregations> {
  const allActive = await db.listing.findMany({
    where: baseWhere as any,
    select: { make: true, city: true, fuelType: true, transmission: true, bodyType: true, price: true, year: true, dealTag: true },
  });

  const makeMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const fuelTypeMap = new Map<string, number>();
  const transmissionMap = new Map<string, number>();
  const bodyTypeMap = new Map<string, number>();
  const dealTagMap = new Map<string, number>();

  let minPrice = Infinity, maxPrice = -Infinity, minYear = Infinity, maxYear = -Infinity;

  for (const item of allActive) {
    if (item.make) makeMap.set(item.make, (makeMap.get(item.make) || 0) + 1);
    if (item.city) cityMap.set(item.city, (cityMap.get(item.city) || 0) + 1);
    if (item.fuelType) fuelTypeMap.set(item.fuelType, (fuelTypeMap.get(item.fuelType) || 0) + 1);
    if (item.transmission) transmissionMap.set(item.transmission, (transmissionMap.get(item.transmission) || 0) + 1);
    if (item.bodyType) bodyTypeMap.set(item.bodyType, (bodyTypeMap.get(item.bodyType) || 0) + 1);
    if (item.dealTag) dealTagMap.set(item.dealTag, (dealTagMap.get(item.dealTag) || 0) + 1);
    if (item.price < minPrice) minPrice = item.price;
    if (item.price > maxPrice) maxPrice = item.price;
    if (item.year < minYear) minYear = item.year;
    if (item.year > maxYear) maxYear = item.year;
  }

  const toArr = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return {
    makes: toArr(makeMap), cities: toArr(cityMap),
    fuelTypes: toArr(fuelTypeMap), transmissions: toArr(transmissionMap),
    bodyTypes: toArr(bodyTypeMap),
    priceRange: { min: allActive.length > 0 ? minPrice : 0, max: allActive.length > 0 ? maxPrice : 0 },
    yearRange: { min: allActive.length > 0 ? minYear : 0, max: allActive.length > 0 ? maxYear : 0 },
    totalActive: allActive.length,
    dealBreakdown: Array.from(dealTagMap.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  };
}

async function buildAggregationsFromListings(listings: ListingWithScore[]): Promise<SearchAggregations> {
  const makeMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const fuelTypeMap = new Map<string, number>();
  const transmissionMap = new Map<string, number>();
  const bodyTypeMap = new Map<string, number>();
  const dealTagMap = new Map<string, number>();

  let minPrice = Infinity, maxPrice = -Infinity, minYear = Infinity, maxYear = -Infinity;

  for (const item of listings) {
    if (item.make) makeMap.set(item.make, (makeMap.get(item.make) || 0) + 1);
    if (item.city) cityMap.set(item.city, (cityMap.get(item.city) || 0) + 1);
    if (item.fuelType) fuelTypeMap.set(item.fuelType, (fuelTypeMap.get(item.fuelType) || 0) + 1);
    if (item.transmission) transmissionMap.set(item.transmission, (transmissionMap.get(item.transmission) || 0) + 1);
    if (item.bodyType) bodyTypeMap.set(item.bodyType, (bodyTypeMap.get(item.bodyType) || 0) + 1);
    if (item.dealTag) dealTagMap.set(item.dealTag, (dealTagMap.get(item.dealTag) || 0) + 1);
    if (item.price < minPrice) minPrice = item.price;
    if (item.price > maxPrice) maxPrice = item.price;
    if (item.year < minYear) minYear = item.year;
    if (item.year > maxYear) maxYear = item.year;
  }

  const toArr = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  return {
    makes: toArr(makeMap), cities: toArr(cityMap),
    fuelTypes: toArr(fuelTypeMap), transmissions: toArr(transmissionMap),
    bodyTypes: toArr(bodyTypeMap),
    priceRange: { min: listings.length ? minPrice : 0, max: listings.length ? maxPrice : 0 },
    yearRange: { min: listings.length ? minYear : 0, max: listings.length ? maxYear : 0 },
    totalActive: listings.length,
    dealBreakdown: Array.from(dealTagMap.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count),
  };
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);

    const cacheKey = getCacheKey(filters);
    const cached = await cache.get<SearchResult>(cacheKey);
    if (cached) return NextResponse.json(cached);

    const where = buildWhereClause(filters);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;
    const orderBy = buildOrderBy(filters.sortBy);

    // Execute queries — tolerate DB errors (table missing, conn failed)
    let listings: any[] = [];
    let total = 0;
    let dbError: string | null = null;
    try {
      [listings, total] = await Promise.all([
        db.listing.findMany({ where: where as any, orderBy, skip, take: limit }),
        db.listing.count({ where: where as any }),
      ]);
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
      console.warn('[API /listings] DB query failed, will use fallback:', dbError);
      console.warn('[API /listings] Where clause was:', JSON.stringify(where, null, 2));
    }

    // DB empty/error → static fallback (live scrape disabled for preview speed)
    if (total === 0 || dbError) {
      const fallbackResult = queryFallbackListings(filters);
      const result: SearchResult = {
        listings: fallbackResult.listings as unknown as ListingWithScore[],
        total: fallbackResult.total, page: fallbackResult.page,
        limit: fallbackResult.limit, totalPages: fallbackResult.totalPages,
        aggregations: fallbackResult.aggregations,
      };
      await cache.set(cacheKey, result, 30_000); // 30s TTL
      return NextResponse.json({ ...result, _fallback: true, _dbError: dbError, _where: where });
    }

    // DB has results
    const aggregations = await buildAggregations(where);
    const transformedListings: ListingWithScore[] = listings.map(transformListing);

    const result: SearchResult = {
      listings: transformedListings, total, page, limit,
      totalPages: Math.ceil(total / limit), aggregations,
    };

    await cache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /listings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings' },
      { status: 500 },
    );
  }
}
