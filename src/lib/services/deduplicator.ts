// apps/scraper/src/deduplicator.ts

import { db } from '@/lib/db';
import { ListingRaw } from '../adapters/base';

export class Deduplicator {
  // Gruplama stratejileri
  static readonly MAX_PRICE_DIFF_PERCENT = 0.05; // %5
  static readonly MAX_MILEAGE_DIFF_PERCENT = 0.05; // %5
  private static readonly SAME_YEAR_ALLOWED = 1; // ±1 yıl

  static async groupDuplicates(listings: ListingRaw[]): Promise<Map<string, string[]>> {
    const groups = new Map<string, string[]>();
    const processed = new Set<string>();

    for (const listing of listings) {
      if (processed.has(listing.sourceUrl)) continue;
      
      const groupKey = await this.findOrCreateGroup(listing);
      if (!groupKey) continue;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      
      groups.get(groupKey)!.push(listing.sourceUrl);
      processed.add(listing.sourceUrl);
    }

    return groups;
  }

  private static async findOrCreateGroup(listing: ListingRaw): Promise<string | null> {
    // 1. VIN ile eşleştirme (en güvenilir)
    if (listing.vin) {
      const existing = await db.listing.findFirst({
        where: {
          vin: listing.vin,
          isActive: true,
        }
      });
      
      if (existing) {
        return existing.duplicateGroupId || `vin:${listing.vin}`;
      }
    }

    // 2. Make+Model+Year + Benzer Km + Benzer Fiyat + Aynı Şehir
    const similar = await db.listing.findMany({
      where: {
        make: listing.make,
        model: listing.model,
        year: {
          gte: listing.year - this.SAME_YEAR_ALLOWED,
          lte: listing.year + this.SAME_YEAR_ALLOWED
        },
        city: listing.city,
        isActive: true,
      },
      select: {
        id: true,
        price: true,
        mileageKm: true,
        duplicateGroupId: true
      }
    });

    for (const candidate of similar) {
      // Km farkı kontrolü
      const kmDiff = Math.abs((candidate.mileageKm || 0) - (listing.mileageKm || 0));
      const kmPercent = kmDiff / Math.max(candidate.mileageKm || 1, listing.mileageKm || 1);
      
      // Fiyat farkı kontrolü
      const priceDiff = Math.abs(candidate.price - listing.price);
      const pricePercent = priceDiff / Math.max(candidate.price, listing.price);

      if (kmPercent <= this.MAX_MILEAGE_DIFF_PERCENT && 
          pricePercent <= this.MAX_PRICE_DIFF_PERCENT) {
        return candidate.duplicateGroupId || `group:${candidate.id}`;
      }
    }

    return null;
  }

  static async getDuplicateGroup(listingId: string): Promise<string[]> {
    // SQLite doesn't support array `has` filter, so we fetch all groups and filter in JS
    const groups = await db.duplicateGroup.findMany();
    
    for (const group of groups) {
      const ids = group.listingIds.split(',');
      if (ids.includes(listingId)) {
        return ids;
      }
    }
    return [];
  }
}

/**
 * Run deduplication across all active listings in the database.
 * Groups duplicates by VIN and make+model+year+city+price+mileage proximity.
 *
 * @returns Object with groupsCreated count and totalGroups count
 */
export async function runDeduplication(): Promise<{
  groupsCreated: number;
  totalGroups: number;
}> {
  const listings = await db.listing.findMany({
    where: { isActive: true, isDeleted: false },
    select: {
      id: true,
      sourceUrl: true,
      vin: true,
      make: true,
      model: true,
      year: true,
      price: true,
      mileageKm: true,
      city: true,
      duplicateGroupId: true,
    },
  });

  let groupsCreated = 0;
  const existingGroups = new Set<string>();

  // Collect existing group IDs
  for (const listing of listings) {
    if (listing.duplicateGroupId) {
      existingGroups.add(listing.duplicateGroupId);
    }
  }

  // Find duplicates by comparing pairs
  for (let i = 0; i < listings.length; i++) {
    const a = listings[i];
    if (!a.vin && !a.make) continue; // Skip incomplete listings

    for (let j = i + 1; j < listings.length; j++) {
      const b = listings[j];

      // Must be same make+model+city
      if (a.make !== b.make || a.model !== b.model || a.city !== b.city) continue;

      // Year must be within ±1
      if (Math.abs(a.year - b.year) > 1) continue;

      let isDuplicate = false;

      // VIN match (strongest signal)
      if (a.vin && b.vin && a.vin === b.vin) {
        isDuplicate = true;
      } else {
        // Price within 5% and mileage within 5%
        const priceDiff = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
        const kmA = a.mileageKm ?? 0;
        const kmB = b.mileageKm ?? 0;
        const kmDiff = Math.abs(kmA - kmB) / Math.max(kmA, kmB, 1);

        if (priceDiff <= Deduplicator.MAX_PRICE_DIFF_PERCENT && kmDiff <= Deduplicator.MAX_MILEAGE_DIFF_PERCENT) {
          isDuplicate = true;
        }
      }

      if (isDuplicate) {
        // Use existing group or create new one
        const groupId = a.duplicateGroupId || b.duplicateGroupId || `group:${a.id}`;

        // Update both listings with the group ID
        if (a.duplicateGroupId !== groupId) {
          await db.listing.update({ where: { id: a.id }, data: { duplicateGroupId: groupId } });
        }
        if (b.duplicateGroupId !== groupId) {
          await db.listing.update({ where: { id: b.id }, data: { duplicateGroupId: groupId } });
        }

        // Create or update DuplicateGroup record
        const existingGroup = await db.duplicateGroup.findFirst({
          where: { id: groupId },
        });

        if (!existingGroup) {
          await db.duplicateGroup.create({
            data: {
              id: groupId,
              listingIds: [a.id, b.id].join(','),
              primaryId: a.id,
            },
          });
          groupsCreated++;
        } else {
          const existingIds = new Set(existingGroup.listingIds.split(','));
          if (!existingIds.has(a.id)) existingIds.add(a.id);
          if (!existingIds.has(b.id)) existingIds.add(b.id);
          await db.duplicateGroup.update({
            where: { id: groupId },
            data: { listingIds: Array.from(existingIds).join(',') },
          });
        }
      }
    }
  }

  const totalGroups = await db.duplicateGroup.count();

  return { groupsCreated, totalGroups };
}
