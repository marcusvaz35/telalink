import Foundation

enum ShareState: Equatable {
    case idle
    case connecting(deviceName: String)
    case readyToBroadcast(peerName: String)
    case error(String)

    static func == (lhs: ShareState, rhs: ShareState) -> Bool {
        switch (lhs, rhs) {
        case (.idle, .idle): return true
        case (.connecting(let a), .connecting(let b)): return a == b
        case (.readyToBroadcast(let a), .readyToBroadcast(let b)): return a == b
        case (.error(let a), .error(let b)): return a == b
        default: return false
        }
    }
}

/// Faz só o handshake (connect-request → connect-response). Depois de aceito,
/// a extensão ReplayKit assume a conexão de verdade — ver HandoffStore.
@MainActor
final class ConnectionManager: ObservableObject {
    @Published var discovery: Discovery
    @Published var state: ShareState = .idle
    let myDevice: DeviceInfo

    private var client: SignalingClient?

    init() {
        let device = DeviceIdentity.current()
        self.myDevice = device
        self.discovery = Discovery(myId: device.id)
        discovery.start()
    }

    func requestShare(to device: DiscoveredDevice) {
        state = .connecting(deviceName: device.name)

        let client = SignalingClient()
        self.client = client

        client.onMessage = { [weak self] message in
            guard let self else { return }
            Task { @MainActor in
                self.handle(message: message, target: device)
            }
        }
        client.onClosed = { [weak self] in
            Task { @MainActor in
                guard let self, case .connecting = self.state else { return }
                self.state = .error("Não foi possível conectar.")
            }
        }

        client.connect(host: device.host, port: device.port)
        let requestId = UUID().uuidString.lowercased()
        pendingRequestId = requestId
        client.send(.connectRequest(requestId: requestId, kind: .shareOffer, from: myDevice))
    }

    private var pendingRequestId: String?

    private func handle(message: SignalMessage, target: DiscoveredDevice) {
        guard case .connectResponse(let requestId, let accept) = message, requestId == pendingRequestId else { return }

        if !accept {
            state = .error("Conexão recusada.")
            client?.close()
            client = nil
            return
        }

        HandoffStore.save(HandoffInfo(requestId: requestId, host: target.host, port: target.port, peerName: target.name))
        state = .readyToBroadcast(peerName: target.name)

        // O handshake terminou; a extensão abre a própria conexão pra essa
        // mesma requestId quando o usuário tocar no seletor de transmissão.
        client?.close()
        client = nil
    }

    func reset() {
        client?.close()
        client = nil
        pendingRequestId = nil
        state = .idle
    }
}
