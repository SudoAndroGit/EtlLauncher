/** Eternal synchronized appearance: one HTTPS JSON check per launch.
 * Remote wallpapers must pass the SAME binary validation as local files.
 * No remote HTML, JavaScript, or unvalidated image URLs go into CSS.
 */
import feedConfig from '@/features/news/eternal-news-config.json'
import { invoke } from '@tauri-apps/api/core'
import { fetchEternalContent, fetchEternalJson } from '@/features/news/eternal-remote-content'
import { detectedType, MAX_IMAGE_BYTES, validateEternalImage } from './eternal-image-validation'
import { hasEternalWallpaper, hasRestoredEternalWallpaper } from './eternal-wallpaper'

export type WallpaperChoice = 'default' | 'sakura' | 'custom' | 'windows'
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
let windowsWallpaperUrl: string | null = null
let windowsWallpaperDigest: string | null = null
let windowsRefresh: Promise<void> | undefined

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* live setting still applies */ }
}
export function getEternalWallpaperChoice(): WallpaperChoice {
  const value = readSetting(WALLPAPER_CHOICE_KEY)
  if (value === 'default' || value === 'sakura' || value === 'custom' || value === 'windows') return value
  return hasRestoredEternalWallpaper() ? 'custom' : 'default'
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
  } else if (mode === 'windows' && windowsWallpaperUrl) {
    root.style.setProperty('--eternal-active-wallpaper', 'url("' + windowsWallpaperUrl + '")')
  } else if (mode === 'default' && validatedRemoteUrl && validatedSource === remote.wallpaper) {
    root.style.setProperty('--eternal-active-wallpaper', 'url("' + validatedRemoteUrl + '")')
  } else {
    root.style.setProperty('--eternal-active-wallpaper', 'url("/eternal-default-sakura.webp")')
  }
  root.dataset.eternalWallpaperChoice = mode
}
async function loadWindowsWallpaper(): Promise<void> {
  try {
    const data = await invoke<ArrayBuffer | number[]>('read_windows_wallpaper')
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data)
      : Array.isArray(data) && data.length <= MAX_IMAGE_BYTES ? Uint8Array.from(data) : null
    if (!bytes?.byteLength || bytes.byteLength > MAX_IMAGE_BYTES) {
      throw new Error('Windows no devolvió una imagen de fondo válida.')
    }
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).join(',')
    if (digest === windowsWallpaperDigest || getEternalWallpaperChoice() !== 'windows') return
    const mime = detectedType(bytes)
    const file = new Blob([bytes], { type: mime })
    await validateEternalImage(file, 'desktop.' + mime.slice(6))
    if (getEternalWallpaperChoice() !== 'windows') return
    if (windowsWallpaperUrl) URL.revokeObjectURL(windowsWallpaperUrl)
    windowsWallpaperUrl = URL.createObjectURL(file)
    windowsWallpaperDigest = digest
  } catch (error) {
    if (windowsWallpaperUrl) URL.revokeObjectURL(windowsWallpaperUrl)
    windowsWallpaperUrl = null
    windowsWallpaperDigest = null
    throw error
  } finally {
    if (getEternalWallpaperChoice() === 'windows') applyWallpaperChoice()
  }
}

export async function refreshWindowsWallpaper(): Promise<void> {
  if (getEternalWallpaperChoice() !== 'windows') return
  await (windowsRefresh ??= loadWindowsWallpaper().finally(() => { windowsRefresh = undefined }))
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

async function loadValidatedRemoteWallpaper(): Promise<void> {
  const source = remote.wallpaper
  if (!source || getEternalWallpaperChoice() !== 'default' || downloadAttempt === source) return
  downloadAttempt = source
  try {
    const file = await fetchEternalContent(source, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 12_000,
      cache: 'default',
      allowedTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
    })
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
  const refreshOnFocus = () => { void refreshWindowsWallpaper().catch(() => {}) }
  window.addEventListener('focus', refreshOnFocus)
  refreshOnFocus()
  const wallpaperReady = hasEternalWallpaper().then(() => applyWallpaperChoice())
  const url = appearanceUrl()
  if (!url) return
  try {
    const payload = await fetchEternalJson(url.href, { maxBytes: 4096, timeoutMs: 5500 })
    if (!payload || typeof payload !== 'object') return
    const data = payload as Record<string, unknown>
    if (data.version !== 1) return
    const particles = typeof data.particles === 'string' && AVAILABLE_PARTICLES.has(data.particles)
      ? data.particles as RemoteAppearance['particles'] : 'sakura'
    remote = { wallpaper: sameOriginImage(data.wallpaper, url), particles }
    applyWallpaperChoice()
    applyParticleChoice()
    await wallpaperReady
    if (getEternalWallpaperChoice() === 'default') void loadValidatedRemoteWallpaper()
  } catch { /* offline is supported */ }
}

