import Foundation

/// Espelha src/shared/types.ts do app desktop — mesmo protocolo de sinalização
/// em JSON, pra que iPhone e Mac/Windows conversem sem tradução.

enum DeviceType: String, Codable {
    case mac, windows, linux, android, ios, unknown
}

struct DeviceInfo: Codable, Equatable {
    let id: String
    let name: String
    let type: DeviceType
}

struct DiscoveredDevice: Identifiable, Equatable {
    let id: String
    let name: String
    let type: DeviceType
    let host: String
    let port: Int
}

enum RequestKind: String, Codable {
    case shareOffer = "share-offer"
    case viewRequest = "view-request"
}

struct SdpPayload: Codable {
    let type: String
    let sdp: String?
}

struct IceCandidatePayload: Codable {
    let candidate: String?
    let sdpMLineIndex: Int32?
    let sdpMid: String?
}

enum SignalMessage {
    case connectRequest(requestId: String, kind: RequestKind, from: DeviceInfo)
    case connectResponse(requestId: String, accept: Bool)
    case offer(requestId: String, sdp: SdpPayload)
    case answer(requestId: String, sdp: SdpPayload)
    case iceCandidate(requestId: String, candidate: IceCandidatePayload)
    case hangup(requestId: String)

    var requestId: String {
        switch self {
        case .connectRequest(let id, _, _): return id
        case .connectResponse(let id, _): return id
        case .offer(let id, _): return id
        case .answer(let id, _): return id
        case .iceCandidate(let id, _): return id
        case .hangup(let id): return id
        }
    }
}

extension SignalMessage: Codable {
    private enum CodingKeys: String, CodingKey {
        case type, requestId, kind, from, accept, sdp, candidate
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(String.self, forKey: .type)
        let requestId = try c.decode(String.self, forKey: .requestId)
        switch type {
        case "connect-request":
            self = .connectRequest(requestId: requestId, kind: try c.decode(RequestKind.self, forKey: .kind), from: try c.decode(DeviceInfo.self, forKey: .from))
        case "connect-response":
            self = .connectResponse(requestId: requestId, accept: try c.decode(Bool.self, forKey: .accept))
        case "offer":
            self = .offer(requestId: requestId, sdp: try c.decode(SdpPayload.self, forKey: .sdp))
        case "answer":
            self = .answer(requestId: requestId, sdp: try c.decode(SdpPayload.self, forKey: .sdp))
        case "ice-candidate":
            self = .iceCandidate(requestId: requestId, candidate: try c.decode(IceCandidatePayload.self, forKey: .candidate))
        case "hangup":
            self = .hangup(requestId: requestId)
        default:
            throw DecodingError.dataCorruptedError(forKey: .type, in: c, debugDescription: "tipo de mensagem desconhecido: \(type)")
        }
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(requestId, forKey: .requestId)
        switch self {
        case .connectRequest(_, let kind, let from):
            try c.encode("connect-request", forKey: .type)
            try c.encode(kind, forKey: .kind)
            try c.encode(from, forKey: .from)
        case .connectResponse(_, let accept):
            try c.encode("connect-response", forKey: .type)
            try c.encode(accept, forKey: .accept)
        case .offer(_, let sdp):
            try c.encode("offer", forKey: .type)
            try c.encode(sdp, forKey: .sdp)
        case .answer(_, let sdp):
            try c.encode("answer", forKey: .type)
            try c.encode(sdp, forKey: .sdp)
        case .iceCandidate(_, let candidate):
            try c.encode("ice-candidate", forKey: .type)
            try c.encode(candidate, forKey: .candidate)
        case .hangup:
            try c.encode("hangup", forKey: .type)
        }
    }
}
