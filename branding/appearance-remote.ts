/** Eternal synchronized appearance: one HTTPS JSON check per launch.
 * Remote wallpapers must pass the SAME binary validation as local files.
 * No remote HTML, JavaScript, or unvalidated image URLs go into CSS.
 */
import feedConfig from '@/features/news/eternal-news-config.json'
import { MAX_IMAGE_BYTES, validateEternalImage } from './eternal-image-validation'

export type WallpaperChoice = 'default' | 'sakura' | 'custom'
export type ParticleChoice = 'default' | 'sakura' | 'lava' | 'otono' | 'primavera' | 'navidad' | 'none'
type RemoteAppearance = { wallpaper?: string; particles: Exclude<ParticleChoice, 'default'> }

const WALLPAPER_CHOICE_KEY = 'eternal.wallpaper.choice.v1'
const PARTICLE_CHOICE_KEY = 'eternal.particles.choice.v1'
const PARTICLE_MOTION_OVERRIDE_KEY = 'eternal.particles.ignore-reduced-motion.v1'
const AVAILABLE_PARTICLES = new Set(['sakura', 'lava', 'otono', 'primavera', 'navidad', 'none'])
const FALLBACK: RemoteAppearance = { particles: 'sakura' }
let remote: RemoteAppearance = FALLBACK
let fetched = false
let validatedRemoteUrl: string | null = null
let validatedSource: string | null = null
let downloadAttempt: string | null = null

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* live setting still applies */ }
}
export function getEternalWallpaperChoice(): WallpaperChoice {
  const value = readSetting(WALLPAPER_CHOICE_KEY)
  if (value === 'default' || value === 'sakura' || value === 'custom') return value
  return readSetting('eternal.wallpaper.v1') || readSetting('eternal.wallpaper.gif.v1') ? 'custom' : 'default'
}
export function getEternalParticleChoice(): ParticleChoice {
  const value = readSetting(PARTICLE_CHOICE_KEY)
  return value === 'default' || AVAILABLE_PARTICLES.has(value ?? '') ? value as ParticleChoice : 'default'
}
/** Explicit local opt-in. By default we respect Windows reduced-motion. */
export function getEternalParticleMotionOverride(): boolean {
  return readSetting(PARTICLE_MOTION_OVERRIDE_KEY) === 'true'
}
export function setEternalParticleMotionOverride(enabled: boolean): void {
  saveSetting(PARTICLE_MOTION_OVERRIDE_KEY, enabled ? 'true' : 'false')
  document.documentElement.dataset.eternalParticleMotionOverride = enabled ? 'true' : 'false'
}
function applyWallpaperChoice() {
  const root = document.documentElement
  const mode = getEternalWallpaperChoice()
  if (mode === 'custom') {
    root.style.setProperty('--eternal-active-wallpaper', 'var(--eternal-custom-wallpaper, url("/eternal-default-sakura.webp"))')
  } else if (mode === 'default' && validatedRemoteUrl && validatedSource === remote.wallpaper) {
    root.style.setProperty('--eternal-active-wallpaper', 'url("' + validatedRemoteUrl + '")')
  } else {
    root.style.setProperty('--eternal-active-wallpaper', 'url("/eternal-default-sakura.webp")')
  }
  root.dataset.eternalWallpaperChoice = mode
}
function applyParticleChoice() {
  const mode = getEternalParticleChoice()
  const root = document.documentElement
  root.dataset.eternalParticles = mode === 'default' ? remote.particles : mode
  root.dataset.eternalParticleMotionOverride = getEternalParticleMotionOverride() ? 'true' : 'false'
}
export function setEternalWallpaperChoice(mode: WallpaperChoice) {
  saveSetting(WALLPAPER_CHOICE_KEY, mode)
  applyWallpaperChoice()
  if (mode === 'default') void loadValidatedRemoteWallpaper()
}
export function setEternalParticleChoice(mode: ParticleChoice) {
  saveSetting(PARTICLE_CHOICE_KEY, mode)
  applyParticleChoice()
}
function sameOriginImage(value: unknown, manifestUrl: URL): string | undefined {
  if (typeof value !== 'string' || !value || value.length > 300) return
  try {
    const url = new URL(value, manifestUrl)
    if (url.origin !== manifestUrl.origin || url.protocol !== 'https:' ||
        url.username || url.password || url.hash ||
        !/\.(?:jpe?g|png|webp|gif)$/i.test(url.pathname)) return
    return url.href
  } catch { return }
}
function appearanceUrl(): URL | null {
  try {
    if (!feedConfig.url || typeof feedConfig.url !== 'string') return null
    const news = new URL(feedConfig.url)
    if (news.protocol !== 'https:' || news.username || news.password) return null
    return new URL('appearance.json', news)
  } catch { return null }
}

