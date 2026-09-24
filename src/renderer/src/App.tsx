import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DeviceInfo,
  DiscoveredDevice,
  IncomingRequestPayload,
  ScreenSource,
  SharePreset,
  SignalMessage
} from '../../shared/types'
import { SHARE_PRESETS } from '../../shared/types'
import { PeerSession } from './webrtc/PeerSession'
import { captureSource } from './webrtc/capture'
import { HomeScreen } from './screens/HomeScreen'
import { ShareSetupScreen } from './screens/ShareSetupScreen'
import { ReceiveScreen } from './screens/ReceiveScreen'
import { WebShareScreen } from './screens/WebShareScreen'
import { ShareControlBar } from './components/ShareControlBar'
import { ConnectionRequestModal } from './components/ConnectionRequestModal'
import { IncomingSharePicker } from './components/IncomingSharePicker'
import { Toast } from './components/Toast'
import { UpdateBanner } from './components/UpdateBanner'

type View = 'home' | 'share-setup' | 'receive' | 'sharing' | 'web-share'

interface PendingOutgoing {
  requestId: string
  kind: 'share-offer' | 'view-request'
  target: DiscoveredDevice
  source?: ScreenSource
  presetId?: SharePreset['id']
  audio?: boolean
}

interface SharingState {
  requestId: string
  peer: DeviceInfo
  sourceName: string
  localStream: MediaStream
}

interface WebShareState {
  requestId: string
  url: string
  session: PeerSession
  localStream: MediaStream
  status: 'waiting' | 'connected'
}

