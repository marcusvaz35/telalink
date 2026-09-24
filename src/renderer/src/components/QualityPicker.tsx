import { SHARE_PRESETS, type SharePreset } from '../../../shared/types'

interface QualityPickerProps {
  presetId: SharePreset['id']
  onChange: (id: SharePreset['id']) => void
  audio: boolean
  onAudioChange: (audio: boolean) => void
}

export function QualityPicker({ presetId, onChange, audio, onAudioChange }: QualityPickerProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: 'var(--tl-text-dim)', textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Qualidade
      </div>
      {SHARE_PRESETS.map((preset) => (
        <label
          key={preset.id}
          className="tl-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            cursor: 'pointer',
            border: presetId === preset.id ? '1px solid var(--tl-blue)' : '1px solid var(--tl-border-soft)'
          }}
        >
          <input
            type="radio"
            name="quality-preset"
            checked={presetId === preset.id}
            onChange={() => onChange(preset.id)}
          />
          <span style={{ fontSize: 13 }}>{preset.label}</span>
        </label>
      ))}

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, cursor: 'pointer' }}>
        <input type="checkbox" checked={audio} onChange={(e) => onAudioChange(e.target.checked)} />
        <span style={{ fontSize: 13, color: 'var(--tl-text-dim)' }}>Incluir áudio do sistema</span>
      </label>
    </div>
  )
}
