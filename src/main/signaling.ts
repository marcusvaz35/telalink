import { WebSocketServer, WebSocket } from 'ws'
import { createServer, type Server } from 'http'
import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type {
  DeviceInfo,
  IncomingRequestPayload,
  RequestKind,
  SignalMessage
} from '../shared/types'
import { store } from './store'
import type { IDiscovery } from './discovery'
import { renderWebViewerPage } from './webViewerPage'
import { DEFAULT_SIGNAL_PORT } from '../shared/types'

const WEB_SESSION_TTL_MS = 5 * 60 * 1000
const RECONNECT_WINDOW_MS = 2 * 60 * 1000
const PREFERRED_PORT = DEFAULT_SIGNAL_PORT

interface SignalingEvents {
  'incoming-request': [IncomingRequestPayload]
  'auto-accepted': [IncomingRequestPayload]
  message: [SignalMessage]
  closed: [string]
  'web-connected': [string]
  error: [{ requestId: string; message: string }]
}

interface PendingWebSession {
  fromName: string
  expireTimer: ReturnType<typeof setTimeout>
}

export class Signaling extends EventEmitter {
  private httpServer: Server | null = null
  private wss: WebSocketServer | null = null
  private sockets = new Map<string, WebSocket>()
  /** Requests com "porta de reconexão" aberta: sessões web aguardando o navegador,
   *  e handshakes de peer já aceitos aguardando quem vai carregar a mídia se reconectar
   *  (caso da extensão ReplayKit do iOS, que roda em processo separado do app). */
  private pendingWebSessions = new Map<string, PendingWebSession>()
  private pendingHandshakeFrom = new Map<string, DeviceInfo>()
  private me: DeviceInfo
  private discovery: IDiscovery

  constructor(me: DeviceInfo, discovery: IDiscovery) {
    super()
    this.me = me
    this.discovery = discovery
  }

  async start(): Promise<number> {
    this.httpServer = createServer((req, res) => this.handleHttpRequest(req.url, res))
    this.wss = new WebSocketServer({ server: this.httpServer })
    this.wss.on('connection', (socket, req) => this.handleInboundSocket(socket, req.url))

    const tryListen = (port: number): Promise<number> =>
      new Promise((resolve, reject) => {
        const onError = (err: NodeJS.ErrnoException): void => {
          this.httpServer!.off('listening', onListening)
          reject(err)
        }
        const onListening = (): void => {
          this.httpServer!.off('error', onError)
          const addr = this.httpServer!.address()
          resolve(typeof addr === 'object' && addr ? addr.port : 0)
        }
        this.httpServer!.once('error', onError)
        this.httpServer!.once('listening', onListening)
        this.httpServer!.listen(port, '0.0.0.0')
      })

    try {
      return await tryListen(PREFERRED_PORT)
    } catch {
      return tryListen(0)
    }
  }

  private handleHttpRequest(rawUrl: string | undefined, res: import('http').ServerResponse): void {
    const requestId = new URL(rawUrl ?? '/', 'http://localhost').searchParams.get('r')
    const pending = requestId ? this.pendingWebSessions.get(requestId) : undefined
    if (requestId && pending) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(renderWebViewerPage({ requestId, fromName: pending.fromName }))
      return
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('TelaLink: link inválido ou expirado.')
  }

  /** Sessão de navegador (celular sem o TelaLink instalado): o link em si é a autorização, sem diálogo de confirmação. */
  registerWebSession(fromName: string): string {
    const requestId = randomUUID()
    this.markReconnectable(requestId, fromName, WEB_SESSION_TTL_MS, true)
    return requestId
  }

  /**
   * Abre uma janela de reconexão por `?r=<requestId>` sem tocar num socket já
   * ativo. `forceCloseOnExpiry` só deve ser true quando ninguém conectou ainda
   * (sessão web recém-criada) — nunca para um handshake de peer já aceito, ou
   * a sessão em andamento seria derrubada quando a janela expirasse.
   */
  private markReconnectable(requestId: string, fromName: string, ttlMs: number, forceCloseOnExpiry: boolean): void {
    const expireTimer = setTimeout(() => {
      this.pendingWebSessions.delete(requestId)
      if (forceCloseOnExpiry) {
        const socket = this.sockets.get(requestId)
        if (socket) {
          socket.close()
          this.sockets.delete(requestId)
        }
      }
    }, ttlMs)
    this.pendingWebSessions.set(requestId, { fromName, expireTimer })
  }

  cancelWebSession(requestId: string): void {
    const pending = this.pendingWebSessions.get(requestId)
    if (pending) clearTimeout(pending.expireTimer)
    this.pendingWebSessions.delete(requestId)
    const socket = this.sockets.get(requestId)
    if (socket) {
      socket.close()
      this.sockets.delete(requestId)
    }
  }

  private handleInboundSocket(socket: WebSocket, rawUrl: string | undefined): void {
    const webRequestId = new URL(rawUrl ?? '/', 'http://localhost').searchParams.get('r')
    const pending = webRequestId ? this.pendingWebSessions.get(webRequestId) : undefined

    if (webRequestId && pending) {
      clearTimeout(pending.expireTimer)
      this.sockets.set(webRequestId, socket)
      this.wireSocketRelay(socket, webRequestId)
      socket.on('close', () => {
        this.pendingWebSessions.delete(webRequestId)
        this.sockets.delete(webRequestId)
        this.emit('closed', webRequestId)
      })
      this.emit('web-connected', webRequestId)
      return
    }

    this.handlePeerHandshake(socket)
  }

