'use client'

import { useState, useMemo, useEffect } from 'react'
import { Calculator, TrendingDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { formatPrice } from '@/components/price-display'

// ── Kredi Hesaplayıcı ───────────────────────────────────────────────────
//
// Otomobil kredisi hesaplama aracı.
// Faiz oranı, vade, peşinat girilir → aylık taksit, toplam ödeme, faiz toplamı.
//
// Türkçe format: faiz %2.59/ay gibi (aylık bileşik faiz)

interface LoanCalculatorProps {
  /** İlan fiyatı (varsayılan tutar olarak kullanılır) */
  price?: number
  /** Compact mod (ilan detayında küçük gösterim) */
  compact?: boolean
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

export function LoanCalculator({ price, compact = false }: LoanCalculatorProps) {
  const [vehiclePrice, setVehiclePrice] = useState(price ? Math.round(price).toString() : '500000')
  const [downPayment, setDownPayment] = useState('0') // peşinat
  const [interestRate, setInterestRate] = useState('2.59') // aylık faiz %
  const [termMonths, setTermMonths] = useState('36') // vade (ay)

  // price prop değişince vehiclePrice'ı güncelle
  useEffect(() => {
    if (price) {
      setVehiclePrice(Math.round(price).toString())
      setDownPayment('0')
    }
  }, [price])

  const results = useMemo(() => {
    const price = parseFloat(vehiclePrice) || 0
    const down = parseFloat(downPayment) || 0
    const rate = parseFloat(interestRate) || 0
    const months = parseInt(termMonths) || 1

    const loanAmount = Math.max(0, price - down)
    if (loanAmount <= 0 || months <= 0) {
      return { monthlyPayment: 0, totalPayment: 0, totalInterest: 0, loanAmount: 0 }
    }

    // Aylık bileşik faiz formülü
    // Aylık taksit = P * r * (1+r)^n / ((1+r)^n - 1)
    const r = rate / 100
    const pow = Math.pow(1 + r, months)
    const monthlyPayment = loanAmount * r * pow / (pow - 1)
    const totalPayment = monthlyPayment * months
    const totalInterest = totalPayment - loanAmount

    return {
      monthlyPayment: Math.round(monthlyPayment),
      totalPayment: Math.round(totalPayment),
      totalInterest: Math.round(totalInterest),
      loanAmount: Math.round(loanAmount),
    }
  }, [vehiclePrice, downPayment, interestRate, termMonths])

  const quickTerms = [12, 24, 36, 48, 60]

  return (
    <Card className={compact ? 'border-[#2A2A2A]' : 'shadow-lg'}>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Calculator className="h-5 w-5 text-orange-600" />
          Kredi Hesaplayıcı
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Araç Fiyatı */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Araç Fiyatı (TL)</label>
          <Input
            type="number"
            value={vehiclePrice}
            onChange={(e) => setVehiclePrice(e.target.value)}
            className="text-right"
            placeholder="500000"
          />
        </div>

        {/* Peşinat */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Peşinat (TL)</label>
          <Input
            type="number"
            value={downPayment}
            onChange={(e) => setDownPayment(e.target.value)}
            className="text-right"
            placeholder="0"
          />
          <div className="flex gap-1.5">
            {[0, 10, 20, 30].map((pct) => (
              <button
                key={pct}
                onClick={() => {
                  const p = parseFloat(vehiclePrice) || 0
                  setDownPayment(Math.round(p * pct / 100).toString())
                }}
                className="flex-1 py-1 text-[11px] rounded border border-border hover:bg-muted transition-colors"
              >
                %{pct}
              </button>
            ))}
          </div>
        </div>

        {/* Faiz Oranı */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Aylık Faiz Oranı (%)</label>
          <Input
            type="number"
            step="0.01"
            value={interestRate}
            onChange={(e) => setInterestRate(e.target.value)}
            className="text-right"
            placeholder="2.59"
          />
        </div>

        {/* Vade */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Vade (Ay)</label>
          <div className="flex gap-1.5">
            {quickTerms.map((t) => (
              <button
                key={t}
                onClick={() => setTermMonths(t.toString())}
                className={`flex-1 py-2 text-xs rounded-lg border transition-all ${
                  termMonths === t.toString()
                    ? 'bg-orange-600 text-white border-orange-600 font-semibold'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {t} ay
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Sonuçlar */}
        <div className="space-y-2.5">
          {/* Aylık Taksit — büyük vurgu */}
          <div className="bg-[#1A1A1A] rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Aylık Taksit</p>
            <p className="text-2xl sm:text-3xl font-extrabold text-orange-700">
              {formatPrice(results.monthlyPayment)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              {results.monthlyPayment > 0
                ? `${turkishFormatter.format(results.monthlyPayment)} TL/ay`
                : 'Hesaplanıyor...'}
            </p>
          </div>

          {/* Detaylar */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-[11px] text-muted-foreground">Kredi Tutarı</p>
              <p className="font-bold">{formatPrice(results.loanAmount)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5">
              <p className="text-[11px] text-muted-foreground">Toplam Faiz</p>
              <p className="font-bold text-red-600">{formatPrice(results.totalInterest)}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2.5 col-span-2">
              <p className="text-[11px] text-muted-foreground">Toplam Geri Ödeme</p>
              <p className="font-bold text-orange-700">{formatPrice(results.totalPayment)}</p>
            </div>
          </div>

          {/* Bilgi notu */}
          <p className="text-[10px] text-muted-foreground text-center leading-tight">
            * Hesaplama tahmidir. Banka faiz oranları ve dosya masrafları farklılık gösterebilir.
            Güncel faiz oranları için bankanızla iletişime geçin.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
