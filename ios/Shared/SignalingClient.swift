import Foundation

/// Cliente WebSocket que fala o mesmo protocolo de sinalização do signaling.ts
/// do desktop. O iPhone sempre inicia a conexão (nunca roda servidor próprio
/// nesta fase) — por isso só precisamos do lado cliente.
final class SignalingClient: NSObject {
    private var task: URLSessionWebSocketTask?
    private let session: URLSession
    private(set) var requestId: String = ""

    var onMessage: ((SignalMessage) -> Void)?
    var onClosed: (() -> Void)?
    var onOpenError: ((Error) -> Void)?

    override init() {
        self.session = URLSession(configuration: .default)
        super.init()
    }

    func connect(host: String, port: Int, requestId: String? = nil) {
        let urlString = requestId.map { "ws://\(host):\(port)/?r=\($0)" } ?? "ws://\(host):\(port)"
        guard let url = URL(string: urlString) else { return }
        let task = session.webSocketTask(with: url)
        self.task = task
        task.resume()
        listen()
    }

    private func listen() {
        task?.receive { [weak self] result in
            guard let self else { return }
            switch result {
            case .failure:
                self.onClosed?()
                return
            case .success(let message):
                if case .string(let text) = message, let data = text.data(using: .utf8) {
                    if let signal = try? JSONDecoder().decode(SignalMessage.self, from: data) {
                        self.onMessage?(signal)
                    }
                }
                self.listen()
            }
        }
    }

    func send(_ message: SignalMessage) {
        guard let data = try? JSONEncoder().encode(message), let text = String(data: data, encoding: .utf8) else { return }
        task?.send(.string(text)) { _ in }
    }

    func close() {
        task?.cancel(with: .normalClosure, reason: nil)
        task = nil
    }
}
