import SwiftUI

struct HomeView: View {
    @StateObject private var manager = ConnectionManager()

    var body: some View {
        ZStack {
            TL.bg.ignoresSafeArea()

            VStack(spacing: 24) {
                Logo(withTagline: true).padding(.top, 16)

                HStack(spacing: 10) {
                    Circle().fill(Color.green).frame(width: 8, height: 8)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Conectado").font(.subheadline).fontWeight(.semibold).foregroundColor(.white)
                        Text("Pronto para compartilhar sua tela").font(.caption).foregroundColor(TL.textDim)
                    }
                    Spacer()
                }
                .padding(14)
                .background(TL.card)
                .clipShape(RoundedRectangle(cornerRadius: 14))

                VStack(alignment: .leading, spacing: 10) {
                    Text("DISPOSITIVOS DISPONÍVEIS")
                        .font(.caption2)
                        .foregroundColor(TL.textDim)
                        .tracking(0.5)

                    if manager.discovery.devices.isEmpty {
                        Text("Procurando dispositivos na rede…")
                            .font(.footnote)
                            .foregroundColor(TL.textDim)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 24)
                    } else {
                        ForEach(manager.discovery.devices) { device in
                            DeviceRowView(
                                device: device,
                                busy: isBusy(with: device)
                            ) {
                                manager.requestShare(to: device)
                            }
                        }
                    }
                }

                Spacer()
            }
            .padding(20)
        }
        .sheet(isPresented: isSharePresented) {
            ShareStatusSheet(manager: manager)
                .presentationDetents([.medium])
        }
    }

    private func isBusy(with device: DiscoveredDevice) -> Bool {
        if case .connecting(let name) = manager.state { return name == device.name }
        return false
    }

    private var isSharePresented: Binding<Bool> {
        Binding(
            get: { manager.state != .idle },
            set: { if !$0 { manager.reset() } }
        )
    }
}

struct ShareStatusSheet: View {
    @ObservedObject var manager: ConnectionManager

    var body: some View {
        ZStack {
            TL.bg.ignoresSafeArea()
            VStack(spacing: 20) {
                switch manager.state {
                case .connecting(let name):
                    ProgressView().tint(.white)
                    Text("Conectando com \(name)…").foregroundColor(.white)

                case .readyToBroadcast(let peerName):
                    VStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").font(.largeTitle).foregroundColor(.green)
                        Text("Conectado com \(peerName)").font(.headline).foregroundColor(.white)
                        Text("Toque no botão abaixo pra iniciar a transmissão da sua tela. Você pode sair deste app depois — a transmissão continua.")
                            .font(.footnote)
                            .foregroundColor(TL.textDim)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 20)
                    }
                    BroadcastPickerButton()
                        .frame(width: 64, height: 64)
                        .background(TL.gradient)
                        .clipShape(Circle())

                case .error(let message):
                    Image(systemName: "exclamationmark.triangle.fill").font(.largeTitle).foregroundColor(TL.danger)
                    Text(message).foregroundColor(.white)
                    Button("Fechar") { manager.reset() }
                        .foregroundColor(.white)
                        .padding(.horizontal, 20)
                        .padding(.vertical, 10)
                        .background(TL.card)
                        .clipShape(Capsule())

                case .idle:
                    EmptyView()
                }
            }
            .padding(24)
        }
    }
}
