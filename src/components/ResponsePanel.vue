<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  response: {
    type: Object,
    default: () => null
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const activeTab = ref('body')

const tabs = [
  { key: 'body', name: '响应体' },
  { key: 'headers', name: '响应头' },
  { key: 'test', name: '测试结果' },
  { key: 'network', name: '网络日志' },
  { key: 'timeline', name: '时间线' }
]

const statusClass = computed(() => {
  if (!props.response) return ''
  const status = props.response.status
  if (status >= 200 && status < 300) return 'success'
  if (status >= 300 && status < 400) return 'redirect'
  if (status >= 400 && status < 500) return 'client-error'
  if (status >= 500) return 'server-error'
  return ''
})

const formattedBody = computed(() => {
  if (!props.response?.body) return ''
  try {
    return JSON.stringify(JSON.parse(props.response.body), null, 2)
  } catch {
    return props.response.body
  }
})

const getLineNumbers = computed(() => {
  if (!formattedBody.value) return ''
  const lines = formattedBody.value.split('\n')
  return lines.map((_, i) => i + 1).join('\n')
})

const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024
    i++
  }
  return `${size.toFixed(2)} ${units[i]}`
}

const formatTime = (ms) => {
  if (!ms) return '0 ms'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
</script>

<template>
  <div class="response-panel">
    <!-- 响应状态栏 -->
    <div class="response-status" v-if="response || loading">
      <div v-if="loading" class="loading-indicator">
        <span class="loading-spinner"></span>
        <span>请求中...</span>
      </div>
      <template v-else-if="response">
        <div class="status-item">
          <span class="status-label">状态:</span>
          <span class="status-value" :class="statusClass">{{ response.status }} {{ response.statusText }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">时间:</span>
          <span class="status-value">{{ formatTime(response.time) }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">大小:</span>
          <span class="status-value">{{ formatSize(response.size) }}</span>
        </div>
      </template>
    </div>
    
    <!-- 响应标签页 -->
    <div class="response-tabs">
      <div 
        v-for="tab in tabs" 
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.name }}
      </div>
    </div>
    
    <!-- 响应内容 -->
    <div class="response-content">
      <!-- 空状态 -->
      <div v-if="!response && !loading" class="empty-state">
        <div class="empty-icon">📤</div>
        <p class="empty-text">发送请求以查看响应</p>
        <p class="empty-hint">在上方输入 URL 并点击"发送"按钮</p>
      </div>
      
      <!-- 加载状态 -->
      <div v-else-if="loading" class="loading-state">
        <div class="loading-spinner large"></div>
        <p>正在发送请求...</p>
      </div>
      
      <!-- 响应体 -->
      <div v-else-if="activeTab === 'body'" class="body-content">
        <div class="code-editor">
          <div class="line-numbers">{{ getLineNumbers }}</div>
          <pre class="code-area">{{ formattedBody }}</pre>
        </div>
      </div>
      
      <!-- 响应头 -->
      <div v-else-if="activeTab === 'headers'" class="headers-content">
        <div class="headers-list">
          <div 
            v-for="(value, key) in response?.headers" 
            :key="key"
            class="header-row"
          >
            <span class="header-key">{{ key }}</span>
            <span class="header-value">{{ value }}</span>
          </div>
        </div>
      </div>
      
      <!-- 其他标签页 -->
      <div v-else class="placeholder-content">
        <span class="placeholder-icon">📊</span>
        <p>{{ tabs.find(t => t.key === activeTab)?.name }}</p>
        <p class="placeholder-hint">此功能正在开发中...</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.response-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
  border-top: 1px solid #e8e8e8;
}

.response-status {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}

.loading-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1890ff;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #e6f7ff;
  border-top-color: #1890ff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-spinner.large {
  width: 32px;
  height: 32px;
  border-width: 3px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-label {
  font-size: 12px;
  color: #8c8c8c;
}

.status-value {
  font-size: 13px;
  font-weight: 500;
  color: #262626;
}

.status-value.success {
  color: #52c416;
}

.status-value.redirect {
  color: #1890ff;
}

.status-value.client-error {
  color: #fa8c16;
}

.status-value.server-error {
  color: #f5222d;
}

.response-tabs {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.tab-item {
  padding: 8px 16px;
  font-size: 13px;
  color: #595959;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.tab-item:hover {
  color: #1890ff;
}

.tab-item.active {
  color: #1890ff;
  border-bottom-color: #1890ff;
}

.response-content {
  flex: 1;
  overflow: auto;
}

.empty-state,
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8c8c8c;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #262626;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
}

.loading-state p {
  margin-top: 16px;
}

.body-content {
  height: 100%;
}

.code-editor {
  display: flex;
  height: 100%;
}

.line-numbers {
  width: 40px;
  padding: 12px 8px;
  background: #fafafa;
  border-right: 1px solid #e8e8e8;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #8c8c8c;
  text-align: right;
  user-select: none;
  overflow: hidden;
}

.code-area {
  flex: 1;
  margin: 0;
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  background: #ffffff;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.headers-content {
  padding: 16px;
}

.headers-list {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.header-row {
  display: flex;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.header-row:last-child {
  border-bottom: none;
}

.header-row:hover {
  background: #fafafa;
}

.header-key {
  width: 200px;
  font-weight: 500;
  color: #1890ff;
  font-size: 13px;
}

.header-value {
  flex: 1;
  font-size: 13px;
  color: #262626;
}

.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8c8c8c;
}

.placeholder-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.placeholder-hint {
  font-size: 12px;
  margin-top: 8px;
}
</style>