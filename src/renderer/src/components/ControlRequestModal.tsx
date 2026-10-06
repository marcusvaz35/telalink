interface ControlRequestModalProps {
  peerName: string
  onDecide: (choice: 'deny' | 'once' | 'always') => void
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
          Se confiar, nas próximas vezes ele entra direto, sem perguntar. Você encerra a qualquer momento com Ctrl/Cmd + Alt + Shift + X (e pode apagar as confianças em Ajuda).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="tl-btn tl-btn-primary" style={{ justifyContent: 'center' }} onClick={() => onDecide('always')}>
            Permitir sempre (confiar neste computador)
          </button>
          <button className="tl-btn tl-btn-secondary" style={{ justifyContent: 'center' }} onClick={() => onDecide('once')}>
            Permitir só desta vez
          </button>
          <button className="tl-btn tl-btn-ghost" style={{ justifyContent: 'center' }} onClick={() => onDecide('deny')}>
            Negar
          </button>
        </div>
      </div>
    </div>
  )
}
