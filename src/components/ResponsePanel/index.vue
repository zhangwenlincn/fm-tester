<script setup>
import { useI18n } from 'vue-i18n'
import { useResponsePanelSetup } from './index.js'
import Icon from '../Icon/index.vue'

const { t } = useI18n()

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

const emit = defineEmits(['save-response'])

const {
  tabs,
  activeTab,
  statusClass,
  formattedBody,
  detectedLanguage,
  formatSize,
  formatTime,
  editorContainer,
  handleSaveResponse
} = useResponsePanelSetup(props, emit)
</script>

<template>
  <div class="response-panel">
    <!-- 响应状态栏 -->
    <div class="response-status" v-if="response || loading">
      <div v-if="loading" class="loading-indicator">
        <span class="loading-spinner"></span>
        <span>{{ t('response.requesting') }}</span>
      </div>
      <template v-else-if="response">
        <div class="status-info">
          <div class="status-item">
            <span class="status-label">{{ t('response.status') }}:</span>
            <span class="status-value" :class="statusClass">{{ response.status }} {{ response.statusText }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">{{ t('response.time') }}:</span>
            <span class="status-value">{{ formatTime(response.time) }}</span>
          </div>
          <div class="status-item">
            <span class="status-label">{{ t('response.size') }}:</span>
            <span class="status-value">{{ formatSize(response.size) }}</span>
          </div>
        </div>
        <button class="save-response-btn" @click="handleSaveResponse">
          <Icon name="save" :size="14" />
          <span>{{ t('buttons.saveResponse') }}</span>
        </button>
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
        <span class="empty-icon"><Icon name="send" :size="48" /></span>
        <p class="empty-text">{{ t('empty.noResponse') }}</p>
        <p class="empty-hint">{{ t('empty.noResponseHint') }}</p>
      </div>
      
      <!-- 加载状态 -->
      <div v-else-if="loading" class="loading-state">
        <div class="loading-spinner large"></div>
        <p>{{ t('response.sending') }}</p>
      </div>
      
      <!-- 响应体 - Monaco Editor (用 v-show 确保容器始终存在) -->
      <div v-show="response && !loading && activeTab === 'body'" class="body-content">
        <div ref="editorContainer" class="monaco-editor-container"></div>
      </div>
      
      <!-- 响应头 -->
      <div v-show="response && !loading && activeTab === 'headers'" class="headers-content">
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
      <div v-show="response && !loading && activeTab !== 'body' && activeTab !== 'headers'" class="placeholder-content">
        <span class="placeholder-icon"><Icon name="performance" :size="32" /></span>
        <p>{{ tabs.find(t => t.key === activeTab)?.name }}</p>
        <p class="placeholder-hint">{{ t('common.developing') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>