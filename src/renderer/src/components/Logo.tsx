import logoMarkSrc from '../assets/icons/logo_mark.png'

interface LogoMarkProps {
  size?: number
}

const LOGO_MARK_RATIO = 347 / 251

export function LogoMark({ size = 40 }: LogoMarkProps): JSX.Element {
  return <img src={logoMarkSrc} alt="TelaLink" style={{ height: size, width: size * LOGO_MARK_RATIO }} />
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
