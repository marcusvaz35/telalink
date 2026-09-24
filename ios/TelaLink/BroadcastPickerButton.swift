import SwiftUI
import ReplayKit

/// O sistema exige que o início da transmissão seja um toque direto nesse
/// botão nativo — não dá pra disparar programaticamente por segurança.
struct BroadcastPickerButton: UIViewRepresentable {
    func makeUIView(context: Context) -> RPSystemBroadcastPickerView {
        let view = RPSystemBroadcastPickerView(frame: .zero)
        view.preferredExtension = "com.telalink.app.broadcast"
        view.showsMicrophoneButton = false
        return view
    }

    func updateUIView(_ uiView: RPSystemBroadcastPickerView, context: Context) {}
}
