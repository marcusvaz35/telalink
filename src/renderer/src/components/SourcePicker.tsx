import { useEffect, useState } from 'react'
import type { ScreenSource } from '../../../shared/types'

interface SourcePickerProps {
  selectedId: string | null
  onSelect: (source: ScreenSource) => void
}

export function SourcePicker({ selectedId, onSelect }: SourcePickerProps): JSX.Element {
  const [sources, setSources] = useState<ScreenSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    window.telalink.listSources().then((list) => {
      if (!cancelled) {
        setSources(list)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return <p style={{ color: 'var(--tl-text-dim)', fontSize: 13 }}>Carregando telas e janelas…</p>
  }

  const screens = sources.filter((s) => s.kind === 'screen')
  const windows = sources.filter((s) => s.kind === 'window')

  const renderGrid = (label: string, items: ScreenSource[]): JSX.Element | null => {
    if (items.length === 0) return null
    return (
      <div>
        <div style={{ fontSize: 12, color: 'var(--tl-text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {label}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map((source) => {
            const selected = source.id === selectedId
            return (
              <button
                key={source.id}
                onClick={() => onSelect(source)}
                className="tl-card"
                style={{
                  padding: 8,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: selected ? '2px solid var(--tl-blue)' : '1px solid var(--tl-border-soft)',
                  background: selected ? 'var(--tl-bg-card-hover)' : 'var(--tl-bg-card)'
                }}
              >
                <img
                  src={source.thumbnailDataUrl}
                  alt={source.name}
                  style={{ width: '100%', height: 70, objectFit: 'cover', borderRadius: 8, background: '#000' }}
                />
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {source.name}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {renderGrid('Telas / Monitores', screens)}
      {renderGrid('Janelas', windows)}
    </div>
  )
}
