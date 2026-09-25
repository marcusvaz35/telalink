/**
 * Formas mínimas equivalentes aos tipos DOM `RTCSessionDescriptionInit` /
 * `RTCIceCandidateInit`, redeclaradas aqui porque este arquivo é compartilhado
 * com o processo principal (sem lib DOM). Estruturalmente compatíveis com os
 * tipos reais usados no renderer.
 */
export interface SdpInit {
  type: 'offer' | 'answer' | 'pranswer' | 'rollback'
  sdp?: string
}

export interface IceCandidateInit {
  candidate?: string
  sdpMLineIndex?: number | null
  sdpMid?: string | null
  usernameFragment?: string | null
}

export type DeviceType = 'mac' | 'windows' | 'linux' | 'android' | 'ios' | 'unknown'

/** Porta padrão do servidor de sinalização — fixa pra permitir conectar por
 *  IP manual sem precisar informar a porta também (cai pra uma aleatória só
 *  se essa já estiver em uso). */
export const DEFAULT_SIGNAL_PORT = 47811

export interface DeviceInfo {
  id: string
  name: string
  type: DeviceType
}

export interface DiscoveredDevice extends DeviceInfo {
  host: string
  port: number
  lastSeenAt: number
  trusted: boolean
  blocked: boolean
}

export type RequestKind = 'share-offer' | 'view-request'

export interface SignalConnectRequest {
  type: 'connect-request'
  requestId: string
  kind: RequestKind
  from: DeviceInfo
}

export interface SignalConnectResponse {
  type: 'connect-response'
  requestId: string
  accept: boolean
}

export interface SignalDescription {
  type: 'offer' | 'answer'
  requestId: string
  sdp: SdpInit
}

export interface SignalIceCandidate {
  type: 'ice-candidate'
  requestId: string
  candidate: IceCandidateInit
}

export interface SignalHangup {
  type: 'hangup'
  requestId: string
}

export type SignalMessage =
  | SignalConnectRequest
  | SignalConnectResponse
  | SignalDescription
  | SignalIceCandidate
  | SignalHangup

export interface IncomingRequestPayload {
  requestId: string
  kind: RequestKind
  from: DeviceInfo
  peerKey: string
}

export interface SharePreset {
  id: 'low-latency' | 'balanced' | 'high-quality'
  label: string
  width: number
  height: number
  frameRate: number
}

export const SHARE_PRESETS: SharePreset[] = [
  { id: 'low-latency', label: 'Baixa latência · 720p · 30 FPS', width: 1280, height: 720, frameRate: 30 },
  { id: 'balanced', label: 'Balanceado · 1080p · 30 FPS', width: 1920, height: 1080, frameRate: 30 },
  { id: 'high-quality', label: 'Alta qualidade · 1080p · 60 FPS', width: 1920, height: 1080, frameRate: 60 }
]

export interface ScreenSource {
  id: string
  name: string
  kind: 'screen' | 'window'
  thumbnailDataUrl: string
}

export interface ConnectionRole {
  role: 'sharer' | 'viewer'
  requestId: string
  peer: DeviceInfo
}
