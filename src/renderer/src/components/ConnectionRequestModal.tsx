import { useState } from 'react'
import type { IncomingRequestPayload } from '../../../shared/types'

interface ConnectionRequestModalProps {
  request: IncomingRequestPayload
  onRespond: (accept: boolean, trust: boolean) => void
}

export function ConnectionRequestModal({ request, onRespond }: ConnectionRequestModalProps): JSX.Element {
  const [trust, setTrust] = useState(false)

  const title = 'Solicitação de conexão'
  const question =
    request.kind === 'share-offer'
      ? `Deseja permitir que "${request.from.name}" compartilhe a tela com você?`
      : `"${request.from.name}" está solicitando ver a sua tela. Permitir?`

  return (
    <div className="tl-overlay">
      <div className="tl-card tl-fade-in" style={{ width: 340, padding: 24, boxShadow: 'var(--tl-shadow)' }}>
        <div style={{ fontSize: 13, color: 'var(--tl-text-dim)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>{request.from.name}</div>
        <p style={{ fontSize: 14, color: 'var(--tl-text)', lineHeight: 1.5, marginBottom: 18 }}>{question}</p>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
          <span style={{ fontSize: 13, color: 'var(--tl-text-dim)' }}>Confiar neste dispositivo</span>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tl-btn tl-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onRespond(false, false)}>
            Recusar
          </button>
          <button className="tl-btn tl-btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onRespond(true, trust)}>
            Permitir
          </button>
        </div>
      </div>
    </div>
  )
}
