// Otodedektif - Cost Estimator Engine
// Calculates total cost of ownership for Turkish second-hand car market

import { db } from '@/lib/db';
import { getVehicleFuelConsumption } from '@/lib/services/vehicle-fuel-specs';
import { getFuelPrice, type FuelPriceType } from '@/lib/services/fuel-prices';

// ── Types ──────────────────────────────────────────────────────────────

export interface CostEstimate {
  annualDepreciationPercent: number;
  annualDepreciationAmount: number;
  ownershipCostAnnual: number;
  fuelCostAnnual: number;
  insuranceCostAnnual: number;
  maintenanceCostAnnual: number;
  taxCostAnnual: number;
}

interface ListingInput {
  make: string;
  model: string;
  year: number;
  price: number;
  mileageKm: number | null;
  fuelType: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────

/** Average annual driving distance in Turkey (km) */
const ANNUAL_MILEAGE_KM = 15000;

/** Current fuel prices in Turkey (TRY/L) — 2024/2025 averages */
const FUEL_PRICES: Record<string, number> = {
  Benzin: 45, // TRY/L
  Dizel: 42, // TRY/L
  LPG: 20, // TRY/L
  Hybrid: 45, // Uses benzin pricing as base
  Elektrik: 2.5, // TRY/kWh
};

/** Average fuel consumption by type (L/100km or kWh/100km for electric) */
const FUEL_CONSUMPTION: Record<string, number> = {
  Benzin: 6, // L/100km
  Dizel: 5, // L/100km
  LPG: 8, // L/100km (higher consumption but cheaper fuel)
  Hybrid: 4, // L/100km
  Elektrik: 15, // kWh/100km
};

/** Luxury brands with higher depreciation and costs */
const LUXURY_BRANDS = [
  'BMW', 'Mercedes-Benz', 'Audi', 'Porsche', 'Land Rover',
  'Range Rover', 'Jaguar', 'Lexus', 'Infiniti', 'Volvo',
  'Mini', 'Alfa Romeo', 'Maserati', 'Bentley', 'Rolls-Royce',
];

/** Popular brands with lower depreciation (reliable, high demand in Turkey) */
const POPULAR_BRANDS = [
  'Toyota', 'Honda', 'Hyundai', 'Dacia',
];

/** Engine displacement assumptions by make/model (cc) */
const DEFAULT_ENGINE_CC = 1600; // Most common in Turkey

/** Age-based consumption increase factors */
const AGE_CONSUMPTION_INCREASE: Record<string, number> = {
  new: 1.0, // 0-3 years: no increase
  mid: 1.1, // 4-7 years: +10%
  older: 1.15, // 8-10 years: +15%
  veryOld: 1.2, // 11+ years: +20%
};

// ── Main Public Functions ──────────────────────────────────────────────

/**
 * Estimate total cost of ownership for a single listing.
 * All costs are annual and in TRY.
 *
 * @param listing - Listing data with make, model, year, price, mileageKm, fuelType
 * @returns CostEstimate with all annual cost components
 */
export function estimateCosts(listing: ListingInput): CostEstimate {
  const currentYear = new Date().getFullYear();
  const vehicleAge = currentYear - listing.year;

  const isLuxury = LUXURY_BRANDS.some(
    (b) => listing.make.toLowerCase() === b.toLowerCase(),
  );
  const isPopular = POPULAR_BRANDS.some(
    (b) => listing.make.toLowerCase() === b.toLowerCase(),
  );

  // ── Depreciation ──
  const annualDepreciationPercent = calculateDepreciationPercent(vehicleAge, isLuxury, isPopular);
  const annualDepreciationAmount = listing.price * (annualDepreciationPercent / 100);

  // ── Fuel Cost ──
  const fuelCostAnnual = calculateFuelCost(listing.fuelType, vehicleAge);

  // ── Insurance Cost ──
  const insuranceCostAnnual = calculateInsuranceCost(
    listing.price,
    vehicleAge,
    isLuxury,
  );

  // ── Maintenance Cost ──
  const maintenanceCostAnnual = calculateMaintenanceCost(
    vehicleAge,
    isLuxury,
    listing.mileageKm,
  );

  // ── Tax (MTV) Cost ──
  const taxCostAnnual = calculateTaxCost(
    listing.make,
    listing.model,
    vehicleAge,
    listing.fuelType,
  );

  // ── Total Annual Ownership Cost ──
  const ownershipCostAnnual =
    annualDepreciationAmount +
    fuelCostAnnual +
    insuranceCostAnnual +
    maintenanceCostAnnual +
    taxCostAnnual;

  return {
    annualDepreciationPercent,
    annualDepreciationAmount,
    ownershipCostAnnual,
    fuelCostAnnual,
    insuranceCostAnnual,
    maintenanceCostAnnual,
    taxCostAnnual,
  };
}

/**
 * Estimate and persist costs for all listings that don't have cost data yet.
 *
 * @returns Counts of estimated and skipped listings
 */
export async function estimateAllCosts(): Promise<{
  estimated: number;
  skipped: number;
}> {
  const listings = await db.listing.findMany({
    where: {
      isActive: true,
      isDeleted: false,
      ownershipCostAnnual: null,
    },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      price: true,
      mileageKm: true,
      fuelType: true,
    },
  });

