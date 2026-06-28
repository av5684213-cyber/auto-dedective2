'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const STATUSES = [
  { value: 'new', label: 'Yeni' },
  { value: 'contacted', label: 'İletişim Kuruldu' },
  { value: 'interested', label: 'İlgili' },
  { value: 'no_response', label: 'Yanıt Yok' },
  { value: 'converted', label: 'Dönüştü' },
  { value: 'lost', label: 'Kayıp' },
]

export default function LeadStatusUpdater({
  leadId,
  currentStatus,
}: {
  leadId: string
  currentStatus: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [updating, setUpdating] = useState(false)

  const update = async (newStatus: string) => {
    setUpdating(true)
    try {
      await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      setStatus(newStatus)
      router.refresh()
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="space-y-2">
      <select
        value={status}
        onChange={(e) => update(e.target.value)}
        disabled={updating}
        className="w-full px-3 py-2 text-sm border rounded bg-background"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        Durum değişikliği anında kaydedilir.
      </p>
    </div>
  )
}
