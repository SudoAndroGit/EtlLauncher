import metadata from './eternal-version.json' with { type: 'json' }

const repository = 'Wildlx3/EtlLauncher'
const releasesUrl = `https://github.com/${repository}/releases`
const preferenceKey = 'eternal.check-updates-on-startup'
const tagPattern = /^eternallauncher-v(\d{1,6}\.\d{1,6}\.\d{1,6})(?:-build\.\d+\.\d+)?$/

export const eternalVersion = metadata.version
export const latestReleaseEndpoint = `https://api.github.com/repos/${repository}/releases/latest`

type Update = { version: string; url: string }

export function checksEnabled(storage: Storage): boolean {
	return storage.getItem(preferenceKey) !== 'off'
}

export function saveCheckPreference(storage: Storage, enabled: boolean): void {
	storage.setItem(preferenceKey, enabled ? 'on' : 'off')
}

export function newerRelease(payload: unknown): Update | null {
	if (!payload || typeof payload !== 'object') return null
	const release = payload as Record<string, unknown>
	if (release.draft !== false || release.prerelease !== false || typeof release.tag_name !== 'string') {
		return null
	}
	const version = tagPattern.exec(release.tag_name)?.[1]
	if (!version) return null

	const installed = eternalVersion.split('.').map(Number)
	const difference = version.split('.').map(Number).map((part, index) => part - installed[index])
	if ((difference.find((part) => part !== 0) ?? 0) <= 0) return null

	return { version, url: `${releasesUrl}/tag/${encodeURIComponent(release.tag_name)}` }
}

let startupCheck: Promise<Update | null> | undefined

export function checkReleaseOnStartup(
	storage: Storage,
	load: () => Promise<unknown>,
): Promise<Update | null> {
	startupCheck ??= Promise.resolve().then(async () => {
		if (!checksEnabled(storage)) return null
		const release = newerRelease(await load())
		return checksEnabled(storage) ? release : null
	}).catch(() => null)
	return startupCheck
}