  let estimated = 0;
  let skipped = 0;

  for (const listing of listings) {
    try {
      const costs = estimateCosts({
        make: listing.make,
        model: listing.model,
        year: listing.year,
        price: listing.price,
        mileageKm: listing.mileageKm,
        fuelType: listing.fuelType,
      });

      await db.listing.update({
        where: { id: listing.id },
        data: {
          annualDepreciationPercent: costs.annualDepreciationPercent,
          annualDepreciationAmount: costs.annualDepreciationAmount,
          ownershipCostAnnual: costs.ownershipCostAnnual,
          fuelCostAnnual: costs.fuelCostAnnual,
          insuranceCostAnnual: costs.insuranceCostAnnual,
          maintenanceCostAnnual: costs.maintenanceCostAnnual,
          taxCostAnnual: costs.taxCostAnnual,
        },
      });

      estimated++;
    } catch {
      skipped++;
    }
  }

  return { estimated, skipped };
}

/**
 * Re-estimate costs for all listings (including those with existing cost data).
 * Useful for periodic refresh when fuel prices or tax rates change.
 *
 * @returns Counts of estimated and skipped listings
 */
export async function reestimateAllCosts(): Promise<{
  estimated: number;
  skipped: number;
}> {
  const listings = await db.listing.findMany({
    where: {
      isActive: true,
      isDeleted: false,
    },
    select: {
      id: true,
      make: true,
      model: true,
      year: true,
      price: true,
      mileageKm: true,
      fuelType: true,
    },
  });

  let estimated = 0;
  let skipped = 0;

  for (const listing of listings) {
    try {
      const costs = estimateCosts({
        make: listing.make,
        model: listing.model,
        year: listing.year,
        price: listing.price,
        mileageKm: listing.mileageKm,
        fuelType: listing.fuelType,
      });

      await db.listing.update({
        where: { id: listing.id },
        data: {
          annualDepreciationPercent: costs.annualDepreciationPercent,
          annualDepreciationAmount: costs.annualDepreciationAmount,
          ownershipCostAnnual: costs.ownershipCostAnnual,
          fuelCostAnnual: costs.fuelCostAnnual,
          insuranceCostAnnual: costs.insuranceCostAnnual,
          maintenanceCostAnnual: costs.maintenanceCostAnnual,
          taxCostAnnual: costs.taxCostAnnual,
        },
      });

      estimated++;
    } catch {
      skipped++;
    }
  }

  return { estimated, skipped };
}

// ── Internal: Depreciation Calculation ─────────────────────────────────

/**
 * Calculate annual depreciation percentage based on vehicle age and brand.
 *
 * Age brackets:
 *   0-2 years:  15-20% annual depreciation
 *   3-5 years:  10-15% annual depreciation
 *   6-10 years: 8-12% annual depreciation
 *   10+ years:  5-8% annual depreciation
 *
 * Brand adjustments:
 *   Luxury:  +3%
 *   Popular: -2%
 *
 * @param vehicleAge - Age of vehicle in years
 * @param isLuxury - Whether the brand is a luxury brand
 * @param isPopular - Whether the brand is a popular/reliable brand
 * @returns Annual depreciation percentage
 */
