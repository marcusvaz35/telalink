interface ToastProps {
  message: string
  tone?: 'info' | 'error'
}

export function Toast({ message, tone = 'info' }: ToastProps): JSX.Element {
  return (
    <div
      className="tl-fade-in"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        background: tone === 'error' ? 'rgba(239,68,68,0.15)' : 'var(--tl-bg-elevated)',
        border: `1px solid ${tone === 'error' ? 'rgba(239,68,68,0.4)' : 'var(--tl-border)'}`,
        color: tone === 'error' ? '#fca5a5' : 'var(--tl-text)',
        padding: '10px 18px',
        borderRadius: 999,
        fontSize: 13,
        boxShadow: 'var(--tl-shadow)',
        zIndex: 60,
        maxWidth: '85%',
        textAlign: 'center'
      }}
    >
      {message}
    </div>
  )
}
