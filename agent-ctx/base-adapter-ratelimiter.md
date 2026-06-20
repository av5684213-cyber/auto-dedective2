# Task: Create BaseAdapter, RateLimiter, and Shared Helpers

## Summary

Created the new adapter architecture and rate-limiter utility for the AracıKıyas scraping infrastructure.

## Files Created

1. **`/home/z/my-project/src/lib/utils/rate-limiter.ts`** — Rate limiter utility
   - `RateLimiterConfig` interface with `maxRequests`, `perSeconds`, `key`
   - `RateLimiter` class with sliding-window timestamp tracking
   - `wait()` — blocks until a slot opens; sleeps if limit reached
   - `getCurrentCount()`, `reset()`, `getEstimatedWaitMs()` — utility methods
   - Global registry: `getRateLimiter(config)`, `resetAllLimiters()`

2. **`/home/z/my-project/src/lib/utils/index.ts`** — Moved from `utils.ts` (preserves `cn()` imports)

## Files Rewritten

3. **`/home/z/my-project/src/lib/adapters/base.ts`** — Complete rewrite with new architecture
   - `SearchFilters` interface
   - `ListingRaw` interface (extends old RawListing with `id`, `firstSeenAt`, `lastSeenAt`, `isActive`)
   - `AdapterResult` interface
   - `BaseAdapter` abstract class with all specified methods:
     - Abstract: `search()`, `parseListing()`, `getDetail()`, `scrapeFallback()`
     - Smart: `scrape(filters?)` — tries real then fallback
     - Polite: `fetchWithPoliteness()` — UA rotation, random delay, retries, backoff, proxy
     - `checkRobotsTxt()` — simple robots.txt parser
     - `handleRateLimit()` — exponential wait on 429
     - Proxy support via env vars (PROXY_HOST, PROXY_PORT, etc.)
     - Logging: `log()` with levels
     - Normalization: `normalizeMake/Model/Fuel/Transmission/BodyType/SellerType()` with Turkish mappings
     - Extraction: `extractPrice()`, `extractYear()`, `extractMileage()` with Turkish number formats
     - UA rotation: pool of 7 realistic browser User-Agents
   - Mock data helpers preserved: `generateMockListings`, `pick`, `pickOptional`, `randInt`, `randFloat`, `getModelsForMake`, `getDistrictForCity`, `fakeListingUrl`, `generatePrice`, `generateMileage`

## Files Updated (14 adapters + index)

All 14 adapters updated to implement the new abstract methods:
- Added `defaultDelay` and `maxConcurrency` properties
- `search()` returns `AdapterResult` (wraps mock data)
- `parseListing()` basic identity cast
- `getDetail()` returns null (no real detail fetching yet)
- `scrapeFallback()` returns mock data (same as search)

`index.ts` updated:
- `runAllAdapters()` and `runAdapter()` now call `adapter.scrape(filters)` returning `AdapterResult`
- Added `listingRawToRaw()` converter for backward compatibility with `RawListing` type

## Verification

- `bun run lint` — passes cleanly (0 errors, 0 warnings)
- TypeScript compilation — no new errors in adapter/utils files
- Dev server — running without issues
