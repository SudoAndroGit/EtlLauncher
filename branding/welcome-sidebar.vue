<script setup>
import { onMounted, onUnmounted, ref } from 'vue'

import welcome from './eternal-welcome.json'
import feedConfig from './eternal-news-config.json'

const CACHE_KEY = 'eternal-news-cache-v1'
const MAX_BODY_CHARS = 850
const MAX_ITEMS = 5

function safeHttpsUrl(value) {
	try {
		const url = new URL(value)
		return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
	} catch {
		return null
	}
}

const feedUrl = typeof feedConfig.url === 'string' ? safeHttpsUrl(feedConfig.url.trim()) : null
const refreshMinutes = Math.min(60, Math.max(5, Number(feedConfig.refreshMinutes) || 15))
const articles = ref([])
const updateDate = ref('')
const cached = ref(false)
const loading = ref(false)
const feedError = ref('')
let refreshTimer
let activeController

function parseFeed(payload) {
	if (!payload || payload.version !== 1 || !Array.isArray(payload.items)) {
		throw new Error('Formato de noticias no válido')
	}
	const cleaned = payload.items.slice(0, MAX_ITEMS).map((item, index) => {
		if (!item || typeof item.title !== 'string' || typeof item.body !== 'string') {
			return null
		}
		const title = item.title.trim().slice(0, 110)
		const body = item.body.trim().slice(0, MAX_BODY_CHARS)
		if (!title || !body) return null
		const href = typeof item.url === 'string' ? safeHttpsUrl(item.url) : null
		return {
			id: typeof item.id === 'string' ? item.id.slice(0, 70) : String(index),
			title,
			body,
			date: typeof item.date === 'string' ? item.date.slice(0, 30) : '',
			url: href,
		}
	}).filter(Boolean)
	if (!cleaned.length) throw new Error('El archivo no contiene noticias válidas')
	return {
		items: cleaned,
		updated_at: typeof payload.updated_at === 'string' ? payload.updated_at.slice(0, 30) : '',
	}
}

function loadCache() {
	try {
		const entry = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')
		if (entry?.url !== feedUrl) return
		const content = parseFeed(entry.data)
		articles.value = content.items
		updateDate.value = content.updated_at
		cached.value = true
	} catch {
		// A bad or missing cache should never hide the bundled welcome.
	}
}

async function refreshNews() {
	if (!feedUrl || loading.value) return
	const controller = new AbortController()
	activeController = controller
	const timeout = setTimeout(() => controller.abort(), 8000)
	loading.value = true
	feedError.value = ''
	try {
		const response = await fetch(feedUrl, { cache: 'no-cache', signal: controller.signal })
		if (!response.ok) throw new Error('HTTP ' + response.status)
		if (Number(response.headers.get('content-length') || 0) > 100_000) {
			throw new Error('Archivo de noticias demasiado grande')
		}
		const text = await response.text()
		if (text.length > 100_000) throw new Error('Archivo de noticias demasiado grande')
		const raw = JSON.parse(text)
		const parsed = parseFeed(raw)
		articles.value = parsed.items
		updateDate.value = parsed.updated_at
		cached.value = false
		try {
			localStorage.setItem(CACHE_KEY, JSON.stringify({
				url: feedUrl,
				data: { version: 1, ...parsed },
			}))
		} catch {
			// No local storage is needed to show the news.
		}
	} catch {
		if (!controller.signal.aborted || articles.value.length === 0) {
			feedError.value = 'Sin conexión. Mostrando las últimas noticias disponibles.'
		}
	} finally {
		clearTimeout(timeout)
		if (activeController === controller) activeController = undefined
		loading.value = false
	}
}

onMounted(() => {
	if (!feedUrl) return
	loadCache()
	void refreshNews()
	refreshTimer = window.setInterval(() => void refreshNews(), refreshMinutes * 60 * 1000)
})

onUnmounted(() => {
	if (refreshTimer !== undefined) window.clearInterval(refreshTimer)
	activeController?.abort()
})
</script>

