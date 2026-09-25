import { EventEmitter } from 'events'
import type { DeviceInfo, DiscoveredDevice } from '../shared/types'
import type { IDiscovery } from './discovery'

/**
 * Combina várias fontes de descoberta (mDNS + broadcast UDP) numa lista só.
 * Assim o resto do app (janela principal, sinalização) continua enxergando
 * um único IDiscovery, sem saber que tem mais de uma fonte por trás.
 *
 * Prioridade por ORDEM da lista (fontes depois "vencem" fontes antes), não
 * por timestamp: o endereço resolvido via mDNS pode vir de um cache do
 * mDNSResponder do sistema e ficar desatualizado se o IP do outro
 * dispositivo mudar (ex: reconectou no Wi-Fi, renovou DHCP); o broadcast
 * UDP nunca tem esse problema, pois o host vem do IP de origem literal de
 * cada pacote recebido. Por isso o broadcast é passado por último na
 * construção — quando os dois enxergam o mesmo aparelho, o IP dele manda.
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

  private mergedMap(): Map<string, DiscoveredDevice> {
    const map = new Map<string, DiscoveredDevice>()
    for (const source of this.sources) {
      for (const device of source.list()) map.set(device.id, device)
    }
    return map
  }

  list(): DiscoveredDevice[] {
    return Array.from(this.mergedMap().values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  getHost(id: string): DiscoveredDevice | undefined {
    return this.mergedMap().get(id)
  }

  refreshFlags(): void {
    for (const source of this.sources) source.refreshFlags()
  }
}

export declare interface MergedDiscovery {
  on(event: 'update', listener: (devices: DiscoveredDevice[]) => void): this
}
