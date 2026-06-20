# Task: Build AracıKıyas Frontend - Complete Single-Page Application

## Summary

Built the complete frontend for "AracıKıyas" - a Turkish second-hand car meta-search aggregator platform. The application is a single-page Next.js 16 app with two main views (Search and Dashboard), all rendered on the `/` route.

## Components Created

1. **`src/components/deal-badge.tsx`** - Reusable colored badge for deal tags (Harika Fırsat, İyi Fiyat, etc.)
2. **`src/components/price-display.tsx`** - Turkish Lira formatted price with estimated value comparison
3. **`src/components/search-bar.tsx`** - Hero search with autocomplete suggestions from API
4. **`src/components/filter-sidebar.tsx`** - Desktop sidebar + mobile Sheet with all filter controls
5. **`src/components/listing-card.tsx`** - Card with gradient/image, deal badge, specs, and price
6. **`src/components/listing-grid.tsx`** - Responsive grid with loading skeletons and pagination
7. **`src/components/listing-detail.tsx`** - Full detail modal with specs, deal analysis, cost breakdown, price history, and comparables
8. **`src/components/stats-dashboard.tsx`** - Platform stats with cards, bar charts, and scrape logs

## Files Modified

1. **`src/app/layout.tsx`** - Updated metadata (Turkish title, description, lang="tr")
2. **`src/app/page.tsx`** - Complete SPA with search/dashboard tabs, filter management, URL sync
3. **`src/app/globals.css`** - Updated primary color to teal (oklch(0.521 0.119 175.5))
4. **`src/app/api/listings/suggestions/route.ts`** - Returns model+make objects instead of just model strings

## Key Architecture Decisions

- **Single route (`/`)**: All views managed via client-side tab state
- **useReducer** for listing detail state to avoid lint issues with setState in effects
- **URL param sync**: Filters are persisted in URL query params for sharing
- **Responsive design**: Filter sidebar as Sheet on mobile, permanent sidebar on desktop
- **Image handling**: Falls back to make-specific gradient if imageUrl fails
- **Color scheme**: Teal primary (#0d9488), amber accent (#f59e0b)
- **Turkish locale**: All UI text, number formatting (Intl.NumberFormat('tr-TR'))

## API Endpoints Used

- `GET /api/listings` - Search with filters, returns paginated results + aggregations
- `GET /api/listings/[id]` - Single listing with price history and comparables
- `GET /api/listings/suggestions?q=` - Autocomplete suggestions (makes + models)
- `GET /api/admin/stats` - Platform statistics
- `POST /api/admin/scrape` - Trigger data refresh
