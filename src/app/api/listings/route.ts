import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cache } from '@/lib/services/cache';
import { SearchFilters, SearchResult, ListingWithScore, SearchAggregations } from '@/lib/types';

// ── Helper: Parse query params into SearchFilters ──────────────────────

function parseFilters(searchParams: URLSearchParams): SearchFilters {
  return {
    make: searchParams.get('make') || undefined,
    model: searchParams.get('model') || undefined,
    yearMin: searchParams.get('yearMin') ? Number(searchParams.get('yearMin')) : undefined,
    yearMax: searchParams.get('yearMax') ? Number(searchParams.get('yearMax')) : undefined,
    priceMin: searchParams.get('priceMin') ? Number(searchParams.get('priceMin')) : undefined,
    priceMax: searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : undefined,
    mileageMax: searchParams.get('mileageMax') ? Number(searchParams.get('mileageMax')) : undefined,
    fuelType: searchParams.get('fuelType') || undefined,
    transmission: searchParams.get('transmission') || undefined,
    bodyType: searchParams.get('bodyType') || undefined,
    city: searchParams.get('city') || undefined,
    sellerType: searchParams.get('sellerType') || undefined,
    dealTag: searchParams.get('dealTag') || undefined,
    sortBy: (searchParams.get('sortBy') as SearchFilters['sortBy']) || 'newest',
    page: searchParams.get('page') ? Number(searchParams.get('page')) : 1,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : 20,
  };
}

// ── Helper: Generate cache key from filters ────────────────────────────

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

// ── Helper: Build Prisma where clause ──────────────────────────────────

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

// ── Helper: Build Prisma orderBy ───────────────────────────────────────

function buildOrderBy(sortBy?: string | null) {
  switch (sortBy) {
    case 'price_asc':
      return { price: 'asc' as const };
    case 'price_desc':
      return { price: 'desc' as const };
    case 'year_desc':
      return { year: 'desc' as const };
    case 'year_asc':
      return { year: 'asc' as const };
    case 'mileage_asc':
      return { mileageKm: 'asc' as const };
    case 'deal_score_desc':
      return { dealScore: 'desc' as const };
    case 'newest':
    default:
      return { lastSeenAt: 'desc' as const };
  }
}

// ── Helper: Transform DB listing to ListingWithScore ───────────────────

function transformListing(listing: Record<string, unknown>): ListingWithScore {
  return {
    id: listing.id as string,
    sourceName: listing.sourceName as string,
    sourceUrl: listing.sourceUrl as string,
    make: listing.make as string,
    model: listing.model as string,
    trim: (listing.trim as string) || null,
    year: listing.year as number,
    price: listing.price as number,
    mileageKm: (listing.mileageKm as number) ?? null,
    fuelType: (listing.fuelType as string) || null,
    transmission: (listing.transmission as string) || null,
    bodyType: (listing.bodyType as string) || null,
    color: (listing.color as string) || null,
    city: (listing.city as string) || null,
    district: (listing.district as string) || null,
    sellerType: (listing.sellerType as string) || null,
    imageUrl: (listing.imageUrl as string) || null,
    imageUrls: JSON.parse((listing.imageUrls as string) || '[]') as string[],
    description: (listing.description as string) || null,
    firstSeenAt: new Date(listing.firstSeenAt as string | Date).toISOString(),
    lastSeenAt: new Date(listing.lastSeenAt as string | Date).toISOString(),
    estimatedValue: (listing.estimatedValue as number) ?? null,
    confidence: (listing.confidence as string) || null,
    dealScore: (listing.dealScore as number) ?? null,
    dealTag: (listing.dealTag as string) || null,
    comparableCount: (listing.comparableCount as number) ?? 0,
    annualDepreciationPercent: (listing.annualDepreciationPercent as number) ?? null,
    annualDepreciationAmount: (listing.annualDepreciationAmount as number) ?? null,
    ownershipCostAnnual: (listing.ownershipCostAnnual as number) ?? null,
    fuelCostAnnual: (listing.fuelCostAnnual as number) ?? null,
    insuranceCostAnnual: (listing.insuranceCostAnnual as number) ?? null,
    maintenanceCostAnnual: (listing.maintenanceCostAnnual as number) ?? null,
    taxCostAnnual: (listing.taxCostAnnual as number) ?? null,
  };
}

