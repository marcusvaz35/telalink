import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { createInterface } from 'readline'
import { EventEmitter } from 'events'
import type { DeviceInfo, DeviceType, DiscoveredDevice } from '../shared/types'
import { store } from './store'
import type { IDiscovery } from './discovery'

/**
 * No macOS, o mDNSResponder do sistema é o único que fala de verdade com
 * clientes nativos (NetServiceBrowser do iOS, Bonjour Browser, etc.) — uma
 * implementação própria de mDNS em socket puro (a usada em discovery.ts nas
 * outras plataformas) compete pela porta 5353 e não é vista de forma
 * confiável por eles. Aqui usamos o `dns-sd` (parte do próprio macOS) tanto
 * pra publicar quanto pra procurar, garantindo interoperabilidade real.
 */
const SERVICE_TYPE = '_telalink._tcp'
const DOMAIN = 'local'
const STALE_MS = 20_000
const SWEEP_MS = 5_000

interface DiscoveryEvents {
  update: [DiscoveredDevice[]]
}

function parseTxtLine(line: string): Record<string, string> {
  const tokens: string[] = []
  let current = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && i + 1 < line.length) {
      current += line[i + 1]
      i++
    } else if (ch === ' ') {
      if (current.length) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current.length) tokens.push(current)

  const result: Record<string, string> = {}
  for (const token of tokens) {
    const idx = token.indexOf('=')
    if (idx > 0) result[token.slice(0, idx)] = token.slice(idx + 1)
  }
  return result
}

export class DiscoveryMac extends EventEmitter implements IDiscovery {
  private registerProc: ChildProcessWithoutNullStreams | null = null
  private browseProc: ChildProcessWithoutNullStreams | null = null
  private lookupProcs = new Map<string, ChildProcessWithoutNullStreams>()
  private instanceToId = new Map<string, string>()
  private devices = new Map<string, DiscoveredDevice>()
  private sweepTimer: NodeJS.Timeout | null = null
  private myId = ''

  start(device: DeviceInfo, signalPort: number): void {
    this.myId = device.id

    this.registerProc = spawn('dns-sd', [
      '-R',
      `TelaLink-${device.id.slice(0, 8)}`,
      SERVICE_TYPE,
      DOMAIN,
      String(signalPort),
      `id=${device.id}`,
      `name=${device.name}`,
      `devtype=${device.type}`
    ])
    this.registerProc.on('error', () => undefined)

    this.browseProc = spawn('dns-sd', ['-B', SERVICE_TYPE, `${DOMAIN}.`])
    this.browseProc.on('error', () => undefined)

    const seenInstances = new Set<string>()
    createInterface({ input: this.browseProc.stdout }).on('line', (line) => {
      const match = line.match(/^\S+\s+(Add|Rmv)\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/)
      if (!match) return
      const [, action, rawName] = match
      const instanceName = rawName.trim()

      if (action === 'Add') {
        if (!seenInstances.has(instanceName)) {
          seenInstances.add(instanceName)
          this.resolve(instanceName)
        }
      } else {
        seenInstances.delete(instanceName)
        const id = this.instanceToId.get(instanceName)
        if (id) {
          this.devices.delete(id)
          this.instanceToId.delete(instanceName)
          this.emitUpdate()
        }
      }
    })

    this.sweepTimer = setInterval(() => this.sweepStale(), SWEEP_MS)
  }

  private resolve(instanceName: string): void {
    if (this.lookupProcs.has(instanceName)) return

    const proc = spawn('dns-sd', ['-L', instanceName, SERVICE_TYPE, `${DOMAIN}.`])
    this.lookupProcs.set(instanceName, proc)
    proc.on('error', () => undefined)

    let pendingHost: { host: string; port: number } | null = null
    let settled = false

    createInterface({ input: proc.stdout }).on('line', (line) => {
      if (settled) return

      const hostMatch = line.match(/can be reached at ([^\s:]+):(\d+)/)
      if (hostMatch) {
        pendingHost = { host: hostMatch[1].replace(/\.$/, ''), port: Number(hostMatch[2]) }
        return
      }

      if (line.startsWith(' ') && pendingHost) {
        settled = true
        const { host: hostname, port } = pendingHost
        const txt = parseTxtLine(line.trim())
        proc.kill()
        this.lookupProcs.delete(instanceName)

        if (!txt.id || txt.id === this.myId) return

        // O hostname .local às vezes resolve pra um IP diferente do que a
        // conexão real vai usar (rede com mais de uma interface no mesmo
        // nome) — pega o IP literal de verdade antes de guardar o dispositivo.
        this.resolveHostToIp(hostname, (ip) => {
          this.instanceToId.set(instanceName, txt.id)
          this.devices.set(txt.id, {
            id: txt.id,
            name: txt.name ?? instanceName,
            type: (txt.devtype as DeviceType) ?? 'unknown',
            host: ip ?? hostname,
            port,
            lastSeenAt: Date.now(),
            trusted: store.isTrusted(txt.id),
            blocked: store.isBlocked(txt.id)
          })
          this.emitUpdate()
        })
      }
    })

    proc.on('close', () => this.lookupProcs.delete(instanceName))
  }

  private resolveHostToIp(hostname: string, done: (ip: string | null) => void): void {
    const proc = spawn('dns-sd', ['-G', 'v4', hostname])
    proc.on('error', () => done(null))

    let finished = false
    const finish = (ip: string | null): void => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      proc.kill()
      done(ip)
    }

    const timer = setTimeout(() => finish(null), 2500)

    createInterface({ input: proc.stdout }).on('line', (line) => {
      const match = line.match(/^\S+\s+(Add|Rmv)\s+\S+\s+\S+\s+\S+\s+(\d{1,3}(?:\.\d{1,3}){3})\s+\S+$/)
      if (!match) return
      const [, action, address] = match
      if (action === 'Add' && address !== '127.0.0.1') finish(address)
    })
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
    this.registerProc?.kill()
    this.browseProc?.kill()
    for (const proc of this.lookupProcs.values()) proc.kill()
    this.lookupProcs.clear()
  }
}

export declare interface DiscoveryMac {
  on<K extends keyof DiscoveryEvents>(event: K, listener: (...args: DiscoveryEvents[K]) => void): this
  emit<K extends keyof DiscoveryEvents>(event: K, ...args: DiscoveryEvents[K]): boolean
}
