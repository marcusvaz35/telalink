import Foundation

/// Repassa pro processo da extensão ReplayKit (separado do app) qual conexão
/// já foi negociada e aceita, pra ela abrir a própria sinalização direto.
struct HandoffInfo: Codable {
    let requestId: String
    let host: String
    let port: Int
    let peerName: String
}

enum HandoffStore {
    private static let key = "telalink.handoff.current"

    static func save(_ info: HandoffInfo) {
        guard let data = try? JSONEncoder().encode(info) else { return }
        AppGroup.defaults.set(data, forKey: key)
    }

    static func load() -> HandoffInfo? {
        guard let data = AppGroup.defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(HandoffInfo.self, from: data)
    }

    static func clear() {
        AppGroup.defaults.removeObject(forKey: key)
    }
}
