/**
 * Eternal's optional local background. Images are resized in the WebView and
 * saved as JPEG in localStorage: no file-system permissions or network upload.
 */
const KEY = 'eternal.wallpaper.v1'
const MAX_SOURCE_BYTES = 32 * 1024 * 1024
const MAX_STORED_CHARS = 3_000_000
const EFFECTS_KEY = 'eternal.wallpaper.effects.v2'
const LEGACY_EFFECTS_KEY = 'eternal.wallpaper.effects.v1'
const SIDEBAR_KEY = 'eternal.sidebar.transparency.v1'
const DEFAULT_DARKNESS = 38
const DEFAULT_BLUR = 0
const MAX_BLUR = 24
const VALID_DATA_URL = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function readStoredWallpaper(): string | null {
	try {
		const value = localStorage.getItem(KEY)
		return value && value.length <= MAX_STORED_CHARS && VALID_DATA_URL.test(value) ? value : null
	} catch {
		return null
	}
}

export function hasEternalWallpaper(): boolean {
	return readStoredWallpaper() !== null
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
	const fraction = ((100 - transparency) / 100).toFixed(2)
	document.documentElement.style.setProperty('--eternal-sidebar-visibility', fraction)
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
	if (!ALLOWED_TYPES.has(file.type)) {
		throw new Error('Selecciona una imagen JPG, PNG o WebP.')
	}
	if (file.size > MAX_SOURCE_BYTES) {
		throw new Error('La imagen debe ocupar como máximo 32 MB.')
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
		applyEternalWallpaper()
	} finally {
		URL.revokeObjectURL(objectUrl)
	}
}

export function resetEternalWallpaper(): void {
	localStorage.removeItem(KEY)
	applyEternalWallpaper()
}
