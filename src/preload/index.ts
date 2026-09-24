import { contextBridge, ipcRenderer } from 'electron'
import type {
  DeviceInfo,
  DiscoveredDevice,
  IncomingRequestPayload,
  RequestKind,
  ScreenSource,
  SignalMessage
} from '../shared/types'

const api = {
  getDevice: (): Promise<DeviceInfo> => ipcRenderer.invoke('device:get'),
  setDeviceName: (name: string): Promise<DeviceInfo> => ipcRenderer.invoke('device:set-name', name),

  listDevices: (): Promise<DiscoveredDevice[]> => ipcRenderer.invoke('devices:list'),
  onDevicesUpdate: (cb: (devices: DiscoveredDevice[]) => void) => {
    const listener = (_e: unknown, devices: DiscoveredDevice[]) => cb(devices)
    ipcRenderer.on('devices:update', listener)
    return () => ipcRenderer.removeListener('devices:update', listener)
  },

  trustDevice: (id: string): Promise<void> => ipcRenderer.invoke('devices:trust', id),
  untrustDevice: (id: string): Promise<void> => ipcRenderer.invoke('devices:untrust', id),
  blockDevice: (id: string): Promise<void> => ipcRenderer.invoke('devices:block', id),
  unblockDevice: (id: string): Promise<void> => ipcRenderer.invoke('devices:unblock', id),
  getHistory: () => ipcRenderer.invoke('devices:history'),

  listSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('sources:list'),

  requestConnection: (targetDeviceId: string, kind: RequestKind): Promise<string> =>
    ipcRenderer.invoke('signal:request-connection', targetDeviceId, kind),
  respondConnect: (requestId: string, accept: boolean, trust: boolean, peerId: string): Promise<void> =>
    ipcRenderer.invoke('signal:respond', requestId, accept, trust, peerId),
  sendSignal: (message: SignalMessage): Promise<void> => ipcRenderer.invoke('signal:send', message),
  hangup: (requestId: string): Promise<void> => ipcRenderer.invoke('signal:hangup', requestId),

  onIncomingRequest: (cb: (payload: IncomingRequestPayload) => void) => {
    const listener = (_e: unknown, payload: IncomingRequestPayload) => cb(payload)
    ipcRenderer.on('signal:incoming-request', listener)
    return () => ipcRenderer.removeListener('signal:incoming-request', listener)
  },
  onAutoAccepted: (cb: (payload: IncomingRequestPayload) => void) => {
    const listener = (_e: unknown, payload: IncomingRequestPayload) => cb(payload)
    ipcRenderer.on('signal:auto-accepted', listener)
    return () => ipcRenderer.removeListener('signal:auto-accepted', listener)
  },
  onSignalMessage: (cb: (message: SignalMessage) => void) => {
    const listener = (_e: unknown, message: SignalMessage) => cb(message)
    ipcRenderer.on('signal:message', listener)
    return () => ipcRenderer.removeListener('signal:message', listener)
  },
  onSignalClosed: (cb: (requestId: string) => void) => {
    const listener = (_e: unknown, requestId: string) => cb(requestId)
    ipcRenderer.on('signal:closed', listener)
    return () => ipcRenderer.removeListener('signal:closed', listener)
  },

  addHistory: (entry: { deviceId: string; deviceName: string; direction: 'shared-to' | 'received-from' }) =>
    ipcRenderer.invoke('history:add', entry),

  saveScreenshot: (dataUrl: string): Promise<boolean> => ipcRenderer.invoke('screenshot:save', dataUrl),

  openViewerWindow: (requestId: string, peer: DeviceInfo): Promise<void> =>
    ipcRenderer.invoke('viewer:open', requestId, peer),
  viewerReady: (requestId: string): Promise<void> => ipcRenderer.invoke('viewer:ready', requestId),
  toggleThisWindowFullscreen: (): Promise<void> => ipcRenderer.invoke('viewer:toggle-fullscreen'),
  requestSwap: (peer: DeviceInfo): Promise<void> => ipcRenderer.invoke('viewer:swap-request', peer),
  onSwapNavigate: (cb: (peer: DeviceInfo) => void) => {
    const listener = (_e: unknown, peer: DeviceInfo) => cb(peer)
    ipcRenderer.on('viewer:swap-navigate', listener)
    return () => ipcRenderer.removeListener('viewer:swap-navigate', listener)
  },

  createWebShare: (): Promise<{ requestId: string; url: string }> => ipcRenderer.invoke('webshare:create'),
  cancelWebShare: (requestId: string): Promise<void> => ipcRenderer.invoke('webshare:cancel', requestId),
  onWebConnected: (cb: (requestId: string) => void) => {
    const listener = (_e: unknown, requestId: string) => cb(requestId)
    ipcRenderer.on('signal:web-connected', listener)
    return () => ipcRenderer.removeListener('signal:web-connected', listener)
  },

  onUpdateAvailable: (cb: (info: { version: string; url: string; notes: string }) => void) => {
    const listener = (_e: unknown, info: { version: string; url: string; notes: string }) => cb(info)
    ipcRenderer.on('update:available', listener)
    return () => ipcRenderer.removeListener('update:available', listener)
  },
  openUpdateDownload: (url: string): Promise<void> => ipcRenderer.invoke('update:open-download', url),

  startTextureShare: (requestId: string, name: string, width: number, height: number): Promise<void> =>
    ipcRenderer.invoke('texture:start', requestId, name, width, height),
  sendTextureFrame: (requestId: string, data: Uint8Array, width: number, height: number): void => {
    ipcRenderer.send('texture:frame', requestId, data, width, height)
  },
  stopTextureShare: (requestId: string): Promise<void> => ipcRenderer.invoke('texture:stop', requestId)
}

contextBridge.exposeInMainWorld('telalink', api)

export type TelaLinkApi = typeof api
