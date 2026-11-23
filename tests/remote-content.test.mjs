import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchEternalContent, fetchEternalJson } from '../branding/remote-content.ts'

const ENDPOINT = 'https://example.test/content.json'
const OPTIONS = { maxBytes: 8, timeoutMs: 1000 }

test('accepts JSON at the exact byte limit and sends a restricted request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{"x": 1}'))
  assert.deepEqual(await fetchEternalJson(ENDPOINT, OPTIONS), { x: 1 })
  const [url, options] = fetch.mock.calls[0].arguments
  assert.equal(url, ENDPOINT)
  assert.equal(options.credentials, 'omit')
  assert.equal(options.redirect, 'error')
  assert.equal(options.referrerPolicy, 'no-referrer')
})

test('counts UTF-8 bytes and cancels an oversized body even without a length header', async (t) => {
  let cancelled = false
  const bytes = new TextEncoder().encode('"🌸🌸"')
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.subarray(0, 5))
      controller.enqueue(bytes.subarray(5))
    },
    cancel() { cancelled = true },
  })
  t.mock.method(globalThis, 'fetch', async () => new Response(body))
  await assert.rejects(fetchEternalJson(ENDPOINT, OPTIONS), /supera el límite/)
  assert.equal(cancelled, true)
})

test('checks an oversized Content-Length before obtaining a stream reader', async (t) => {
  const body = new ReadableStream()
  const reader = t.mock.method(body, 'getReader')
  t.mock.method(globalThis, 'fetch', async () => new Response(body, { headers: { 'Content-Length': '9' } }))
  await assert.rejects(fetchEternalContent(ENDPOINT, OPTIONS), /supera el límite/)
  assert.equal(reader.mock.callCount(), 0)
})

test('honors timeout and caller cancellation while downloading', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => new Response(new ReadableStream({
    start(controller) {
      signal.addEventListener('abort', () => controller.error(signal.reason), { once: true })
    },
  })))
  const caller = new AbortController()
  const download = fetchEternalContent(ENDPOINT, { ...OPTIONS, signal: caller.signal })
  caller.abort()
  await assert.rejects(download, { name: 'AbortError' })
  await assert.rejects(fetchEternalContent(ENDPOINT, { ...OPTIONS, timeoutMs: 15 }), { name: 'AbortError' })
})

test('rejects insecure endpoints, unexpected image types and invalid UTF-8', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response(new Uint8Array([0xff])))
  await assert.rejects(fetchEternalContent('http://example.test/content.json', OPTIONS), /URL/)
  assert.equal(fetch.mock.callCount(), 0)
  await assert.rejects(fetchEternalJson(ENDPOINT, OPTIONS), TypeError)
  fetch.mock.mockImplementation(async () => new Response('text', { headers: { 'Content-Type': 'text/html' } }))
  await assert.rejects(fetchEternalContent(ENDPOINT, { ...OPTIONS, allowedTypes: ['image/webp'] }), /Tipo de contenido/)
})
