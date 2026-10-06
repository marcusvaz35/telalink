import { BrowserWindow, globalShortcut, screen, systemPreferences } from 'electron'
import { EventEmitter } from 'events'
import type { DeviceType, RemoteInputEvent } from '../shared/types'

type Libnut = typeof import('@nut-tree-fork/libnut-darwin')

const KILL_SWITCH = 'CommandOrControl+Alt+Shift+X'
const MAX_KEY_LEN = 32

const NAMED_KEYS: Record<string, string> = {
  Enter: 'enter',
  NumpadEnter: 'enter',
  Backspace: 'backspace',
  Tab: 'tab',
  Escape: 'escape',
  Space: 'space',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Delete: 'delete',
  Insert: 'insert',
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Backquote: '`',
  Comma: ',',
  Period: '.',
  Slash: '/',
  NumpadAdd: 'numpad_+',
  NumpadSubtract: 'numpad_-',
  NumpadMultiply: 'numpad_*',
  NumpadDivide: 'numpad_/',
  NumpadDecimal: 'numpad_.'
}

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'MetaLeft',
  'MetaRight'
])

/** Tecla física (KeyboardEvent.code) → nome de tecla do libnut; undefined = sem equivalente. */
function physicalKey(code: string): string | undefined {
  if (NAMED_KEYS[code]) return NAMED_KEYS[code]
  let m = /^Key([A-Z])$/.exec(code)
  if (m) return m[1].toLowerCase()
  m = /^Digit([0-9])$/.exec(code)
  if (m) return m[1]
  m = /^Numpad([0-9])$/.exec(code)
  if (m) return `numpad_${m[1]}`
  m = /^F([0-9]{1,2})$/.exec(code)
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 24) return `f${m[1]}`
  return undefined
}

/**
 * Atalhos usam a tecla "de comando" do sistema de cada lado: Cmd no Mac vira
 * Ctrl no Windows e vice-versa, pra Cmd+C / Ctrl+C funcionarem do jeito que
 * quem está controlando espera.
 */
function modifierKey(code: string, viewer: DeviceType, target: NodeJS.Platform): string {
  const viewerIsMac = viewer === 'mac'
  const targetIsMac = target === 'darwin'
  const side = code.startsWith('Shift') ? 'shift' : code.startsWith('Control') ? 'control' : code.startsWith('Alt') ? 'alt' : 'meta'
  if (side === 'shift') return code === 'ShiftRight' ? 'right_shift' : 'shift'
  if (viewerIsMac === targetIsMac) return side === 'meta' ? 'command' : side
  if (viewerIsMac && !targetIsMac) return side === 'meta' ? 'control' : side
  return side === 'control' ? 'command' : side === 'meta' ? 'control' : side
}

interface Grant {
  displayId: string
  viewerPlatform: DeviceType
  buttonsDown: Set<number>
  modsViewer: Map<string, string>
  modsPressed: Set<string>
  physicalDown: Map<string, string>
  scrollRemainder: { x: number; y: number }
}

interface RemoteControlEvents {
  revoked: [requestId: string]
}

export class RemoteControl extends EventEmitter {
  private grants = new Map<string, Grant>()
  private lib: Libnut | null = null
  private overlay: BrowserWindow | null = null
  private overlayInfo: { displayId: string; peerName: string } | null = null

  private native(): Libnut {
    if (!this.lib) {
      const name = process.platform === 'darwin' ? '@nut-tree-fork/libnut-darwin' : '@nut-tree-fork/libnut-win32'
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.lib = require(name) as Libnut
      this.lib.setMouseDelay(0)
      this.lib.setKeyboardDelay(0)
    }
    return this.lib
  }

  supported(): boolean {
    return process.platform === 'darwin' || process.platform === 'win32'
  }

  grant(
    requestId: string,
    displayId: string | undefined,
    viewerPlatform: DeviceType,
    peerName: string
  ): { ok: boolean; reason?: string } {
    if (!this.supported()) return { ok: false, reason: 'Controle remoto só funciona em Mac e Windows.' }
    if (!displayId) {
      return { ok: false, reason: 'Só é possível controlar quando uma tela inteira está sendo compartilhada (não uma janela).' }
    }
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) {
      return {
        ok: false,
        reason:
          'Libere o TelaLink em Ajustes do Sistema → Privacidade e Segurança → Acessibilidade, feche e abra o app e peça de novo.'
      }
    }
    try {
      this.native()
    } catch (err) {
      console.log(`[control] não foi possível carregar o módulo nativo: ${(err as Error).message}`)
      return { ok: false, reason: 'Não foi possível ativar o controle remoto neste computador.' }
    }

