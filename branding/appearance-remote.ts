/** Eternal synchronized appearance: one small HTTPS JSON request per launch.
 * Never loads remote HTML/JS. All animation modes are local CSS.
 */
import feedConfig from '@/features/news/eternal-news-config.json'

export type WallpaperChoice = 'default' | 'sakura' | 'custom'
export type ParticleChoice = 'default' | 'sakura' | 'lava' | 'otono' | 'primavera' | 'navidad' | 'none'
type RemoteAppearance = { wallpaper?: string; particles: Exclude<ParticleChoice, 'default'> }

const WALLPAPER_CHOICE_KEY = 'eternal.wallpaper.choice.v1'
const PARTICLE_CHOICE_KEY = 'eternal.particles.choice.v1'
const AVAILABLE_PARTICLES = new Set(['sakura', 'lava', 'otono', 'primavera', 'navidad', 'none'])
const FALLBACK: RemoteAppearance = { particles: 'sakura' }
let remote: RemoteAppearance = FALLBACK
let fetched = false

function readSetting(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}
function saveSetting(key: string, value: string) {
  try { localStorage.setItem(key, value) } catch { /* live setting still applies */ }
}

export function getEternalWallpaperChoice(): WallpaperChoice {
  const value = readSetting(WALLPAPER_CHOICE_KEY)
  if (value === 'default' || value === 'sakura' || value === 'custom') return value
  // Existing users who selected a local image keep it after upgrading.
  return readSetting('eternal.wallpaper.v1') || readSetting('eternal.wallpaper.gif.v1') ? 'custom' : 'default'
}
export function getEternalParticleChoice(): ParticleChoice {
  const value = readSetting(PARTICLE_CHOICE_KEY)
  return value === 'default' || AVAILABLE_PARTICLES.has(value ?? '') ? value as ParticleChoice : 'default'
}

function applyWallpaperChoice() {
  const root = document.documentElement
  const mode = getEternalWallpaperChoice()
  if (mode === 'custom') {
    root.style.setProperty('--eternal-active-wallpaper', 'var(--eternal-custom-wallpaper, url("/eternal-default-sakura.webp"))')
  } else if (mode === 'default' && remote.wallpaper) {
    root.style.setProperty('--eternal-active-wallpaper', `url(${JSON.stringify(remote.wallpaper)})`)
  } else {
    root.style.setProperty('--eternal-active-wallpaper', 'url("/eternal-default-sakura.webp")')
  }
  root.dataset.eternalWallpaperChoice = mode
}
function applyParticleChoice() {
  const mode = getEternalParticleChoice()
  document.documentElement.dataset.eternalParticles = mode === 'default' ? remote.particles : mode
}

export function setEternalWallpaperChoice(mode: WallpaperChoice) {
  saveSetting(WALLPAPER_CHOICE_KEY, mode)
  applyWallpaperChoice()
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

/** Called once at startup. Missing/unavailable remote config uses local Sakura. */
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
    // Explicit local choices are never replaced by remote defaults.
    applyWallpaperChoice()
    applyParticleChoice()
  } catch { /* offline is supported */ }
  finally { clearTimeout(timeout) }
}

export function mountEternalParticles(): void {
  const mount = () => {
    const surface = document.querySelector<HTMLElement>('.app-contents .app-viewport')
    if (!surface) return false
    if (surface.querySelector('.eternal-particles-layer')) return true
    const layer = document.createElement('div')
    layer.className = 'eternal-particles-layer'
    layer.setAttribute('aria-hidden', 'true')
    for (let i = 0; i < 14; i++) {
      const petal = document.createElement('span')
      petal.className = 'eternal-particle'
      petal.style.setProperty('--particle-left', `${(i * 43 + 13) % 100}%`)
      petal.style.setProperty('--particle-delay', `${-((i * 3) % 19)}s`)
      petal.style.setProperty('--particle-duration', `${17 + ((i * 7) % 10)}s`)
      petal.style.setProperty('--particle-drift', `${(i % 2 ? -1 : 1) * (25 + (i * 11) % 55)}px`)
      petal.style.setProperty('--particle-size', `${6 + (i * 7) % 8}px`)
      layer.appendChild(petal)
    }
    surface.appendChild(layer)
    return true
  }
  if (mount()) return
  const observer = new MutationObserver(() => { if (mount()) observer.disconnect() })
  observer.observe(document.body, { subtree: true, childList: true })
  window.setTimeout(() => observer.disconnect(), 12000)
}
