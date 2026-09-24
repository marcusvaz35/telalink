const { execFileSync } = require('child_process')

/**
 * Sem certificado Developer ID pago, o electron-builder pula a assinatura
 * inteiramente ("skipped macOS application code signing"). Em Mac Apple
 * Silicon isso não é só um aviso do Gatekeeper — o macOS recusa rodar um
 * binário arm64 sem assinatura nenhuma, mostrando "está danificado" mesmo
 * depois de "Abrir mesmo assim". Uma assinatura ad-hoc (identidade "-",
 * sem conta Apple, grátis) já resolve isso.
 */
module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
}
