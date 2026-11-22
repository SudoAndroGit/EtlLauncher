/**
 * Eternal's optional local background. Images are resized in the WebView and
 * saved as JPEG in localStorage: no file-system permissions or network upload.
 */
import { MAX_IMAGE_BYTES, validateEternalImage } from './eternal-image-validation'

const KEY = 'eternal.wallpaper.v1'
const GIF_KEY = 'eternal.wallpaper.gif.v1'
let activeGifUrl: string | null = null
const MAX_STORED_CHARS = 3_000_000
const EFFECTS_KEY = 'eternal.wallpaper.effects.v2'
const LEGACY_EFFECTS_KEY = 'eternal.wallpaper.effects.v1'
const SIDEBAR_KEY = 'eternal.sidebar.transparency.v1'
const DEFAULT_DARKNESS = 38
const DEFAULT_BLUR = 0
const MAX_BLUR = 24
const VALID_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/

function readStoredWallpaper(): string | null {
	try {
		const value = localStorage.getItem(KEY)
		return value && value.length <= MAX_STORED_CHARS && VALID_DATA_URL.test(value) ? value : null
	} catch {
		return null
	}
}

export function hasEternalWallpaper(): boolean {
	try { return readStoredWallpaper() !== null || localStorage.getItem(GIF_KEY) === '1' }
	catch { return readStoredWallpaper() !== null }
}

export function applyEternalWallpaper(): void {
	const image = readStoredWallpaper()
	if (image) {
		document.documentElement.style.setProperty(
			'--eternal-custom-wallpaper',
			'url("' + image + '")',
		)
	} else {
		document.documentElement.style.removeProperty('--eternal-custom-wallpaper')
		try { if (localStorage.getItem(GIF_KEY) === '1') void restoreStoredGif() } catch { /* storage unavailable */ }
	}
	applyEternalWallpaperEffects()
	applyEternalSidebarTransparency()
}

function clampPercent(value: unknown, fallback: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
	return Math.round(Math.min(100, Math.max(0, value)))
}

export function getEternalWallpaperEffects(): { darkness: number; blur: number } {
	try {
		const stored: unknown = JSON.parse(localStorage.getItem(EFFECTS_KEY) ?? localStorage.getItem(LEGACY_EFFECTS_KEY) ?? 'null')
		if (stored && typeof stored === 'object') {
			const values = stored as Record<string, unknown>
			return {
				darkness: clampPercent(values.darkness, DEFAULT_DARKNESS),
				blur: Math.min(MAX_BLUR, clampPercent(values.blur, DEFAULT_BLUR)),
			}
		}
	} catch {
		// Settings may be disabled or corrupted; use safe defaults.
	}
	return { darkness: DEFAULT_DARKNESS, blur: DEFAULT_BLUR }
}

export function applyEternalWallpaperEffects(): void {
	const { darkness, blur } = getEternalWallpaperEffects()
	document.documentElement.style.setProperty('--eternal-wallpaper-darkness', (darkness / 100).toFixed(2))
	document.documentElement.style.setProperty('--eternal-wallpaper-blur', `${blur}px`)
	document.documentElement.style.removeProperty('--eternal-wallpaper-image-opacity')
}

export function setEternalWallpaperEffects(darkness: number, blur: number): void {
	const settings = {
		darkness: clampPercent(darkness, DEFAULT_DARKNESS),
		blur: Math.min(MAX_BLUR, clampPercent(blur, DEFAULT_BLUR)),
	}
	try {
		localStorage.setItem(EFFECTS_KEY, JSON.stringify(settings))
	} catch {
		// Storage is optional; the user can still preview the effect.
	}
	document.documentElement.style.setProperty('--eternal-wallpaper-darkness', (settings.darkness / 100).toFixed(2))
	document.documentElement.style.setProperty('--eternal-wallpaper-blur', `${settings.blur}px`)
	document.documentElement.style.removeProperty('--eternal-wallpaper-image-opacity')
}

/**
 * 0% transparency keeps the original glass opacity.
 * 100% removes the right sidebar's panel/card backgrounds and their blur.
 * This setting is local to the current launcher installation.
 */
export function getEternalSidebarTransparency(): number {
	try {
		const raw = localStorage.getItem(SIDEBAR_KEY)
		return raw === null ? 0 : clampPercent(Number(raw), 0)
	} catch {
		return 0
	}
}

function renderEternalSidebarTransparency(transparency: number): void {
	const fraction = (100 - transparency) / 100
	// Compute alpha in JavaScript rather than depending on CSS calc() multiplication.
	const alphas: Array<[string, number]> = [
		['--eternal-sidebar-dark-shell-alpha', .38],
		['--eternal-sidebar-dark-module-alpha', .45],
		['--eternal-sidebar-dark-highlight-alpha', .045],
		['--eternal-sidebar-dark-news-alpha', .55],
		['--eternal-sidebar-light-shell-alpha', .62],
		['--eternal-sidebar-light-module-alpha', .80],
		['--eternal-sidebar-light-highlight-alpha', .91],
		['--eternal-sidebar-light-news-alpha', .78],
	]
	for (const [property, baseAlpha] of alphas) {
		document.documentElement.style.setProperty(property, (baseAlpha * fraction).toFixed(3))
	}
	document.documentElement.dataset.eternalSidebarClear = transparency === 100 ? 'true' : 'false'
	document.documentElement.style.setProperty(
		'--eternal-sidebar-backdrop',
		transparency === 100 ? 'none' : 'blur(14px) saturate(115%)',
	)
	document.documentElement.style.setProperty(
		'--eternal-sidebar-card-backdrop',
		transparency === 100 ? 'none' : 'blur(8px) saturate(110%)',
	)
}

