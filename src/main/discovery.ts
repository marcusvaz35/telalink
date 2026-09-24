import { Bonjour, type Service } from 'bonjour-service'
import { EventEmitter } from 'events'
import type { DeviceInfo, DeviceType, DiscoveredDevice } from '../shared/types'
import { store } from './store'

const SERVICE_TYPE = 'telalink'
const STALE_MS = 5 * 60_000
const SWEEP_MS = 15_000

function isIpLiteral(value: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value) || value.includes(':')
}

interface DiscoveryEvents {
  update: [DiscoveredDevice[]]
}

/** Contrato comum entre Discovery (bonjour-service, Windows/Linux) e DiscoveryMac (dns-sd nativo). */
export interface IDiscovery {
  start(device: DeviceInfo, signalPort: number): void
  stop(): void
  list(): DiscoveredDevice[]
  getHost(id: string): DiscoveredDevice | undefined
  refreshFlags(): void
  on(event: 'update', listener: (devices: DiscoveredDevice[]) => void): this
}

export class Discovery extends EventEmitter implements IDiscovery {
  private bonjour = new Bonjour()
  private devices = new Map<string, DiscoveredDevice>()
  private sweepTimer: NodeJS.Timeout | null = null

  start(device: DeviceInfo, signalPort: number): void {
    this.bonjour.publish({
      name: `TelaLink-${device.id.slice(0, 8)}`,
      type: SERVICE_TYPE,
      port: signalPort,
      txt: {
        id: device.id,
        name: device.name,
        devtype: device.type
      }
    })

    const browser = this.bonjour.find({ type: SERVICE_TYPE }, (service) => this.onServiceSeen(service))
    browser.on('up', (service) => this.onServiceSeen(service))
    browser.on('down', (service) => this.onServiceDown(service))

    this.sweepTimer = setInterval(() => this.sweepStale(), SWEEP_MS)
  }

  private onServiceSeen(service: Service): void {
    const txt = (service.txt ?? {}) as Record<string, string>
    const id = txt.id
    if (!id || id === store.getDevice().id) return

    // Prefere sempre um IP literal: em algumas redes (principalmente com o
    // Windows) o hostname resolve pra um IP diferente do de quem realmente
    // anunciou o serviço, e a conexão falha silenciosamente.
    const candidates = [service.referer?.address, ...(service.addresses ?? [])].filter(
      (h): h is string => !!h
    )
    const host = candidates.find(isIpLiteral) ?? candidates[0]
    if (!host) return

    const existing = this.devices.get(id)
    this.devices.set(id, {
      id,
      name: txt.name ?? existing?.name ?? 'Dispositivo',
      type: (txt.devtype as DeviceType) ?? existing?.type ?? 'unknown',
      host,
      port: service.port,
      lastSeenAt: Date.now(),
      trusted: store.isTrusted(id),
      blocked: store.isBlocked(id)
    })
    this.emitUpdate()
  }

  private onServiceDown(service: Service): void {
    const txt = (service.txt ?? {}) as Record<string, string>
    if (txt.id) {
      this.devices.delete(txt.id)
      this.emitUpdate()
    }
  }

  private sweepStale(): void {
    const now = Date.now()
    let changed = false
    for (const [id, dev] of this.devices) {
      if (now - dev.lastSeenAt > STALE_MS) {
        this.devices.delete(id)
        changed = true
      }
    }
    if (changed) this.emitUpdate()
  }

  private emitUpdate(): void {
    this.emit('update', this.list())
  }

  list(): DiscoveredDevice[] {
    return Array.from(this.devices.values())
      .map((d) => ({ ...d, trusted: store.isTrusted(d.id), blocked: store.isBlocked(d.id) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  getHost(id: string): DiscoveredDevice | undefined {
    return this.devices.get(id)
  }

  refreshFlags(): void {
    this.emitUpdate()
  }

  stop(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    this.bonjour.unpublishAll(() => this.bonjour.destroy())
  }
}

export declare interface Discovery {
  on<K extends keyof DiscoveryEvents>(event: K, listener: (...args: DiscoveryEvents[K]) => void): this
  emit<K extends keyof DiscoveryEvents>(event: K, ...args: DiscoveryEvents[K]): boolean
}
