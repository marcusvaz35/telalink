import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  DeviceInfo,
  DeviceType,
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
import { ManualConnectModal } from './components/ManualConnectModal'
import { ControlRequestModal } from './components/ControlRequestModal'
import { AppFooter } from './components/AppFooter'

/** Extrai a mensagem de verdade de um erro de IPC, sem o prefixo técnico do Electron. */
function connectionErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const cleaned = raw.replace(/^Error invoking remote method '.*?':\s*(Error:\s*)?/, '').trim()
  if (/EHOSTUNREACH|ENETUNREACH|ETIMEDOUT|Tempo esgotado/.test(cleaned)) {
    return 'Não consegui falar com esse computador. Verifique se o TelaLink está aberto nele e se o Firewall do Windows permite o app nesta rede.'
  }
  if (/ECONNREFUSED/.test(cleaned)) {
    return 'O TelaLink não está aberto no outro computador. Abra o app lá e tente de novo.'
  }
  return cleaned || 'Não foi possível conectar.'
}

const MANUAL_PREFIX = 'manual:'

function isManualDevice(id: string): boolean {
  return id.startsWith(MANUAL_PREFIX)
}

/** Quando a busca automática falha (algumas redes bloqueiam), conecta direto
 *  pelo IP — sem precisar que o dispositivo tenha sido descoberto antes. */