function calculateDepreciationPercent(
  vehicleAge: number,
  isLuxury: boolean,
  isPopular: boolean,
): number {
  let basePercent: number;

  if (vehicleAge <= 2) {
    // New cars: 15-20%. Use 17.5 as base, scale with age within bracket
    basePercent = 20 - (vehicleAge / 2) * 5; // 20 at age 0, 17.5 at age 2
  } else if (vehicleAge <= 5) {
    // Mid-age: 10-15%
    basePercent = 15 - ((vehicleAge - 2) / 3) * 5; // 15 at age 3, 11.67 at age 5
  } else if (vehicleAge <= 10) {
    // Older: 8-12%
    basePercent = 12 - ((vehicleAge - 5) / 5) * 4; // 12 at age 6, 8.8 at age 10
  } else {
    // Very old: 5-8%
    basePercent = Math.max(5, 8 - (vehicleAge - 10) * 0.3); // Gradually decreasing
  }

  // Brand adjustments
  if (isLuxury) basePercent += 3;
  if (isPopular) basePercent -= 2;

  // Ensure reasonable bounds
  return Math.max(3, Math.min(25, basePercent));
}

// ── Internal: Fuel Cost Calculation ────────────────────────────────────

/**
 * Calculate annual fuel cost based on fuel type and vehicle age.
 *
 * Base costs (15,000 km/year):
 *   Benzin:  6L/100km × 45 TRY/L = ~40,500 TRY/year
 *   Dizel:   5L/100km × 42 TRY/L = ~31,500 TRY/year
 *   LPG:     8L/100km × 20 TRY/L = ~24,000 TRY/year
 *   Hybrid:  4L/100km × 45 TRY/L = ~27,000 TRY/year
 *   Elektrik: 15kWh/100km × 2.5 TRY/kWh = ~5,625 TRY/year
 *
 * Age adjustment: older vehicles consume 10-20% more fuel.
 * Also handles "Benzin + LPG" as dual-fuel (weighted average).
 *
 * @param fuelType - Fuel type string (Benzin, Dizel, LPG, Hybrid, Elektrik, etc.)
 * @param vehicleAge - Age of vehicle in years
 * @returns Annual fuel cost in TRY
 */
function calculateFuelCost(fuelType: string | null, vehicleAge: number): number {
  // Determine the age-based consumption increase factor
  let ageFactor: number;
  if (vehicleAge <= 3) {
    ageFactor = AGE_CONSUMPTION_INCREASE.new;
  } else if (vehicleAge <= 7) {
    ageFactor = AGE_CONSUMPTION_INCREASE.mid;
  } else if (vehicleAge <= 10) {
    ageFactor = AGE_CONSUMPTION_INCREASE.older;
  } else {
    ageFactor = AGE_CONSUMPTION_INCREASE.veryOld;
  }

  // Handle dual-fuel "Benzin + LPG" — assume 60% LPG usage, 40% Benzin
  if (fuelType && fuelType.toLowerCase().includes('lpg') && fuelType.toLowerCase().includes('benzin')) {
    const benzinCost = calculateSingleFuelCost('Benzin', ageFactor);
    const lpgCost = calculateSingleFuelCost('LPG', ageFactor);
    // Weighted: 60% LPG usage (cheaper), 40% Benzin usage
    return benzinCost * 0.4 + lpgCost * 0.6;
  }

  // Normalize fuel type string
  const normalizedFuel = normalizeFuelType(fuelType);
  return calculateSingleFuelCost(normalizedFuel, ageFactor);
}

/**
 * Calculate annual fuel cost for a single fuel type.
 *
 * @param fuelType - Normalized fuel type
 * @param ageFactor - Age-based consumption increase factor
 * @returns Annual fuel cost in TRY
 */
