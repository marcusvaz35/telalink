import { EventEmitter } from 'events'
import type { DeviceInfo, DiscoveredDevice } from '../shared/types'
import type { IDiscovery } from './discovery'

/**
 * Combina várias fontes de descoberta (mDNS + broadcast UDP) numa lista só,
 * deduplicando por id e ficando com o registro visto mais recentemente.
 * Assim o resto do app (janela principal, sinalização) continua enxergando
 * um único IDiscovery, sem saber que tem mais de uma fonte por trás.
 */
export class MergedDiscovery extends EventEmitter implements IDiscovery {
  private sources: IDiscovery[]

  constructor(sources: IDiscovery[]) {
    super()
    this.sources = sources
    for (const source of sources) source.on('update', () => this.emit('update', this.list()))
  }

  start(device: DeviceInfo, signalPort: number): void {
    for (const source of this.sources) source.start(device, signalPort)
  }

  stop(): void {
    for (const source of this.sources) source.stop()
  }

  list(): DiscoveredDevice[] {
    const map = new Map<string, DiscoveredDevice>()
    for (const source of this.sources) {
      for (const device of source.list()) {
        const existing = map.get(device.id)
        if (!existing || device.lastSeenAt > existing.lastSeenAt) map.set(device.id, device)
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  getHost(id: string): DiscoveredDevice | undefined {
    for (const source of this.sources) {
      const device = source.getHost(id)
      if (device) return device
    }
    return undefined
  }

  refreshFlags(): void {
    for (const source of this.sources) source.refreshFlags()
  }
}

export declare interface MergedDiscovery {
  on(event: 'update', listener: (devices: DiscoveredDevice[]) => void): this
}
