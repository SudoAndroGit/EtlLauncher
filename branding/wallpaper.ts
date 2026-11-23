/**
 * Eternal's local backgrounds live in IndexedDB. Existing JPEG and GIF
 * preferences are still readable.
 */
import { MAX_IMAGE_BYTES, validateEternalImage } from './eternal-image-validation'

const LEGACY_JPEG_KEY = 'eternal.wallpaper.v1'
const GIF_KEY = 'eternal.wallpaper.gif.v1'
const GIF_DATABASE = 'eternal-animated-wallpaper'
const WALLPAPER_STORE = 'wallpapers'
const WALLPAPER_RECORD = 'wallpaper'
const LEGACY_GIF_RECORD = 'current'
const MAX_WALLPAPERS = 12
const MAX_LIBRARY_BYTES = 96 * 1024 * 1024
type WallpaperEntry = { id: string; name: string; file: Blob; thumbnail?: Blob }
type WallpaperLibrary = { items: WallpaperEntry[]; activeId: string | null }
let library: WallpaperLibrary = { items: [], activeId: null }
let activeWallpaperUrl: string | null = null
let storedWallpaper = false
let restoration: Promise<void> | undefined
let changingWallpaper = false
const MAX_STORED_CHARS = 3_000_000
const EFFECTS_KEY = 'eternal.wallpaper.effects.v2'
const LEGACY_EFFECTS_KEY = 'eternal.wallpaper.effects.v1'
const SIDEBAR_KEY = 'eternal.sidebar.transparency.v1'
const DEFAULT_DARKNESS = 38
const DEFAULT_BLUR = 0
const MAX_BLUR = 24
const VALID_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/

function readLegacyJpeg(): string | null {
	try {
		const value = localStorage.getItem(LEGACY_JPEG_KEY)
		return value && value.length <= MAX_STORED_CHARS && VALID_DATA_URL.test(value) ? value : null
	} catch {
		return null
	}
}

export function hasRestoredEternalWallpaper(): boolean {
	return storedWallpaper
}

export async function hasEternalWallpaper(): Promise<boolean> {
	await (restoration ??= restoreStoredWallpaper())
	return storedWallpaper
}

export function applyEternalWallpaper(): void {
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

export async function listEternalWallpapers() {
	await hasEternalWallpaper()
	return {
		items: library.items.map(({ id, name, thumbnail }) => ({ id, name, thumbnail })),
		activeId: library.activeId,
	}
}

export async function addEternalWallpapers(files: File[]): Promise<void> {
	await changeWallpaperLibrary(async () => {
		if (!files.length) return
		if (library.items.length + files.length > MAX_WALLPAPERS) {
			throw new Error(`Puedes guardar hasta ${MAX_WALLPAPERS} fondos. Quita uno para agregar más.`)
		}
		const items = [...library.items]
		let total = items.reduce((sum, entry) => sum + entry.file.size, 0)
		for (const file of files) {
			const { image, mime } = await validateEternalImage(file, file.name)
			const saved = mime === 'image/gif' ? new Blob([file], { type: mime }) : await resizeWallpaper(image)
			total += saved.size
			if (total > MAX_LIBRARY_BYTES) throw new Error('La galería alcanza su límite de 96 MiB.')
			const thumbnail = await resizeWallpaper(image, 160, 100)
			items.push({ id: crypto.randomUUID(), name: file.name.slice(0, 160), file: saved, thumbnail })
		}
		const active = items[items.length - 1]
		await saveLibrary({ items, activeId: active.id }, active.file)
	})
}

export async function selectEternalWallpaper(id: string): Promise<void> {
	await changeWallpaperLibrary(async () => {
		const entry = library.items.find((item) => item.id === id)
		if (!entry || (storedWallpaper && id === library.activeId)) return
		await validateSavedWallpaper(entry.file)
		await saveLibrary({ ...library, activeId: id }, entry.file)
	})
}

export async function removeEternalWallpaper(id: string): Promise<void> {
	await changeWallpaperLibrary(async () => {
		const items = library.items.filter((item) => item.id !== id)
		if (items.length === library.items.length) return
		const activeId = library.activeId === id ? null : library.activeId
		const updated = { items, activeId }
		if (activeId === library.activeId) {
			await writeWallpaper(updated)
			library = updated
		} else {
			await saveLibrary(updated, null)
		}
	})
}

async function resizeWallpaper(image: HTMLImageElement, maxWidth = 1920, maxHeight = 1080): Promise<Blob> {
	const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight)
	const canvas = document.createElement('canvas')
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
	const context = canvas.getContext('2d')
	if (!context) throw new Error('No se pudo procesar la imagen.')
	context.fillStyle = '#211922'
	context.fillRect(0, 0, canvas.width, canvas.height)
	context.drawImage(image, 0, 0, canvas.width, canvas.height)
	const compressed = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78))
	if (!compressed?.size || compressed.type !== 'image/jpeg') throw new Error('No se pudo comprimir la imagen.')
	return compressed
}