function calculateSingleFuelCost(fuelType: string, ageFactor: number): number {
  const consumption = FUEL_CONSUMPTION[fuelType] ?? FUEL_CONSUMPTION.Benzin;
  const adjustedConsumption = consumption * ageFactor;

  if (fuelType === 'Elektrik') {
    // Electric: consumption in kWh/100km, price in TRY/kWh
    const pricePerUnit = FUEL_PRICES.Elektrik;
    const annualKwh = (adjustedConsumption / 100) * ANNUAL_MILEAGE_KM;
    return annualKwh * pricePerUnit;
  }

  // ICE/LPG/Hybrid: consumption in L/100km, price in TRY/L
  const pricePerLiter = FUEL_PRICES[fuelType] ?? FUEL_PRICES.Benzin;
  const annualLiters = (adjustedConsumption / 100) * ANNUAL_MILEAGE_KM;
  return annualLiters * pricePerLiter;
}

/**
 * Normalize fuel type string to a known type.
 */
function normalizeFuelType(fuelType: string | null): string {
  if (!fuelType) return 'Benzin'; // Default assumption

  const lower = fuelType.toLowerCase().trim();

  if (lower.includes('dizel') || lower.includes('diesel')) return 'Dizel';
  if (lower.includes('elektrik') || lower.includes('electric')) return 'Elektrik';
  if (lower.includes('hybrid') || lower.includes('hibrit')) return 'Hybrid';
  if (lower.includes('lpg') || lower.includes('otogaz')) return 'LPG';
  if (lower.includes('benzin') || lower.includes('gasoline') || lower.includes('petrol')) return 'Benzin';

  return 'Benzin'; // Default fallback
}

// ── Internal: Insurance Cost Calculation ───────────────────────────────

/**
 * Calculate annual insurance cost (Kasko + Trafik Sigortası).
 *
 * Rules:
 *   Base: 3-5% of vehicle value
 *   New cars (0-2 years): 4-5%
 *   Mid-age (3-5 years): 3-4%
 *   Older (6+ years): 2.5-3%
 *   Luxury: +1%
 *   Minimum: 8,000 TRY
 *   Maximum: 150,000 TRY
 *
 * @param price - Vehicle price/value
 * @param vehicleAge - Age of vehicle in years
 * @param isLuxury - Whether the brand is luxury
 * @returns Annual insurance cost in TRY
 */
function calculateInsuranceCost(
  price: number,
  vehicleAge: number,
  isLuxury: boolean,
): number {
  let rate: number;

  if (vehicleAge <= 2) {
    // New cars: 4-5%, linearly interpolate within bracket
    rate = 5 - (vehicleAge / 2) * 1; // 5% at age 0, 4.5% at age 1, 4% at age 2
  } else if (vehicleAge <= 5) {
    // Mid-age: 3-4%
    rate = 4 - ((vehicleAge - 2) / 3) * 1; // 4% at age 3, 3.33% at age 5
  } else {
    // Older: 2.5-3%
    rate = 3 - Math.min((vehicleAge - 5) * 0.1, 0.5); // Gradually down to 2.5%
  }

  // Luxury surcharge
  if (isLuxury) rate += 1;

  let cost = price * (rate / 100);

  // Apply minimum and maximum bounds
  cost = Math.max(8000, Math.min(150000, cost));

  return cost;
}

// ── Internal: Maintenance Cost Calculation ─────────────────────────────

/**
 * Calculate annual maintenance cost.
 *
 * Rules:
 *   New (0-3 years): 3,000-5,000 TRY/year
 *   Mid (4-7 years): 8,000-15,000 TRY/year
 *   Older (8+ years): 15,000-30,000 TRY/year
 *   Luxury: +50%
 *   High mileage (>150,000 km): +30%
 *
 * @param vehicleAge - Age of vehicle in years
 * @param isLuxury - Whether the brand is luxury
 * @param mileageKm - Current mileage in km
 * @returns Annual maintenance cost in TRY
 */
function calculateMaintenanceCost(
  vehicleAge: number,
  isLuxury: boolean,
  mileageKm: number | null,
): number {
  let baseCost: number;

  if (vehicleAge <= 3) {
    // New: 3,000-5,000, interpolate by age within bracket
    baseCost = 3000 + (vehicleAge / 3) * 2000; // 3,000 at age 0 → 5,000 at age 3
  } else if (vehicleAge <= 7) {
    // Mid: 8,000-15,000
    baseCost = 8000 + ((vehicleAge - 3) / 4) * 7000; // 8,000 at age 4 → 15,000 at age 7
  } else {
    // Older: 15,000-30,000, gradually increasing
    baseCost = 15000 + Math.min((vehicleAge - 7) * 2500, 15000); // Up to 30,000
  }

  // Luxury surcharge: +50%
  if (isLuxury) {
    baseCost *= 1.5;
  }

  // High mileage surcharge: +30% if over 150,000 km
  if (mileageKm != null && mileageKm > 150000) {
    baseCost *= 1.3;
  }

  return Math.round(baseCost);
}