  private handlePeerHandshake(socket: WebSocket): void {
    let boundRequestId: string | null = null

    socket.once('message', (raw) => {
      let msg: SignalMessage
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        socket.close()
        return
      }
      if (msg.type !== 'connect-request') {
        socket.close()
        return
      }
      boundRequestId = msg.requestId
      this.sockets.set(msg.requestId, socket)
      this.wireSocketRelay(socket, msg.requestId)
      this.pendingHandshakeFrom.set(msg.requestId, msg.from)

      const fromId = msg.from.id
      if (store.isBlocked(fromId)) {
        this.send(msg.requestId, { type: 'connect-response', requestId: msg.requestId, accept: false })
        socket.close()
        this.sockets.delete(msg.requestId)
        return
      }

      const payload: IncomingRequestPayload = {
        requestId: msg.requestId,
        kind: msg.kind,
        from: msg.from,
        peerKey: fromId
      }

      if (store.isTrusted(fromId)) {
        this.send(msg.requestId, { type: 'connect-response', requestId: msg.requestId, accept: true })
        this.emit('auto-accepted', payload)
      } else {
        this.emit('incoming-request', payload)
      }
    })

    socket.on('close', () => {
      if (boundRequestId) {
        this.sockets.delete(boundRequestId)
        this.pendingHandshakeFrom.delete(boundRequestId)
        // Se ficou reconectável (aceito, aguardando quem vai carregar a mídia
        // se conectar — caso da extensão do iOS), esse fechamento é só o fim
        // do handshake, não o fim da sessão: não avisa "conexão perdida".
        if (!this.pendingWebSessions.has(boundRequestId)) {
          this.emit('closed', boundRequestId)
        }
      }
    })
  }

  private wireSocketRelay(socket: WebSocket, requestId: string): void {
    socket.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as SignalMessage
        if (msg.type === 'connect-request') return
        this.emit('message', msg)
      } catch {
        // ignora mensagens inválidas
      }
    })
  }

  async requestConnection(targetDeviceId: string, kind: RequestKind): Promise<string> {
    const target = this.discovery.getHost(targetDeviceId)
    if (!target) throw new Error('Dispositivo não encontrado na rede.')
    return this.connectAndHandshake(target.host, target.port, kind)
  }

  /** Contorna a descoberta automática quando ela falha numa rede específica
   *  (roteadores/mesh que filtram mDNS não-nativo) — conecta direto pelo IP. */
  async requestConnectionByAddress(host: string, port: number, kind: RequestKind): Promise<string> {
    return this.connectAndHandshake(host, port, kind)
  }

  private async connectAndHandshake(host: string, port: number, kind: RequestKind): Promise<string> {
    const requestId = randomUUID()
    const socket = new WebSocket(`ws://${host}:${port}`)

    // Sem isso, uma porta bloqueada por firewall trava o handshake TCP por
    // minutos sem erro nenhum — do lado do usuário parece que "não acontece
    // nada" ao clicar em compartilhar.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.terminate()
        reject(new Error('Tempo esgotado ao conectar — verifique o firewall do dispositivo de destino.'))
      }, 7000)
      socket.once('open', () => {
        clearTimeout(timeout)
        resolve()
      })
      socket.once('error', (err) => {
        clearTimeout(timeout)
        reject(err)
      })
    })

    this.sockets.set(requestId, socket)
    this.wireSocketRelay(socket, requestId)
    socket.on('close', () => {
      this.sockets.delete(requestId)
      this.emit('closed', requestId)
    })

    socket.send(
      JSON.stringify({
        type: 'connect-request',
        requestId,
        kind,
        from: this.me
      } satisfies SignalMessage)
    )

    return requestId
  }

  send(requestId: string, message: SignalMessage): void {
    const socket = this.sockets.get(requestId)
    if (!socket || socket.readyState !== WebSocket.OPEN) return
    socket.send(JSON.stringify(message))

    if (message.type === 'connect-response' && message.accept) {
      const fromName = this.pendingHandshakeFrom.get(requestId)?.name ?? 'Dispositivo'
      this.pendingHandshakeFrom.delete(requestId)
      this.markReconnectable(requestId, fromName, RECONNECT_WINDOW_MS, false)
    }
  }

  hangup(requestId: string): void {
    const socket = this.sockets.get(requestId)
    if (socket) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'hangup', requestId } satisfies SignalMessage))
      }
      socket.close()
    }
    this.sockets.delete(requestId)
    this.cancelWebSession(requestId)
  }

  stop(): void {
    for (const socket of this.sockets.values()) socket.close()
    this.sockets.clear()
    for (const pending of this.pendingWebSessions.values()) clearTimeout(pending.expireTimer)
    this.pendingWebSessions.clear()
    this.wss?.close()
    this.httpServer?.close()
  }
}

export declare interface Signaling {
  on<K extends keyof SignalingEvents>(event: K, listener: (...args: SignalingEvents[K]) => void): this
  emit<K extends keyof SignalingEvents>(event: K, ...args: SignalingEvents[K]): boolean
}
