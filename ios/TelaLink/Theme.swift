import SwiftUI

enum TL {
    static let bg = Color(red: 0x0a / 255, green: 0x0f / 255, blue: 0x1e / 255)
    static let card = Color(red: 0x13 / 255, green: 0x1c / 255, blue: 0x30 / 255)
    static let border = Color(red: 0x22 / 255, green: 0x30 / 255, blue: 0x49 / 255)
    static let textDim = Color(red: 0x8f / 255, green: 0xa1 / 255, blue: 0xbd / 255)
    static let teal = Color(red: 0x5e / 255, green: 0xea / 255, blue: 0xd4 / 255)
    static let cyan = Color(red: 0x38 / 255, green: 0xbd / 255, blue: 0xf8 / 255)
    static let blue = Color(red: 0x3b / 255, green: 0x82 / 255, blue: 0xf6 / 255)
    static let danger = Color(red: 0xef / 255, green: 0x44 / 255, blue: 0x44 / 255)

    static let gradient = LinearGradient(
        colors: [teal, cyan, blue],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

struct LogoMark: View {
    var size: CGFloat = 40

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.18)
                .fill(TL.gradient)
                .frame(width: size * 0.65, height: size * 0.48)
                .offset(x: -size * 0.14, y: -size * 0.1)
            RoundedRectangle(cornerRadius: size * 0.18)
                .fill(LinearGradient(colors: [TL.blue, Color(red: 0x1d / 255, green: 0x3f / 255, blue: 0xa0 / 255)], startPoint: .topLeading, endPoint: .bottomTrailing))
                .frame(width: size * 0.65, height: size * 0.48)
                .offset(x: size * 0.14, y: size * 0.1)
        }
        .frame(width: size, height: size)
    }
}

struct Logo: View {
    var size: CGFloat = 36
    var withTagline = false

    var body: some View {
        VStack(spacing: 6) {
            HStack(spacing: 10) {
                LogoMark(size: size)
                HStack(spacing: 0) {
                    Text("Tela").foregroundColor(.white)
                    Text("Link")
                        .foregroundColor(.clear)
                        .overlay(TL.gradient.mask(Text("Link")))
                }
                .font(.system(size: size * 0.62, weight: .heavy))
            }
            if withTagline {
                Text("Sua tela, em qualquer lugar.")
                    .font(.subheadline)
                    .foregroundColor(TL.textDim)
            }
        }
    }
}
