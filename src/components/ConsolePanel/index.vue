<script setup>
const props = defineProps({
  visible: Boolean,
  logs: Array
})

const emit = defineEmits(['close', 'clear'])
</script>

<template>
  <div class="console-panel" v-if="visible">
    <div class="panel-header">
      <h3>控制台</h3>
      <div class="header-actions">
        <button class="clear-btn" @click="$emit('clear')">清空</button>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
    </div>
    <div class="panel-content">
      <div v-if="logs.length === 0" class="empty-message">
        暂无日志
      </div>
      <div v-else class="log-list">
        <div class="log-item" :class="log.type" v-for="(log, index) in logs" :key="index">
          <span class="log-time">{{ log.time }}</span>
          <span class="log-type">{{ log.type.toUpperCase() }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>