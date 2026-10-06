import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { ControlMessage, DeviceType, ScreenChoice } from '../../../shared/types'
import type { PeerSession } from './PeerSession'

export type RemoteControlState = 'idle' | 'requesting' | 'active'

const REQUEST_TIMEOUT_MS = 60_000

function localPlatform(): DeviceType {
  const ua = navigator.userAgent
  if (ua.includes('Mac')) return 'mac'
  if (ua.includes('Windows')) return 'windows'
  return 'unknown'
}

/** Pede e usa o controle remoto do computador de quem está compartilhando a tela. */
export function useRemoteControl(
  peerSession: PeerSession,
  videoRef: RefObject<HTMLVideoElement>,
  onNotice: (message: string) => void
): {
  state: RemoteControlState
  request: () => void
  stop: () => void
  screens: ScreenChoice[]
  currentScreen: string | null
  switchScreen: (id: string) => void
} {
  const [state, setState] = useState<RemoteControlState>('idle')
  const stateRef = useRef<RemoteControlState>('idle')
  const [screens, setScreens] = useState<ScreenChoice[]>([])
  const [currentScreen, setCurrentScreen] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const update = useCallback((next: RemoteControlState) => {
    stateRef.current = next
    setState(next)
  }, [])

  useEffect(() => {
    peerSession.onControlMessage = (msg: ControlMessage) => {
      if (msg.t === 'screens') {
        setScreens(msg.screens)
        setCurrentScreen(msg.current)
        return
      }
      if (msg.t !== 'state') return
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (msg.state === 'granted') {
        update('active')
        peerSession.sendControl({ t: 'screens-request' })
        onNotice('Controle liberado. Clique em "Parar controle" pra sair.')
      } else if (msg.state === 'denied') {
        update('idle')
        onNotice('O outro computador negou o controle.')
      } else if (msg.state === 'revoked') {
        update('idle')
        onNotice('O controle foi encerrado pelo outro computador.')
      } else {
        update('idle')
        onNotice(msg.reason ?? 'Controle remoto indisponível nesse computador.')
      }
    }
    return () => {
      peerSession.onControlMessage = null
    }
  }, [peerSession, update, onNotice])

  const request = useCallback(() => {
    if (stateRef.current !== 'idle') return
    update('requesting')
    peerSession.sendControl({ t: 'hello', platform: localPlatform() })
    peerSession.sendControl({ t: 'request' })
    timeoutRef.current = setTimeout(() => {
      if (stateRef.current === 'requesting') {
        update('idle')
        onNotice('O outro computador não respondeu ao pedido de controle.')
      }
    }, REQUEST_TIMEOUT_MS)
  }, [peerSession, update, onNotice])

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    peerSession.sendControl({ t: 'release' })
    update('idle')
    setScreens([])
    setCurrentScreen(null)
  }, [peerSession, update])

  const switchScreen = useCallback(
    (id: string) => {
      peerSession.sendControl({ t: 'switch-screen', id })
    },
    [peerSession]
  )

  useEffect(() => {
    if (state !== 'active') return
    const video = videoRef.current
    if (!video) return

    void window.telalink.setKeyCapture(true)

    const normalize = (e: MouseEvent, clamp: boolean): { x: number; y: number } | null => {
      const vw = video.videoWidth
      const vh = video.videoHeight
      if (!vw || !vh) return null
      const rect = video.getBoundingClientRect()
      const scale = Math.min(rect.width / vw, rect.height / vh)
      const w = vw * scale
      const h = vh * scale
      const left = rect.left + (rect.width - w) / 2
      const top = rect.top + (rect.height - h) / 2
      let x = (e.clientX - left) / w
      let y = (e.clientY - top) / h
      if (clamp) {
        x = Math.min(1, Math.max(0, x))
        y = Math.min(1, Math.max(0, y))
      } else if (x < 0 || x > 1 || y < 0 || y > 1) {
        return null
      }
      return { x, y }
    }

    let pendingMove: { x: number; y: number } | null = null
    let frame = 0
    const flushMove = (): void => {
      frame = 0
      if (pendingMove) peerSession.sendControl({ t: 'move', ...pendingMove })
      pendingMove = null
    }

    const onMove = (e: MouseEvent): void => {
      const p = normalize(e, false)
      if (!p) return
      pendingMove = p
      if (!frame) frame = requestAnimationFrame(flushMove)
    }
    const onDown = (e: MouseEvent): void => {
      const p = normalize(e, false)
      if (!p || e.button > 2) return
      e.preventDefault()
      peerSession.sendControl({ t: 'down', ...p, button: e.button as 0 | 1 | 2, clicks: e.detail })
    }
    const onUp = (e: MouseEvent): void => {
      const p = normalize(e, true)
      if (!p || e.button > 2) return
      peerSession.sendControl({ t: 'up', ...p, button: e.button as 0 | 1 | 2, clicks: e.detail })
    }
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1
      peerSession.sendControl({ t: 'wheel', dx: e.deltaX * unit, dy: e.deltaY * unit })
    }
    const onContext = (e: Event): void => e.preventDefault()
    const onKey = (down: boolean) => (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      peerSession.sendControl({
        t: 'key',
        down,
        code: e.code,
        key: e.key,
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey,
        meta: e.metaKey
      })
    }
    const keyDown = onKey(true)
    const keyUp = onKey(false)

    video.addEventListener('mousemove', onMove)
    video.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    video.addEventListener('wheel', onWheel, { passive: false })
    video.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', keyDown, true)
    window.addEventListener('keyup', keyUp, true)

    return () => {
      video.removeEventListener('mousemove', onMove)
      video.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      video.removeEventListener('wheel', onWheel)
      video.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', keyDown, true)
      window.removeEventListener('keyup', keyUp, true)
      if (frame) cancelAnimationFrame(frame)
      void window.telalink.setKeyCapture(false)
    }
  }, [state, peerSession, videoRef])

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    []
  )

  return { state, request, stop, screens, currentScreen, switchScreen }
}
