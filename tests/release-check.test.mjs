import assert from 'node:assert/strict'
import test from 'node:test'

import {
	checkReleaseOnStartup,
	checksEnabled,
	newerRelease,
	saveCheckPreference,
} from '../branding/release-check.ts'

function publishedRelease(tag) {
	return { tag_name: tag, draft: false, prerelease: false }
}

function memoryStorage() {
	const entries = new Map()
	return {
		getItem: (key) => entries.get(key) ?? null,
		setItem: (key, value) => entries.set(key, value),
	}
}

test('compares Eternal versions numerically and builds the link from the trusted repository', () => {
	assert.equal(newerRelease(publishedRelease('eternallauncher-v1.2.1-build.118.1')), null)
	assert.equal(newerRelease(publishedRelease('eternallauncher-v1.2.00')), null)
	assert.equal(newerRelease(publishedRelease('eternal-v0.23.5-build.117.1')), null)
	assert.equal(newerRelease({
		...publishedRelease('eternallauncher-v1.2.10'),
		prerelease: true,
	}), null)
	assert.deepEqual(newerRelease({
		...publishedRelease('eternallauncher-v1.2.10-build.119.1'),
		html_url: 'https://example.test/',
	}), {
		version: '1.2.10',
		url: 'https://github.com/Wildlx3/EtlLauncher/releases/tag/eternallauncher-v1.2.10-build.119.1',
	})
})

test('shares one startup request even when the title bar mounts again', async () => {
	let loads = 0
	const storage = memoryStorage()
	const load = async () => {
		loads++
		return publishedRelease('eternallauncher-v1.2.02')
	}
	const results = await Promise.all([
		checkReleaseOnStartup(storage, load),
		checkReleaseOnStartup(storage, load),
	])
	assert.equal(loads, 1)
	assert.equal(results[0].version, '1.2.02')
	assert.deepEqual(results[0], results[1])
})

test('skips GitHub when the saved preference is disabled', async () => {
	const { checkReleaseOnStartup } = await import('../branding/release-check.ts?disabled-startup')
	const storage = memoryStorage()
	assert.equal(checksEnabled(storage), true)
	saveCheckPreference(storage, false)
	assert.equal(checksEnabled(storage), false)

	let requested = false
	const result = await checkReleaseOnStartup(storage, async () => {
		requested = true
	})
	assert.equal(requested, false)
	assert.equal(result, null)
})
