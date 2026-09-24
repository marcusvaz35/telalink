import SwiftUI

struct DeviceRowView: View {
    let device: DiscoveredDevice
    let busy: Bool
    let onTap: () -> Void

    private var icon: String {
        switch device.type {
        case .mac, .windows, .linux: return "desktopcomputer"
        case .android, .ios: return "iphone"
        case .unknown: return "questionmark.circle"
        }
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(.white)
                    .frame(width: 28)

                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Circle().fill(Color.green).frame(width: 8, height: 8)
                        Text(device.name).font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
                    }
                    Text("Disponível").font(.caption).foregroundColor(TL.textDim)
                }

                Spacer()

                if busy {
                    ProgressView().tint(.white)
                } else {
                    Image(systemName: "chevron.right").foregroundColor(TL.textDim)
                }
            }
            .padding(14)
            .background(TL.card)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(busy)
    }
}