/** Stream with a hard byte cap even if the server omits Content-Length. */
async function readLimitedImage(url: string): Promise<Blob | null> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal, cache: 'no-cache', credentials: 'omit',
      redirect: 'error', mode: 'cors',
    })
    if (!response.ok || !response.body) return null
    const advertised = Number(response.headers.get('content-length') ?? 0)
    if (!Number.isFinite(advertised) || advertised < 0 || advertised > MAX_IMAGE_BYTES) return null
    const declaredType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
    if (declaredType && declaredType !== 'application/octet-stream' &&
      !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(declaredType)) return null
    const reader = response.body.getReader()
    const parts: Uint8Array[] = []
    let total = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        total += value.byteLength
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel().catch(() => {})
          return null
        }
        parts.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    if (!total) return null
    const assembled = new Uint8Array(total)
    let offset = 0
    for (const part of parts) {
      assembled.set(part, offset)
      offset += part.byteLength
    }
    return new Blob([assembled.buffer], { type: declaredType })
  } catch {
    return null
  } finally {
    window.clearTimeout(timeout)
  }
}
async function loadValidatedRemoteWallpaper(): Promise<void> {
  const source = remote.wallpaper
  if (!source || getEternalWallpaperChoice() !== 'default' || downloadAttempt === source) return
  downloadAttempt = source
  const file = await readLimitedImage(source)
  if (!file) return
  try {
    const filename = new URL(source).pathname.split('/').pop() ?? ''
    await validateEternalImage(file, filename)
    const safeUrl = URL.createObjectURL(file)
    if (validatedRemoteUrl) URL.revokeObjectURL(validatedRemoteUrl)
    validatedRemoteUrl = safeUrl
    validatedSource = source
    if (getEternalWallpaperChoice() === 'default') applyWallpaperChoice()
  } catch {
    // Invalid remote images cannot replace the local Sakura fallback.
  }
}

/** One small JSON read each start; no periodic polling. */
export async function initializeEternalAppearance(): Promise<void> {
  applyWallpaperChoice()
  applyParticleChoice()
  if (fetched) return
  fetched = true
  const url = appearanceUrl()
  if (!url) return
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 5500)
  try {
    const response = await fetch(url.href, {
      signal: controller.signal, cache: 'no-cache', credentials: 'omit', redirect: 'error',
    })
    if (!response.ok || Number(response.headers.get('content-length') || '0') > 4096) return
    const text = await response.text()
    if (text.length > 4096) return
    const payload: unknown = JSON.parse(text)
    if (!payload || typeof payload !== 'object') return
    const data = payload as Record<string, unknown>
    if (data.version !== 1) return
    const particles = typeof data.particles === 'string' && AVAILABLE_PARTICLES.has(data.particles)
      ? data.particles as RemoteAppearance['particles'] : 'sakura'
    remote = { wallpaper: sameOriginImage(data.wallpaper, url), particles }
    applyWallpaperChoice()
    applyParticleChoice()
    if (getEternalWallpaperChoice() === 'default') void loadValidatedRemoteWallpaper()
  } catch { /* offline is supported */ }
  finally { clearTimeout(timeout) }
}

