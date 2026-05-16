<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const version = 'v0.0.1'

const emit = defineEmits(['open-cookie-panel', 'open-console-panel'])
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="version">{{ version }}</span>
    </div>
    <div class="status-right">
      <div class="status-icon" title="Cookies" @click="$emit('open-cookie-panel')">
        <span>🍪</span>
      </div>
      <div class="status-icon" :title="t('panels.console')" @click="$emit('open-console-panel')">
        <span>🖥️</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>