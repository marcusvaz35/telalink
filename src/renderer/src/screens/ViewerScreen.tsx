import { useEffect, useRef, useState } from 'react'
import type { PeerSession, PeerSessionStats } from '../webrtc/PeerSession'

interface ViewerScreenProps {
  remoteStream: MediaStream
  peerSession: PeerSession
  peerName: string
  onSwap: () => void
  onDisconnect: () => void
}

const TEXTURE_WIDTH = 1920
const TEXTURE_HEIGHT = 1080
const TEXTURE_FPS = 15

/** ImageData do canvas vem em RGBA; Syphon/Spout esperam BGRA. */
function toBgra(rgba: Uint8ClampedArray): Uint8Array {
  const out = new Uint8Array(rgba.length)
  for (let i = 0; i < rgba.length; i += 4) {
    out[i] = rgba[i + 2]
    out[i + 1] = rgba[i + 1]
    out[i + 2] = rgba[i]
    out[i + 3] = rgba[i + 3]
  }
  return out
}

export function ViewerScreen({ remoteStream, peerSession, peerName, onSwap, onDisconnect }: ViewerScreenProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [stats, setStats] = useState<PeerSessionStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [textureSharing, setTextureSharing] = useState(false)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = remoteStream
  }, [remoteStream])

  // Publica pro Resolume (Syphon/Spout) automaticamente assim que a tela
  // chega — sem precisar clicar em nada. O botão 📡 continua existindo só
  // pra quem quiser parar/reiniciar manualmente.
  useEffect(() => {
    window.telalink
      .startTextureShare(peerSession.requestId, `TelaLink - ${peerName}`, TEXTURE_WIDTH, TEXTURE_HEIGHT)
      .then(() => setTextureSharing(true))
    return () => {
      void window.telalink.stopTextureShare(peerSession.requestId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      peerSession.getStats().then(setStats)
    }, 1000)
    return () => clearInterval(interval)
  }, [peerSession])

  useEffect(() => {
    if (!textureSharing) return

    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return
    canvas.width = TEXTURE_WIDTH
    canvas.height = TEXTURE_HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    const interval = setInterval(() => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return

      // Sempre publica em 1920x1080 fixo pro Resolume, preenchendo o quadro
      // inteiro (sem tarja/transparência nas bordas) — corta o excesso em vez
      // de encaixar com sobra, já que é pra ir direto pro telão.
      const scale = Math.max(TEXTURE_WIDTH / vw, TEXTURE_HEIGHT / vh)
      const drawWidth = Math.round(vw * scale)
      const drawHeight = Math.round(vh * scale)
      const offsetX = Math.round((TEXTURE_WIDTH - drawWidth) / 2)
      const offsetY = Math.round((TEXTURE_HEIGHT - drawHeight) / 2)

      ctx.drawImage(video, offsetX, offsetY, drawWidth, drawHeight)

      const { data } = ctx.getImageData(0, 0, TEXTURE_WIDTH, TEXTURE_HEIGHT)
      window.telalink.sendTextureFrame(peerSession.requestId, toBgra(data), TEXTURE_WIDTH, TEXTURE_HEIGHT)
    }, 1000 / TEXTURE_FPS)

    return () => clearInterval(interval)
  }, [textureSharing, peerSession])

  const handleFullscreen = (): void => {
    void window.telalink.toggleThisWindowFullscreen()
  }

  const handleScreenshot = async (): Promise<void> => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    await window.telalink.saveScreenshot(dataUrl)
  }

  const handleToggleTexture = async (): Promise<void> => {
    if (textureSharing) {
      setTextureSharing(false)
      await window.telalink.stopTextureShare(peerSession.requestId)
      return
    }
    await window.telalink.startTextureShare(peerSession.requestId, `TelaLink - ${peerName}`, TEXTURE_WIDTH, TEXTURE_HEIGHT)
    setTextureSharing(true)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%', background: '#000', display: 'flex' }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {showStats && stats && (
        <div
          className="tl-fade-in"
          style={{
            position: 'absolute',
            top: 12,
            left: 12,
            background: 'rgba(10,15,30,0.7)',
            border: '1px solid var(--tl-border)',
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 11,
            color: 'var(--tl-text-dim)',
            lineHeight: 1.6
          }}
        >
          <div>FPS: {stats.fps}</div>
          <div>Latência: {stats.latencyMs}ms</div>
          <div>Qualidade: {stats.resolution}</div>
          <div>Conexão: {stats.connectionType === 'p2p' ? 'P2P' : stats.connectionType === 'relay' ? 'Relay' : '—'}</div>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 8,
          background: 'rgba(10,15,30,0.75)',
          border: '1px solid var(--tl-border)',
          borderRadius: 14,
          padding: 8
        }}
      >
        <IconButton label="Tela cheia" onClick={handleFullscreen}>
          ⛶
        </IconButton>
        <IconButton label="Estatísticas" onClick={() => setShowStats((v) => !v)}>
          ℹ️
        </IconButton>
        <IconButton label="Capturar" onClick={handleScreenshot}>
          📸
        </IconButton>
        <IconButton
          label={textureSharing ? 'Parar envio pro Resolume' : 'Enviar pro Resolume (Syphon/Spout)'}
          onClick={() => void handleToggleTexture()}
          active={textureSharing}
        >
          📡
        </IconButton>
        <IconButton label="Trocar compartilhamento" onClick={onSwap}>
          ⇄
        </IconButton>
        <IconButton label="Desconectar" onClick={onDisconnect} danger>
          ✕
        </IconButton>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(10,15,30,0.7)',
          border: '1px solid var(--tl-border)',
          borderRadius: 10,
          padding: '6px 12px',
          fontSize: 12,
          color: 'var(--tl-text)'
        }}
      >
        Recebendo de {peerName}
      </div>
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  danger,
  active
}: {
  children: string
  label: string
  onClick: () => void
  danger?: boolean
  active?: boolean
}): JSX.Element {
  return (
    <button
      title={label}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        border: 'none',
        background: danger ? 'rgba(239,68,68,0.15)' : active ? 'var(--tl-gradient-strong)' : 'transparent',
        color: danger ? '#fca5a5' : 'var(--tl-text)',
        fontSize: 16,
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}
