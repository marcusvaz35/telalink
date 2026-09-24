import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import os from 'os'
import type { DeviceInfo, DeviceType } from '../shared/types'

interface ConnectionHistoryEntry {
  deviceId: string
  deviceName: string
  at: number
  direction: 'shared-to' | 'received-from'
}

interface StoreData {
  device: DeviceInfo
  trustedDeviceIds: string[]
  blockedDeviceIds: string[]
  history: ConnectionHistoryEntry[]
}

function detectDeviceType(): DeviceType {
  switch (os.platform()) {
    case 'darwin':
      return 'mac'
    case 'win32':
      return 'windows'
    case 'linux':
      return 'linux'
    default:
      return 'unknown'
  }
}

function defaultDeviceName(): string {
  const host = os.hostname().replace(/\.local$/, '')
  return host || 'Meu dispositivo'
}

class Store {
  private path: string
  private data: StoreData

  constructor() {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.path = join(dir, 'telalink-store.json')
    this.data = this.load()
  }

  private load(): StoreData {
    if (existsSync(this.path)) {
      try {
        const raw = JSON.parse(readFileSync(this.path, 'utf-8')) as Partial<StoreData>
        return {
          device: raw.device ?? { id: randomUUID(), name: defaultDeviceName(), type: detectDeviceType() },
          trustedDeviceIds: raw.trustedDeviceIds ?? [],
          blockedDeviceIds: raw.blockedDeviceIds ?? [],
          history: raw.history ?? []
        }
      } catch {
        // arquivo corrompido, recria
      }
    }
    const fresh: StoreData = {
      device: { id: randomUUID(), name: defaultDeviceName(), type: detectDeviceType() },
      trustedDeviceIds: [],
      blockedDeviceIds: [],
      history: []
    }
    this.persist(fresh)
    return fresh
  }

  private persist(data: StoreData = this.data): void {
    writeFileSync(this.path, JSON.stringify(data, null, 2), 'utf-8')
  }

  getDevice(): DeviceInfo {
    return this.data.device
  }

  setDeviceName(name: string): DeviceInfo {
    this.data.device.name = name.trim().slice(0, 40) || this.data.device.name
    this.persist()
    return this.data.device
  }

  isTrusted(deviceId: string): boolean {
    return this.data.trustedDeviceIds.includes(deviceId)
  }

  isBlocked(deviceId: string): boolean {
    return this.data.blockedDeviceIds.includes(deviceId)
  }

  trust(deviceId: string): void {
    if (!this.data.trustedDeviceIds.includes(deviceId)) this.data.trustedDeviceIds.push(deviceId)
    this.data.blockedDeviceIds = this.data.blockedDeviceIds.filter((id) => id !== deviceId)
    this.persist()
  }

  untrust(deviceId: string): void {
    this.data.trustedDeviceIds = this.data.trustedDeviceIds.filter((id) => id !== deviceId)
    this.persist()
  }

  block(deviceId: string): void {
    if (!this.data.blockedDeviceIds.includes(deviceId)) this.data.blockedDeviceIds.push(deviceId)
    this.data.trustedDeviceIds = this.data.trustedDeviceIds.filter((id) => id !== deviceId)
    this.persist()
  }

  unblock(deviceId: string): void {
    this.data.blockedDeviceIds = this.data.blockedDeviceIds.filter((id) => id !== deviceId)
    this.persist()
  }

  addHistory(entry: ConnectionHistoryEntry): void {
    this.data.history.unshift(entry)
    this.data.history = this.data.history.slice(0, 100)
    this.persist()
  }

  getHistory(): ConnectionHistoryEntry[] {
    return this.data.history
  }

  getTrustedIds(): string[] {
    return this.data.trustedDeviceIds
  }

  getBlockedIds(): string[] {
    return this.data.blockedDeviceIds
  }
}

export const store = new Store()
