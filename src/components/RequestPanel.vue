<script setup>
import { ref, computed, watch } from 'vue'
import Icon from './Icon.vue'

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

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']
const activeTab = ref('params')

const localRequest = ref({
  method: 'GET',
  url: '',
  params: [],
  headers: [],
  body: '',
  bodyType: 'raw'
})

// 监听 props.request 变化，同步到 localRequest
watch(() => props.request, (newVal) => {
  if (newVal) {
    localRequest.value = {
      method: newVal.method || 'GET',
      url: newVal.url || '',
      params: newVal.params || [],
      headers: newVal.headers || [],
      body: newVal.body || '',
      bodyType: newVal.bodyType || 'raw'
    }
  }
}, { immediate: true, deep: true })

const tabs = [
  { key: 'docs', name: '文档' },
  { key: 'params', name: '参数' },
  { key: 'auth', name: '授权' },
  { key: 'headers', name: '请求头' },
  { key: 'body', name: '请求体' },
  { key: 'scripts', name: '脚本' },
  { key: 'settings', name: '设置' }
]

const bodyTypes = [
  { key: 'none', name: 'none' },
  { key: 'form-data', name: 'form-data' },
  { key: 'x-www-form-urlencoded', name: 'x-www-form-urlencoded' },
  { key: 'raw', name: 'raw' },
  { key: 'binary', name: 'binary' }
]

const rawTypes = ['JSON', 'Text', 'JavaScript', 'HTML', 'XML']

const selectedRawType = ref('JSON')

const methodClass = computed(() => localRequest.value.method.toLowerCase())

const updateMethod = (method) => {
  localRequest.value.method = method
  emit('update:request', localRequest.value)
}

const updateUrl = (event) => {
  localRequest.value.url = event.target.value
  emit('update:request', localRequest.value)
}

const updateBody = (event) => {
  localRequest.value.body = event.target.value
  emit('update:request', localRequest.value)
}

const sendRequest = () => {
  emit('send', localRequest.value)
}

const saveRequest = () => {
  emit('save', localRequest.value)
}

const addParam = () => {
  localRequest.value.params.push({ key: '', value: '', enabled: true })
}

const removeParam = (index) => {
  localRequest.value.params.splice(index, 1)
}

const addHeader = () => {
  localRequest.value.headers.push({ key: '', value: '', enabled: true })
}

const removeHeader = (index) => {
  localRequest.value.headers.splice(index, 1)
}

const formatJson = () => {
  try {
    const parsed = JSON.parse(localRequest.value.body)
    localRequest.value.body = JSON.stringify(parsed, null, 2)
  } catch (e) {
    // JSON 格式错误，不做处理
  }
}

const getLineNumbers = computed(() => {
  const lines = localRequest.value.body.split('\n')
  return lines.map((_, i) => i + 1).join('\n')
})
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

<style scoped>
.request-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #ffffff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #8c8c8c;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #bfbfbf;
}

.url-bar {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid #e8e8e8;
}

.method-selector {
  flex-shrink: 0;
}

.method-select {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
  outline: none;
  min-width: 90px;
}

.method-select.get {
  color: #52c416;
  background: #f6ffed;
  border-color: #b7eb8f;
}

.method-select.post {
  color: #fa8c16;
  background: #fff7e6;
  border-color: #ffd591;
}

.method-select.put {
  color: #1890ff;
  background: #e6f7ff;
  border-color: #91d5ff;
}

.method-select.delete {
  color: #f5222d;
  background: #fff1f0;
  border-color: #ffa39e;
}

.url-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: none;
}

.url-input:focus {
  border-color: #1890ff;
}

.send-btn {
  padding: 8px 24px;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  background: #1890ff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.send-btn:hover {
  background: #40a9ff;
}

.save-btn {
  padding: 8px 16px;
  font-size: 13px;
  color: #262626;
  background: #ffffff;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.save-btn:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.request-tabs {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafafa;
}

.tab-item {
  padding: 10px 16px;
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

.tab-content {
  flex: 1;
  overflow: auto;
}

.params-panel,
.headers-panel {
  padding: 16px;
}

.params-toolbar {
  margin-bottom: 12px;
}

.add-btn {
  padding: 6px 12px;
  font-size: 12px;
  color: #1890ff;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  cursor: pointer;
}

.add-btn:hover {
  background: #bae7ff;
}

.params-list {
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

.params-header {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  font-size: 12px;
  color: #8c8c8c;
}

.param-row {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.param-row:last-child {
  border-bottom: none;
}

.param-row:hover {
  background: #fafafa;
}

.col-check {
  width: 32px;
  flex-shrink: 0;
}

.col-key,
.col-value {
  flex: 1;
  min-width: 0;
}

.col-desc {
  flex: 1;
  min-width: 0;
}

.col-action {
  width: 32px;
  flex-shrink: 0;
}

.col-key input,
.col-value input,
.col-desc input {
  width: 100%;
  padding: 4px 8px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: none;
}

.col-key input:focus,
.col-value input:focus,
.col-desc input:focus {
  border-color: #1890ff;
}

.remove-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #8c8c8c;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.remove-btn:hover {
  background: #ff4d4f;
  color: #ffffff;
}

.empty-params {
  padding: 24px;
  text-align: center;
  color: #8c8c8c;
  font-size: 13px;
}

.body-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.body-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.body-type-selector {
  display: flex;
  gap: 16px;
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #262626;
  cursor: pointer;
}

.radio-label input {
  cursor: pointer;
}

.raw-type-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.raw-type-selector select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: none;
}

.format-btn {
  padding: 4px 12px;
  font-size: 12px;
  color: #1890ff;
  background: #e6f7ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  cursor: pointer;
}

.format-btn:hover {
  background: #bae7ff;
}

.code-editor {
  flex: 1;
  display: flex;
  overflow: hidden;
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
  padding: 12px;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.5;
  border: none;
  outline: none;
  resize: none;
  background: #ffffff;
}

.placeholder-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.placeholder-content {
  text-align: center;
  color: #8c8c8c;
}

.placeholder-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.placeholder-hint {
  font-size: 12px;
  margin-top: 8px;
}
</style>