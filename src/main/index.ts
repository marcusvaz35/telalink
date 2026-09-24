import { app, BrowserWindow, desktopCapturer, ipcMain, dialog, screen, shell } from 'electron'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { is } from './platform'
import { store } from './store'
import { Discovery, type IDiscovery } from './discovery'
import { DiscoveryMac } from './discoveryMac'
import { Signaling } from './signaling'
import { getLanIp } from './network'
import { checkForUpdate } from './updateCheck'
import { TextureSender } from '@napolab/texture-bridge'
import type { DeviceInfo, RequestKind, ScreenSource, SignalMessage } from '../shared/types'

if (process.env['TELALINK_DEBUG_PORT']) {
  app.commandLine.appendSwitch('remote-debugging-port', process.env['TELALINK_DEBUG_PORT'])
}

let mainWindow: BrowserWindow | null = null
const viewerWindows = new Map<string, BrowserWindow>()
const textureSenders = new Map<string, TextureSender>()
// No macOS o dns-sd nativo interopera de verdade com clientes Bonjour reais
// (iOS, Android, Bonjour Browser); em outras plataformas usamos a
// implementação em JS via bonjour-service.
const discovery: IDiscovery = process.platform === 'darwin' ? new DiscoveryMac() : new Discovery()
let signaling: Signaling
let signalPort = 0

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0a0f1e',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.on('console-message', (_e, _level, message, line, sourceId) => {
    console.log(`[renderer] ${message} (${sourceId}:${line})`)
  })

  loadRenderer(mainWindow)
}

function loadRenderer(win: BrowserWindow, query?: Record<string, string>): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL'])
    if (query) for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v)
    win.loadURL(url.toString())
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), query ? { query } : undefined)
  }
}

/** Monitor diferente do principal, se houver — é onde a tela recebida deve abrir. */
function pickSecondaryDisplay(): Electron.Display {
  const displays = screen.getAllDisplays()
  const primary = screen.getPrimaryDisplay()
  return displays.find((d) => d.id !== primary.id) ?? primary
}

function openViewerWindow(requestId: string, peer: DeviceInfo): void {
  const existing = viewerWindows.get(requestId)
  if (existing && !existing.isDestroyed()) {
    existing.focus()
    return
  }

  const target = pickSecondaryDisplay()

  const win = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    frame: false,
    show: false,
    backgroundColor: '#000000',
    autoHideMenuBar: true,
    title: `TelaLink — ${peer.name}`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
    win.setFullScreen(true)
    win.focus()
  })
  win.on('closed', () => {
    viewerWindows.delete(requestId)
    textureSenders.get(requestId)?.stop()
    textureSenders.delete(requestId)
  })

  loadRenderer(win, { view: 'viewer', requestId, peerId: peer.id, peerName: peer.name })
  viewerWindows.set(requestId, win)
}

