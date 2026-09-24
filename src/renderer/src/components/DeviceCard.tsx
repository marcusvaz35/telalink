import type { DeviceType, DiscoveredDevice } from '../../../shared/types'

const TYPE_LABEL: Record<DeviceType, string> = {
  mac: 'Mac',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iPhone',
  unknown: 'Dispositivo'
}

const TYPE_ICON: Record<DeviceType, string> = {
  mac: '🖥️',
  windows: '🖥️',
  linux: '🖥️',
  android: '📱',
  ios: '📱',
  unknown: '💻'
}

interface DeviceCardProps {
  device: DiscoveredDevice
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
  busy?: boolean
}

export function DeviceCard({ device, actionLabel, onAction, disabled, busy }: DeviceCardProps): JSX.Element {
  return (
    <div
      className="tl-card"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        opacity: device.blocked ? 0.5 : 1
      }}
    >
      <span style={{ fontSize: 22 }}>{TYPE_ICON[device.type]}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className={`tl-dot ${device.blocked ? 'tl-dot-offline' : 'tl-dot-online'}`}
            aria-hidden
          />
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {device.name}
          </span>
          {device.trusted && (
            <span style={{ fontSize: 11, color: 'var(--tl-cyan)', border: '1px solid var(--tl-border)', borderRadius: 6, padding: '1px 6px' }}>
              confiável
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--tl-text-dim)', marginTop: 2 }}>
          {TYPE_LABEL[device.type]} · {device.blocked ? 'Bloqueado' : 'Disponível'}
        </div>
      </div>
      {actionLabel && onAction && (
        <button
          className="tl-btn tl-btn-secondary"
          style={{ padding: '8px 14px', fontSize: 13 }}
          onClick={onAction}
          disabled={disabled || device.blocked}
        >
          {busy ? 'Conectando…' : actionLabel}
        </button>
      )}
    </div>
  )
}
