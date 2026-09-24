interface UpdateBannerProps {
  version: string
  onDownload: () => void
  onDismiss: () => void
}

export function UpdateBanner({ version, onDownload, onDismiss }: UpdateBannerProps): JSX.Element {
  return (
    <div
      className="tl-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        background: 'var(--tl-gradient-strong)',
        color: 'white',
        fontSize: 13
      }}
    >
      <span style={{ flex: 1 }}>Nova versão do TelaLink disponível (v{version})</span>
      <button
        onClick={onDownload}
        style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.35)',
          color: 'white',
          borderRadius: 8,
          padding: '5px 12px',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer'
        }}
      >
        Baixar atualização
      </button>
      <button
        onClick={onDismiss}
        aria-label="Fechar"
        style={{ background: 'none', border: 'none', color: 'white', opacity: 0.8, cursor: 'pointer', fontSize: 14, padding: 4 }}
      >
        ✕
      </button>
    </div>
  )
}
