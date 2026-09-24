import { useState } from 'react'
import type { DiscoveredDevice, ScreenSource, SharePreset } from '../../../shared/types'
import { SourcePicker } from '../components/SourcePicker'
import { QualityPicker } from '../components/QualityPicker'
import { DeviceCard } from '../components/DeviceCard'

interface ShareSetupScreenProps {
  devices: DiscoveredDevice[]
  busy: boolean
  onBack: () => void
  onStart: (source: ScreenSource, target: DiscoveredDevice, presetId: SharePreset['id'], audio: boolean) => void
}

export function ShareSetupScreen({ devices, busy, onBack, onStart }: ShareSetupScreenProps): JSX.Element {
  const [source, setSource] = useState<ScreenSource | null>(null)
  const [target, setTarget] = useState<DiscoveredDevice | null>(null)
  const [presetId, setPresetId] = useState<SharePreset['id']>('high-quality')
  const [audio, setAudio] = useState(false)

  const available = devices.filter((d) => !d.blocked)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, gap: 18, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="tl-btn tl-btn-ghost" onClick={onBack} disabled={busy}>
          ← Voltar
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Compartilhar minha tela</span>
      </div>

      <SourcePicker selectedId={source?.id ?? null} onSelect={setSource} />

      <div>
        <div style={{ fontSize: 12, color: 'var(--tl-text-dim)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Enviar para
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {available.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tl-text-faint)' }}>Nenhum dispositivo encontrado na rede.</div>
          )}
          {available.map((d) => (
            <div
              key={d.id}
              onClick={() => setTarget(d)}
              style={{
                cursor: 'pointer',
                borderRadius: 14,
                outline: target?.id === d.id ? '2px solid var(--tl-blue)' : 'none'
              }}
            >
              <DeviceCard device={d} />
            </div>
          ))}
        </div>
      </div>

      <QualityPicker presetId={presetId} onChange={setPresetId} audio={audio} onAudioChange={setAudio} />

      <button
        className="tl-btn tl-btn-primary"
        style={{ justifyContent: 'center', marginTop: 4 }}
        disabled={!source || !target || busy}
        onClick={() => source && target && onStart(source, target, presetId, audio)}
      >
        {busy ? 'Conectando…' : 'Começar compartilhamento'}
      </button>
    </div>
  )
}
