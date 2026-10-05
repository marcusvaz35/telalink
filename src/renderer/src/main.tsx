import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ViewerWindowApp } from './ViewerWindowApp'
import { SpoutOutApp } from './SpoutOutApp'
import { ControlOverlayApp } from './ControlOverlayApp'
import './styles/global.css'

const params = new URLSearchParams(window.location.search)
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

if (params.get('view') === 'control-overlay') {
  root.render(<ControlOverlayApp peerName={params.get('peerName') ?? 'Alguém'} />)
} else if (params.get('view') === 'spout-out') {
  root.render(<SpoutOutApp />)
} else if (params.get('view') === 'viewer') {
  const requestId = params.get('requestId') ?? ''
  const peer = {
    id: params.get('peerId') ?? '',
    name: params.get('peerName') ?? 'Dispositivo',
    type: 'unknown' as const
  }
  root.render(
    <React.StrictMode>
      <ViewerWindowApp requestId={requestId} peer={peer} />
    </React.StrictMode>
  )
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}
