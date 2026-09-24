import os from 'os'

/** Primeiro IPv4 de rede local não-interno — o endereço que outro dispositivo na LAN usa para nos alcançar. */
export function getLanIp(): string {
  const interfaces = os.networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}
