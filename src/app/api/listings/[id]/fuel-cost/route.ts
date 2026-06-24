// Otodedektif - Yakıt Maliyeti Hesaplama API
//
// GET /api/listings/[id]/fuel-cost?city=İstanbul&annualKm=15000
//
// Şunu döndürür:
//   - Aracın fabrika yakıt tüketim verisi (L/100km veya kWh/100km)
//   - Seçilen ildeki güncel yakıt fiyatı
//   - Hesaplanan yıllık ve aylık yakıt maliyeti
//   - Veri kaynağı bilgileri (factory/estimated, epdk/fallback)

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { loadFallbackListings } from '@/lib/services/fallback-data';
import { getFuelPrice, type FuelPriceType } from '@/lib/services/fuel-prices';
import { getVehicleFuelConsumption } from '@/lib/services/vehicle-fuel-specs';
import { transformListing } from '@/lib/utils/transform-listing';

interface FuelCostResponse {
  listingId: string;
  city: string;
  annualKm: number;

  consumption: {
    city: number | null;
    highway: number | null;
    combined: number;
    unit: 'L' | 'kWh';
    source: 'factory' | 'estimated';
    isEstimated: boolean;
    matchedFrom?: string;
  };

  fuelPrice: {
    price: number;
    unit: 'L' | 'kWh';
    fuelType: FuelPriceType;
    source: 'epdk' | 'fallback';
    fetchedAt: string;
  };

  calculation: {
    annualCost: number;
    monthlyCost: number;
    annualConsumption: number;
    formula: string;
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city') || 'İstanbul';
    const annualKm = parseInt(searchParams.get('annualKm') || '15000', 10);

    if (!annualKm || annualKm < 1000 || annualKm > 200000) {
      return NextResponse.json(
        { error: 'Geçersiz annualKm. 1000-200000 arası olmalı.' },
        { status: 400 },
      );
    }

    let listing: any = null;
    try {
      listing = await db.listing.findUnique({ where: { id } });
    } catch {
      // DB erişilemiyor — fallback'e düş
    }

    if (!listing) {
      const fallback = loadFallbackListings().find((l) => l.id === id);
      if (fallback) listing = fallback;
    }

    if (!listing) {
      return NextResponse.json({ error: 'İlan bulunamadı' }, { status: 404 });
    }

    const transformed = transformListing(listing as unknown as Record<string, unknown>);

    const consumption = await getVehicleFuelConsumption({
      make: transformed.make,
      model: transformed.model,
      year: transformed.year,
      fuelType: transformed.fuelType,
      fuelConsumptionCity: transformed.fuelConsumptionCity ?? null,
      fuelConsumptionHighway: transformed.fuelConsumptionHighway ?? null,
      fuelConsumptionCombined: transformed.fuelConsumptionCombined ?? null,
      fuelConsumptionUnit: transformed.fuelConsumptionUnit ?? null,
      fuelConsumptionSource: transformed.fuelConsumptionSource ?? null,
    });

    const fuelTypeStr = (transformed.fuelType || 'Benzin').toLowerCase();
    let fuelType: FuelPriceType = 'Benzin';
    if (fuelTypeStr.includes('dizel') || fuelTypeStr.includes('diesel')) fuelType = 'Dizel';
    else if (fuelTypeStr.includes('elektrik')) fuelType = 'Elektrik';
    else if (fuelTypeStr.includes('hybrid') || fuelTypeStr.includes('hibrit')) fuelType = 'Hybrid';
    else if (fuelTypeStr === 'lpg' || fuelTypeStr === 'otogaz') fuelType = 'LPG';
    else if (fuelTypeStr.includes('lpg') && fuelTypeStr.includes('benzin')) fuelType = 'LPG';

    const fuelPrice = await getFuelPrice(city, fuelType);

    const annualConsumption = (annualKm / 100) * consumption.combined;
    const annualCost = annualConsumption * fuelPrice.price;
    const monthlyCost = annualCost / 12;

    const unitLabel = consumption.unit === 'kWh' ? 'kWh' : 'L';
    const priceUnitLabel = fuelPrice.unit === 'kWh' ? 'kWh' : 'L';

    const response: FuelCostResponse = {
      listingId: id,
      city: fuelPrice.city,
      annualKm,
      consumption: {
        city: consumption.city,
        highway: consumption.highway,
        combined: consumption.combined,
        unit: consumption.unit,
        source: consumption.source,
        isEstimated: consumption.isEstimated,
        matchedFrom: consumption.matchedFrom,
      },
      fuelPrice: {
        price: fuelPrice.price,
        unit: fuelPrice.unit,
        fuelType: fuelPrice.fuelType,
        source: fuelPrice.source,
        fetchedAt: fuelPrice.fetchedAt,
      },
      calculation: {
        annualCost: Math.round(annualCost),
        monthlyCost: Math.round(monthlyCost),
        annualConsumption: Math.round(annualConsumption * 10) / 10,
        formula: `(yıllık ${annualKm.toLocaleString('tr-TR')} km / 100) × ${consumption.combined} ${unitLabel}/100km × ${fuelPrice.price.toFixed(2)} TL/${priceUnitLabel}`,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[API /listings/[id]/fuel-cost] Error:', error);
    return NextResponse.json(
      { error: 'Yakıt maliyeti hesaplanamadı' },
      { status: 500 },
    );
  }
}
