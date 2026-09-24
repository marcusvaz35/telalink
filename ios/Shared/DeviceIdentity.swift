import Foundation
#if canImport(UIKit)
import UIKit
#endif

enum AppGroup {
    static let id = "group.com.telalink.app"
    static var defaults: UserDefaults {
        UserDefaults(suiteName: id) ?? .standard
    }
}

enum DeviceIdentity {
    private static let idKey = "telalink.device.id"
    private static let nameKey = "telalink.device.name"

    static func current() -> DeviceInfo {
        let defaults = AppGroup.defaults
        let id = defaults.string(forKey: idKey) ?? {
            let fresh = UUID().uuidString
            defaults.set(fresh, forKey: idKey)
            return fresh
        }()
        let name = defaults.string(forKey: nameKey) ?? {
            let fresh = UIDevice.current.name
            defaults.set(fresh, forKey: nameKey)
            return fresh
        }()
        return DeviceInfo(id: id, name: name, type: .ios)
    }

    static func setName(_ name: String) {
        AppGroup.defaults.set(name, forKey: nameKey)
    }
}