// ── Internal: Tax (MTV) Calculation ────────────────────────────────────

/**
 * Calculate annual Motorlu Taşıtlar Vergisi (MTV) — Motor Vehicle Tax.
 *
 * Based on engine displacement and age:
 *   Small engine (<1600cc): 1,000-3,000 TRY/year
 *   Medium (1600-2000cc): 2,000-7,000 TRY/year
 *   Large (>2000cc): 5,000-20,000 TRY/year
 *
 * Age discount: 5% per year after year 5, max 50%
 * Electric vehicles: 25% of regular MTV
 *
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @param vehicleAge - Age of vehicle in years
 * @param fuelType - Fuel type
 * @returns Annual MTV in TRY
 */
function calculateTaxCost(
  make: string,
  model: string,
  vehicleAge: number,
  fuelType: string | null,
): number {
  // Estimate engine displacement from make/model
  const engineCc = estimateEngineDisplacement(make, model);

  let baseTax: number;

  if (engineCc < 1600) {
    // Small engine: 1,000-3,000 TRY — scale by displacement
    const ratio = engineCc / 1600;
    baseTax = 1000 + ratio * 2000; // 1,000 at 0cc → 3,000 at 1600cc
  } else if (engineCc <= 2000) {
    // Medium: 2,000-7,000 TRY
    const ratio = (engineCc - 1600) / 400;
    baseTax = 2000 + ratio * 5000; // 2,000 at 1600cc → 7,000 at 2000cc
  } else if (engineCc <= 3000) {
    // Large: 5,000-15,000 TRY
    const ratio = (engineCc - 2000) / 1000;
    baseTax = 7000 + ratio * 8000; // 7,000 at 2000cc → 15,000 at 3000cc
  } else {
    // Very large: 15,000-20,000+ TRY
    const ratio = Math.min((engineCc - 3000) / 1000, 1);
    baseTax = 15000 + ratio * 5000; // 15,000 at 3000cc → 20,000 at 4000cc
  }

  // Age discount: 5% per year after year 5, max 50%
  if (vehicleAge > 5) {
    const discountPercent = Math.min((vehicleAge - 5) * 5, 50);
    baseTax *= (100 - discountPercent) / 100;
  }

  // Electric vehicles: 25% of regular MTV
  const normalizedFuel = normalizeFuelType(fuelType);
  if (normalizedFuel === 'Elektrik') {
    baseTax *= 0.25;
  }

  // Minimum MTV
  return Math.max(baseTax, 500);
}

/**
 * Estimate engine displacement based on make and model.
 * Uses known patterns for Turkish market vehicles.
 * Falls back to DEFAULT_ENGINE_CC (1600cc) if unknown.
 *
 * @param make - Vehicle make
 * @param model - Vehicle model
 * @returns Estimated engine displacement in cc
 */
