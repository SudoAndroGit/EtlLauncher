/**
 * Image checks for local and synchronized Eternal wallpaper.
 *
 * Inspect container headers before asking the browser to decode pixels.
 * Reject huge dimensions, malformed GIF structures, misleading extensions and
 * overly long animations. This reduces abuse; it cannot replace WebView updates.
 */
export const MAX_IMAGE_BYTES = 22 * 1024 * 1024
export const MAX_STILL_EDGE = 4096
export const MAX_STILL_PIXELS = 16_000_000
export const MAX_GIF_EDGE_WIDTH = 1920
export const MAX_GIF_EDGE_HEIGHT = 1080
export const MAX_GIF_FRAMES = 150
export const MAX_GIF_FRAME_PIXELS = 100_000_000

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
export type ValidatedImage = { mime: ImageMime; width: number; height: number; frames: number }

const EXTENSIONS: Record<string, ImageMime> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif',
}

function fail(message: string): never {
  throw new Error(message)
}
function le16(bytes: Uint8Array, index: number): number {
  return bytes[index] | (bytes[index + 1] << 8)
}
function be16(bytes: Uint8Array, index: number): number {
  return (bytes[index] << 8) | bytes[index + 1]
}
function be32(bytes: Uint8Array, index: number): number {
  return ((bytes[index] * 0x1000000) + (bytes[index + 1] << 16) +
    (bytes[index + 2] << 8) + bytes[index + 3]) >>> 0
}
function le32(bytes: Uint8Array, index: number): number {
  return ((bytes[index + 3] * 0x1000000) + (bytes[index + 2] << 16) +
    (bytes[index + 1] << 8) + bytes[index]) >>> 0
}
function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, end))
}
function requireSize(bytes: Uint8Array, end: number): void {
  if (end > bytes.length) fail('Imagen incompleta o dañada.')
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    fail('La firma JPEG es incorrecta.')
  }
  let p = 2
  while (p < bytes.length) {
    if (bytes[p++] !== 0xff) fail('Estructura JPEG no válida.')
    while (p < bytes.length && bytes[p] === 0xff) p++
    requireSize(bytes, p + 1)
    const marker = bytes[p++]
    if (marker === 0xd9 || marker === 0xda) fail('El JPEG no tiene dimensiones válidas.')
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    requireSize(bytes, p + 2)
    const size = be16(bytes, p)
    if (size < 2) fail('Segmento JPEG inválido.')
    requireSize(bytes, p + size)
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (size < 7) fail('Cabecera JPEG incompleta.')
      return { width: be16(bytes, p + 5), height: be16(bytes, p + 3) }
    }
    p += size
  }
  fail('El JPEG no contiene una cabecera de imagen válida.')
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== 'RIFF' ||
    ascii(bytes, 8, 12) !== 'WEBP' || le32(bytes, 4) + 8 !== bytes.length) {
    fail('La firma WebP es incorrecta.')
  }
  const type = ascii(bytes, 12, 16)
  const length = le32(bytes, 16)
  requireSize(bytes, 20 + length)
  if (type === 'VP8X' && length >= 10) {
    // Animated WebP bypasses GIF frame limits, so require still WebP here.
    if (bytes[20] & 0x02) fail('WebP animado no admitido; utiliza un GIF válido.')
    return {
      width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
      height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
    }
  }
  if (type === 'VP8L' && length >= 5 && bytes[20] === 0x2f) {
    return {
      width: 1 + (bytes[21] | ((bytes[22] & 0x3f) << 8)),
      height: 1 + ((bytes[22] >> 6) | (bytes[23] << 2) | ((bytes[24] & 0x0f) << 10)),
    }
  }
  if (type === 'VP8 ' && length >= 10 &&
    bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff }
  }
  fail('Estructura WebP no reconocida.')
}

