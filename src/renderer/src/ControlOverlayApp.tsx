interface ControlOverlayAppProps {
  peerName: string
}

/** Faixa sempre visível, no topo da tela controlada, enquanto alguém controla este computador. */
export function ControlOverlayApp({ peerName }: ControlOverlayAppProps): JSX.Element {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 12px 0 16px',
        background: '#0a0f1e',
        border: '2px solid #ef4444',
        borderRadius: 12,
        color: 'var(--tl-text)',
        fontSize: 13
      }}
    >
      <span className="tl-dot" style={{ background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)' }} />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong>{peerName}</strong> está controlando este computador
      </span>
      <button
        className="tl-btn tl-btn-danger"
        style={{ padding: '6px 12px', fontSize: 12, whiteSpace: 'nowrap' }}
        onClick={() => void window.telalink.revokeAllControl()}
      >
        Parar controle
      </button>
    </div>
  )
}
