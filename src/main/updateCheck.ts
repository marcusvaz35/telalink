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

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' }
    })
    if (!res.ok) return null

    const data = (await res.json()) as GithubRelease
    const latestVersion = (data.tag_name ?? '').replace(/^v/, '')
    const currentVersion = app.getVersion()
    if (!latestVersion || !isNewer(latestVersion, currentVersion)) return null

    const assetExt = process.platform === 'darwin' ? '.dmg' : process.platform === 'win32' ? '.exe' : null
    const asset = assetExt ? data.assets?.find((a) => a.name.endsWith(assetExt)) : undefined

    return {
      version: latestVersion,
      url: asset?.browser_download_url ?? data.html_url,
      notes: data.body ?? ''
    }
  } catch {
    return null
  }
}
