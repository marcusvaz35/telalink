import type { TelaLinkApi } from './index'

declare global {
  interface Window {
    telalink: TelaLinkApi
  }
}