function estimateEngineDisplacement(make: string, model: string): number {
  const makeLower = make.toLowerCase().trim();
  const modelLower = model.toLowerCase().trim();

  // Check for explicit engine size indicators in model name
  // Common patterns: "1.6", "2.0", "30d", "520i", "C200", "320i", etc.

  // BMW naming: 3-digit number = displacement hint
  // e.g., 320i ≈ 2000cc, 520i ≈ 2000cc, 740i ≈ 3000cc
  if (makeLower === 'bmw') {
    const bmwMatch = modelLower.match(/(\d)(\d{2})/);
    if (bmwMatch) {
      const series = parseInt(bmwMatch[1]);
      const engineCode = parseInt(bmwMatch[2]);
      if (engineCode >= 40) return 3000;
      if (engineCode >= 30) return 3000;
      if (engineCode >= 25) return 2500;
      if (engineCode >= 20) return 2000;
      if (engineCode >= 18) return 1800;
      if (engineCode >= 16) return 1600;
      return 2000; // default for BMW
    }
    // M models
    if (modelLower.includes('m3') || modelLower.includes('m5') || modelLower.includes('m4')) {
      return 3000;
    }
    // X5, X7 etc. tend to have larger engines
    if (modelLower.includes('x5') || modelLower.includes('x7') || modelLower.includes('x6')) {
      return 3000;
    }
    return 2000; // BMW default
  }

  // Mercedes naming: C200, E300, etc.
  if (makeLower === 'mercedes-benz' || makeLower === 'mercedes') {
    const mbMatch = modelLower.match(/([a-z])(\d{3})/);
    if (mbMatch) {
      const engineCode = parseInt(mbMatch[2]);
      if (engineCode >= 400) return 3000;
      if (engineCode >= 300) return 3000;
      if (engineCode >= 250) return 2500;
      if (engineCode >= 220) return 2000;
      if (engineCode >= 200) return 2000;
      if (engineCode >= 180) return 1600;
      if (engineCode >= 160) return 1600;
      return 2000;
    }
    // AMG models
    if (modelLower.includes('amg')) return 3000;
    // S-Class, G-Class, GLS tend to have larger engines
    if (modelLower.includes('s serisi') || modelLower.includes('gle') || modelLower.includes('gls')) {
      return 3000;
    }
    return 2000; // Mercedes default
  }

  // Audi: A3/A4/A5 = ~2000cc, A6/A7/A8 = ~3000cc, Q7/Q8 = ~3000cc
  if (makeLower === 'audi') {
    if (modelLower.includes('a8') || modelLower.includes('a7') || modelLower.includes('q7') || modelLower.includes('q8') || modelLower.includes('s') || modelLower.includes('rs')) {
      return 3000;
    }
    if (modelLower.includes('a6') || modelLower.includes('q5')) {
      return 2000;
    }
    return 1600; // A1, A3, A4, Q2, Q3
  }

  // Volvo: generally 2000cc for newer models
  if (makeLower === 'volvo') {
    if (modelLower.includes('xc90') || modelLower.includes('xc60') || modelLower.includes('s90')) {
      return 2000;
    }
    return 2000;
  }

  // Volkswagen: mostly 1400-2000cc
  if (makeLower === 'volkswagen' || makeLower === 'vw') {
    if (modelLower.includes('passat') || modelLower.includes('tiguan') || modelLower.includes('arteon')) {
      return 1600;
    }
    if (modelLower.includes('golf') || modelLower.includes('jetta') || modelLower.includes('t-roc')) {
      return 1400;
    }
    if (modelLower.includes('touareg')) return 3000;
    return 1400;
  }

  // Toyota: mostly 1500-2000cc
  if (makeLower === 'toyota') {
    if (modelLower.includes('land cruiser') || modelLower.includes('highlander')) return 2700;
    if (modelLower.includes('camry') || modelLower.includes('rav4')) return 2000;
    if (modelLower.includes('corolla') || modelLower.includes('c-hr')) return 1800;
    if (modelLower.includes('yaris') || modelLower.includes('auris')) return 1500;
    return 1600;
  }

  // Honda
  if (makeLower === 'honda') {
    if (modelLower.includes('cr-v') || modelLower.includes('accord')) return 1500;
    if (modelLower.includes('civic')) return 1400;
    return 1500;
  }

  // Hyundai
  if (makeLower === 'hyundai') {
    if (modelLower.includes('santa fe') || modelLower.includes('staria')) return 2200;
    if (modelLower.includes('tucson') || modelLower.includes('i30') || modelLower.includes('elantra')) return 1600;
    if (modelLower.includes('i20') || modelLower.includes('accent') || modelLower.includes('bayon')) return 1400;
    return 1600;
  }

  // Ford
  if (makeLower === 'ford') {
    if (modelLower.includes('explorer') || modelLower.includes('mustang') || modelLower.includes('ranger')) return 2500;
    if (modelLower.includes('kuga') || modelLower.includes('focus') || modelLower.includes('puma')) return 1500;
    return 1600;
  }

  // Renault
  if (makeLower === 'renault') {
    if (modelLower.includes('kadjar') || modelLower.includes('talisman') || modelLower.includes('scenic')) return 1600;
    if (modelLower.includes('megane') || modelLower.includes('captur') || modelLower.includes('fluence')) return 1400;
    if (modelLower.includes('clio') || modelLower.includes('symbol')) return 1000;
    return 1400;
  }

  // Fiat
  if (makeLower === 'fiat') {
    if (modelLower.includes('egea') || modelLower.includes('tipo')) return 1400;
    if (modelLower.includes('500x')) return 1400;
    if (modelLower.includes('500') && !modelLower.includes('500x')) return 1200;
    if (modelLower.includes('panda') || modelLower.includes('punto')) return 1200;
    return 1400;
  }

  // Dacia
  if (makeLower === 'dacia') {
    if (modelLower.includes('duster')) return 1500;
    if (modelLower.includes('spring')) return 0; // Electric, no displacement
    return 1400;
  }

  // Peugeot, Opel, Citroen: mostly 1200-1600cc
  if (makeLower === 'peugeot' || makeLower === 'opel' || makeLower === 'citroen') {
    if (modelLower.includes('5008') || modelLower.includes('insignia') || modelLower.includes('grandland')) return 1600;
    return 1400;
  }

  // Skoda, Seat
  if (makeLower === 'skoda' || makeLower === 'seat') {
    if (modelLower.includes('superb') || modelLower.includes('kodiaq') || modelLower.includes('tarraco')) return 1600;
    return 1400;
  }

  // Kia
  if (makeLower === 'kia') {
    if (modelLower.includes('sorento') || modelLower.includes('carnival') || modelLower.includes('ev6')) return 2000;
    if (modelLower.includes('sportage') || modelLower.includes('niro')) return 1600;
    if (modelLower.includes('ceed') || modelLower.includes('stonic')) return 1400;
    return 1400;
  }

  // Nissan
  if (makeLower === 'nissan') {
    if (modelLower.includes('patrol') || modelLower.includes('navara')) return 3000;
    if (modelLower.includes('qashqai') || modelLower.includes('x-trail')) return 1600;
    return 1400;
  }

  // Land Rover / Range Rover / Jeep
  if (makeLower === 'land rover' || makeLower === 'jeep') {
    return 2000;
  }

  // Lexus, Infiniti
  if (makeLower === 'lexus' || makeLower === 'infiniti') {
    return 2500;
  }

  // Mini
  if (makeLower === 'mini') {
    return 1500;
  }

  // Alfa Romeo
  if (makeLower === 'alfa romeo') {
    if (modelLower.includes('giulia') || modelLower.includes('stelvio')) return 2000;
    return 1400;
  }

  // Mazda
  if (makeLower === 'mazda') {
    if (modelLower.includes('cx-9') || modelLower.includes('cx-5')) return 2500;
    return 2000;
  }

  // Suzuki
  if (makeLower === 'suzuki') {
    if (modelLower.includes('jimny')) return 1500;
    return 1400;
  }

  // Mitsubishi
  if (makeLower === 'mitsubishi') {
    if (modelLower.includes('pajero') || modelLower.includes('outlander') || modelLower.includes('l200')) return 2400;
    return 1500;
  }

  // Chevrolet
  if (makeLower === 'chevrolet') {
    if (modelLower.includes('camaro') || modelLower.includes('silverado')) return 3600;
    return 1400;
  }

  // Tofaş
  if (makeLower === 'tofaş' || makeLower === 'tofas') {
    return 1600; // Şahin, Doğan, Kartal all had 1.6L engines
  }

  // Check for common engine size patterns in model name
  const engineMatch = modelLower.match(/(\d\.\d)/);
  if (engineMatch) {
    return parseFloat(engineMatch[1]) * 1000;
  }

  // Default: 1600cc (most common in Turkey)
  return DEFAULT_ENGINE_CC;
}

