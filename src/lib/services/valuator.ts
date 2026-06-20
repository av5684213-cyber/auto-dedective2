// apps/scraper/src/valuator.ts

import { db } from '@/lib/db';

interface ValueEstimate {
  value: number;
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
  sampleSize: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
}

export class Valuator {
  private static readonly MIN_SAMPLE_SIZE = 5;
  private static readonly HIGH_CONFIDENCE_SIZE = 20;
  private static readonly MEDIUM_CONFIDENCE_SIZE = 10;

  static async updateAllListings(): Promise<void> {
    const listings = await db.listing.findMany({
      where: { isActive: true },
      orderBy: { lastSeenAt: 'desc' }
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
            dealScore: dealScore,
            dealTag: dealTag
          }
        });
        
        updatedCount++;
      } catch (error) {
        console.error(`Error updating listing ${listing.id}:`, error);
      }
    }

    console.log(`Updated ${updatedCount} listings with valuations`);
  }

  private static async estimateValue(listing: any): Promise<ValueEstimate> {
    // Comparables: aynı make+model, year ±1, aynı fuel ve transmission
    const comparables = await db.listing.findMany({
      where: {
        make: listing.make,
        model: listing.model,
        year: {
          gte: listing.year - 1,
          lte: listing.year + 1
        },
        fuelType: listing.fuelType,
        transmission: listing.transmission,
        isActive: true,
        id: { not: listing.id }
      },
      select: {
        price: true,
        mileageKm: true
      }
    });

    const sampleSize = comparables.length;
    
    if (sampleSize < this.MIN_SAMPLE_SIZE) {
      return {
        value: listing.price,
        confidence: 'insufficient',
        sampleSize: sampleSize,
        minPrice: listing.price,
        maxPrice: listing.price,
        medianPrice: listing.price
      };
    }

    // Fiyatları topla ve sırala
    const prices = comparables.map(c => c.price).sort((a, b) => a - b);
    const medianPrice = this.calculateMedian(prices);
    
    // Km düzeltmesi (basit regresyon)
    const mileageAdjustment = this.calculateMileageAdjustment(comparables, listing.mileageKm);
    
    const estimatedValue = Math.round(medianPrice + mileageAdjustment);
    
    // Confidence değerlendirmesi
    let confidence: 'high' | 'medium' | 'low' | 'insufficient';
    if (sampleSize >= this.HIGH_CONFIDENCE_SIZE) {
      confidence = 'high';
    } else if (sampleSize >= this.MEDIUM_CONFIDENCE_SIZE) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      value: estimatedValue,
      confidence,
      sampleSize,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      medianPrice
    };
  }

  private static calculateMileageAdjustment(comparables: any[], targetMileage: number): number {
    if (comparables.length < 2 || !targetMileage) return 0;
    
    // Basit lineer regresyon: price ~ mileage
    const prices = comparables.map(c => c.price);
    const mileages = comparables.map(c => c.mileageKm || 0);
    
    // Ortalamalar
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const avgMileage = mileages.reduce((a, b) => a + b, 0) / mileages.length;
    
    // Slope hesapla
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < comparables.length; i++) {
      const priceDiff = prices[i] - avgPrice;
      const mileageDiff = (mileages[i] || 0) - avgMileage;
      numerator += priceDiff * mileageDiff;
      denominator += mileageDiff * mileageDiff;
    }
    
    const slope = denominator !== 0 ? numerator / denominator : 0;
    const mileageDiff = (targetMileage || 0) - avgMileage;
    
    return slope * mileageDiff;
  }

  private static calculateMedian(arr: number[]): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private static calculateDealScore(price: number, estimatedValue: number): number {
    if (!estimatedValue || estimatedValue === 0) return 0;
    return (price - estimatedValue) / estimatedValue;
  }

  private static getDealTag(score: number, confidence: string): string {
    if (confidence === 'insufficient') {
      return 'Değerlendirilemedi';
    }
    
    if (score < -0.15) return 'Harika Fırsat';
    if (score < -0.05) return 'İyi Fiyat';
    if (score < 0.05) return 'Piyasa Fiyatı';
    if (score < 0.15) return 'Piyasa Üstü';
    return 'Pahalı';
  }

  // Belirli bir ilan için manuel değerleme
  static async estimateSingleListing(listingId: string): Promise<ValueEstimate | null> {
    const listing = await db.listing.findUnique({
      where: { id: listingId }
    });
    
    if (!listing) return null;
    return this.estimateValue(listing);
  }
}

/**
 * Convenience wrapper: run valuation for all active listings.
 * Called by the admin/scrape pipeline.
 *
 * @returns Object with updated count
 */
export async function valueAllListings(): Promise<{
  updated: number;
  skipped: number;
}> {
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
