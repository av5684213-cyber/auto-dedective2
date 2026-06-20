'use client'

interface PriceDisplayProps {
  price: number
  estimatedValue?: number | null
  dealTag?: string | null
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const turkishFormatter = new Intl.NumberFormat('tr-TR')

function formatPrice(value: number): string {
  return turkishFormatter.format(value) + ' ₺'
}

export function PriceDisplay({ price, estimatedValue, dealTag, className, size = 'md' }: PriceDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm font-semibold',
    md: 'text-lg font-bold',
    lg: 'text-2xl font-bold',
  }

  const isGoodDeal = dealTag === 'Harika Fırsat' || dealTag === 'İyi Fiyat'
  const isBadDeal = dealTag === 'Pahalı' || dealTag === 'Piyasa Üstü'

  return (
    <div className={className}>
      <div className={`${sizeClasses[size]} ${isGoodDeal ? 'text-green-600' : isBadDeal ? 'text-red-500' : 'text-foreground'}`}>
        {formatPrice(price)}
      </div>
      {estimatedValue && estimatedValue !== price && (
        <div className="text-xs text-muted-foreground mt-0.5">
          Tahmini: {formatPrice(estimatedValue)}
          {price > estimatedValue && (
            <span className="text-red-400 ml-1">
              (+{formatPrice(price - estimatedValue)})
            </span>
          )}
          {price < estimatedValue && (
            <span className="text-green-500 ml-1">
              (-{formatPrice(estimatedValue - price)})
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export { formatPrice }