// ═══════════════════════════════════════════════════════════════════════
// İL BAZLI + FABRİKA VERİLİ YAKIT MALİYETİ HESAPLAMASI
// ═══════════════════════════════════════════════════════════════════════
//
// Yukarıdaki calculateFuelCost() ulusal ortalama + yakıt tipi tahmini kullanır
// (batch DB güncellemeleri için iyidir).
//
// Aşağıdaki estimateFuelCostByCity() ise:
//   - Aracın fabrika yakıt tüketim verisini kullanır (WLTP/NEDC)
//   - Seçilen ildeki güncel yakıt fiyatını kullanır
//   - Component-driven yakıt maliyeti hesaplaması için tasarlanmıştır

export interface FuelCostByCityInput {
  make: string;
  model: string;
  year: number;
  fuelType: string | null;
  city: string;
  annualKm: number;
  // Listing kaydında fabrika verisi varsa kullanılır
  fuelConsumptionCity?: number | null;
  fuelConsumptionHighway?: number | null;
  fuelConsumptionCombined?: number | null;
  fuelConsumptionUnit?: string | null;
  fuelConsumptionSource?: string | null;
}

export interface FuelCostByCityResult {
  annualCost: number;
  monthlyCost: number;
  annualConsumption: number; // L veya kWh
  consumption: {
    city: number | null;
    highway: number | null;
    combined: number;
    unit: 'L' | 'kWh';
    source: 'factory' | 'estimated';
    isEstimated: boolean;
  };
  fuelPrice: {
    price: number;
    unit: 'L' | 'kWh';
    fuelType: FuelPriceType;
    source: 'epdk' | 'fallback';
    fetchedAt: string;
  };
  city: string;
}

