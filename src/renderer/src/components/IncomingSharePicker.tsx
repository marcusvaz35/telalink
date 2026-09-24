import { useState } from 'react'
import type { DeviceInfo, ScreenSource, SharePreset } from '../../../shared/types'
import { SourcePicker } from './SourcePicker'
import { QualityPicker } from './QualityPicker'

interface IncomingSharePickerProps {
  from: DeviceInfo
  busy: boolean
  onCancel: () => void
  onConfirm: (source: ScreenSource, presetId: SharePreset['id'], audio: boolean) => void
}

export function IncomingSharePicker({ from, busy, onCancel, onConfirm }: IncomingSharePickerProps): JSX.Element {
  const [source, setSource] = useState<ScreenSource | null>(null)
  const [presetId, setPresetId] = useState<SharePreset['id']>('high-quality')
  const [audio, setAudio] = useState(false)

  return (
    <div className="tl-overlay">
      <div
        className="tl-card tl-fade-in"
        style={{ width: 360, maxHeight: '80vh', overflowY: 'auto', padding: 22, boxShadow: 'var(--tl-shadow)' }}
      >
        <div style={{ fontSize: 13, color: 'var(--tl-text-dim)', marginBottom: 4 }}>O que compartilhar com</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 16 }}>{from.name}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SourcePicker selectedId={source?.id ?? null} onSelect={setSource} />
          <QualityPicker presetId={presetId} onChange={setPresetId} audio={audio} onAudioChange={setAudio} />
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button className="tl-btn tl-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel} disabled={busy}>
            Cancelar
          </button>
          <button
            className="tl-btn tl-btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!source || busy}
            onClick={() => source && onConfirm(source, presetId, audio)}
          >
            {busy ? 'Conectando…' : 'Começar'}
          </button>
        </div>
      </div>
    </div>
  )
}
