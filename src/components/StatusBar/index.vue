<script setup>
const version = 'v1.0.0'

const emit = defineEmits(['open-cookie-panel'])
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
      <div class="status-icon" title="控制台">
        <span>🖥️</span>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>