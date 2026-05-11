<script setup>
const version = 'v1.0.0'
</script>

<template>
  <div class="status-bar">
    <div class="status-left">
      <span class="version">{{ version }}</span>
    </div>
    <div class="status-right">
      <div class="status-icon" title="Cookies">
        <span>🍪</span>
      </div>
      <div class="status-icon" title="控制台">
        <span>🖥️</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  padding: 0 12px;
  background: #fafafa;
  border-top: 1px solid #e8e8e8;
  font-size: 12px;
  color: #8c8c8c;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  cursor: pointer;
  border-radius: 4px;
}

.status-icon:hover {
  background: #e6f7ff;
}

.version {
  color: #8c8c8c;
}
</style>