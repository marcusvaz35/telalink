import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import type { ScreenSource, SharePreset } from '../../../shared/types'
import { SourcePicker } from '../components/SourcePicker'
import { QualityPicker } from '../components/QualityPicker'

type Status = 'setup' | 'waiting' | 'connected'

interface WebShareScreenProps {
  status: Status
  url: string | null
  busy: boolean
  onBack: () => void
  onGenerate: (source: ScreenSource, presetId: SharePreset['id'], audio: boolean) => void
  onStop: () => void
}

export function WebShareScreen({ status, url, busy, onBack, onGenerate, onStop }: WebShareScreenProps): JSX.Element {
  const [source, setSource] = useState<ScreenSource | null>(null)
  const [presetId, setPresetId] = useState<SharePreset['id']>('high-quality')
  const [audio, setAudio] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      setQrDataUrl(null)
      return
    }
    QRCode.toDataURL(url, { width: 240, margin: 1, color: { dark: '#0a0f1e', light: '#f4f8ff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [url])

  if (status === 'setup') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, gap: 18, overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="tl-btn tl-btn-ghost" onClick={onBack} disabled={busy}>
            ← Voltar
          </button>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Compartilhar com iPhone/Android</span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--tl-text-dim)', lineHeight: 1.5 }}>
          Gera um link temporário. Abra no Safari/Chrome do celular, na mesma rede, pra ver sua tela — não
          precisa instalar nada. O celular só recebe; ainda não dá pra compartilhar a tela dele de volta.
        </p>

        <SourcePicker selectedId={source?.id ?? null} onSelect={setSource} />
        <QualityPicker presetId={presetId} onChange={setPresetId} audio={audio} onAudioChange={setAudio} />

        <button
          className="tl-btn tl-btn-primary"
          style={{ justifyContent: 'center', marginTop: 4 }}
          disabled={!source || busy}
          onClick={() => source && onGenerate(source, presetId, audio)}
        >
          {busy ? 'Gerando…' : 'Gerar link'}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, gap: 18, alignItems: 'center', textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {status === 'waiting' ? 'Aguardando o celular…' : 'Compartilhando com o celular'}
        </span>
      </div>

      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="QR code do link"
          style={{ width: 220, height: 220, borderRadius: 16, border: '1px solid var(--tl-border)' }}
        />
      )}

      {url && (
        <div className="tl-card" style={{ padding: '10px 14px', fontSize: 12, color: 'var(--tl-text-dim)', wordBreak: 'break-all', maxWidth: 320 }}>
          {url}
        </div>
      )}

      <p style={{ fontSize: 13, color: 'var(--tl-text-dim)', maxWidth: 300 }}>
        {status === 'waiting'
          ? 'Aponte a câmera do iPhone/Android pro QR code, ou abra o link no navegador, na mesma rede Wi-Fi.'
          : 'A tela já está sendo exibida no navegador do celular.'}
      </p>

      {status === 'connected' && (
        <div className="tl-card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="tl-dot tl-dot-online" />
          <span style={{ fontSize: 13 }}>Conectado</span>
        </div>
      )}

      <button className="tl-btn tl-btn-danger" onClick={onStop}>
        Parar compartilhamento
      </button>
    </div>
  )
}
