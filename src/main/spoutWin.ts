import { BrowserWindow } from 'electron'
import type { TextureSender } from '@napolab/texture-bridge-core'

type Core = typeof import('@napolab/texture-bridge-core')

/**
 * Saída Spout no Windows. O Spout só aceita textura da GPU (enviar buffer
 * cru não é implementado lá), então os quadros recebidos são desenhados num
 * canvas de uma janela invisível com "offscreen shared texture" do Electron,
 * e a textura de cada pintura dessa janela é entregue ao Spout.
 */
export class SpoutOutput {
  private sender: TextureSender
  private win: BrowserWindow
  private ready = false
  private stopped = false

  constructor(name: string, width: number, height: number, preloadPath: string, rendererFile: string) {
    // Carregado só aqui (não no início do app): se o módulo nativo não abrir
    // neste computador (ex.: falta o Visual C++), só o Spout fica indisponível.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const core = require('@napolab/texture-bridge-core') as Core
    const sendTextureFromPaintEvent = core.sendTextureFromPaintEvent
    this.sender = new core.TextureSender(name, width, height)
    this.win = new BrowserWindow({
      width,
      height,
      useContentSize: true,
      show: false,
      frame: false,
      backgroundColor: '#000000',
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
        offscreen: { useSharedTexture: true, deviceScaleFactor: 1 }
      }
    })

    this.win.webContents.on('paint', (details) => {
      const texture = details.texture
      if (!texture) return
      try {
        if (!this.stopped) {
          const defect = sendTextureFromPaintEvent(this.sender, texture.textureInfo)
          if (defect) console.log(`[spout] quadro descartado: ${JSON.stringify(defect)}`)
        }
      } catch (err) {
        console.log(`[spout] falha ao enviar textura: ${(err as Error).message}`)
      } finally {
        texture.release()
      }
    })

    this.win.webContents.setFrameRate(30)
    this.win.webContents.once('did-finish-load', () => {
      this.ready = true
    })
    void this.win.loadFile(rendererFile, { query: { view: 'spout-out' } })
  }

  push(data: Uint8Array, width: number, height: number): void {
    if (this.stopped || !this.ready || this.win.isDestroyed()) return
    this.win.webContents.send('texture:frame-in', data, width, height)
  }

  stop(): void {
    if (this.stopped) return
    this.stopped = true
    try {
      this.sender.stop()
    } catch {
      // ignora: já parado
    }
    if (!this.win.isDestroyed()) this.win.destroy()
  }
}