/**
 * İl bazlı + fabrika verisiyle yakıt maliyeti hesaplar.
 *
 * Şu hesaplama yapılır:
 *   yıllık yakıt maliyeti = (yıllık km / 100) × combined tüketim × il bazlı fiyat
 *
 * @returns FuelCostByCityResult — yıllık/aylık maliyet + tüm ara değerler
 */
export async function estimateFuelCostByCity(input: FuelCostByCityInput): Promise<FuelCostByCityResult> {
  const consumption = await getVehicleFuelConsumption({
    make: input.make,
    model: input.model,
    year: input.year,
    fuelType: input.fuelType,
    fuelConsumptionCity: input.fuelConsumptionCity ?? null,
    fuelConsumptionHighway: input.fuelConsumptionHighway ?? null,
    fuelConsumptionCombined: input.fuelConsumptionCombined ?? null,
    fuelConsumptionUnit: input.fuelConsumptionUnit ?? null,
    fuelConsumptionSource: input.fuelConsumptionSource ?? null,
  });

  // Yakıt tipi normalize → FuelPriceType
  const fuelTypeStr = (input.fuelType || 'Benzin').toLowerCase();
  let fuelType: FuelPriceType = 'Benzin';
  if (fuelTypeStr.includes('dizel') || fuelTypeStr.includes('diesel')) fuelType = 'Dizel';
  else if (fuelTypeStr.includes('elektrik')) fuelType = 'Elektrik';
  else if (fuelTypeStr.includes('hybrid') || fuelTypeStr.includes('hibrit')) fuelType = 'Hybrid';
  else if (fuelTypeStr === 'lpg' || fuelTypeStr === 'otogaz') fuelType = 'LPG';
  else if (fuelTypeStr.includes('lpg') && fuelTypeStr.includes('benzin')) fuelType = 'LPG';

  const fuelPrice = await getFuelPrice(input.city, fuelType);

  const annualConsumption = (input.annualKm / 100) * consumption.combined;
  const annualCost = annualConsumption * fuelPrice.price;

  return {
    annualCost: Math.round(annualCost),
    monthlyCost: Math.round(annualCost / 12),
    annualConsumption: Math.round(annualConsumption * 10) / 10,
    consumption: {
      city: consumption.city,
      highway: consumption.highway,
      combined: consumption.combined,
      unit: consumption.unit,
      source: consumption.source,
      isEstimated: consumption.isEstimated,
    },
    fuelPrice: {
      price: fuelPrice.price,
      unit: fuelPrice.unit,
      fuelType: fuelPrice.fuelType,
      source: fuelPrice.source,
      fetchedAt: fuelPrice.fetchedAt,
    },
    city: fuelPrice.city,
  };
}