    this.grants.set(requestId, {
      displayId,
      viewerPlatform,
      buttonsDown: new Set(),
      modsViewer: new Map(),
      modsPressed: new Set(),
      physicalDown: new Map(),
      scrollRemainder: { x: 0, y: 0 }
    })
    if (this.grants.size === 1) {
      globalShortcut.register(KILL_SWITCH, () => this.revokeAll())
    }
    this.overlayInfo = { displayId, peerName }
    if (this.shouldShowIndicator()) this.showOverlay(displayId, peerName)
    return { ok: true }
  }

  setDisplay(requestId: string, displayId: string): void {
    const grant = this.grants.get(requestId)
    if (!grant) return
    grant.displayId = displayId
    if (this.overlayInfo) this.overlayInfo.displayId = displayId
  }

  revoke(requestId: string): void {
    const grant = this.grants.get(requestId)
    if (!grant) return
    this.releaseAll(grant)
    this.grants.delete(requestId)
    if (this.grants.size === 0) {
      globalShortcut.unregister(KILL_SWITCH)
      this.hideOverlay()
      this.overlayInfo = null
    }
    this.emit('revoked', requestId)
  }

  /** Chamado quando a preferência de mostrar a faixa muda com um controle já em andamento. */
  refreshIndicator(): void {
    if (this.grants.size === 0 || !this.overlayInfo) return
    if (this.shouldShowIndicator()) this.showOverlay(this.overlayInfo.displayId, this.overlayInfo.peerName)
    else this.hideOverlay()
  }

  revokeAll(): void {
    for (const id of [...this.grants.keys()]) this.revoke(id)
  }

  isActive(requestId: string): boolean {
    return this.grants.has(requestId)
  }

  handle(requestId: string, ev: RemoteInputEvent): void {
    const grant = this.grants.get(requestId)
    if (!grant) return
    try {
      switch (ev.t) {
        case 'move':
          if (validPoint(ev.x, ev.y)) this.moveTo(grant, ev.x, ev.y)
          break
        case 'down':
        case 'up':
          if (validPoint(ev.x, ev.y) && (ev.button === 0 || ev.button === 1 || ev.button === 2)) {
            this.mouseButton(grant, ev)
          }
          break
        case 'wheel':
          if (Number.isFinite(ev.dx) && Number.isFinite(ev.dy)) this.wheel(grant, ev.dx, ev.dy)
          break
        case 'key':
          if (typeof ev.code === 'string' && typeof ev.key === 'string' && ev.code.length <= MAX_KEY_LEN) {
            this.keyboard(grant, ev)
          }
          break
      }
    } catch (err) {
      console.log(`[control] falha ao executar evento ${ev.t}: ${(err as Error).message}`)
    }
  }

  private moveTo(grant: Grant, nx: number, ny: number): void {
    const display = screen.getAllDisplays().find((d) => String(d.id) === grant.displayId)
    if (!display) return
    const dip = {
      x: display.bounds.x + nx * (display.bounds.width - 1),
      y: display.bounds.y + ny * (display.bounds.height - 1)
    }
    const p = process.platform === 'win32' ? screen.dipToScreenPoint(dip) : dip
    const lib = this.native()
    const x = Math.round(p.x)
    const y = Math.round(p.y)
    if (grant.buttonsDown.size > 0) lib.dragMouse(x, y)
    else lib.moveMouse(x, y)
  }

  private mouseButton(grant: Grant, ev: Extract<RemoteInputEvent, { t: 'down' | 'up' }>): void {
    const lib = this.native()
    const name = ev.button === 0 ? 'left' : ev.button === 1 ? 'middle' : 'right'
    this.moveTo(grant, ev.x, ev.y)
    if (ev.t === 'down') {
      // O macOS só entende duplo clique se o evento carregar a contagem de
      // cliques; o libnut só faz isso em mouseClick(..., true).
      if (process.platform === 'darwin' && ev.clicks === 2) {
        lib.mouseClick(name, true)
        grant.buttonsDown.delete(ev.button)
        return
      }
      grant.buttonsDown.add(ev.button)
      lib.mouseToggle('down', name)
    } else {
      if (!grant.buttonsDown.has(ev.button)) return
      grant.buttonsDown.delete(ev.button)
      lib.mouseToggle('up', name)
    }
  }

  private wheel(grant: Grant, dx: number, dy: number): void {
    // deltas do navegador vêm em pixels (~100 por "clique" da roda); soma o
    // resto pra rolagem suave de trackpad não se perder.
    const r = grant.scrollRemainder
    r.x += dx / 100
    r.y += dy / 100
    const ticksX = Math.trunc(r.x)
    const ticksY = Math.trunc(r.y)
    if (ticksX === 0 && ticksY === 0) return
    r.x -= ticksX
    r.y -= ticksY
    this.native().scrollMouse(ticksX, -ticksY)
  }

  private keyboard(grant: Grant, ev: Extract<RemoteInputEvent, { t: 'key' }>): void {
    const lib = this.native()

    if (MODIFIER_CODES.has(ev.code)) {
      const key = modifierKey(ev.code, grant.viewerPlatform, process.platform)
      if (ev.down) {
        grant.modsViewer.set(ev.code, key)
      } else {
        grant.modsViewer.delete(ev.code)
        if (grant.modsPressed.delete(key)) lib.keyToggle(key, 'up')
      }
      return
    }

    if (ev.key === 'Dead' || ev.key === 'Process' || ev.key === 'Unidentified') return

    if (!ev.down) {
      const key = grant.physicalDown.get(ev.code)
      if (key) {
        grant.physicalDown.delete(ev.code)
        lib.keyToggle(key, 'up')
      }
      return
    }

    const printable = [...ev.key].length === 1
    if (printable && !ev.ctrl && !ev.alt && !ev.meta) {
      lib.typeString(ev.key)
      return
    }

    const key = physicalKey(ev.code)
    if (!key) return
    for (const mod of grant.modsViewer.values()) {
      if (!grant.modsPressed.has(mod)) {
        lib.keyToggle(mod, 'down')
        grant.modsPressed.add(mod)
      }
    }
    if (grant.physicalDown.has(ev.code)) lib.keyToggle(key, 'up')
    lib.keyToggle(key, 'down')
    grant.physicalDown.set(ev.code, key)
  }

  private releaseAll(grant: Grant): void {
    try {
      const lib = this.native()
      for (const key of grant.physicalDown.values()) lib.keyToggle(key, 'up')
      for (const key of grant.modsPressed) lib.keyToggle(key, 'up')
      for (const button of grant.buttonsDown) {
        lib.mouseToggle('up', button === 0 ? 'left' : button === 1 ? 'middle' : 'right')
      }
    } catch {
      // ignora: nada a soltar se o módulo nem carregou
    }
  }

  private showOverlay(displayId: string, peerName: string): void {
    if (this.overlay && !this.overlay.isDestroyed()) return
    const display = screen.getAllDisplays().find((d) => String(d.id) === displayId) ?? screen.getPrimaryDisplay()
    const width = 520
    const height = 52
    const win = new BrowserWindow({
      width,
      height,
      x: Math.round(display.bounds.x + (display.bounds.width - width) / 2),
      y: display.bounds.y + 8,
      frame: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      focusable: false,
      show: false,
      hasShadow: true,
      backgroundColor: '#0a0f1e',
      webPreferences: {
        preload: this.preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    // A faixa não entra na captura: quem controla vê a tela limpa, só quem
    // está na frente deste computador enxerga o aviso.
    win.setContentProtection(true)
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.once('ready-to-show', () => win.showInactive())
    this.overlayLoader(win, peerName)
    this.overlay = win
  }

  private hideOverlay(): void {
    if (this.overlay && !this.overlay.isDestroyed()) this.overlay.destroy()
    this.overlay = null
  }

  constructor(
    private preloadPath: string,
    private overlayLoader: (win: BrowserWindow, peerName: string) => void,
    private shouldShowIndicator: () => boolean
  ) {
    super()
  }
}

function validPoint(x: number, y: number): boolean {
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1
}

export declare interface RemoteControl {
  on<K extends keyof RemoteControlEvents>(event: K, listener: (...args: RemoteControlEvents[K]) => void): this
}
