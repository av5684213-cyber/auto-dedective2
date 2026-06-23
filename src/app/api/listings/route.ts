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
      make: undefined, model: undefined, yearMin: undefined, yearMax: undefined,
      priceMin: undefined, priceMax: undefined, mileageMax: undefined,
      fuelType: undefined, transmission: undefined, bodyType: undefined,
      city: undefined, sellerType: undefined, dealTag: undefined,
      sortBy: 'newest', page: 1, limit: 20,
    } as ListingsQuery,
    'listingsQuery',
  );

  return {
    make: parsed.make, model: parsed.model,
    yearMin: parsed.yearMin, yearMax: parsed.yearMax,
    priceMin: parsed.priceMin, priceMax: parsed.priceMax,
    mileageMax: parsed.mileageMax,
    fuelType: parsed.fuelType, transmission: parsed.transmission,
    bodyType: parsed.bodyType, city: parsed.city,
    sellerType: parsed.sellerType, dealTag: parsed.dealTag,
    sortBy: parsed.sortBy as SearchFilters['sortBy'],
    page: parsed.page, limit: parsed.limit,
  };
}

function getCacheKey(filters: SearchFilters): string {
  const parts: string[] = ['listings'];
  if (filters.make) parts.push(`make:${filters.make}`);
  if (filters.model) parts.push(`model:${filters.model}`);
  if (filters.yearMin) parts.push(`yearMin:${filters.yearMin}`);
  if (filters.yearMax) parts.push(`yearMax:${filters.yearMax}`);
  if (filters.priceMin) parts.push(`priceMin:${filters.priceMin}`);
  if (filters.priceMax) parts.push(`priceMax:${filters.priceMax}`);
  if (filters.mileageMax) parts.push(`mileageMax:${filters.mileageMax}`);
  if (filters.fuelType) parts.push(`fuelType:${filters.fuelType}`);
  if (filters.transmission) parts.push(`transmission:${filters.transmission}`);
  if (filters.bodyType) parts.push(`bodyType:${filters.bodyType}`);
  if (filters.city) parts.push(`city:${filters.city}`);
  if (filters.sellerType) parts.push(`sellerType:${filters.sellerType}`);
  if (filters.dealTag) parts.push(`dealTag:${filters.dealTag}`);
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

  if (filters.make) where.make = { equals: filters.make };
  if (filters.model) where.model = { equals: filters.model };
  if (filters.yearMin || filters.yearMax) {
    const yearCondition: Record<string, number> = {};
    if (filters.yearMin) yearCondition.gte = filters.yearMin;
    if (filters.yearMax) yearCondition.lte = filters.yearMax;
    where.year = yearCondition;
  }
  if (filters.priceMin || filters.priceMax) {
    const priceCondition: Record<string, number> = {};
    if (filters.priceMin) priceCondition.gte = filters.priceMin;
    if (filters.priceMax) priceCondition.lte = filters.priceMax;
    where.price = priceCondition;
  }
  if (filters.mileageMax) where.mileageKm = { lte: filters.mileageMax };
  if (filters.fuelType) where.fuelType = { equals: filters.fuelType };
  if (filters.transmission) where.transmission = { equals: filters.transmission };
  if (filters.bodyType) where.bodyType = { equals: filters.bodyType };
  if (filters.city) where.city = { equals: filters.city };
  if (filters.sellerType) where.sellerType = { equals: filters.sellerType };
  if (filters.dealTag) where.dealTag = { equals: filters.dealTag };

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
    }

    // DB empty/error → live scrape → static fallback
    if (total === 0 || dbError) {
      // 1. Live sitemap scrape
      try {
        const liveListings = await liveScrapeLetgo(filters, limit);
        if (liveListings.length > 0) {
          const transformedLive: ListingWithScore[] = liveListings.map((l) => ({
            id: `letgo-${l.sourceUrl.match(/iid-(\d+)/)?.[1] ?? ''}`,
            sourceName: l.sourceName, sourceUrl: l.sourceUrl,
            make: l.make, model: l.model, trim: l.trim ?? null,
            year: l.year, price: l.price,
            mileageKm: l.mileageKm ?? null,
            fuelType: l.fuelType ?? null, transmission: l.transmission ?? null,
            bodyType: l.bodyType ?? null, color: l.color ?? null,
            city: l.city ?? null, district: l.district ?? null,
            sellerType: l.sellerType ?? null,
            imageUrl: l.imageUrl ?? null, imageUrls: l.imageUrls ?? [],
            description: l.description ?? null,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
            estimatedValue: null, confidence: 'insufficient',
            dealScore: null, dealTag: 'Değerlendirilemedi', comparableCount: 0,
            annualDepreciationPercent: null, annualDepreciationAmount: null,
            ownershipCostAnnual: null, fuelCostAnnual: null,
            insuranceCostAnnual: null, maintenanceCostAnnual: null,
            taxCostAnnual: null,
          }));

          const liveResult: SearchResult = {
            listings: transformedLive, total: transformedLive.length,
            page: 1, limit, totalPages: 1,
            aggregations: await buildAggregationsFromListings(transformedLive),
          };
          await cache.set(cacheKey, liveResult);
          return NextResponse.json({ ...liveResult, _live: true });
        }
      } catch (err) {
        console.error('[API /listings] Live sitemap scrape failed:', err);
      }

      // 2. Static fallback
      const fallbackResult = queryFallbackListings(filters);
      const result: SearchResult = {
        listings: fallbackResult.listings as unknown as ListingWithScore[],
        total: fallbackResult.total, page: fallbackResult.page,
        limit: fallbackResult.limit, totalPages: fallbackResult.totalPages,
        aggregations: fallbackResult.aggregations,
      };
      await cache.set(cacheKey, result);
      return NextResponse.json({ ...result, _fallback: true });
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
