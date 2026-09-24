import ReplayKit
import WebRTC

/// Roda em processo separado do app principal, com pouca memória disponível.
/// O app principal já fez o handshake (connect-request/connect-response) —
/// aqui só abrimos nossa própria sinalização pra essa mesma requestId e
/// carregamos a mídia de verdade.
final class SampleHandler: RPBroadcastSampleHandler {
    private let factory: RTCPeerConnectionFactory = {
        RTCInitializeSSL()
        return RTCPeerConnectionFactory()
    }()

    private var peerConnection: RTCPeerConnection?
    private var videoSource: RTCVideoSource?
    private var dummyCapturer: RTCVideoCapturer?
    private var client: SignalingClient?
    private var handoff: HandoffInfo?
    private var pendingCandidates: [RTCIceCandidate] = []
    private var remoteDescriptionSet = false

    override func broadcastStarted(withSetupInfo setupInfo: [String: NSObject]?) {
        guard let info = HandoffStore.load() else {
            finishBroadcastWithError(NSError(domain: "TelaLink", code: 1, userInfo: [NSLocalizedDescriptionKey: "Nenhuma conexão pendente. Abra o TelaLink e escolha um dispositivo antes de iniciar."]))
            return
        }
        handoff = info
        setUpPeerConnection()
        connectSignaling(info)
    }

    private func setUpPeerConnection() {
        let config = RTCConfiguration()
        config.iceServers = []
        config.sdpSemantics = .unifiedPlan

        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        let pc = factory.peerConnection(with: config, constraints: constraints, delegate: nil)

        let source = factory.videoSource()
        source.adaptOutputFormat(toWidth: 1280, height: 720, fps: 30)
        let track = factory.videoTrack(with: source, trackId: "telalink-screen")
        pc?.add(track, streamIds: ["telalink-stream"])

        self.videoSource = source
        self.dummyCapturer = RTCVideoCapturer(delegate: source)
        self.peerConnection = pc
        pc?.delegate = self
    }

    private func connectSignaling(_ info: HandoffInfo) {
        let client = SignalingClient()
        self.client = client
        client.onMessage = { [weak self] message in self?.handle(message) }
        client.onClosed = { [weak self] in
            self?.finishBroadcastWithError(NSError(domain: "TelaLink", code: 2, userInfo: [NSLocalizedDescriptionKey: "Conexão perdida."]))
        }
        client.connect(host: info.host, port: info.port, requestId: info.requestId)
        createAndSendOffer(requestId: info.requestId)
    }

    private func createAndSendOffer(requestId: String) {
        let constraints = RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil)
        peerConnection?.offer(for: constraints) { [weak self] sdp, _ in
            guard let self, let sdp else { return }
            self.peerConnection?.setLocalDescription(sdp) { _ in }
            self.client?.send(.offer(requestId: requestId, sdp: SdpPayload(type: "offer", sdp: sdp.sdp)))
        }
    }

    private func handle(_ message: SignalMessage) {
        switch message {
        case .answer(_, let sdp):
            guard let sdpString = sdp.sdp else { return }
            let desc = RTCSessionDescription(type: .answer, sdp: sdpString)
            peerConnection?.setRemoteDescription(desc) { [weak self] _ in
                self?.remoteDescriptionSet = true
                self?.flushPendingCandidates()
            }
        case .iceCandidate(_, let candidate):
            guard let sdpLine = candidate.candidate else { return }
            let iceCandidate = RTCIceCandidate(sdp: sdpLine, sdpMLineIndex: candidate.sdpMLineIndex ?? 0, sdpMid: candidate.sdpMid)
            if remoteDescriptionSet {
                peerConnection?.add(iceCandidate)
            } else {
                pendingCandidates.append(iceCandidate)
            }
        case .hangup:
            finishBroadcastWithError(NSError(domain: "TelaLink", code: 3, userInfo: [NSLocalizedDescriptionKey: "O outro dispositivo encerrou a conexão."]))
        default:
            break
        }
    }

    private func flushPendingCandidates() {
        pendingCandidates.forEach { peerConnection?.add($0) }
        pendingCandidates.removeAll()
    }

    override func processSampleBuffer(_ sampleBuffer: CMSampleBuffer, with sampleBufferType: RPSampleBufferType) {
        guard sampleBufferType == .video,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer),
              let source = videoSource,
              let capturer = dummyCapturer
        else { return }

        let timeStampNs = Int64(CMTimeGetSeconds(CMSampleBufferGetPresentationTimeStamp(sampleBuffer)) * 1_000_000_000)
        let rtcPixelBuffer = RTCCVPixelBuffer(pixelBuffer: pixelBuffer)
        let frame = RTCVideoFrame(buffer: rtcPixelBuffer, rotation: ._0, timeStampNs: timeStampNs)
        source.capturer(capturer, didCapture: frame)
    }

    override func broadcastFinished() {
        if let requestId = handoff?.requestId {
            client?.send(.hangup(requestId: requestId))
        }
        client?.close()
        peerConnection?.close()
        HandoffStore.clear()
    }
}

extension SampleHandler: RTCPeerConnectionDelegate {
    func peerConnection(_ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate) {
        guard let requestId = handoff?.requestId else { return }
        let payload = IceCandidatePayload(candidate: candidate.sdp, sdpMLineIndex: candidate.sdpMLineIndex, sdpMid: candidate.sdpMid)
        client?.send(.iceCandidate(requestId: requestId, candidate: payload))
    }

    func peerConnection(_ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream) {}
    func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]) {}
    func peerConnection(_ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel) {}
}
