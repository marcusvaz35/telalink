const { execFileSync } = require('child_process')

/**
 * Sem certificado Developer ID pago, o electron-builder pula a assinatura
 * inteiramente. Em Mac Apple Silicon isso é fatal (o macOS recusa rodar um
 * binário arm64 sem assinatura nenhuma). Uma assinatura ad-hoc ("-")
 * resolvia isso, mas sua identidade muda a cada build — o macOS trata cada
 * versão como um app diferente e some com permissões concedidas (Gravação
 * de Tela) e a liberação do Gatekeeper a cada atualização.
 *
 * "TelaLink Developer" é um certificado autoassinado fixo, gerado uma vez
 * e guardado no keychain de login deste Mac (não vem da Apple, não custa
 * nada) — assinar sempre com a mesma identidade faz o macOS reconhecer
 * como "o mesmo app" entre versões, então a permissão só é pedida uma vez.
 */
const IDENTITY = 'TelaLink Developer'

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  execFileSync('codesign', ['--force', '--deep', '--sign', IDENTITY, appPath], { stdio: 'inherit' })
}
