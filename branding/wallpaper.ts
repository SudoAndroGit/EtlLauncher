/**
 * Eternal's optional local background. Images are resized in the WebView and
 * saved as JPEG in localStorage: no file-system permissions or network upload.
 */
const KEY = 'eternal.wallpaper.v1'
const MAX_SOURCE_BYTES = 12 * 1024 * 1024
const MAX_STORED_CHARS = 3_000_000
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
			'linear-gradient(rgba(18, 12, 24, .36), rgba(18, 12, 24, .36)), url("' + image + '")',
		)
	} else {
		document.documentElement.style.removeProperty('--eternal-custom-wallpaper')
	}
}

export async function setEternalWallpaper(file: File): Promise<void> {
	if (!ALLOWED_TYPES.has(file.type)) {
		throw new Error('Selecciona una imagen JPG, PNG o WebP.')
	}
	if (file.size > MAX_SOURCE_BYTES) {
		throw new Error('La imagen debe ocupar menos de 12 MB.')
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
