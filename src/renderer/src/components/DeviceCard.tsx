import type { DeviceType, DiscoveredDevice } from '../../../shared/types'
import iconMonitorWhite from '../assets/icons/icon_monitor_white.png'
import iconPhoneWhite from '../assets/icons/icon_phone_white.png'

const TYPE_LABEL: Record<DeviceType, string> = {
  mac: 'Mac',
  windows: 'Windows',
  linux: 'Linux',
  android: 'Android',
  ios: 'iPhone',
  unknown: 'Dispositivo'
}

const TYPE_ICON: Record<DeviceType, string> = {
  mac: iconMonitorWhite,
  windows: iconMonitorWhite,
  linux: iconMonitorWhite,
  android: iconPhoneWhite,
  ios: iconPhoneWhite,
  unknown: iconMonitorWhite
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
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: 'var(--tl-gradient-strong)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}
      >
        <img src={TYPE_ICON[device.type]} alt="" style={{ height: 18 }} />
      </span>
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
