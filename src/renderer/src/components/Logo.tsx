interface LogoMarkProps {
  size?: number
}

export function LogoMark({ size = 40 }: LogoMarkProps): JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tl-screen-back" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="0.45" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="tl-screen-front" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#1d3fa0" />
        </linearGradient>
      </defs>
      <rect x="22" y="28" width="112" height="84" rx="20" fill="url(#tl-screen-back)" />
      <rect x="68" y="70" width="112" height="84" rx="20" fill="url(#tl-screen-front)" />
      <path d="M 72 88 C 96 88, 112 88, 132 88" fill="none" stroke="#f8fbff" strokeWidth="9" strokeLinecap="round" />
      <path d="M 122 78 L 136 88 L 122 98 Z" fill="#f8fbff" />
      <path d="M 130 116 C 106 116, 90 116, 70 116" fill="none" stroke="#f8fbff" strokeWidth="9" strokeLinecap="round" />
      <path d="M 80 106 L 66 116 L 80 126 Z" fill="#f8fbff" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  withWordmark?: boolean
  withTagline?: boolean
}

export function Logo({ size = 40, withWordmark = true, withTagline = false }: LogoProps): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <LogoMark size={size} />
        {withWordmark && (
          <span style={{ fontSize: size * 0.62, fontWeight: 800, letterSpacing: -0.5 }}>
            <span style={{ color: 'var(--tl-text)' }}>Tela</span>
            <span
              style={{
                background: 'var(--tl-gradient)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent'
              }}
            >
              Link
            </span>
          </span>
        )}
      </div>
      {withTagline && (
        <span style={{ color: 'var(--tl-text-dim)', fontSize: 14 }}>Sua tela, em qualquer lugar.</span>
      )}
    </div>
  )
}
