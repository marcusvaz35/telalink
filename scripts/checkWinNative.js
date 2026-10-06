const { existsSync } = require('fs')
const { join } = require('path')

const base = join(__dirname, '..', 'release', 'win-unpacked', 'resources', 'app.asar.unpacked', 'node_modules')
const required = [
  '@napolab/texture-bridge-win32-x64-msvc/index.win32-x64-msvc.node',
  '@nut-tree-fork/libnut-win32/build/Release/libnut.node'
]
const missing = required.filter((f) => !existsSync(join(base, f)))
if (missing.length > 0) {
  console.error(`Instalador do Windows sem módulos nativos obrigatórios:\n - ${missing.join('\n - ')}`)
  process.exit(1)
}
