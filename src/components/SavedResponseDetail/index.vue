<script setup>
import { useSavedResponseDetailSetup } from './index.js'
import Icon from '../Icon/index.vue'

const props = defineProps({
  savedResponse: {
    type: Object,
    default: () => null
  }
})

const emit = defineEmits(['close'])

const {
  activeTab,
  statusClass,
  editorContainer,
  getMethodClass,
  formatTime,
  formatSize,
  formatDate
} = useSavedResponseDetailSetup(props, emit)
</script>

<template>
  <div class="saved-response-detail">
    <!-- 头部 -->
    <div class="detail-header">
      <div class="header-info">
        <h3 class="response-name">{{ savedResponse?.name }}</h3>
        <span class="created-time">{{ formatDate(savedResponse?.created_at) }}</span>
      </div>
      <button class="close-btn" @click="emit('close')">
        <Icon name="close" :size="16" />
      </button>
    </div>

    <!-- 请求信息 -->
    <div class="request-section">
      <h4 class="section-title">请求信息</h4>
      
      <!-- 方法和 URL -->
      <div class="request-line">
        <span class="method" :class="getMethodClass(savedResponse?.request?.method)">
          {{ savedResponse?.request?.method }}
        </span>
        <span class="url">{{ savedResponse?.request?.resolved_url }}</span>
      </div>
      
      <!-- 原始 URL（如果有变量） -->
      <div v-if="savedResponse?.request?.url !== savedResponse?.request?.resolved_url" class="original-url">
        <span class="label">原始 URL:</span>
        <span class="value">{{ savedResponse?.request?.url }}</span>
      </div>

      <!-- 请求头 -->
      <div v-if="savedResponse?.request?.headers?.length" class="headers-list">
        <div class="list-title">请求头</div>
        <div class="header-row" v-for="h in savedResponse?.request?.headers" :key="h.key">
          <span class="header-key">{{ h.key }}</span>
          <span class="header-value">{{ h.value }}</span>
        </div>
      </div>

      <!-- 请求体 -->
      <div v-if="savedResponse?.request?.body" class="request-body">
        <div class="list-title">请求体</div>
        <pre class="body-content">{{ savedResponse?.request?.body }}</pre>
      </div>
    </div>

    <!-- 响应信息 -->
    <div class="response-section">
      <h4 class="section-title">响应信息</h4>
      
      <!-- 状态栏 -->
      <div class="response-status">
        <div class="status-item">
          <span class="status-label">状态:</span>
          <span class="status-value" :class="statusClass">
            {{ savedResponse?.response?.status }} {{ savedResponse?.response?.status_text }}
          </span>
        </div>
        <div class="status-item">
          <span class="status-label">时间:</span>
          <span class="status-value">{{ formatTime(savedResponse?.response?.time) }}</span>
        </div>
        <div class="status-item">
          <span class="status-label">大小:</span>
          <span class="status-value">{{ formatSize(savedResponse?.response?.size) }}</span>
        </div>
      </div>

      <!-- 标签页 -->
      <div class="response-tabs">
        <div 
          class="tab-item"
          :class="{ active: activeTab === 'body' }"
          @click="activeTab = 'body'"
        >
          响应体
        </div>
        <div 
          class="tab-item"
          :class="{ active: activeTab === 'headers' }"
          @click="activeTab = 'headers'"
        >
          响应头
        </div>
        <div 
          class="tab-item"
          :class="{ active: activeTab === 'cookies' }"
          @click="activeTab = 'cookies'"
        >
          Cookie
        </div>
      </div>

      <!-- 标签页内容 -->
      <div class="tab-content">
        <!-- 响应体 -->
        <div v-show="activeTab === 'body'" class="body-panel">
          <div ref="editorContainer" class="monaco-editor"></div>
        </div>

        <!-- 响应头 -->
        <div v-show="activeTab === 'headers'" class="headers-panel">
          <div v-if="savedResponse?.response?.headers" class="headers-list">
            <div 
              class="header-row" 
              v-for="(value, key) in savedResponse?.response?.headers" 
              :key="key"
            >
              <span class="header-key">{{ key }}</span>
              <span class="header-value">{{ value }}</span>
            </div>
          </div>
          <div v-else class="empty-content">无响应头</div>
        </div>

        <!-- Cookie -->
        <div v-show="activeTab === 'cookies'" class="cookies-panel">
          <div v-if="savedResponse?.cookies?.length" class="cookies-list">
            <div class="cookie-row" v-for="c in savedResponse?.cookies" :key="c.name">
              <div class="cookie-main">
                <span class="cookie-name">{{ c.name }}</span>
                <span class="cookie-value">{{ c.value }}</span>
              </div>
              <div class="cookie-meta">
                <span class="cookie-domain">{{ c.domain }}</span>
                <span class="cookie-path">路径: {{ c.path }}</span>
                <span v-if="c.secure" class="cookie-secure">安全</span>
                <span v-if="c.http_only" class="cookie-http-only">仅 HTTP</span>
              </div>
            </div>
          </div>
          <div v-else class="empty-content">无 Cookie</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style src="./style.css"></style>