<script setup lang="ts">
import { ref } from 'vue'

import {
	getEternalWallpaperEffects,
	getEternalSidebarTransparency,
	hasEternalWallpaper,
	resetEternalWallpaper,
	setEternalWallpaper,
	setEternalWallpaperEffects,
	setEternalSidebarTransparency,
} from './eternal-wallpaper'
import {
	getEternalParticleChoice,
	getEternalWallpaperChoice,
	setEternalParticleChoice,
	setEternalWallpaperChoice,
	type ParticleChoice,
	type WallpaperChoice,
} from './eternal-appearance'

const initialEffects = getEternalWallpaperEffects()
const darkness = ref(initialEffects.darkness)
const blur = ref(initialEffects.blur)
const sidebarTransparency = ref(getEternalSidebarTransparency())
const wallpaperChoice = ref<WallpaperChoice>(getEternalWallpaperChoice())
const particleChoice = ref<ParticleChoice>(getEternalParticleChoice())
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
		wallpaperChoice.value = 'custom'
		setEternalWallpaperChoice('custom')
		notice.value = 'Fondo guardado. Se mantendrá al reiniciar Eternal.'
	} catch (e) {
		error.value = e instanceof Error ? e.message : 'No se pudo guardar el fondo.'
	} finally {
		busy.value = false
	}
}

function updateEffects() {
	setEternalWallpaperEffects(darkness.value, blur.value)
}

function updateWallpaperMode(mode: WallpaperChoice) {
	wallpaperChoice.value = mode
	setEternalWallpaperChoice(mode)
	error.value = ''
	notice.value = mode === 'custom' && !custom.value
		? 'Selecciona una imagen para usar tu fondo personalizado.'
		: ''
}

function updateParticleMode() {
	setEternalParticleChoice(particleChoice.value)
}

function updateSidebarTransparency() {
	setEternalSidebarTransparency(sidebarTransparency.value)
}