export default function App(): JSX.Element {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [view, setView] = useState<View>('home')
  const [updateInfo, setUpdateInfo] = useState<{ version: string; url: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; tone: 'info' | 'error' } | null>(null)
  const [outgoingBusyId, setOutgoingBusyId] = useState<string | null>(null)
  const [incomingRequest, setIncomingRequest] = useState<IncomingRequestPayload | null>(null)
  const [pickingSourceFor, setPickingSourceFor] = useState<IncomingRequestPayload | null>(null)
  const [pickingBusy, setPickingBusy] = useState(false)
  const [sharing, setSharing] = useState<SharingState | null>(null)
  const [webShare, setWebShare] = useState<WebShareState | null>(null)
  const [webShareBusy, setWebShareBusy] = useState(false)
  const [prefillTargetId, setPrefillTargetId] = useState<string | null>(null)

  const peerSessions = useRef(new Map<string, PeerSession>())
  const pendingOutgoing = useRef<PendingOutgoing | null>(null)
  const pendingTrust = useRef<Map<string, boolean>>(new Map())
  const userHangup = useRef(new Set<string>())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const notify = useCallback((message: string, tone: 'info' | 'error' = 'info') => {
    setToast({ message, tone })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const cleanupSession = useCallback((requestId: string) => {
    peerSessions.current.get(requestId)?.close()
    peerSessions.current.delete(requestId)
  }, [])

  /**
   * Quem recebe a tela nunca fica preso dentro da janelinha de controle:
   * abrimos uma janela dedicada (tela cheia, no monitor secundário quando
   * existir) e é lá que o PeerSession de visualização realmente vive.
   */
  const openViewerFor = useCallback(
    (requestId: string, peer: DeviceInfo) => {
      void window.telalink.openViewerWindow(requestId, peer)
      window.telalink.addHistory({ deviceId: peer.id, deviceName: peer.name, direction: 'received-from' })
      setView('home')
    },
    []
  )

  const startSharingFlow = useCallback(
    async (requestId: string, target: DeviceInfo, source: ScreenSource, presetId: SharePreset['id'], audio: boolean) => {
      const preset = SHARE_PRESETS.find((p) => p.id === presetId) ?? SHARE_PRESETS[2]
      try {
        const stream = await captureSource(source.id, preset, audio)
        const session = new PeerSession(requestId, 'sharer')
        session.onConnectionStateChange = (state) => {
          if (state === 'failed') notify('Conexão perdida. Tentando reconectar…', 'error')
        }
        peerSessions.current.set(requestId, session)
        await session.startAsSharer(stream)
        setSharing({ requestId, peer: target, sourceName: source.name, localStream: stream })
        setView('sharing')
        window.telalink.addHistory({ deviceId: target.id, deviceName: target.name, direction: 'shared-to' })
      } catch (err) {
        console.error('[share] falhou ao capturar/negociar', err)
        notify('Permissão para capturar a tela necessária.', 'error')
        window.telalink.hangup(requestId)
        setView('home')
      }
    },
    [notify]
  )

  // bootstrap: device info + discovery + sinalização
  useEffect(() => {
    window.telalink.getDevice().then(setDevice)
    window.telalink.listDevices().then(setDevices)

    const offDevices = window.telalink.onDevicesUpdate(setDevices)

    const offIncoming = window.telalink.onIncomingRequest((payload) => {
      setIncomingRequest(payload)
    })

    const offAuto = window.telalink.onAutoAccepted((payload) => {
      notify(`Conectando automaticamente com ${payload.from.name}…`)
      if (payload.kind === 'share-offer') {
        openViewerFor(payload.requestId, payload.from)
      } else {
        window.telalink.listSources().then((sources) => {
          const first = sources.find((s) => s.kind === 'screen') ?? sources[0]
          if (!first) {
            notify('Nenhuma tela disponível para compartilhar.', 'error')
            window.telalink.hangup(payload.requestId)
            return
          }
          void startSharingFlow(payload.requestId, payload.from, first, 'high-quality', false)
        })
      }
    })

    const offMessage = window.telalink.onSignalMessage((message: SignalMessage) => {
      if (message.type === 'connect-response') {
        const pending = pendingOutgoing.current
        if (!pending || pending.requestId !== message.requestId) return
        pendingOutgoing.current = null
        setOutgoingBusyId(null)

        if (!message.accept) {
          notify('Conexão recusada.', 'error')
          setView('home')
          return
        }

        if (pending.kind === 'share-offer' && pending.source && pending.presetId) {
          void startSharingFlow(pending.requestId, pending.target, pending.source, pending.presetId, !!pending.audio)
        } else {
          openViewerFor(pending.requestId, pending.target)
          notify(`Conectando com ${pending.target.name}…`)
        }
        return
      }

      peerSessions.current.get(message.requestId)?.handleSignal(message)
    })

    const offClosed = window.telalink.onSignalClosed((requestId) => {
      const wasUserInitiated = userHangup.current.has(requestId)
      userHangup.current.delete(requestId)
      cleanupSession(requestId)

      if (pendingOutgoing.current?.requestId === requestId) {
        pendingOutgoing.current = null
        setOutgoingBusyId(null)
        if (!wasUserInitiated) notify('Não foi possível conectar.', 'error')
      }

      setSharing((current) => {
        if (current?.requestId === requestId) {
          current.localStream.getTracks().forEach((t) => t.stop())
          if (!wasUserInitiated) notify('Conexão perdida.', 'error')
          setView('home')
          return null
        }
        return current
      })

      setWebShare((current) => {
        if (current?.requestId === requestId) {
          current.localStream.getTracks().forEach((t) => t.stop())
          if (!wasUserInitiated) notify('Conexão perdida.', 'error')
          setView('home')
          return null
        }
        return current
      })
    })

    const offSwapNavigate = window.telalink.onSwapNavigate((peer) => {
      setPrefillTargetId(peer.id)
      setView('share-setup')
    })

    const offWebConnected = window.telalink.onWebConnected((requestId) => {
      setWebShare((current) => {
        if (current?.requestId === requestId && current.status === 'waiting') {
          void current.session.startAsSharer(current.localStream)
          return { ...current, status: 'connected' }
        }
        return current
      })
    })

    const offUpdateAvailable = window.telalink.onUpdateAvailable((info) => {
      setUpdateInfo({ version: info.version, url: info.url })
    })

    return () => {
      offDevices()
      offIncoming()
      offAuto()
      offMessage()
      offClosed()
      offSwapNavigate()
      offWebConnected()
      offUpdateAvailable()
    }
  }, [cleanupSession, notify, openViewerFor, startSharingFlow])

  const handleStartShare = (source: ScreenSource, target: DiscoveredDevice, presetId: SharePreset['id'], audio: boolean): void => {
    setOutgoingBusyId(target.id)
    window.telalink
      .requestConnection(target.id, 'share-offer')
      .then((requestId) => {
        pendingOutgoing.current = { requestId, kind: 'share-offer', target, source, presetId, audio }
      })
      .catch(() => {
        setOutgoingBusyId(null)
        notify('Não foi possível conectar.', 'error')
      })
  }

  const handleRequestView = (target: DiscoveredDevice): void => {
    setOutgoingBusyId(target.id)
    window.telalink
      .requestConnection(target.id, 'view-request')
      .then((requestId) => {
        pendingOutgoing.current = { requestId, kind: 'view-request', target }
      })
      .catch(() => {
        setOutgoingBusyId(null)
        notify('Não foi possível conectar.', 'error')
      })
  }

  const handleRespondIncoming = (accept: boolean, trust: boolean): void => {
    if (!incomingRequest) return
    if (!accept) {
      window.telalink.respondConnect(incomingRequest.requestId, false, false, incomingRequest.from.id)
      setIncomingRequest(null)
      return
    }
    if (incomingRequest.kind === 'share-offer') {
      window.telalink.respondConnect(incomingRequest.requestId, true, trust, incomingRequest.from.id)
      openViewerFor(incomingRequest.requestId, incomingRequest.from)
      setIncomingRequest(null)
      notify(`Conectando com ${incomingRequest.from.name}…`)
    } else {
      pendingTrust.current.set(incomingRequest.requestId, trust)
      setPickingSourceFor(incomingRequest)
      setIncomingRequest(null)
    }
  }

  const handleConfirmIncomingShare = (source: ScreenSource, presetId: SharePreset['id'], audio: boolean): void => {
    if (!pickingSourceFor) return
    const trust = pendingTrust.current.get(pickingSourceFor.requestId) ?? false
    setPickingBusy(true)
    window.telalink.respondConnect(pickingSourceFor.requestId, true, trust, pickingSourceFor.from.id)
    void startSharingFlow(pickingSourceFor.requestId, pickingSourceFor.from, source, presetId, audio).finally(() => {
      setPickingBusy(false)
      setPickingSourceFor(null)
    })
  }

  const handleCancelIncomingShare = (): void => {
    if (pickingSourceFor) {
      window.telalink.respondConnect(pickingSourceFor.requestId, false, false, pickingSourceFor.from.id)
    }
    setPickingSourceFor(null)
  }

  const handleStopSharing = (): void => {
    if (!sharing) return
    userHangup.current.add(sharing.requestId)
    window.telalink.hangup(sharing.requestId)
    cleanupSession(sharing.requestId)
    sharing.localStream.getTracks().forEach((t) => t.stop())
    setSharing(null)
    setView('home')
  }

  const handleGenerateWebShare = async (source: ScreenSource, presetId: SharePreset['id'], audio: boolean): Promise<void> => {
    const preset = SHARE_PRESETS.find((p) => p.id === presetId) ?? SHARE_PRESETS[2]
    setWebShareBusy(true)
    try {
      const stream = await captureSource(source.id, preset, audio)
      const { requestId, url } = await window.telalink.createWebShare()
      const session = new PeerSession(requestId, 'sharer')
      session.onConnectionStateChange = (state) => {
        if (state === 'failed') notify('Conexão perdida. Tentando reconectar…', 'error')
      }
      peerSessions.current.set(requestId, session)
      setWebShare({ requestId, url, session, localStream: stream, status: 'waiting' })
    } catch (err) {
      console.error('[web-share] falhou ao gerar link', err)
      notify('Permissão para capturar a tela necessária.', 'error')
    } finally {
      setWebShareBusy(false)
    }
  }

  const handleStopWebShare = (): void => {
    if (!webShare) return
    userHangup.current.add(webShare.requestId)
    window.telalink.hangup(webShare.requestId)
    cleanupSession(webShare.requestId)
    webShare.localStream.getTracks().forEach((t) => t.stop())
    setWebShare(null)
    setView('home')
  }

  return (
    <div style={{ height: '100%' }}>
      {updateInfo && (
        <UpdateBanner
          version={updateInfo.version}
          onDownload={() => window.telalink.openUpdateDownload(updateInfo.url)}
          onDismiss={() => setUpdateInfo(null)}
        />
      )}

      {view === 'home' && (
        <HomeScreen
          device={device}
          devices={devices}
          onShare={() => {
            setPrefillTargetId(null)
            setView('share-setup')
          }}
          onReceive={() => setView('receive')}
          onWebShare={() => setView('web-share')}
        />
      )}

      {view === 'share-setup' && (
        <ShareSetupScreen
          devices={prefillTargetId ? devices.filter((d) => d.id === prefillTargetId) : devices}
          busy={outgoingBusyId !== null}
          onBack={() => setView('home')}
          onStart={handleStartShare}
        />
      )}

      {view === 'receive' && (
        <ReceiveScreen devices={devices} busyDeviceId={outgoingBusyId} onBack={() => setView('home')} onRequest={handleRequestView} />
      )}

      {view === 'sharing' && sharing && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🟢</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Compartilhando tela</div>
          <div style={{ color: 'var(--tl-text-dim)', fontSize: 13, marginTop: 4 }}>
            {sharing.sourceName} → {sharing.peer.name}
          </div>
        </div>
      )}

      {view === 'sharing' && sharing && (
        <ShareControlBar peerName={sharing.peer.name} sourceName={sharing.sourceName} onStop={handleStopSharing} />
      )}

      {view === 'web-share' && (
        <WebShareScreen
          status={webShare?.status ?? 'setup'}
          url={webShare?.url ?? null}
          busy={webShareBusy}
          onBack={() => setView('home')}
          onGenerate={handleGenerateWebShare}
          onStop={handleStopWebShare}
        />
      )}

      {incomingRequest && <ConnectionRequestModal request={incomingRequest} onRespond={handleRespondIncoming} />}

      {pickingSourceFor && (
        <IncomingSharePicker
          from={pickingSourceFor.from}
          busy={pickingBusy}
          onCancel={handleCancelIncomingShare}
          onConfirm={handleConfirmIncomingShare}
        />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
    </div>
  )
}
