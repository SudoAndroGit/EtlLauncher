type FetchOptions = {
  maxBytes: number
  timeoutMs: number
  signal?: AbortSignal
  cache?: RequestCache
  allowedTypes?: readonly string[]
}

export async function fetchEternalContent(url: string, options: FetchOptions): Promise<Blob> {
  const endpoint = new URL(url)
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error('URL de contenido remoto no válida.')
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs)
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal
  try {
    const response = await fetch(endpoint.href, {
      signal,
      cache: options.cache ?? 'no-cache',
      credentials: 'omit',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok || !response.body) throw new Error('Respuesta remota no válida.')
    const advertised = Number(response.headers.get('content-length') ?? 0)
    if (!Number.isSafeInteger(advertised) || advertised < 0 || advertised > options.maxBytes) {
      throw new Error('El contenido remoto supera el límite permitido.')
    }
    const type = (response.headers.get('content-type') ?? '').split(';', 1)[0].trim().toLowerCase()
    if (type && type !== 'application/octet-stream' && options.allowedTypes && !options.allowedTypes.includes(type)) {
      throw new Error('Tipo de contenido remoto no admitido.')
    }

    const reader = response.body.getReader()
    const chunks: Uint8Array<ArrayBuffer>[] = []
    let size = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > options.maxBytes) {
          void reader.cancel().catch(() => {})
          throw new Error('El contenido remoto supera el límite permitido.')
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    return new Blob(chunks, { type })
  } finally {
    controller.abort()
    clearTimeout(timeout)
  }
}

export async function fetchEternalJson(url: string, options: FetchOptions): Promise<unknown> {
  const body = await fetchEternalContent(url, options)
  const text = new TextDecoder('utf-8', { fatal: true }).decode(await body.arrayBuffer())
  return JSON.parse(text)
}
