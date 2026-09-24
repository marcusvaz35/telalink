# TelaLink — Fase 1 (MVP: PC ↔ PC na mesma rede)

Compartilhamento de tela P2P entre computadores, com descoberta automática e sem
configuração de rede. Fase 1: dois computadores Windows/macOS/Linux na mesma
rede local, via Electron + WebRTC + mDNS.

## Como executar

```bash
npm install
npm run dev
```

Isso abre a janela do TelaLink. Rode o mesmo comando em um segundo computador
na mesma rede Wi-Fi/Ethernet — os dois devem aparecer automaticamente um na
lista de "Dispositivos disponíveis" do outro, sem digitar IP.

Build de produção (gera `out/`):

```bash
npm run build
```

## Estrutura de pastas

```
src/
  main/            processo principal (Electron/Node)
    index.ts        janela, bootstrap, handlers IPC
    discovery.ts     descoberta mDNS (_telalink._tcp)
    signaling.ts     WebSocket local p/ trocar SDP/ICE entre pares
    store.ts         identidade do dispositivo, confiáveis/bloqueados, histórico
  preload/         ponte segura (contextBridge) entre main e renderer
  renderer/        interface (React + TypeScript)
    src/screens/     Home, ShareSetup, Receive, Viewer
    src/components/  DeviceCard, modais, barra de controle, etc.
    src/webrtc/      PeerSession (RTCPeerConnection) e captura de tela
  shared/          tipos TypeScript compartilhados entre main e renderer
```

## Notas importantes

- **Não rode `npm install` em volumes exFAT/NTFS externos.** O macOS cria
  arquivos `._*` (AppleDouble) para simular permissões Unix/symlinks nesses
  sistemas de arquivos, o que quebra a extração do binário do Electron (e,
  pelo mesmo motivo, venvs Python). Desenvolva sempre em disco interno (APFS).
- Fase 1 não usa STUN/TURN — funciona apenas na mesma rede local. O ponto de
  extensão para Fase 2/3 (internet) está isolado em `ICE_SERVERS` em
  `src/renderer/src/webrtc/PeerSession.ts` e no `signaling.ts` (troca o
  WebSocket local por um servidor de sinalização remoto).
- Controle de mouse/teclado não existe nesta versão — só compartilhar/receber
  tela, conforme especificado.
