interface WebViewerPageOptions {
  requestId: string
  fromName: string
}

/**
 * Página autônoma (sem build, sem dependências) servida pelo próprio processo
 * principal do TelaLink para um navegador de celular receber a tela via
 * WebRTC. Reaproveita o mesmo protocolo de sinalização dos peers nativos:
 * a conexão WebSocket já chega amarrada ao requestId (ver signaling.ts),
 * então essa página só precisa esperar a 'offer' e responder com 'answer'.
 */
export function renderWebViewerPage({ requestId, fromName }: WebViewerPageOptions): string {
  const safeName = fromName.replace(/</g, '&lt;')
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>TelaLink</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; background: #0a0f1e; color: #f4f8ff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; overscroll-behavior: none; }
  #stage { position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
  #status { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; padding: 24px; }
  #logo { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 800; }
  #logo .tela { color: #f4f8ff; }
  #logo .link { background: linear-gradient(135deg, #5eead4, #38bdf8 45%, #3b82f6); -webkit-background-clip: text; background-clip: text; color: transparent; }
  #sub { color: #8fa1bd; font-size: 14px; }
  #bar { position: fixed; bottom: max(16px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); background: rgba(10,15,30,0.75); border: 1px solid #223049; border-radius: 14px; padding: 8px 14px; font-size: 12px; color: #8fa1bd; display: none; }
</style>
</head>
<body>
  <div id="stage">
    <div id="status">
      <div id="logo"><span class="tela">Tela</span><span class="link">Link</span></div>
      <div id="sub">Conectando com ${safeName}…</div>
    </div>
    <video id="video" autoplay playsinline muted="false" style="display:none"></video>
  </div>
  <div id="bar">Recebendo de ${safeName} · toque na tela para tela cheia</div>

<script>
(function () {
  var requestId = ${JSON.stringify(requestId)};
  var statusEl = document.getElementById('status');
  var subEl = document.getElementById('sub');
  var video = document.getElementById('video');
  var bar = document.getElementById('bar');
  var pc = null;

  function setSub(text) { subEl.textContent = text; }

  function send(msg) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  var wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  var ws = new WebSocket(wsProtocol + '//' + location.host + '/?r=' + encodeURIComponent(requestId));

  ws.onopen = function () { setSub('Aguardando a tela de ' + ${JSON.stringify(fromName)} + '…'); };
  ws.onclose = function () { setSub('Conexão encerrada.'); };
  ws.onerror = function () { setSub('Não foi possível conectar.'); };

  ws.onmessage = async function (ev) {
    var msg;
    try { msg = JSON.parse(ev.data); } catch (e) { return; }

    if (msg.type === 'offer') {
      pc = new RTCPeerConnection({ iceServers: [] });
      pc.onicecandidate = function (e) {
        if (e.candidate) send({ type: 'ice-candidate', requestId: requestId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = function (e) {
        video.srcObject = e.streams[0];
        video.style.display = 'block';
        statusEl.style.display = 'none';
        bar.style.display = 'block';
        video.play().catch(function () {});
      };
      await pc.setRemoteDescription(msg.sdp);
      var answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      send({ type: 'answer', requestId: requestId, sdp: answer });
    } else if (msg.type === 'ice-candidate' && pc) {
      pc.addIceCandidate(msg.candidate).catch(function () {});
    } else if (msg.type === 'hangup') {
      setSub('O compartilhamento foi encerrado.');
      video.style.display = 'none';
      bar.style.display = 'none';
      statusEl.style.display = 'flex';
      if (pc) { pc.close(); pc = null; }
    }
  };

  document.body.addEventListener('click', function () {
    if (video.style.display === 'block' && video.requestFullscreen) {
      video.requestFullscreen().catch(function () {});
    } else if (video.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  });
})();
</script>
</body>
</html>
`
}
