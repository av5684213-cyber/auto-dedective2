// Raw listing from a scraping adapter
export interface RawListing {
  sourceName: string;
  sourceUrl: string;
  vin?: string;
  make: string;
  model: string;
  trim?: string;
  year: number;
  price: number;
  currency: string;
  mileageKm?: number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  color?: string;
  city?: string;
  district?: string;
  sellerType?: string;
  imageUrl?: string;
  imageUrls?: string[];
  description?: string;
}

// Search filters
export interface SearchFilters {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  mileageMax?: number;
  fuelType?: string;
  transmission?: string;
  bodyType?: string;
  city?: string;
  sellerType?: string;
  dealTag?: string;
  sortBy?:
    | 'price_asc'
    | 'price_desc'
    | 'year_desc'
    | 'year_asc'
    | 'mileage_asc'
    | 'deal_score_desc'
    | 'newest';
  page?: number;
  limit?: number;
}

// Search result
export interface SearchResult {
  listings: ListingWithScore[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  aggregations: SearchAggregations;
}

export interface ListingWithScore {
  id: string;
  sourceName: string;
  sourceUrl: string;
  make: string;
  model: string;
  trim?: string | null;
  year: number;
  price: number;
  mileageKm?: number | null;
  fuelType?: string | null;
  transmission?: string | null;
  bodyType?: string | null;
  color?: string | null;
  city?: string | null;
  district?: string | null;
  sellerType?: string | null;
  imageUrl?: string | null;
  imageUrls: string[];
  description?: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  estimatedValue?: number | null;
  confidence?: string | null;
  dealScore?: number | null;
  dealTag?: string | null;
  comparableCount: number;
  annualDepreciationPercent?: number | null;
  annualDepreciationAmount?: number | null;
  ownershipCostAnnual?: number | null;
  fuelCostAnnual?: number | null;
  insuranceCostAnnual?: number | null;
  maintenanceCostAnnual?: number | null;
  taxCostAnnual?: number | null;
}

export interface SearchAggregations {
  makes: { name: string; count: number }[];
  cities: { name: string; count: number }[];
  fuelTypes: { name: string; count: number }[];
  transmissions: { name: string; count: number }[];
  bodyTypes: { name: string; count: number }[];
  priceRange: { min: number; max: number };
  yearRange: { min: number; max: number };
  totalActive: number;
  dealBreakdown: { tag: string; count: number }[];
}

// Deal tag type
export type DealTag =
  | 'Harika Fırsat'
  | 'İyi Fiyat'
  | 'Piyasa Fiyatı'
  | 'Piyasa Üstü'
  | 'Pahalı'
  | 'Değerlendirilemedi';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'insufficient';

// Source platform info
export interface SourcePlatform {
  name: string;
  displayName: string;
  baseUrl: string;
  color: string;
  icon: string;
}

// Scrape result
export interface ScrapeResult {
  sourceName: string;
  itemsFound: number;
  itemsSaved: number;
  durationMs: number;
  status: 'success' | 'failed';
  errorMsg?: string;
}
