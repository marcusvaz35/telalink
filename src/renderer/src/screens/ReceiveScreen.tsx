import type { DiscoveredDevice } from '../../../shared/types'
import { DeviceCard } from '../components/DeviceCard'

interface ReceiveScreenProps {
  devices: DiscoveredDevice[]
  busyDeviceId: string | null
  onBack: () => void
  onRequest: (device: DiscoveredDevice) => void
}

export function ReceiveScreen({ devices, busyDeviceId, onBack, onRequest }: ReceiveScreenProps): JSX.Element {
  const available = devices.filter((d) => !d.blocked)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button className="tl-btn tl-btn-ghost" onClick={onBack} disabled={!!busyDeviceId}>
          ← Voltar
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>Receber uma tela</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
        {available.length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--tl-text-faint)', textAlign: 'center', padding: '24px 0' }}>
            Nenhum dispositivo encontrado na rede.
          </div>
        )}
        {available.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            actionLabel="Solicitar tela"
            busy={busyDeviceId === d.id}
            disabled={!!busyDeviceId}
            onAction={() => onRequest(d)}
          />
        ))}
      </div>
    </div>
  )
}
