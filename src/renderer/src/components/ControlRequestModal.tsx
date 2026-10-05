interface ControlRequestModalProps {
  peerName: string
  onDecide: (allow: boolean) => void
}

export function ControlRequestModal({ peerName, onDecide }: ControlRequestModalProps): JSX.Element {
  return (
    <div className="tl-overlay">
      <div className="tl-card tl-fade-in" style={{ width: 340, padding: 22, boxShadow: 'var(--tl-shadow)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 8 }}>{peerName} quer controlar seu computador</div>
        <p style={{ fontSize: 13, color: 'var(--tl-text-dim)', lineHeight: 1.5, marginBottom: 14 }}>
          Quem controlar poderá mover o mouse, clicar e digitar como se estivesse na frente da sua tela. Só permita se
          você conhece e confia nessa pessoa.
        </p>
        <p style={{ fontSize: 12, color: 'var(--tl-text-faint)', lineHeight: 1.5, marginBottom: 16 }}>
          Você pode encerrar a qualquer momento pelo botão "Parar controle" ou com Ctrl/Cmd + Alt + Shift + X.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tl-btn tl-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onDecide(false)}>
            Negar
          </button>
          <button className="tl-btn tl-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onDecide(true)}>
            Permitir
          </button>
        </div>
      </div>
    </div>
  )
}
