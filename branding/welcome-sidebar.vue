<script setup>
import welcome from './eternal-welcome.json'
</script>

<template>
  <section class="eternal-welcome p-4" aria-label="Bienvenida a Eternal">
    <div class="eternal-welcome-card">
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
</style>