function gifDetails(bytes: Uint8Array): ValidatedImage {
  if (bytes.length < 20 || !['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) {
    fail('La firma GIF es incorrecta.')
  }
  const width = le16(bytes, 6)
  const height = le16(bytes, 8)
  checkDimensions('image/gif', width, height)
  let p = 13
  if (bytes[10] & 0x80) p += 3 * (1 << ((bytes[10] & 7) + 1))
  requireSize(bytes, p)
  let frames = 0
  let totalPixels = 0
  function skipBlocks(): void {
    while (true) {
      requireSize(bytes, p + 1)
      const size = bytes[p++]
      if (size === 0) return
      requireSize(bytes, p + size)
      p += size
    }
  }
  while (p < bytes.length) {
    const type = bytes[p++]
    if (type === 0x3b) {
      if (!frames || p !== bytes.length) fail('GIF incompleto o con datos inesperados.')
      return { mime: 'image/gif', width, height, frames }
    }
    if (type === 0x21) {
      requireSize(bytes, p + 1)
      const extension = bytes[p++]
      if (![0xf9, 0xfe, 0x01, 0xff].includes(extension)) fail('Extensión GIF desconocida.')
      skipBlocks()
      continue
    }
    if (type !== 0x2c) fail('Bloque GIF inválido.')
    requireSize(bytes, p + 9)
    const left = le16(bytes, p)
    const top = le16(bytes, p + 2)
    const frameWidth = le16(bytes, p + 4)
    const frameHeight = le16(bytes, p + 6)
    if (!frameWidth || !frameHeight || left + frameWidth > width || top + frameHeight > height) {
      fail('Fotograma GIF fuera del área visible.')
    }
    // Count the full GIF canvas for each frame: decoders may retain fully
    // composited frames even when only a tiny sub-rectangle changes.
    totalPixels += width * height
    if (++frames > MAX_GIF_FRAMES || totalPixels > MAX_GIF_FRAME_PIXELS) {
      fail('GIF demasiado largo o pesado (máximo 150 fotogramas y 100 millones de píxeles acumulados).')
    }
    const packed = bytes[p + 8]
    p += 9
    if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1))
    requireSize(bytes, p + 1)
    const lzwSize = bytes[p++]
    if (lzwSize < 2 || lzwSize > 8) fail('Compresión GIF inválida.')
    skipBlocks()
  }
  fail('GIF incompleto: falta el terminador.')
}
function checkDimensions(mime: ImageMime, width: number, height: number): void {
  if (!width || !height || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)) {
    fail('Dimensiones de imagen inválidas.')
  }
  if (mime === 'image/gif') {
    if (width > MAX_GIF_EDGE_WIDTH || height > MAX_GIF_EDGE_HEIGHT) {
      fail('El GIF excede la resolución máxima de 1920 × 1080.')
    }
  } else if (width > MAX_STILL_EDGE || height > MAX_STILL_EDGE ||
    width * height > MAX_STILL_PIXELS) {
    fail('La imagen excede 4096 px por lado o 16 millones de píxeles.')
  }
}
function detectedType(bytes: Uint8Array): ImageMime {
  if (bytes.length > 24 && ascii(bytes, 0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png'
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) return 'image/gif'
  fail('Archivo rechazado: no es PNG, JPG, WebP ni GIF auténtico.')
}

async function decodeImage(file: Blob, expected: ValidatedImage): Promise<void> {
  // The browser must also recognize it. Never decode before checking dimensions.
  const url = URL.createObjectURL(file)
  const image = new Image()
  let timeout = 0
  try {
    image.src = url
    await Promise.race([
      image.decode(),
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error('Tiempo de procesamiento de imagen agotado.')), 10_000)
      }),
    ])
    if (image.naturalWidth !== expected.width || image.naturalHeight !== expected.height) {
      fail('Las dimensiones declaradas no coinciden con las decodificadas.')
    }
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Tiempo de procesamiento') ||
      error.message.includes('dimensiones declaradas'))) throw error
    fail('No se pudo decodificar la imagen; podría estar dañada.')
  } finally {
    window.clearTimeout(timeout)
    image.src = ''
    URL.revokeObjectURL(url)
  }
}

/**
 * Validates signature, real format vs extension, dimensions, frame budget and
 * ability to decode. The filename is required for local & remote uploads.
 */
export async function inspectEternalImage(file: Blob, filename: string): Promise<ValidatedImage> {
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    fail('El archivo debe ocupar como máximo 22 MB.')
  }
  const ext = /\.([a-z0-9]+)$/i.exec(filename)?.[1]?.toLowerCase()
  const fromExtension = ext ? EXTENSIONS[ext] : undefined
  if (!fromExtension) fail('Utiliza un archivo .png, .jpg, .jpeg, .webp o .gif.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const mime = detectedType(bytes)
  if (mime !== fromExtension) fail('La extensión no coincide con el formato real del archivo.')
  if (file.type && file.type !== 'application/octet-stream' && file.type !== mime) {
    fail('El tipo de archivo declarado no coincide con su contenido.')
  }

  let result: ValidatedImage
  if (mime === 'image/gif') {
    result = gifDetails(bytes)
  } else {
    let dimensions: { width: number; height: number }
    if (mime === 'image/png') {
      if (bytes.length < 33 || be32(bytes, 8) !== 13 || ascii(bytes, 12, 16) !== 'IHDR') {
        fail('Cabecera PNG inválida.')
      }
      dimensions = { width: be32(bytes, 16), height: be32(bytes, 20) }
    } else if (mime === 'image/jpeg') {
      dimensions = jpegDimensions(bytes)
    } else {
      dimensions = webpDimensions(bytes)
    }
    checkDimensions(mime, dimensions.width, dimensions.height)
    result = { mime, ...dimensions, frames: 1 }
  }
  return result
}

/** Full browser-side validation including an actual decoder pass. */
export async function validateEternalImage(file: Blob, filename: string): Promise<ValidatedImage> {
  const result = await inspectEternalImage(file, filename)
  await decodeImage(file, result)
  return result
}
