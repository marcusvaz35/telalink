import { app } from 'electron'

const REPO = 'marcusvaz35/telalink'

export interface UpdateInfo {
  version: string
  url: string
  notes: string
}

interface GithubAsset {
  name: string
  browser_download_url: string
}

interface GithubRelease {
  tag_name: string
  draft?: boolean
  html_url: string
  body: string | null
  assets: GithubAsset[]
}

/** Compara "1.2.3" com "1.10.0" corretamente (não como string). */
function isNewer(latest: string, current: string): boolean {
  const a = latest.split('.').map(Number)
  const b = current.split('.').map(Number)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    if (x !== y) return x > y
  }
  return false
}

export type UpdateCheckResult =
  | { status: 'update'; info: UpdateInfo }
  | { status: 'latest'; currentVersion: string }
  | { status: 'error' }

/** Distingue "já está na última versão" de "não consegui checar" (sem internet, limite do GitHub...). */
export async function checkForUpdateResult(): Promise<UpdateCheckResult> {
  try {
    // Lista (em vez de /releases/latest) pra enxergar também as versões de
    // teste: /latest ignora tudo que foi publicado como "pre-release".
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return { status: 'error' }

    const releases = ((await res.json()) as GithubRelease[]).filter((r) => !r.draft && /^v?\d+(\.\d+)*$/.test(r.tag_name ?? ''))
    const data = releases.reduce<GithubRelease | null>(
      (best, r) => (!best || isNewer(r.tag_name.replace(/^v/, ''), best.tag_name.replace(/^v/, '')) ? r : best),
      null
    )
    if (!data) return { status: 'error' }
    const latestVersion = data.tag_name.replace(/^v/, '')
    const currentVersion = app.getVersion()
    if (!latestVersion) return { status: 'error' }
    if (!isNewer(latestVersion, currentVersion)) return { status: 'latest', currentVersion }

    const assetExt = process.platform === 'darwin' ? '.dmg' : process.platform === 'win32' ? '.exe' : null
    const asset = assetExt ? data.assets?.find((a) => a.name.endsWith(assetExt)) : undefined

    return {
      status: 'update',
      info: {
        version: latestVersion,
        url: asset?.browser_download_url ?? data.html_url,
        notes: data.body ?? ''
      }
    }
  } catch {
    return { status: 'error' }
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const result = await checkForUpdateResult()
  return result.status === 'update' ? result.info : null
}
