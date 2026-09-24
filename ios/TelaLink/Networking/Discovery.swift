import Foundation
import Network

/// NWBrowser (Network.framework) — API moderna de descoberta Bonjour da Apple,
/// mais confiável que o NetServiceBrowser legado e a que de fato aciona o
/// prompt de permissão de Rede Local do iOS.
final class Discovery: NSObject, ObservableObject {
    @Published private(set) var devices: [DiscoveredDevice] = []

    private var browser: NWBrowser?
    private var resolvers: [String: NWConnection] = [:]
    private var resolved: [String: DiscoveredDevice] = [:]
    private let myId: String

    init(myId: String) {
        self.myId = myId
        super.init()
    }

    func start() {
        let params = NWParameters()
        params.includePeerToPeer = true

        let browser = NWBrowser(for: .bonjour(type: "_telalink._tcp", domain: "local."), using: params)
        self.browser = browser

        browser.browseResultsChangedHandler = { [weak self] results, _ in
            self?.handle(results: results)
        }
        browser.stateUpdateHandler = { _ in }
        browser.start(queue: .main)
    }

    func stop() {
        browser?.cancel()
        browser = nil
        resolvers.values.forEach { $0.cancel() }
        resolvers.removeAll()
        resolved.removeAll()
        devices = []
    }

    private func handle(results: Set<NWBrowser.Result>) {
        let currentKeys = Set(results.map(key(for:)))

        for removedKey in Set(resolved.keys).subtracting(currentKeys) {
            resolved.removeValue(forKey: removedKey)
            resolvers.removeValue(forKey: removedKey)?.cancel()
        }

        for result in results {
            let resultKey = key(for: result)
            guard resolved[resultKey] == nil, resolvers[resultKey] == nil else { continue }
            resolve(result, key: resultKey)
        }

        publish()
    }

    private func key(for result: NWBrowser.Result) -> String {
        if case .service(let name, let type, let domain, _) = result.endpoint {
            return "\(name).\(type).\(domain)"
        }
        return "\(result.endpoint)"
    }

    private func resolve(_ result: NWBrowser.Result, key resultKey: String) {
        guard case .bonjour(let txtRecord) = result.metadata else { return }

        let dict = txtRecord.dictionary
        guard let id = dict["id"], id != myId, let name = dict["name"] else { return }
        let typeRaw = dict["devtype"] ?? "unknown"
        let type = DeviceType(rawValue: typeRaw) ?? .unknown

        let connection = NWConnection(to: result.endpoint, using: .tcp)
        resolvers[resultKey] = connection

        connection.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            if case .ready = state {
                if let endpoint = connection.currentPath?.remoteEndpoint, case .hostPort(let host, let port) = endpoint {
                    self.resolved[resultKey] = DiscoveredDevice(
                        id: id,
                        name: name,
                        type: type,
                        host: Self.hostString(host),
                        port: Int(port.rawValue)
                    )
                    self.publish()
                }
                connection.cancel()
                self.resolvers.removeValue(forKey: resultKey)
            } else if case .failed = state {
                connection.cancel()
                self.resolvers.removeValue(forKey: resultKey)
            }
        }
        connection.start(queue: .main)
    }

    private static func hostString(_ host: NWEndpoint.Host) -> String {
        switch host {
        case .ipv4(let addr): return "\(addr)"
        case .ipv6(let addr): return "\(addr)"
        case .name(let name, _): return name
        @unknown default: return "\(host)"
        }
    }

    private func publish() {
        devices = Array(resolved.values).sorted { $0.name < $1.name }
    }
}