function requestConnectionFor(target: DiscoveredDevice, kind: 'share-offer' | 'view-request'): Promise<string> {
  return isManualDevice(target.id)
    ? window.telalink.requestConnectionByAddress(target.host, target.port, kind)
    : window.telalink.requestConnection(target.id, kind)
}

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
  displayId?: string
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
  const [manualDevices, setManualDevices] = useState<DiscoveredDevice[]>([])
  const [manualConnectOpen, setManualConnectOpen] = useState(false)

  const [appVersion, setAppVersion] = useState('')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [controlRequest, setControlRequest] = useState<{ requestId: string; peerName: string; displayId: string } | null>(null)
  const [controlActiveFor, setControlActiveFor] = useState<string | null>(null)
  const controlActiveRef = useRef<string | null>(null)
  const viewerPlatforms = useRef(new Map<string, DeviceType>())

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
        let currentScreenId = source.id
        const sendScreens = async (): Promise<void> => {
          const screens = await window.telalink.listScreens()
          session.sendControl({
            t: 'screens',
            screens: screens.map(({ id, label }) => ({ id, label })),
            current: currentScreenId
          })
        }
        const switchScreen = async (id: string): Promise<void> => {
          const screens = await window.telalink.listScreens()
          const target = screens.find((s) => s.id === id)
          if (!target || target.id === currentScreenId) return
          const next = await captureSource(target.id, preset, false)
          const nextTrack = next.getVideoTracks()[0]
          await session.replaceVideoTrack(nextTrack)
          for (const old of stream.getVideoTracks()) {
            old.stop()
            stream.removeTrack(old)
          }
          stream.addTrack(nextTrack)
          currentScreenId = target.id
          await window.telalink.setControlDisplay(requestId, target.displayId)
          setSharing((cur) =>
            cur?.requestId === requestId ? { ...cur, sourceName: target.label, displayId: target.displayId } : cur
          )
          await sendScreens()
        }
        session.onControlMessage = (msg) => {
          if (msg.t === 'screens-request' || msg.t === 'switch-screen') {
            // Só quem já recebeu permissão de controle pode ver/trocar monitores.
            if (controlActiveRef.current !== requestId) return
            if (msg.t === 'screens-request') void sendScreens()
            else void switchScreen(msg.id).catch((err) => console.error('[control] troca de monitor falhou', err))
            return
          }
          if (msg.t === 'hello') {
            viewerPlatforms.current.set(requestId, msg.platform)
          } else if (msg.t === 'request') {
            if (!source.displayId) {
              session.sendControl({
                t: 'state',
                state: 'unavailable',
                reason: 'Só dá pra controlar quando uma tela inteira está sendo compartilhada (não uma janela).'
              })
            } else {
              setControlRequest({ requestId, peerName: target.name, displayId: source.displayId })
            }
          } else if (msg.t === 'release') {
            void window.telalink.revokeControl(requestId)
          } else if (
            (msg.t === 'move' || msg.t === 'down' || msg.t === 'up' || msg.t === 'wheel' || msg.t === 'key') &&
            controlActiveRef.current === requestId
          ) {
            window.telalink.sendControlEvent(requestId, msg)
          }
        }
        await session.startAsSharer(stream)
        setSharing({ requestId, peer: target, sourceName: source.name, localStream: stream, displayId: source.displayId })
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
    window.telalink.getAppVersion().then(setAppVersion)
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

    const offControlRevoked = window.telalink.onControlRevoked((requestId) => {
      if (controlActiveRef.current === requestId) {
        controlActiveRef.current = null
        setControlActiveFor(null)
        peerSessions.current.get(requestId)?.sendControl({ t: 'state', state: 'revoked' })
        notify('Controle remoto encerrado.')
      }
    })

    const offUpdateResult = window.telalink.onUpdateResult((result) => {
      setCheckingUpdate(false)
      if (result.status === 'latest') notify(`Você já está na versão mais recente (v${result.currentVersion}).`)
      else if (result.status === 'update') notify('Nova versão disponível! Clique em "Baixar atualização".')
      else notify('Não foi possível verificar agora. Confira sua internet e tente de novo.', 'error')
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
      offControlRevoked()
      offUpdateResult()
      offUpdateAvailable()
    }
  }, [cleanupSession, notify, openViewerFor, startSharingFlow])

  const handleStartShare = (source: ScreenSource, target: DiscoveredDevice, presetId: SharePreset['id'], audio: boolean): void => {
    setOutgoingBusyId(target.id)
    requestConnectionFor(target, 'share-offer')
      .then((requestId) => {
        pendingOutgoing.current = { requestId, kind: 'share-offer', target, source, presetId, audio }
      })
      .catch((err) => {
        setOutgoingBusyId(null)
        notify(connectionErrorMessage(err), 'error')
      })
  }

  const handleRequestView = (target: DiscoveredDevice): void => {
    setOutgoingBusyId(target.id)
    requestConnectionFor(target, 'view-request')
      .then((requestId) => {
        pendingOutgoing.current = { requestId, kind: 'view-request', target }
      })
      .catch((err) => {
        setOutgoingBusyId(null)
        notify(connectionErrorMessage(err), 'error')
      })
  }

  const handleAddManualDevice = (host: string, port: number): void => {
    const id = `${MANUAL_PREFIX}${host}:${port}`
    const device: DiscoveredDevice = {
      id,
      name: host,
      type: 'unknown',
      host,
      port,
      lastSeenAt: Date.now(),
      trusted: false,
      blocked: false
    }
    setManualDevices((current) => [...current.filter((d) => d.id !== id), device])
    setManualConnectOpen(false)
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

  const handleControlDecision = async (allow: boolean): Promise<void> => {
    const request = controlRequest
    if (!request) return
    setControlRequest(null)
    const session = peerSessions.current.get(request.requestId)
    if (!allow) {
      session?.sendControl({ t: 'state', state: 'denied' })
      return
    }
    const result = await window.telalink.grantControl(
      request.requestId,
      request.displayId,
      viewerPlatforms.current.get(request.requestId) ?? 'unknown',
      request.peerName
    )
    if (result.ok) {
      controlActiveRef.current = request.requestId
      setControlActiveFor(request.requestId)
      session?.sendControl({ t: 'state', state: 'granted' })
    } else {
      session?.sendControl({ t: 'state', state: 'unavailable', reason: result.reason })
      notify(result.reason ?? 'Não foi possível liberar o controle.', 'error')
    }
  }

  const handleStopSharing = (): void => {
    if (!sharing) return
    void window.telalink.revokeControl(sharing.requestId)
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

  const handleCheckUpdate = (): void => {
    setCheckingUpdate(true)
    void window.telalink.checkForUpdateNow()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
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
          devices={[...devices, ...manualDevices]}
          onShare={() => {
            setPrefillTargetId(null)
            setView('share-setup')
          }}
          onReceive={() => setView('receive')}
          onWebShare={() => setView('web-share')}
          onManualConnect={() => setManualConnectOpen(true)}
        />
      )}

      {view === 'share-setup' && (
        <ShareSetupScreen
          devices={
            prefillTargetId
              ? [...devices, ...manualDevices].filter((d) => d.id === prefillTargetId)
              : [...devices, ...manualDevices]
          }
          busy={outgoingBusyId !== null}
          onBack={() => setView('home')}
          onStart={handleStartShare}
        />
      )}

      {view === 'receive' && (
        <ReceiveScreen
          devices={[...devices, ...manualDevices]}
          busyDeviceId={outgoingBusyId}
          onBack={() => setView('home')}
          onRequest={handleRequestView}
        />
      )}

      {view === 'sharing' && sharing && (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              marginBottom: 12,
              background: 'var(--tl-success)',
              boxShadow: '0 0 24px rgba(20, 177, 119, 0.6)'
            }}
          />
          <div style={{ fontWeight: 700, fontSize: 16 }}>Compartilhando tela</div>
          <div style={{ color: 'var(--tl-text-dim)', fontSize: 13, marginTop: 4 }}>
            {sharing.sourceName} → {sharing.peer.name}
          </div>
        </div>
      )}

      {view === 'sharing' && sharing && (
        <ShareControlBar
          peerName={sharing.peer.name}
          sourceName={sharing.sourceName}
          onStop={handleStopSharing}
          controlActive={controlActiveFor === sharing.requestId}
          onStopControl={() => void window.telalink.revokeControl(sharing.requestId)}
        />
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

      {manualConnectOpen && (
        <ManualConnectModal onClose={() => setManualConnectOpen(false)} onAdd={handleAddManualDevice} />
      )}

      {controlRequest && (
        <ControlRequestModal peerName={controlRequest.peerName} onDecide={(allow) => void handleControlDecision(allow)} />
      )}

      {toast && <Toast message={toast.message} tone={toast.tone} />}
      </div>
      <AppFooter version={appVersion} checking={checkingUpdate} onCheckUpdate={handleCheckUpdate} />
    </div>
  )
}