function restoreDefault() {
	try {
		resetEternalWallpaper()
		custom.value = false
		wallpaperChoice.value = 'sakura'
		setEternalWallpaperChoice('sakura')
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
		<p>Elige un fondo sincronizado, el Sakura integrado o una imagen propia. Los cambios se aplican al momento.</p>
		<div class="eternal-wallpaper-mode-group" role="group" aria-label="Fondo de pantalla">
			<button type="button" class="eternal-wallpaper-mode" :class="{ 'is-selected': wallpaperChoice === 'default' }" :aria-pressed="wallpaperChoice === 'default'" @click="updateWallpaperMode('default')">Sincronizado</button>
			<button type="button" class="eternal-wallpaper-mode" :class="{ 'is-selected': wallpaperChoice === 'sakura' }" :aria-pressed="wallpaperChoice === 'sakura'" @click="updateWallpaperMode('sakura')">Sakura</button>
			<button type="button" class="eternal-wallpaper-mode" :class="{ 'is-selected': wallpaperChoice === 'custom' }" :aria-pressed="wallpaperChoice === 'custom'" @click="updateWallpaperMode('custom')">Personalizado</button>
		</div>
		<div v-if="wallpaperChoice === 'custom'" class="eternal-wallpaper-actions">
			<input
				ref="input"
				type="file"
				accept="image/jpeg,image/png,image/webp,image/gif"
				class="eternal-wallpaper-file"
				aria-label="Seleccionar imagen de fondo"
				@change="selectImage"
			/>
			<button type="button" class="eternal-wallpaper-primary" :disabled="busy" @click="input?.click()">
				{{ busy ? 'Procesando imagen…' : custom ? 'Cambiar imagen / GIF' : 'Elegir imagen / GIF' }}
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
					<label for="eternal-wallpaper-blur">Desenfoque</label>
					<output for="eternal-wallpaper-blur">{{ blur }} px</output>
				</div>
				<input
					id="eternal-wallpaper-blur"
					v-model.number="blur"
					type="range"
					min="0"
					max="24"
					step="1"
					@input="updateEffects"
				/>
			</div>
			<p class="eternal-wallpaper-hint">El oscurecimiento añade una capa oscura. El desenfoque suaviza únicamente el fondo, no los botones ni los textos.</p>
		</div>
		<p class="eternal-wallpaper-hint">Admite PNG, JPG, WebP y GIF (máx. 22 MB). Se verifica el formato real y la resolución. Las imágenes fijas admiten hasta 4096 px por lado y 16 MP; los GIF, hasta 1920 × 1080, 150 fotogramas y 100 MP acumulados. Se guardan localmente, nunca se suben a Internet.</p>
		<p v-if="error" class="eternal-wallpaper-error" role="alert">{{ error }}</p>
		<p v-else-if="notice" class="eternal-wallpaper-success" role="status">{{ notice }}</p>
	</section>
	<section class="eternal-wallpaper-settings">
		<h3>Animación del menú principal</h3>
		<p>Partículas ligeras sobre la biblioteca. Solo se animan en la pantalla principal y puedes desactivarlas.</p>
		<div class="eternal-appearance-selector">
			<label for="eternal-particle-mode">Estilo de partículas</label>
			<select id="eternal-particle-mode" v-model="particleChoice" @change="updateParticleMode">
				<option value="default">Sincronizado</option>
				<option value="none">Desactivadas</option>
				<option value="sakura">Sakura (pétalos)</option>
				<option value="lava">Lava (gotas)</option>
				<option value="otono">Otoño (hojas secas)</option>
				<option value="primavera">Primavera (hojas verdes)</option>
				<option value="navidad">Navidad (copos de nieve)</option>
			</select>
		</div>
		<p class="eternal-wallpaper-hint">Las opciones manuales no se sobrescriben con las configuraciones remotas. Se respeta la reducción de movimiento del sistema.</p>
	</section>
	<section class="eternal-wallpaper-settings">
		<h3>Panel derecho</h3>
		<p>Ajusta la transparencia de la zona de cuenta, amigos y noticias. Con 100 % el fondo de los paneles y su desenfoque desaparecen, pero los textos siguen visibles.</p>
		<div class="eternal-wallpaper-effects">
			<div class="eternal-wallpaper-effect">
				<div class="eternal-wallpaper-effect-heading">
					<label for="eternal-sidebar-transparency">Transparencia del panel derecho</label>
					<output for="eternal-sidebar-transparency">{{ sidebarTransparency }}%</output>
				</div>
				<input
					id="eternal-sidebar-transparency"
					v-model.number="sidebarTransparency"
					type="range"
					min="0"
					max="100"
					step="1"
					@input="updateSidebarTransparency"
				/>
			</div>
			<p class="eternal-wallpaper-hint">0 % conserva el cristal actual. 100 % muestra el fondo sin oscurecimiento adicional del panel derecho.</p>
		</div>
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
.eternal-wallpaper-mode-group { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .55rem; margin-top: .95rem; }
.eternal-wallpaper-mode { min-width: 0; padding: .75rem .5rem; border: 1px solid var(--eternal-glass-outline, rgba(255, 214, 236, .25)); border-radius: 13px; background: var(--color-button-bg); color: var(--color-contrast); font: inherit; font-weight: 600; cursor: pointer; transition: background-color .15s ease, border-color .15s ease; }
.eternal-wallpaper-mode:hover { background: var(--eternal-v3-quiet-hover, var(--color-button-bg-hover)); }
.eternal-wallpaper-mode.is-selected { color: #301827; background: #edabc9; border-color: #f6c7db; box-shadow: inset 0 1px 0 rgba(255,255,255,.43); }
.eternal-wallpaper-mode:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 3px; }
@media (max-width: 520px) { .eternal-wallpaper-mode-group { gap: .3rem; } .eternal-wallpaper-mode { font-size: .82rem; padding: .7rem .2rem; } }
.eternal-appearance-selector { display: flex; flex-direction: column; gap: .45rem; margin-top: .9rem; }
.eternal-appearance-selector label { color: var(--color-contrast); font-size: .86rem; font-weight: 600; }
.eternal-appearance-selector select { width: 100%; max-width: 380px; border: 1px solid var(--brand-gradient-border); background: var(--color-button-bg); color: var(--color-contrast); border-radius: 12px; padding: .65rem .85rem; font: inherit; cursor: pointer; }
.eternal-appearance-selector select:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 3px; }
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
