// Otodedektif - Valuator Engine
//
// Progressive relaxation: strict → relaxed_fuel → relaxed_year
// Bounded mileage adjustment.

import { db } from '@/lib/db';

interface ValueEstimate {
  value: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  matchLevel?: 'strict' | 'relaxed_fuel' | 'relaxed_year' | 'none';
}

const MIN_SAMPLE_SIZE = 1;
const HIGH_CONFIDENCE_SIZE = 20;
const MEDIUM_CONFIDENCE_SIZE = 10;
const MILEAGE_ADJ_MAX_PCT = 0.20;
const MILEAGE_SLOPE_MIN = -0.02;
const MILEAGE_SLOPE_MAX = 0.0;
const MILEAGE_ADJ_MIN_SAMPLES = 3;

export class Valuator {
  static async updateAllListings(): Promise<void> {
    const listings = await db.listing.findMany({
      where: { isActive: true },
      orderBy: { lastSeenAt: 'desc' },
    });

    let updatedCount = 0;
    for (const listing of listings) {
      try {
        const estimate = await this.estimateValue(listing);
        const dealScore = this.calculateDealScore(listing.price, estimate.value);
        const dealTag = this.getDealTag(dealScore, estimate.confidence);

        await db.listing.update({
          where: { id: listing.id },
          data: {
            estimatedValue: estimate.value,
            confidence: estimate.confidence,
            comparableCount: estimate.sampleSize,
            dealScore, dealTag,
          },
        });
        updatedCount++;
      } catch (error) {
        console.error(`Error updating listing ${listing.id}:`, error);
      }
    }
    console.log(`Updated ${updatedCount} listings with valuations`);
  }

  private static async estimateValue(listing: any): Promise<ValueEstimate> {
    const hasFuel = !!listing.fuelType;
    const hasTransmission = !!listing.transmission;

    const strictWhere: Record<string, unknown> = {
      make: listing.make, model: listing.model,
      year: { gte: listing.year - 1, lte: listing.year + 1 },
      isActive: true, id: { not: listing.id },
    };
    if (hasFuel && hasTransmission) {
      strictWhere.fuelType = listing.fuelType;
      strictWhere.transmission = listing.transmission;
    }

    let comparables = await db.listing.findMany({
      where: strictWhere as any,
      select: { price: true, mileageKm: true },
    });
    let matchLevel: ValueEstimate['matchLevel'] = 'strict';

    if (comparables.length < MIN_SAMPLE_SIZE) {
      const relaxedWhere: Record<string, unknown> = {
        make: listing.make, model: listing.model,
        year: { gte: listing.year - 1, lte: listing.year + 1 },
        isActive: true, id: { not: listing.id },
      };
      comparables = await db.listing.findMany({
        where: relaxedWhere as any,
        select: { price: true, mileageKm: true },
      });
      matchLevel = 'relaxed_fuel';
    }

    if (comparables.length < MIN_SAMPLE_SIZE) {
      const widerWhere: Record<string, unknown> = {
        make: listing.make, model: listing.model,
        year: { gte: listing.year - 2, lte: listing.year + 2 },
        isActive: true, id: { not: listing.id },
      };
      comparables = await db.listing.findMany({
        where: widerWhere as any,
        select: { price: true, mileageKm: true },
      });
      matchLevel = 'relaxed_year';
    }

    const sampleSize = comparables.length;

    if (sampleSize < MIN_SAMPLE_SIZE) {
      return {
        value: listing.price, confidence: 'insufficient', sampleSize,
        minPrice: listing.price, maxPrice: listing.price,
        medianPrice: listing.price, matchLevel: 'none',
      };
    }

    const prices = comparables.map(c => c.price).sort((a, b) => a - b);
    const medianPrice = this.calculateMedian(prices);
    const mileageAdjustment = this.calculateMileageAdjustment(
      comparables, listing.mileageKm, medianPrice,
    );

    let estimatedValue = Math.round(medianPrice + mileageAdjustment);
    if (!Number.isFinite(estimatedValue) || estimatedValue <= 0) {
      estimatedValue = Math.max(1, Math.round(medianPrice));
    }

    let confidence: 'high' | 'medium' | 'low' | 'insufficient';
    if (sampleSize >= HIGH_CONFIDENCE_SIZE && matchLevel === 'strict') {
      confidence = 'high';
    } else if (sampleSize >= MEDIUM_CONFIDENCE_SIZE && matchLevel !== 'relaxed_year') {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      value: estimatedValue, confidence, sampleSize,
      minPrice: prices[0], maxPrice: prices[prices.length - 1],
      medianPrice, matchLevel,
    };
  }

  private static calculateMileageAdjustment(
    comparables: Array<{ price: number; mileageKm: number | null }>,
    targetMileage: number | null,
    medianPrice: number,
  ): number {
    if (targetMileage == null || targetMileage <= 0) return 0;

    const withMileage = comparables.filter(c => c.mileageKm != null && c.mileageKm > 0);
    if (withMileage.length < MILEAGE_ADJ_MIN_SAMPLES) return 0;

    const prices = withMileage.map(c => c.price);
    const mileages = withMileage.map(c => c.mileageKm as number);

    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgMileage = mileages.reduce((a, b) => a + b, 0) / mileages.length;

    let numerator = 0, denominator = 0;
    for (let i = 0; i < withMileage.length; i++) {
      const priceDiff = prices[i] - avgPrice;
      const mileageDiff = mileages[i] - avgMileage;
      numerator += priceDiff * mileageDiff;
      denominator += mileageDiff * mileageDiff;
    }

    if (denominator === 0) return 0;

    let slope = numerator / denominator;
    if (slope > MILEAGE_SLOPE_MAX) slope = MILEAGE_SLOPE_MAX;
    if (slope < MILEAGE_SLOPE_MIN) slope = MILEAGE_SLOPE_MIN;

    const mileageDiff = targetMileage - avgMileage;
    let adjustment = slope * mileageDiff;

    const maxAbs = medianPrice * MILEAGE_ADJ_MAX_PCT;
    if (adjustment > maxAbs) adjustment = maxAbs;
    if (adjustment < -maxAbs) adjustment = -maxAbs;

    return adjustment;
  }

  private static calculateMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private static calculateDealScore(price: number, estimatedValue: number): number {
    if (!estimatedValue || estimatedValue <= 0) return 0;
    return (price - estimatedValue) / estimatedValue;
  }

  private static getDealTag(score: number, confidence: string): string {
    if (score < -0.15) return 'Harika Fırsat';
    if (score < -0.05) return 'İyi Fiyat';
    if (score < 0.05) return 'Piyasa Fiyatı';
    if (score < 0.15) return 'Piyasa Üstü';
    return 'Pahalı';
  }

  static async estimateSingleListing(listingId: string): Promise<ValueEstimate | null> {
    const listing = await db.listing.findUnique({ where: { id: listingId } });
    if (!listing) return null;
    return this.estimateValue(listing);
  }
}

export async function valueAllListings(): Promise<{ updated: number; skipped: number }> {
  try {
    await Valuator.updateAllListings();
    const totalActive = await db.listing.count({
      where: { isActive: true, isDeleted: false, estimatedValue: { not: null } },
    });
    return { updated: totalActive, skipped: 0 };
  } catch {
    return { updated: 0, skipped: 0 };
  }
}
