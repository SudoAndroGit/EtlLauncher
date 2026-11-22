<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

// A Vue component owns this layer from the main-view render.
// The prior startup DOM observer could miss asynchronous initialization.
const particles = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  style: {
    '--particle-left': ((index * 43 + 13) % 100) + '%',
    '--particle-delay': (-((index * 3) % 19)) + 's',
    '--particle-duration': (17 + ((index * 7) % 10)) + 's',
    '--particle-drift': ((index % 2 ? -1 : 1) * (25 + (index * 11) % 55)) + 'px',
    '--particle-size': (6 + ((index * 7) % 8)) + 'px',
  },
}))
</script>

<template>
  <div v-show="route.path === '/'" class="eternal-particles-layer" aria-hidden="true">
    <span v-for="particle in particles" :key="particle.id" class="eternal-particle" :style="particle.style" />
  </div>
</template>