<template>
	<section class="eternal-welcome p-4" aria-label="Noticias de Eternal">
		<div class="eternal-welcome-card">
			<template v-if="articles.length">
				<div class="eternal-welcome-eyebrow">
					<span aria-hidden="true">🌸</span>
					Noticias de Eternal
				</div>
				<div v-for="article in articles" :key="article.id" class="eternal-news-article">
					<time v-if="article.date" class="eternal-news-date">{{ article.date }}</time>
					<h3 class="eternal-welcome-title">{{ article.title }}</h3>
					<p class="eternal-welcome-description">{{ article.body }}</p>
					<a v-if="article.url" :href="article.url" target="_blank" rel="noopener noreferrer" class="eternal-news-link">Leer más ↗</a>
				</div>
				<p v-if="cached || feedError" class="eternal-news-status">{{ feedError || 'Últimas noticias guardadas.' }}</p>
				<p v-else-if="updateDate" class="eternal-news-date">Actualizado: {{ updateDate }}</p>
			</template>
			<template v-else>
				<div class="eternal-welcome-eyebrow">
					<span aria-hidden="true">🌸</span>
					{{ welcome.eyebrow }}
				</div>
				<h3 class="eternal-welcome-title">{{ welcome.title }}</h3>
				<p class="eternal-welcome-description">{{ welcome.description }}</p>
				<ul v-if="welcome.features?.length" class="eternal-welcome-features">
					<li v-for="(feature, index) in welcome.features" :key="index">
						<span class="eternal-welcome-bullet" aria-hidden="true"></span>
						<span>{{ feature }}</span>
					</li>
				</ul>
				<p class="eternal-welcome-footer">{{ welcome.footer }}</p>
			</template>
			<button v-if="feedUrl" type="button" class="eternal-news-refresh" :disabled="loading" @click="refreshNews">
				{{ loading ? 'Buscando noticias…' : 'Actualizar noticias' }}
			</button>
		</div>
	</section>
</template>

<style scoped>
.eternal-welcome-card {
	padding: 1.15rem;
	border: 1px solid var(--brand-gradient-border);
	border-radius: 1rem;
	background: linear-gradient(140deg, rgba(245, 169, 197, .13), rgba(166, 112, 174, .045));
	box-shadow: 0 3px 22px rgba(0, 0, 0, .045);
}
.eternal-welcome-eyebrow {
	display: flex;
	align-items: center;
	gap: .45rem;
	font-size: .72rem;
	font-weight: 700;
	line-height: 1.4;
	letter-spacing: .06em;
	text-transform: uppercase;
	color: var(--color-brand);
}
.eternal-welcome-title {
	margin: .75rem 0 .6rem;
	color: var(--color-contrast);
	font-size: 1.2rem;
	line-height: 1.35;
	font-weight: 750;
}
.eternal-welcome-description {
	margin: 0;
	color: var(--color-base);
	font-size: .85rem;
	line-height: 1.55;
	white-space: pre-wrap;
	overflow-wrap: anywhere;
}
.eternal-welcome-features {
	list-style: none;
	padding: 0;
	margin: 1rem 0;
	display: flex;
	flex-direction: column;
	gap: .65rem;
}
.eternal-welcome-features li {
	display: flex;
	align-items: baseline;
	gap: .65rem;
	color: var(--color-base);
	font-size: .8rem;
	line-height: 1.5;
}
.eternal-welcome-bullet {
	flex: none;
	display: inline-block;
	width: .375rem;
	height: .375rem;
	border-radius: 50%;
	background: var(--color-brand);
}
.eternal-welcome-footer {
	margin: .85rem 0 0;
	padding-top: .8rem;
	border-top: 1px solid var(--brand-gradient-border);
	font-size: .78rem;
	line-height: 1.5;
	color: var(--color-secondary);
}
.eternal-news-article {
	padding-top: .6rem;
}
.eternal-news-article + .eternal-news-article {
	margin-top: .9rem;
	border-top: 1px solid var(--brand-gradient-border);
}
.eternal-news-article .eternal-welcome-title {
	font-size: 1rem;
	margin: .35rem 0;
}
.eternal-news-date {
	color: var(--color-secondary);
	font-size: .7rem;
}
.eternal-news-link {
	display: inline-block;
	margin-top: .4rem;
	font-size: .8rem;
	color: var(--color-brand);
	text-decoration: underline;
}
.eternal-news-refresh {
	margin-top: .85rem;
	padding: .45rem .7rem;
	border-radius: .6rem;
	border: 1px solid var(--brand-gradient-border);
	background: var(--color-button-bg);
	color: var(--color-contrast);
	cursor: pointer;
	font-size: .78rem;
}
.eternal-news-refresh:disabled { cursor: not-allowed; opacity: .6; }
.eternal-news-refresh:focus-visible,
.eternal-news-link:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 3px; }
.eternal-news-status { margin: .6rem 0 0; font-size: .73rem; color: var(--color-secondary); }
</style>