function broadcast(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

async function bootstrapNetworking(): Promise<void> {
  signaling = new Signaling(store.getDevice(), discovery)
  const port = await signaling.start()
  signalPort = port
  discovery.start(store.getDevice(), port)

  discovery.on('update', (list) => broadcast('devices:update', list))

  signaling.on('incoming-request', (payload) => broadcast('signal:incoming-request', payload))
  signaling.on('auto-accepted', (payload) => broadcast('signal:auto-accepted', payload))
  signaling.on('message', (msg: SignalMessage) => broadcast('signal:message', msg))
  signaling.on('web-connected', (requestId) => broadcast('signal:web-connected', requestId))
  signaling.on('closed', (requestId) => {
    broadcast('signal:closed', requestId)
    viewerWindows.get(requestId)?.close()
  })
}

function registerIpc(): void {
  ipcMain.handle('device:get', () => store.getDevice())

  ipcMain.handle('device:set-name', (_e, name: string) => {
    const device = store.setDeviceName(name)
    discovery.stop()
    void bootstrapNetworking()
    return device
  })

  ipcMain.handle('devices:list', () => discovery.list())

  ipcMain.handle('devices:trust', (_e, deviceId: string) => {
    store.trust(deviceId)
    discovery.refreshFlags()
  })

  ipcMain.handle('devices:untrust', (_e, deviceId: string) => {
    store.untrust(deviceId)
    discovery.refreshFlags()
  })

  ipcMain.handle('devices:block', (_e, deviceId: string) => {
    store.block(deviceId)
    discovery.refreshFlags()
  })

  ipcMain.handle('devices:unblock', (_e, deviceId: string) => {
    store.unblock(deviceId)
    discovery.refreshFlags()
  })

  ipcMain.handle('devices:history', () => store.getHistory())

  ipcMain.handle('sources:list', async (): Promise<ScreenSource[]> => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 200 },
      fetchWindowIcons: false
    })
    return sources.map((s) => ({
      id: s.id,
      name: s.name || (s.id.startsWith('screen') ? 'Tela' : 'Janela'),
      kind: s.id.startsWith('screen') ? 'screen' : 'window',
      thumbnailDataUrl: s.thumbnail.toDataURL()
    }))
  })

  ipcMain.handle('signal:request-connection', async (_e, targetDeviceId: string, kind: RequestKind) => {
    return signaling.requestConnection(targetDeviceId, kind)
  })

  ipcMain.handle('signal:respond', (_e, requestId: string, accept: boolean, trust: boolean, peerId: string) => {
    if (trust && accept) store.trust(peerId)
    signaling.send(requestId, { type: 'connect-response', requestId, accept })
    if (!accept) signaling.hangup(requestId)
  })

  ipcMain.handle('signal:send', (_e, message: SignalMessage) => {
    signaling.send(message.requestId, message)
  })

  ipcMain.handle('signal:hangup', (_e, requestId: string) => {
    signaling.hangup(requestId)
    viewerWindows.get(requestId)?.close()
  })

  ipcMain.handle('history:add', (_e, entry: { deviceId: string; deviceName: string; direction: 'shared-to' | 'received-from' }) => {
    store.addHistory({ ...entry, at: Date.now() })
  })

  ipcMain.handle('screenshot:save', async (_e, dataUrl: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow!, {
      title: 'Salvar captura de tela',
      defaultPath: `telalink-captura-${Date.now()}.png`,
      filters: [{ name: 'PNG', extensions: ['png'] }]
    })
    if (canceled || !filePath) return false
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return true
  })

  ipcMain.handle('viewer:open', (_e, requestId: string, peer: DeviceInfo) => {
    openViewerWindow(requestId, peer)
  })

  ipcMain.handle('viewer:toggle-fullscreen', (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    win?.setFullScreen(!win.isFullScreen())
  })

  ipcMain.handle('viewer:swap-request', (_e, peer: DeviceInfo) => {
    mainWindow?.show()
    mainWindow?.focus()
    mainWindow?.webContents.send('viewer:swap-navigate', peer)
  })

  ipcMain.handle('webshare:create', () => {
    const requestId = signaling.registerWebSession(store.getDevice().name)
    return { requestId, url: `http://${getLanIp()}:${signalPort}/?r=${requestId}` }
  })

  ipcMain.handle('webshare:cancel', (_e, requestId: string) => {
    signaling.cancelWebSession(requestId)
  })

  ipcMain.handle('update:open-download', (_e, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('texture:start', (_e, requestId: string, name: string, width: number, height: number) => {
    textureSenders.get(requestId)?.stop()
    textureSenders.set(requestId, new TextureSender(name, width, height))
  })

  ipcMain.on('texture:frame', (_e, requestId: string, data: Uint8Array, width: number, height: number) => {
    textureSenders.get(requestId)?.sendRgbaBuffer(Buffer.from(data.buffer, data.byteOffset, data.byteLength), width, height)
  })

  ipcMain.handle('texture:stop', (_e, requestId: string) => {
    textureSenders.get(requestId)?.stop()
    textureSenders.delete(requestId)
  })
}

app.whenReady().then(async () => {
  registerIpc()
  createWindow()
  await bootstrapNetworking()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Checa uma vez por sessão — sem instalar nada sozinho: só avisa e abre o
  // link do instalador certo pro sistema operacional quando clicarem.
  checkForUpdate().then((info) => {
    if (info) broadcast('update:available', info)
  })
})

app.on('window-all-closed', () => {
  discovery.stop()
  signaling?.stop()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  discovery.stop()
  signaling?.stop()
})
