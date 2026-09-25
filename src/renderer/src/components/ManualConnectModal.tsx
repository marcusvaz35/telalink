import { useState } from 'react'
import { DEFAULT_SIGNAL_PORT } from '../../../shared/types'

interface ManualConnectModalProps {
  onClose: () => void
  onAdd: (host: string, port: number) => void
}

export function ManualConnectModal({ onClose, onAdd }: ManualConnectModalProps): JSX.Element {
  const [host, setHost] = useState('')
  const [port, setPort] = useState(String(DEFAULT_SIGNAL_PORT))
  const [showPort, setShowPort] = useState(false)

  const valid = host.trim().length > 0 && Number(port) > 0

  return (
    <div className="tl-overlay">
      <div className="tl-card tl-fade-in" style={{ width: 320, padding: 22, boxShadow: 'var(--tl-shadow)' }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 6 }}>Conectar por IP</div>
        <p style={{ fontSize: 13, color: 'var(--tl-text-dim)', lineHeight: 1.5, marginBottom: 16 }}>
          Use quando a busca automática não encontrar o outro dispositivo (algumas redes de
          Wi-Fi bloqueiam essa busca). Peça o IP de rede local do outro computador pra quem
          estiver nele.
        </p>

        <input
          autoFocus
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="Ex: 192.168.1.42"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            border: '1px solid var(--tl-border)',
            background: 'var(--tl-bg)',
            color: 'var(--tl-text)',
            fontSize: 14,
            marginBottom: 10
          }}
        />

        {showPort ? (
          <input
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, ''))}
            placeholder="Porta"
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: '1px solid var(--tl-border)',
              background: 'var(--tl-bg)',
              color: 'var(--tl-text)',
              fontSize: 14,
              marginBottom: 16
            }}
          />
        ) : (
          <button
            onClick={() => setShowPort(true)}
            style={{ background: 'none', border: 'none', color: 'var(--tl-text-faint)', fontSize: 12, padding: 0, marginBottom: 16, cursor: 'pointer' }}
          >
            Porta avançada (padrão {DEFAULT_SIGNAL_PORT})
          </button>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="tl-btn tl-btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancelar
          </button>
          <button
            className="tl-btn tl-btn-primary"
            style={{ flex: 1, justifyContent: 'center' }}
            disabled={!valid}
            onClick={() => onAdd(host.trim(), Number(port))}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  )
}
