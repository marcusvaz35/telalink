interface AppFooterProps {
  version: string
  checking: boolean
  onCheckUpdate: () => void
}

export function AppFooter({ version, checking, onCheckUpdate }: AppFooterProps): JSX.Element {
  return (
    <div
      style={{
        flexShrink: 0,
        height: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        fontSize: 11,
        color: 'var(--tl-text-faint)',
        borderTop: '1px solid var(--tl-border-soft)'
      }}
    >
      <span>TelaLink {version ? `v${version}` : ''}</span>
      <span aria-hidden>·</span>
      <button
        onClick={onCheckUpdate}
        disabled={checking}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          fontSize: 11,
          color: 'var(--tl-cyan)',
          cursor: checking ? 'default' : 'pointer',
          opacity: checking ? 0.6 : 1
        }}
      >
        {checking ? 'Verificando…' : 'Verificar atualização'}
      </button>
    </div>
  )
}
