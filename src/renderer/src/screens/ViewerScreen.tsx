import { useEffect, useRef, useState } from 'react'
import type { PeerSession, PeerSessionStats } from '../webrtc/PeerSession'

interface ViewerScreenProps {
  remoteStream: MediaStream
  peerSession: PeerSession
  peerName: string
  onSwap: () => void
  onDisconnect: () => void
}

export function ViewerScreen({ remoteStream, peerSession, peerName, onSwap, onDisconnect }: ViewerScreenProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [stats, setStats] = useState<PeerSessionStats | null>(null)
  const [showStats, setShowStats] = useState(true)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = remoteStream
  }, [remoteStream])

  useEffect(() => {
    const interval = setInterval(() => {
      peerSession.getStats().then(setStats)
    }, 1000)
    return () => clearInterval(interval)
  }, [peerSession])

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

  return (
    <div ref={containerRef} style={{ position: 'relative', height: '100%', background: '#000', display: 'flex' }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />

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
  danger
}: {
  children: string
  label: string
  onClick: () => void
  danger?: boolean
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
        background: danger ? 'rgba(239,68,68,0.15)' : 'transparent',
        color: danger ? '#fca5a5' : 'var(--tl-text)',
        fontSize: 16,
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  )
}
