import type { SignalMessage } from '../../../shared/types'

/**
 * Fase 1: sem STUN/TURN — a mesma rede local já resolve via candidatos "host".
 * Fase 2/3: trocar por [{ urls: 'stun:...' }, { urls: 'turn:...', username, credential }]
 * sem alterar o resto do fluxo de sinalização/negociação abaixo.
 */
const ICE_SERVERS: RTCIceServer[] = []

export interface PeerSessionStats {
  fps: number
  bitrateKbps: number
  latencyMs: number
  resolution: string
  connectionType: 'p2p' | 'relay' | 'desconhecido'
}

type Role = 'sharer' | 'viewer'

export class PeerSession {
  readonly requestId: string
  readonly role: Role
  private pc: RTCPeerConnection
  private pendingRemoteCandidates: RTCIceCandidateInit[] = []
  private remoteDescriptionSet = false
  private lastStats: { bytes: number; timestamp: number } | null = null

  onRemoteStream: ((stream: MediaStream) => void) | null = null
  onConnectionStateChange: ((state: RTCPeerConnectionState) => void) | null = null

  constructor(requestId: string, role: Role) {
    this.requestId = requestId
    this.role = role
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        window.telalink.sendSignal({
          type: 'ice-candidate',
          requestId: this.requestId,
          candidate: ev.candidate.toJSON()
        })
      }
    }

    this.pc.ontrack = (ev) => {
      this.onRemoteStream?.(ev.streams[0])
    }

    this.pc.onconnectionstatechange = () => {
      this.onConnectionStateChange?.(this.pc.connectionState)
    }
  }

  async startAsSharer(stream: MediaStream): Promise<void> {
    for (const track of stream.getTracks()) {
      this.pc.addTrack(track, stream)
    }
    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)
    window.telalink.sendSignal({ type: 'offer', requestId: this.requestId, sdp: offer })
  }

  async handleSignal(message: SignalMessage): Promise<void> {
    if (message.requestId !== this.requestId) return

    if (message.type === 'offer') {
      await this.pc.setRemoteDescription(message.sdp)
      this.remoteDescriptionSet = true
      await this.flushPendingCandidates()
      const answer = await this.pc.createAnswer()
      await this.pc.setLocalDescription(answer)
      window.telalink.sendSignal({ type: 'answer', requestId: this.requestId, sdp: answer })
    } else if (message.type === 'answer') {
      await this.pc.setRemoteDescription(message.sdp)
      this.remoteDescriptionSet = true
      await this.flushPendingCandidates()
    } else if (message.type === 'ice-candidate') {
      if (this.remoteDescriptionSet) {
        await this.pc.addIceCandidate(message.candidate).catch(() => undefined)
      } else {
        this.pendingRemoteCandidates.push(message.candidate)
      }
    }
  }

  private async flushPendingCandidates(): Promise<void> {
    const queued = this.pendingRemoteCandidates
    this.pendingRemoteCandidates = []
    for (const candidate of queued) {
      await this.pc.addIceCandidate(candidate).catch(() => undefined)
    }
  }

  async getStats(): Promise<PeerSessionStats> {
    const report = await this.pc.getStats()
    let fps = 0
    let bitrateKbps = 0
    let latencyMs = 0
    let resolution = '—'
    let connectionType: PeerSessionStats['connectionType'] = 'desconhecido'

    report.forEach((entry) => {
      if (entry.type === 'inbound-rtp' && entry.kind === 'video') {
        fps = Math.round(entry.framesPerSecond ?? 0)
        resolution = entry.frameWidth && entry.frameHeight ? `${entry.frameWidth}x${entry.frameHeight}` : resolution
        if (this.lastStats) {
          const deltaBytes = entry.bytesReceived - this.lastStats.bytes
          const deltaTime = (entry.timestamp - this.lastStats.timestamp) / 1000
          if (deltaTime > 0) bitrateKbps = Math.round((deltaBytes * 8) / deltaTime / 1000)
        }
        this.lastStats = { bytes: entry.bytesReceived ?? 0, timestamp: entry.timestamp }
      }
      if (entry.type === 'outbound-rtp' && entry.kind === 'video') {
        fps = Math.round(entry.framesPerSecond ?? 0)
        resolution = entry.frameWidth && entry.frameHeight ? `${entry.frameWidth}x${entry.frameHeight}` : resolution
        if (this.lastStats) {
          const deltaBytes = entry.bytesSent - this.lastStats.bytes
          const deltaTime = (entry.timestamp - this.lastStats.timestamp) / 1000
          if (deltaTime > 0) bitrateKbps = Math.round((deltaBytes * 8) / deltaTime / 1000)
        }
        this.lastStats = { bytes: entry.bytesSent ?? 0, timestamp: entry.timestamp }
      }
      if (entry.type === 'candidate-pair' && entry.state === 'succeeded' && entry.nominated) {
        latencyMs = Math.round((entry.currentRoundTripTime ?? 0) * 1000)
      }
      if (entry.type === 'local-candidate' && entry.id === entry.id) {
        if (entry.candidateType === 'relay') connectionType = 'relay'
        else if (connectionType !== 'relay') connectionType = 'p2p'
      }
    })

    return { fps, bitrateKbps, latencyMs, resolution, connectionType }
  }

  close(): void {
    this.pc.getSenders().forEach((s) => s.track?.stop())
    this.pc.close()
  }
}
