import type { DeviceInfo, DiscoveredDevice } from '../../../shared/types'
import { Logo } from '../components/Logo'
import { DeviceCard } from '../components/DeviceCard'

interface HomeScreenProps {
  device: DeviceInfo | null
  devices: DiscoveredDevice[]
  onShare: () => void
  onReceive: () => void
  onWebShare: () => void
}

export function HomeScreen({ device, devices, onShare, onReceive, onWebShare }: HomeScreenProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 24, gap: 24 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 8 }}>
        <Logo size={40} withTagline />
      </div>

      <div className="tl-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="tl-dot tl-dot-online" />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Conectado</div>
          <div style={{ fontSize: 12, color: 'var(--tl-text-dim)' }}>
            Pronto para compartilhar ou receber uma tela
          </div>
        </div>
        {device && (
          <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--tl-text-faint)', textAlign: 'right' }}>
            {device.name}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="tl-btn tl-btn-primary" onClick={onShare}>
          <span style={{ fontSize: 18 }}>🖥️</span> Compartilhar minha tela
        </button>
        <button className="tl-btn tl-btn-secondary" onClick={onReceive}>
          <span style={{ fontSize: 18 }}>📺</span> Receber uma tela
        </button>
        <button
          onClick={onWebShare}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--tl-text-dim)',
            fontSize: 12,
            padding: '4px 0',
            cursor: 'pointer',
            textAlign: 'center'
          }}
        >
          🌐 Compartilhar com iPhone/Android (navegador)
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--tl-text-dim)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Dispositivos disponíveis
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {devices.length === 0 && (
            <div style={{ fontSize: 13, color: 'var(--tl-text-faint)', textAlign: 'center', padding: '24px 0' }}>
              Procurando dispositivos na rede…
            </div>
          )}
          {devices.map((d) => (
            <DeviceCard key={d.id} device={d} />
          ))}
        </div>
      </div>
    </div>
  )
}
