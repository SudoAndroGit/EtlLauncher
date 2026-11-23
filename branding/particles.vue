<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

// A Vue component owns this layer from the main-view render.
// The prior startup DOM observer could miss asynchronous initialization.
const particles = Array.from({ length: 22 }, (_, index) => ({
  id: index,
  style: {
    '--particle-left': ((index * 43 + 13) % 100) + '%',
    '--particle-delay': (-((index * 3) % 19)) + 's',
    '--particle-duration': (17 + ((index * 7) % 10)) + 's',
    '--lava-duration': (9 + ((index * 5) % 6)) + 's',
    '--lava-drift': ((index % 2 ? -1 : 1) * (9 + (index * 7) % 28)) + 'px',
    '--particle-drift': ((index % 2 ? -1 : 1) * (25 + (index * 11) % 55)) + 'px',
    '--particle-size': (6 + ((index * 7) % 8)) + 'px',
  },
}))
</script>

<template>
  <!-- The root viewport's backgrounds and overflow can cover/clamp children.
       This decoration is painted above the home page, never over dialogs. -->
  <Teleport to="body">
    <div
      v-if="route.path === '/' || route.path.startsWith('/library')"
      class="eternal-particles-layer eternal-particles-fixed"
      aria-hidden="true"
    >
      <span
        v-for="particle in particles"
        :key="particle.id"
        class="eternal-particle"
        :style="particle.style"
      />
    </div>
  </Teleport>
</template>
