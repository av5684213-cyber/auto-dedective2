import { z } from 'zod';

// ── Zod Schemas for API Input Validation ───────────────────────────────

// String veya string[] kabul eder (URL query'den gelir, virgülle ayrılmış da olabilir)
const multiString = z.union([
  z.string().trim(),
  z.array(z.string().trim()),
]).optional().transform(v => {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.filter(Boolean);
  // Virgülle ayrılmış string ise array'e çevir
  if (v.includes(',')) return v.split(',').map(s => s.trim()).filter(Boolean);
  return v ? [v] : undefined;
});

export const listingsQuerySchema = z.object({
  make: multiString,
  model: multiString,
  trim: z.string().trim().optional(),
  yearMin: z.coerce.number().int().min(1900).max(2100).optional(),
  yearMax: z.coerce.number().int().min(1900).max(2100).optional(),
  priceMin: z.coerce.number().min(0).optional(),
  priceMax: z.coerce.number().min(0).optional(),
  mileageMin: z.coerce.number().int().min(0).optional(),
  mileageMax: z.coerce.number().int().min(0).optional(),
  fuelType: multiString,
  transmission: multiString,
  bodyType: multiString,
  color: multiString,
  colorExclude: multiString,
  city: multiString,
  district: multiString,
  sellerType: multiString,
  accidentStatus: multiString,
  dealTag: multiString,
  dealScoreMin: z.coerce.number().min(0).max(5).optional(),
  q: z.string().trim().optional(),
  sortBy: z
    .enum(['newest', 'price_asc', 'price_desc', 'year_desc', 'year_asc', 'mileage_asc', 'deal_score_desc'])
    .optional()
    .default('newest'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type ListingsQuery = z.infer<typeof listingsQuerySchema>;

export const suggestionsQuerySchema = z.object({
  q: z.string().trim().optional().default(''),
});

export type SuggestionsQuery = z.infer<typeof suggestionsQuerySchema>;

export const scrapeBodySchema = z.object({
  sourceName: z.string().trim().optional(),
  filters: z
    .object({
      make: z.string().trim().optional(),
      model: z.string().trim().optional(),
      yearMin: z.coerce.number().int().min(1900).max(2100).optional(),
      yearMax: z.coerce.number().int().min(1900).max(2100).optional(),
      priceMin: z.coerce.number().min(0).optional(),
      priceMax: z.coerce.number().min(0).optional(),
      mileageMax: z.coerce.number().int().min(0).optional(),
      fuelType: z.string().trim().optional(),
      transmission: z.string().trim().optional(),
      bodyType: z.string().trim().optional(),
      city: z.string().trim().optional(),
      sellerType: z.string().trim().optional(),
      page: z.coerce.number().int().min(1).optional(),
      limit: z.coerce.number().int().min(1).max(500).optional(),
    })
    .optional(),
});

export type ScrapeBody = z.infer<typeof scrapeBodySchema>;

export const schedulerBodySchema = z.object({
  action: z.enum(['start', 'stop', 'trigger']).default('trigger'),
  intervalMs: z.coerce.number().int().min(60_000).max(24 * 60 * 60_000).optional(),
});

export type SchedulerBody = z.infer<typeof schedulerBodySchema>;

export const SCRAPE_PLAYWRIGHT_SITES = ['arabam', 'vavacars', 'sahibinden', 'all'] as const;
export type ScrapePlaywrightSite = (typeof SCRAPE_PLAYWRIGHT_SITES)[number];

export const scrapePlaywrightBodySchema = z.object({
  site: z.enum(SCRAPE_PLAYWRIGHT_SITES).default('all'),
  pages: z.coerce.number().int().min(1).max(50).default(2),
  max: z.coerce.number().int().min(1).max(2000).default(200),
});

export type ScrapePlaywrightBody = z.infer<typeof scrapePlaywrightBodySchema>;

export function safeParse<T>(
  schema: z.ZodSchema<T>,
  input: unknown,
  fallback: T,
  context?: string,
): T {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  if (context) {
    console.warn(`[validation:${context}] invalid input:`, result.error.issues);
  }
  return fallback;
}
