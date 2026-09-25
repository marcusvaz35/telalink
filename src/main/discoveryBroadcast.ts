import { EventEmitter } from 'events'
import dgram from 'dgram'
import os from 'os'
import type { DeviceInfo, DeviceType, DiscoveredDevice } from '../shared/types'
import { store } from './store'
import type { IDiscovery } from './discovery'

const BROADCAST_PORT = 47813
const ANNOUNCE_MS = 3_000
const STALE_MS = 5 * 60_000
const SWEEP_MS = 15_000
const MAGIC = 'telalink-announce'

interface AnnouncePacket {
  magic: string
  id: string
  name: string
  devtype: DeviceType
  signalPort: number
}

function broadcastAddresses(): string[] {
  const addrs = new Set<string>(['255.255.255.255'])
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family !== 'IPv4' || iface.internal || !iface.netmask) continue
      const ip = iface.address.split('.').map(Number)
      const mask = iface.netmask.split('.').map(Number)
      const bcast = ip.map((p, i) => (p | (~mask[i] & 0xff)) & 0xff)
      addrs.add(bcast.join('.'))
    }
  }
  return Array.from(addrs)
}

/**
 * Descoberta via broadcast UDP simples — roda em paralelo ao mDNS (que já é
 * a fonte principal) como uma segunda via. Algumas redes de eventos/igrejas
 * têm segmentação de Wi-Fi que deixa o multicast do mDNS assimétrico (um
 * lado publica, o outro não recebe) mesmo com tudo liberado nos dois
 * aparelhos; broadcast simples às vezes atravessa onde o mDNS não consegue,
 * e o IP de origem do pacote já vem certo (sem depender de resolver
 * hostname), então isso funciona como rede de segurança automática, sem o
 * usuário precisar digitar IP de ninguém.
 */
export class BroadcastDiscovery extends EventEmitter implements IDiscovery {
  private socket: dgram.Socket | null = null
  private announceTimer: NodeJS.Timeout | null = null
  private sweepTimer: NodeJS.Timeout | null = null
  private devices = new Map<string, DiscoveredDevice>()
  private me: DeviceInfo | null = null
  private signalPort = 0

  start(device: DeviceInfo, signalPort: number): void {
    this.me = device
    this.signalPort = signalPort

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true })
    this.socket = socket

    socket.on('error', (err) => {
      console.log(`[broadcast-discovery] erro: ${err.message}`)
    })

    socket.on('message', (buf, rinfo) => this.onMessage(buf, rinfo.address))

    socket.on('listening', () => {
      socket.setBroadcast(true)
      this.announce()
      this.announceTimer = setInterval(() => this.announce(), ANNOUNCE_MS)
    })

    socket.bind(BROADCAST_PORT)

    this.sweepTimer = setInterval(() => this.sweepStale(), SWEEP_MS)
  }

  private announce(): void {
    if (!this.socket || !this.me) return
    const packet: AnnouncePacket = {
      magic: MAGIC,
      id: this.me.id,
      name: this.me.name,
      devtype: this.me.type,
      signalPort: this.signalPort
    }
    const buf = Buffer.from(JSON.stringify(packet))
    for (const addr of broadcastAddresses()) {
      this.socket.send(buf, BROADCAST_PORT, addr, (err) => {
        if (err) console.log(`[broadcast-discovery] falha ao enviar pra ${addr}: ${err.message}`)
      })
    }
  }

  private onMessage(buf: Buffer, senderIp: string): void {
    let packet: AnnouncePacket
    try {
      packet = JSON.parse(buf.toString('utf8'))
    } catch {
      return
    }
    if (packet.magic !== MAGIC || !packet.id || packet.id === this.me?.id) return

    this.devices.set(packet.id, {
      id: packet.id,
      name: packet.name ?? 'Dispositivo',
      type: packet.devtype ?? 'unknown',
      host: senderIp,
      port: packet.signalPort,
      lastSeenAt: Date.now(),
      trusted: store.isTrusted(packet.id),
      blocked: store.isBlocked(packet.id)
    })
    this.emitUpdate()
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
    if (this.announceTimer) clearInterval(this.announceTimer)
    if (this.sweepTimer) clearInterval(this.sweepTimer)
    this.socket?.close()
    this.socket = null
  }
}

export declare interface BroadcastDiscovery {
  on(event: 'update', listener: (devices: DiscoveredDevice[]) => void): this
}