async function changeWallpaperLibrary(change: () => Promise<void>): Promise<void> {
	if (changingWallpaper) throw new Error('Espera a que termine el cambio de fondo.')
	changingWallpaper = true
	try {
		await hasEternalWallpaper()
		await change()
	} finally {
		changingWallpaper = false
	}
}

async function saveLibrary(updated: WallpaperLibrary, file: Blob | null): Promise<void> {
	await writeWallpaper(updated)
	library = updated
	showStoredWallpaper(file)
}

function showStoredWallpaper(file: Blob | null): void {
	if (activeWallpaperUrl) URL.revokeObjectURL(activeWallpaperUrl)
	activeWallpaperUrl = file ? URL.createObjectURL(file) : null
	const style = document.documentElement.style
	if (activeWallpaperUrl) style.setProperty('--eternal-custom-wallpaper', `url("${activeWallpaperUrl}")`)
	else style.removeProperty('--eternal-custom-wallpaper')
	storedWallpaper = file !== null
}

function openWallpaperDatabase(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(GIF_DATABASE, 1)
		request.onupgradeneeded = () => {
			request.result.createObjectStore(WALLPAPER_STORE)
		}
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error ?? new Error('No se pudo abrir el almacenamiento local'))
	})
}

async function readWallpaper(db: IDBDatabase, key: string): Promise<unknown> {
	return new Promise((resolve, reject) => {
		const request = db.transaction(WALLPAPER_STORE).objectStore(WALLPAPER_STORE).get(key)
		request.onsuccess = () => resolve(request.result)
		request.onerror = () => reject(request.error)
	})
}

async function writeWallpaper(updated: WallpaperLibrary): Promise<void> {
	try {
		const db = await openWallpaperDatabase()
		try {
			await new Promise<void>((resolve, reject) => {
				const tx = db.transaction(WALLPAPER_STORE, 'readwrite')
				const store = tx.objectStore(WALLPAPER_STORE)
				store.put(updated, WALLPAPER_RECORD)
				store.delete(LEGACY_GIF_RECORD)
				tx.oncomplete = () => resolve()
				tx.onabort = () => reject(tx.error)
			})
		} finally {
			db.close()
		}
	} catch {
		throw new Error('No se pudo guardar el cambio de fondo. Comprueba el almacenamiento local.')
	}
	try {
		localStorage.removeItem(LEGACY_JPEG_KEY)
		localStorage.removeItem(GIF_KEY)
	} catch { /* the committed IndexedDB record takes precedence */ }
}

function isSavedWallpaper(file: unknown): file is Blob {
	return file instanceof Blob && file.size > 0 && file.size <= MAX_IMAGE_BYTES &&
		(file.type === 'image/gif' || file.type === 'image/jpeg')
}

async function validateSavedWallpaper(file: Blob): Promise<void> {
	await validateEternalImage(file, file.type === 'image/gif' ? 'wallpaper.gif' : 'wallpaper.jpg')
}

function isWallpaperEntry(entry: unknown): entry is WallpaperEntry {
	if (!entry || typeof entry !== 'object') return false
	const item = entry as Partial<WallpaperEntry>
	return typeof item.id === 'string' && typeof item.name === 'string' && isSavedWallpaper(item.file) &&
		(item.thumbnail === undefined || (item.thumbnail instanceof Blob &&
			item.thumbnail.type === 'image/jpeg' && item.thumbnail.size <= 100_000))
}

async function restoreStoredWallpaper(): Promise<void> {
	let file: unknown
	let legacyJpeg: string | null = null
	try {
		const db = await openWallpaperDatabase()
		try {
			file = await readWallpaper(db, WALLPAPER_RECORD)
			if (file === undefined) {
				legacyJpeg = readLegacyJpeg()
				if (!legacyJpeg && localStorage.getItem(GIF_KEY) === '1') {
					file = await readWallpaper(db, LEGACY_GIF_RECORD)
				}
			}
		} finally {
			db.close()
		}
	} catch {
		if (file === undefined) legacyJpeg = readLegacyJpeg()
	}
	try {
		if (legacyJpeg) {
			const decoded = atob(legacyJpeg.slice('data:image/jpeg;base64,'.length))
			const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0))
			file = new Blob([bytes], { type: 'image/jpeg' })
		}
		if (isSavedWallpaper(file)) {
			library = { items: [{ id: 'previous', name: 'Fondo anterior', file }], activeId: 'previous' }
		} else if (file && typeof file === 'object') {
			const record = file as Partial<WallpaperLibrary>
			if (Array.isArray(record.items)) {
				const items = record.items.slice(0, MAX_WALLPAPERS).filter(isWallpaperEntry)
				library = { items, activeId: typeof record.activeId === 'string' ? record.activeId : null }
			}
		}
		const active = library.items.find((item) => item.id === library.activeId)
		if (active) {
			await validateSavedWallpaper(active.file)
			showStoredWallpaper(active.file)
		}
	} catch {
		// A missing or invalid saved image leaves the built-in fallback in place.
	}
}
