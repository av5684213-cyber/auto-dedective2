'use client'

import { DEAL_TAG_CONFIG } from '@/lib/constants'
import { Badge } from '@/components/ui/badge'

interface DealBadgeProps {
  tag?: string | null
  showIcon?: boolean
  className?: string
}

export function DealBadge({ tag, showIcon = true, className }: DealBadgeProps) {
  if (!tag) return null

  const config = DEAL_TAG_CONFIG[tag]
  if (!config) return null

  return (
    <Badge
      className={`border-0 text-xs font-semibold ${className || ''}`}
      style={{
        backgroundColor: config.bgColor,
        color: config.color,
      }}
    >
      {showIcon && <span className="mr-1">{config.icon}</span>}
      {tag}
    </Badge>
  )
}
