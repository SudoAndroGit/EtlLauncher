import test from 'node:test'
import assert from 'node:assert/strict'
import { Blob } from 'node:buffer'
import { readFileSync } from 'node:fs'
import {
  MAX_IMAGE_BYTES, inspectEternalImage,
} from '../branding/image-validation.ts'

function pngHeader(width, height) {
  const bytes = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes)
  bytes.writeUInt32BE(13, 8)
  bytes.write('IHDR', 12)
  bytes.writeUInt32BE(width, 16)
  bytes.writeUInt32BE(height, 20)
  bytes[24] = 8
  bytes[25] = 6
  return bytes
}
function gifHeader(width = 1, height = 1) {
  const header = Buffer.alloc(19)
  header.write('GIF89a', 0)
  header.writeUInt16LE(width, 6)
  header.writeUInt16LE(height, 8)
  header[10] = 0x80
  header.fill(255, 16, 19)
  return header
}
const gifFrame = Buffer.from([
  0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0,
  2, 2, 0x44, 1, 0,
])

test('bundled Sakura WebP is within new security limits', async () => {
  const encoded = readFileSync(new URL('../branding/default-sakura.webp.b64', import.meta.url), 'utf8').trim()
  const raw = Buffer.from(encoded, 'base64')
  const info = await inspectEternalImage(new Blob([raw], { type: 'image/webp' }), 'default.webp')
  assert.equal(info.mime, 'image/webp')
  assert.equal(info.width, 1920)
  assert.equal(info.height, 1280)
})
test('accept small, properly labeled PNG header', async () => {
  const info = await inspectEternalImage(new Blob([pngHeader(1920, 1080)], { type: 'image/png' }), 'wallpaper.png')
  assert.equal(info.width, 1920)
  assert.equal(info.height, 1080)
})
test('reject files whose extension disagrees with signature', async () => {
  await assert.rejects(
    inspectEternalImage(new Blob([pngHeader(100, 100)], { type: 'image/png' }), 'wallpaper.jpg'),
    /extensión no coincide/,
  )
})
test('reject files whose MIME disagrees with signature', async () => {
  await assert.rejects(
    inspectEternalImage(new Blob([pngHeader(100, 100)], { type: 'image/jpeg' }), 'wallpaper.png'),
    /tipo de archivo declarado/,
  )
})
test('reject unsupported or unrecognized content', async () => {
  await assert.rejects(
    inspectEternalImage(new Blob([Buffer.from('<script>alert(1)</script>')]), 'cute.png'),
    /no es PNG, JPG, WebP ni GIF/,
  )
  await assert.rejects(
    inspectEternalImage(new Blob([Buffer.from('<svg/>')]), 'cute.svg'),
    /Utiliza un archivo/,
  )
})
test('reject still images over 16 megapixels even if they fit by file size', async () => {
  await assert.rejects(
    inspectEternalImage(new Blob([pngHeader(4096, 4096)], { type: 'image/png' }), 'large.png'),
    /16 millones/,
  )
})
test('reject files larger than 22 MiB before decoding', async () => {
  const overLimit = new Blob([new Uint8Array(MAX_IMAGE_BYTES + 1)])
  await assert.rejects(inspectEternalImage(overLimit, 'too-large.png'), /22 MB/)
})
test('recognize one-frame minimal GIF', async () => {
  const bytes = Buffer.concat([gifHeader(), gifFrame, Buffer.from([0x3b])])
  const info = await inspectEternalImage(new Blob([bytes], { type: 'image/gif' }), 'animation.gif')
  assert.equal(info.frames, 1)
})
test('reject a GIF with more than 150 frames', async () => {
  const bytes = Buffer.concat([gifHeader(), ...Array(151).fill(gifFrame), Buffer.from([0x3b])])
  await assert.rejects(
    inspectEternalImage(new Blob([bytes], { type: 'image/gif' }), 'overlong.gif'),
    /150 fotogramas/,
  )
})
test('reject oversized GIF dimensions before decoding', async () => {
  const bytes = Buffer.concat([gifHeader(1921, 1080), gifFrame, Buffer.from([0x3b])])
  await assert.rejects(inspectEternalImage(new Blob([bytes], { type: 'image/gif' }), 'huge.gif'), /1920/)
})
test('reject animated WebP that could bypass the GIF frame budget', async () => {
  const bytes = Buffer.alloc(30)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(22, 4)
  bytes.write('WEBP', 8)
  bytes.write('VP8X', 12)
  bytes.writeUInt32LE(10, 16)
  bytes[20] = 0x02
  await assert.rejects(
    inspectEternalImage(new Blob([bytes], { type: 'image/webp' }), 'animated.webp'),
    /WebP animado no admitido/,
  )
})
test('reject a GIF with no end marker', async () => {
  const bytes = Buffer.concat([gifHeader(), gifFrame])
  await assert.rejects(
    inspectEternalImage(new Blob([bytes], { type: 'image/gif' }), 'truncated.gif'),
    /GIF incompleto/,
  )
})