export function applyEternalSidebarTransparency(): void {
	renderEternalSidebarTransparency(getEternalSidebarTransparency())
}

export function setEternalSidebarTransparency(transparency: number): void {
	const value = clampPercent(transparency, 0)
	try {
		localStorage.setItem(SIDEBAR_KEY, String(value))
	} catch {
		// Keep the live preview even without storage access.
	}
	renderEternalSidebarTransparency(value)
}

export async function setEternalWallpaper(file: File): Promise<void> {
	// Validate extension, real signature, resolution, GIF frames and decoder
	// before writing anything to localStorage / IndexedDB.
	const verified = await validateEternalImage(file, file.name)
	if (verified.mime === 'image/gif') {
		// Animated GIFs cannot go through Canvas: it would flatten their frames.
		// IndexedDB persists the original file without extra Tauri permissions.
		const savedGif = new Blob([file], { type: 'image/gif' })
		await storeGif(savedGif)
		try {
			localStorage.setItem(GIF_KEY, '1')
			localStorage.removeItem(KEY)
		} catch {
			throw new Error('No se pudo guardar la referencia al GIF local.')
		}
		showGif(savedGif)
		return
	}
	const objectUrl = URL.createObjectURL(file)
	const image = new Image()
	try {
		image.src = objectUrl
		await image.decode()
		if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 16000 || image.naturalHeight > 16000) {
			throw new Error('Las dimensiones de la imagen no son válidas.')
		}
		const scale = Math.min(1, 1920 / image.naturalWidth, 1080 / image.naturalHeight)
		const canvas = document.createElement('canvas')
		canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
		canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
		const context = canvas.getContext('2d')
		if (!context) throw new Error('No se pudo procesar la imagen.')
		context.fillStyle = '#211922'
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.drawImage(image, 0, 0, canvas.width, canvas.height)
		const compressed = canvas.toDataURL('image/jpeg', 0.78)
		if (!VALID_DATA_URL.test(compressed) || compressed.length > MAX_STORED_CHARS) {
			throw new Error('La imagen comprimida es demasiado grande; prueba otra fotografía.')
		}
		try {
			localStorage.setItem(KEY, compressed)
		} catch {
			throw new Error('No hay espacio local para guardar la imagen.')
		}
		try { localStorage.removeItem(GIF_KEY) } catch { /* JPEG already saved */ }
		void deleteStoredGif()
		releaseGifUrl()
		applyEternalWallpaper()
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

export function resetEternalWallpaper(): void {
	localStorage.removeItem(KEY)
	localStorage.removeItem(GIF_KEY)
	releaseGifUrl()
	void deleteStoredGif()
	applyEternalWallpaper()
}


function releaseGifUrl(): void {
	if (activeGifUrl) URL.revokeObjectURL(activeGifUrl)
	activeGifUrl = null
}
function showGif(file: Blob): void {
	releaseGifUrl()
	activeGifUrl = URL.createObjectURL(file)
	document.documentElement.style.setProperty('--eternal-custom-wallpaper', `url("${activeGifUrl}")`)
}

const GIF_DATABASE = 'eternal-animated-wallpaper'
const GIF_STORE = 'wallpapers'
function openGifDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		if (!('indexedDB' in window)) { reject(new Error('IndexedDB no disponible')); return }
		const request = indexedDB.open(GIF_DATABASE, 1)
		request.onupgradeneeded = () => {
			if (!request.result.objectStoreNames.contains(GIF_STORE)) request.result.createObjectStore(GIF_STORE)
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento local'))
	})
}
async function storeGif(file: Blob): Promise<void> {
	const db = await openGifDatabase()
	try {
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(GIF_STORE, 'readwrite')
			tx.objectStore(GIF_STORE).put(file, 'current')
			tx.oncomplete = () => resolve()
			tx.onerror = () => reject(tx.error ?? new Error('No se pudo guardar el GIF'))
			tx.onabort = () => reject(tx.error ?? new Error('Almacenamiento del GIF cancelado'))
		})
	} catch {
		throw new Error('No se pudo guardar el GIF (máximo 22 MB). Comprueba el espacio disponible.')
	} finally {
		db.close()
	}
}
async function restoreStoredGif(): Promise<void> {
	try {
		const db = await openGifDatabase()
		let file: unknown
		try {
			file = await new Promise((resolve, reject) => {
				const tx = db.transaction(GIF_STORE, 'readonly')
				const request = tx.objectStore(GIF_STORE).get('current')
				request.onsuccess = () => resolve(request.result)
				request.onerror = () => reject(request.error)
			})
		} finally {
			db.close()
		}
		if (!(file instanceof Blob) || file.type !== 'image/gif' || file.size > MAX_IMAGE_BYTES) return
		await validateEternalImage(file, 'restored.gif')
		if (readStoredWallpaper() !== null || localStorage.getItem(GIF_KEY) !== '1') return
		showGif(file)
	} catch {
		// An unavailable GIF store is not a reason to block launcher startup.
	}
}
async function deleteStoredGif(): Promise<void> {
	try {
		const db = await openGifDatabase()
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(GIF_STORE, 'readwrite')
				tx.objectStore(GIF_STORE).delete('current')
				tx.oncomplete = () => resolve()
				tx.onerror = () => reject(tx.error)
			})
		} finally { db.close() }
	} catch { /* an orphaned GIF can be overwritten safely later */ }
}
