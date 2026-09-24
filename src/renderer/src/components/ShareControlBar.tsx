interface ShareControlBarProps {
  peerName: string
  sourceName: string
  onStop: () => void
}

export function ShareControlBar({ peerName, sourceName, onStop }: ShareControlBarProps): JSX.Element {
  return (
    <div
      className="tl-card tl-fade-in"
      style={{
        position: 'fixed',
        bottom: 20,
        left: 20,
        right: 20,
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: 'var(--tl-shadow)'
      }}
    >
      <span className="tl-dot tl-dot-online" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>Compartilhando com {peerName}</div>
        <div style={{ fontSize: 12, color: 'var(--tl-text-dim)' }}>{sourceName}</div>
      </div>
      <button className="tl-btn tl-btn-danger" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onStop}>
        Parar compartilhamento
      </button>
    </div>
  )
}
