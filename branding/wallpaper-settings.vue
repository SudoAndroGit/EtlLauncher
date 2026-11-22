<script setup lang="ts">
import { ref } from 'vue'

import {
	getEternalWallpaperEffects,
	hasEternalWallpaper,
	resetEternalWallpaper,
	setEternalWallpaper,
	setEternalWallpaperEffects,
} from './eternal-wallpaper'

const initialEffects = getEternalWallpaperEffects()
const darkness = ref(initialEffects.darkness)
const fade = ref(initialEffects.fade)
const input = ref<HTMLInputElement | null>(null)
const custom = ref(hasEternalWallpaper())
const busy = ref(false)
const error = ref('')
const notice = ref('')

async function selectImage(event: Event) {
	const element = event.target as HTMLInputElement
	const file = element.files?.[0]
	element.value = ''
	if (!file || busy.value) return
	busy.value = true
	error.value = ''
	notice.value = ''
	try {
		await setEternalWallpaper(file)
		custom.value = true
		notice.value = 'Fondo guardado. Se mantendrá al reiniciar Eternal.'
	} catch (e) {
		error.value = e instanceof Error ? e.message : 'No se pudo guardar el fondo.'
	} finally {
		busy.value = false
	}
}

function updateEffects() {
	setEternalWallpaperEffects(darkness.value, fade.value)
}

function restoreDefault() {
	try {
		resetEternalWallpaper()
		custom.value = false
		error.value = ''
		notice.value = 'Se restauró el fondo Sakura Glass.'
	} catch {
		error.value = 'No se pudo restaurar el fondo.'
	}
}
</script>

<template>
	<section class="eternal-wallpaper-settings">
		<h3>Fondo de Eternal</h3>
		<p>Usa tu fotografía o el fondo Sakura predeterminado. Los cambios se aplican al momento.</p>
		<div class="eternal-wallpaper-actions">
			<input
				ref="input"
				type="file"
				accept="image/jpeg,image/png,image/webp"
				class="eternal-wallpaper-file"
				aria-label="Seleccionar imagen de fondo"
				@change="selectImage"
			/>
			<button type="button" class="eternal-wallpaper-primary" :disabled="busy" @click="input?.click()">
				{{ busy ? 'Procesando imagen…' : custom ? 'Cambiar fotografía' : 'Elegir fotografía' }}
			</button>
			<button
				type="button"
				class="eternal-wallpaper-secondary"
				:disabled="busy || !custom"
				@click="restoreDefault"
			>
				Restaurar Sakura Glass
			</button>
		</div>
		<div class="eternal-wallpaper-effects">
			<div class="eternal-wallpaper-effect">
				<div class="eternal-wallpaper-effect-heading">
					<label for="eternal-wallpaper-darkness">Oscurecimiento</label>
					<output for="eternal-wallpaper-darkness">{{ darkness }}%</output>
				</div>
				<input
					id="eternal-wallpaper-darkness"
					v-model.number="darkness"
					type="range"
					min="0"
					max="100"
					step="1"
					@input="updateEffects"
				/>
			</div>
			<div class="eternal-wallpaper-effect">
				<div class="eternal-wallpaper-effect-heading">
					<label for="eternal-wallpaper-fade">Desvanecimiento</label>
					<output for="eternal-wallpaper-fade">{{ fade }}%</output>
				</div>
				<input
					id="eternal-wallpaper-fade"
					v-model.number="fade"
					type="range"
					min="0"
					max="100"
					step="1"
					@input="updateEffects"
				/>
			</div>
			<p class="eternal-wallpaper-hint">El oscurecimiento añade una capa oscura; el desvanecimiento atenúa la imagen sin modificar el archivo original.</p>
		</div>
		<p class="eternal-wallpaper-hint">Admite JPG, PNG o WebP (máx. 32 MB). Se reduce y guarda localmente; no se sube a Internet.</p>
		<p v-if="error" class="eternal-wallpaper-error" role="alert">{{ error }}</p>
		<p v-else-if="notice" class="eternal-wallpaper-success" role="status">{{ notice }}</p>
	</section>
</template>

<style scoped>
.eternal-wallpaper-settings {
	margin-top: 1.5rem;
	padding: 1.25rem;
	border: 1px solid var(--brand-gradient-border);
	border-radius: 1rem;
	background: var(--color-raised-bg);
}
.eternal-wallpaper-settings h3 {
	margin: 0 0 .5rem;
	font-size: 1.1rem;
	font-weight: 650;
	color: var(--color-contrast);
}
.eternal-wallpaper-settings p { color: var(--color-base); line-height: 1.5; }
.eternal-wallpaper-actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-top: 1rem; }
.eternal-wallpaper-file { display: none; }
.eternal-wallpaper-actions button {
	padding: .65rem .9rem;
	border-radius: .7rem;
	cursor: pointer;
	font-weight: 650;
}
.eternal-wallpaper-primary { background: var(--color-brand); color: var(--color-accent-contrast, #26141d); border: 1px solid var(--color-brand); }
.eternal-wallpaper-secondary { background: var(--color-button-bg); color: var(--color-contrast); border: 1px solid var(--color-button-bg-selected); }
.eternal-wallpaper-actions button:disabled { opacity: .5; cursor: not-allowed; }
.eternal-wallpaper-actions button:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 3px; }
.eternal-wallpaper-hint { font-size: .78rem; }
.eternal-wallpaper-effects { display: flex; flex-direction: column; gap: .95rem; margin-top: 1.25rem; }
.eternal-wallpaper-effect { display: flex; flex-direction: column; gap: .4rem; }
.eternal-wallpaper-effect-heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.eternal-wallpaper-effect-heading label { color: var(--color-contrast); font-size: .9rem; font-weight: 600; }
.eternal-wallpaper-effect-heading output { color: var(--color-brand); font-size: .85rem; font-variant-numeric: tabular-nums; }
.eternal-wallpaper-effect input[type="range"] { width: 100%; accent-color: var(--color-brand); cursor: pointer; }
.eternal-wallpaper-effect input[type="range"]:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 3px; border-radius: .25rem; }
.eternal-wallpaper-error { color: var(--color-red, #f55) !important; }
.eternal-wallpaper-success { color: var(--color-brand) !important; }
</style>