// ── Helper: Build aggregations ─────────────────────────────────────────

async function buildAggregations(baseWhere: Record<string, unknown>): Promise<SearchAggregations> {
  // Fetch all active listings for aggregation (without pagination)
  const allActive = await db.listing.findMany({
    where: baseWhere as any,
    select: {
      make: true,
      city: true,
      fuelType: true,
      transmission: true,
      bodyType: true,
      price: true,
      year: true,
      dealTag: true,
    },
  });

  // Makes aggregation
  const makeMap = new Map<string, number>();
  const cityMap = new Map<string, number>();
  const fuelTypeMap = new Map<string, number>();
  const transmissionMap = new Map<string, number>();
  const bodyTypeMap = new Map<string, number>();
  const dealTagMap = new Map<string, number>();

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let minYear = Infinity;
  let maxYear = -Infinity;

  for (const item of allActive) {
    // Makes
    if (item.make) {
      makeMap.set(item.make, (makeMap.get(item.make) || 0) + 1);
    }

    // Cities
    if (item.city) {
      cityMap.set(item.city, (cityMap.get(item.city) || 0) + 1);
    }

    // Fuel types
    if (item.fuelType) {
      fuelTypeMap.set(item.fuelType, (fuelTypeMap.get(item.fuelType) || 0) + 1);
    }

    // Transmissions
    if (item.transmission) {
      transmissionMap.set(item.transmission, (transmissionMap.get(item.transmission) || 0) + 1);
    }

    // Body types
    if (item.bodyType) {
      bodyTypeMap.set(item.bodyType, (bodyTypeMap.get(item.bodyType) || 0) + 1);
    }

    // Deal tags
    if (item.dealTag) {
      dealTagMap.set(item.dealTag, (dealTagMap.get(item.dealTag) || 0) + 1);
    }

    // Price range
    if (item.price < minPrice) minPrice = item.price;
    if (item.price > maxPrice) maxPrice = item.price;

    // Year range
    if (item.year < minYear) minYear = item.year;
    if (item.year > maxYear) maxYear = item.year;
  }

  // Convert maps to sorted arrays
  const makes = Array.from(makeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const cities = Array.from(cityMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const fuelTypes = Array.from(fuelTypeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const transmissions = Array.from(transmissionMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const bodyTypes = Array.from(bodyTypeMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const dealBreakdown = Array.from(dealTagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  return {
    makes,
    cities,
    fuelTypes,
    transmissions,
    bodyTypes,
    priceRange: {
      min: allActive.length > 0 ? minPrice : 0,
      max: allActive.length > 0 ? maxPrice : 0,
    },
    yearRange: {
      min: allActive.length > 0 ? minYear : 0,
      max: allActive.length > 0 ? maxYear : 0,
    },
    totalActive: allActive.length,
    dealBreakdown,
  };
}

// ── GET Handler ────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);

    // Check cache first
    const cacheKey = getCacheKey(filters);
    const cached = await cache.get<SearchResult>(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Build query
    const where = buildWhereClause(filters);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;
    const orderBy = buildOrderBy(filters.sortBy);

    // Execute queries in parallel
    const [listings, total] = await Promise.all([
      db.listing.findMany({
        where: where as any,
        orderBy,
        skip,
        take: limit,
      }),
      db.listing.count({
        where: where as any,
      }),
    ]);

    // Build aggregations
    const aggregations = await buildAggregations(where);

    // Transform listings
    const transformedListings: ListingWithScore[] = listings.map(transformListing);

    const result: SearchResult = {
      listings: transformedListings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      aggregations,
    };

    // Cache for 5 minutes
    await cache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API /listings] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch listings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
