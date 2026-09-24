import { useEffect, useRef, useState } from 'react'
import type { DeviceInfo, SignalMessage } from '../../shared/types'
import { PeerSession } from './webrtc/PeerSession'
import { ViewerScreen } from './screens/ViewerScreen'
import { Logo } from './components/Logo'

interface ViewerWindowAppProps {
  requestId: string
  peer: DeviceInfo
}

export function ViewerWindowApp({ requestId, peer }: ViewerWindowAppProps): JSX.Element {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null)
  const [lost, setLost] = useState(false)
  const sessionRef = useRef<PeerSession | null>(null)

  useEffect(() => {
    const session = new PeerSession(requestId, 'viewer')
    sessionRef.current = session
    session.onRemoteStream = (stream) => setRemoteStream(stream)

    const offMessage = window.telalink.onSignalMessage((message: SignalMessage) => {
      if (message.requestId === requestId) void session.handleSignal(message)
    })
    const offClosed = window.telalink.onSignalClosed((id) => {
      if (id === requestId) setLost(true)
    })

    // Avisa o processo principal que já dá pra entregar mensagens de sinalização
    // de verdade — antes disso, qualquer oferta/resposta que tenha chegado fica
    // represada lá, pra não se perder enquanto essa janela ainda carregava.
    void window.telalink.viewerReady(requestId)

    return () => {
      offMessage()
      offClosed()
      session.close()
    }
  }, [requestId])

  const handleDisconnect = (): void => {
    void window.telalink.hangup(requestId)
    window.close()
  }

  const handleSwap = (): void => {
    void window.telalink.requestSwap(peer)
  }

  if (lost) {
    return (
      <FullscreenMessage>
        <p>Conexão perdida.</p>
        <button className="tl-btn tl-btn-secondary" onClick={() => window.close()}>
          Fechar
        </button>
      </FullscreenMessage>
    )
  }

  if (!remoteStream) {
    return (
      <FullscreenMessage>
        <Logo size={32} withWordmark />
        <p style={{ color: 'var(--tl-text-dim)', marginTop: 12 }}>Conectando com {peer.name}…</p>
      </FullscreenMessage>
    )
  }

  return (
    <ViewerScreen
      remoteStream={remoteStream}
      peerSession={sessionRef.current as PeerSession}
      peerName={peer.name}
      onSwap={handleSwap}
      onDisconnect={handleDisconnect}
    />
  )
}

function FullscreenMessage({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}
    >
      {children}
    </div>
  )
}
