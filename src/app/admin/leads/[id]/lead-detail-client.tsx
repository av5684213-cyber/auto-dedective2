'use client'

import { useState } from 'react'

interface Note {
  id: string
  content: string
  createdAt: string
}

export default function LeadDetailClient({
  leadId,
  initialNotes,
}: {
  leadId: string
  initialNotes: Note[]
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, noteContent: content }),
      })
      if (res.ok) {
        const data = await res.json()
        setNotes((prev) => [{ ...data.note }, ...prev])
        setContent('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-card border rounded-lg p-5">
      <h2 className="text-sm font-semibold mb-3">Notlar</h2>

      <form onSubmit={addNote} className="flex gap-2 mb-4">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Yeni not ekle…"
          className="flex-1 px-3 py-1.5 text-sm border rounded bg-background"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded disabled:opacity-50"
        >
          Ekle
        </button>
      </form>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Henüz not yok.</p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="p-3 bg-muted/30 rounded text-sm">
              <p>{note.content}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(note.createdAt).toLocaleString('tr-TR')}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
