<script setup>
import { useRequestPanelSetup } from './index.js'
import Icon from '../Icon/index.vue'

const props = defineProps({
  request: {
    type: Object,
    default: () => ({})
  },
  hasActiveTab: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:request', 'send', 'save'])

const {
  methods,
  tabs,
  bodyTypes,
  rawTypes,
  activeTab,
  localRequest,
  selectedRawType,
  methodClass,
  updateMethod,
  updateUrl,
  updateBody,
  sendRequest,
  saveRequest,
  addParam,
  removeParam,
  addHeader,
  removeHeader,
  formatJson,
  getLineNumbers
} = useRequestPanelSetup(props, emit)
</script>

<template>
  <div class="request-panel">
    <!-- 空状态 -->
    <div v-if="!hasActiveTab" class="empty-state">
      <span class="empty-icon"><Icon name="api" :size="48" /></span>
      <p class="empty-text">请选择一个接口</p>
      <p class="empty-hint">从左侧集合中选择接口开始测试</p>
    </div>
    
    <!-- 有内容时显示 -->
    <template v-else>
      <!-- URL 输入行 -->
      <div class="url-bar">
        <div class="method-selector">
          <select :value="localRequest.method" @change="updateMethod($event.target.value)" class="method-select" :class="methodClass">
            <option v-for="m in methods" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <input 
          type="text" 
          :value="localRequest.url"
          @input="updateUrl"
          class="url-input"
          placeholder="输入请求 URL"
        />
        <button class="send-btn" @click="sendRequest">发送</button>
        <button class="save-btn" @click="saveRequest">保存</button>
      </div>
    
    <!-- 请求配置标签页 -->
    <div class="request-tabs">
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
    
    <!-- 标签页内容 -->
    <div class="tab-content">
      <!-- 参数 -->
      <div v-if="activeTab === 'params'" class="params-panel">
        <div class="params-toolbar">
          <button class="add-btn" @click="addParam">+ 添加参数</button>
        </div>
        <div class="params-list">
          <div class="params-header">
            <span class="col-check"></span>
            <span class="col-key">参数名</span>
            <span class="col-value">参数值</span>
            <span class="col-desc">描述</span>
            <span class="col-action"></span>
          </div>
          <div v-if="localRequest.params.length === 0" class="empty-params">
            暂无参数，点击上方按钮添加
          </div>
          <div 
            v-for="(param, index) in localRequest.params" 
            :key="index"
            class="param-row"
          >
            <span class="col-check">
              <input type="checkbox" v-model="param.enabled" />
            </span>
            <span class="col-key">
              <input type="text" v-model="param.key" placeholder="参数名" />
            </span>
            <span class="col-value">
              <input type="text" v-model="param.value" placeholder="参数值" />
            </span>
            <span class="col-desc">
              <input type="text" v-model="param.description" placeholder="描述" />
            </span>
            <span class="col-action">
              <button class="remove-btn" @click="removeParam(index)">×</button>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 请求头 -->
      <div v-else-if="activeTab === 'headers'" class="headers-panel">
        <div class="params-toolbar">
          <button class="add-btn" @click="addHeader">+ 添加请求头</button>
        </div>
        <div class="params-list">
          <div class="params-header">
            <span class="col-check"></span>
            <span class="col-key">Header 名</span>
            <span class="col-value">Header 值</span>
            <span class="col-desc">描述</span>
            <span class="col-action"></span>
          </div>
          <div 
            v-for="(header, index) in localRequest.headers" 
            :key="index"
            class="param-row"
          >
            <span class="col-check">
              <input type="checkbox" v-model="header.enabled" />
            </span>
            <span class="col-key">
              <input type="text" v-model="header.key" placeholder="Header 名" />
            </span>
            <span class="col-value">
              <input type="text" v-model="header.value" placeholder="Header 值" />
            </span>
            <span class="col-desc">
              <input type="text" v-model="header.description" placeholder="描述" />
            </span>
            <span class="col-action">
              <button class="remove-btn" @click="removeHeader(index)">×</button>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 请求体 -->
      <div v-else-if="activeTab === 'body'" class="body-panel">
        <div class="body-toolbar">
          <div class="body-type-selector">
            <label v-for="type in bodyTypes" :key="type.key" class="radio-label">
              <input 
                type="radio" 
                :value="type.key" 
                v-model="localRequest.bodyType"
              />
              {{ type.name }}
            </label>
          </div>
          <div v-if="localRequest.bodyType === 'raw'" class="raw-type-selector">
            <select v-model="selectedRawType">
              <option v-for="t in rawTypes" :key="t" :value="t">{{ t }}</option>
            </select>
            <button class="format-btn" @click="formatJson">格式化</button>
          </div>
        </div>
        <div class="code-editor">
          <div class="line-numbers">{{ getLineNumbers }}</div>
          <textarea 
            v-model="localRequest.body"
            @input="updateBody"
            class="code-area"
            placeholder="输入请求体内容..."
            spellcheck="false"
          ></textarea>
        </div>
      </div>
      
      <!-- 其他标签页 -->
      <div v-else class="placeholder-panel">
        <div class="placeholder-content">
          <span class="placeholder-icon">📝</span>
          <p>{{ tabs.find(t => t.key === activeTab)?.name }}配置</p>
          <p class="placeholder-hint">此功能正在开发中...</p>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<style scoped src="./style.css"></style>