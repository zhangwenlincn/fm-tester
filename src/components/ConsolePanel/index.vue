<script setup>
import { ref, watch, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps({
  visible: Boolean,
  logs: Array
})

const emit = defineEmits(['close', 'clear'])

// 面板高度
const panelHeight = ref(200)
const minHeight = 100
const maxHeight = 400
const isDragging = ref(false)

// 当前选中日志索引
const selectedIndex = ref(-1)

// Monaco Editor 引用
const editorContainer = ref(null)
let monacoEditor = null

// 拖拽逻辑
const startDrag = (e) => {
  isDragging.value = true
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  e.preventDefault()
}

const onDrag = (e) => {
  if (!isDragging.value) return
  const newHeight = panelHeight.value - e.movementY
  panelHeight.value = Math.min(maxHeight, Math.max(minHeight, newHeight))
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

// 解析消息
const parseMessage = (message) => {
  try {
    const parsed = JSON.parse(message)
    if (typeof parsed === 'object' && parsed !== null) {
      return { type: 'object', data: parsed }
    }
  } catch {}
  return { type: 'text', data: message }
}

// 深度解析 JSON（解析嵌套的 JSON 字符串）
const deepParseJson = (obj) => {
  if (obj === null || obj === undefined) return obj
  
  if (typeof obj === 'string') {
    // 尝试解析字符串为 JSON
    try {
      const parsed = JSON.parse(obj)
      if (typeof parsed === 'object') {
        return deepParseJson(parsed) // 递归解析
      }
    } catch {}
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => deepParseJson(item))
  }
  
  if (typeof obj === 'object') {
    const result = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepParseJson(value)
    }
    return result
  }
  
  return obj
}

// 获取摘要
const getSummary = (log) => {
  const parsed = parseMessage(log.message)
  if (parsed.type === 'object') {
    const data = parsed.data
    if (data.request) return `${data.request.method} ${data.request.url}`
    if (data.response) return `${data.response.status} ${data.response.statusText} (${data.response.time}ms)`
    if (data.error) return data.error
    return JSON.stringify(data)
  }
  return log.message.length > 50 ? log.message.substring(0, 50) + '...' : log.message
}

// 选择日志，显示详细内容
const selectLog = async (index) => {
  selectedIndex.value = index
  
  await nextTick()
  
  if (!editorContainer.value) return
  
  const log = props.logs[index]
  const parsed = parseMessage(log.message)
  
  let content = ''
  if (parsed.type === 'object') {
    // 深度解析嵌套的 JSON 字符串
    const deepParsed = deepParseJson(parsed.data)
    content = JSON.stringify(deepParsed, null, 2)
  } else {
    content = log.message
  }
  
  // 初始化或更新编辑器
  if (!monacoEditor) {
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: content,
      language: parsed.type === 'object' ? 'json' : 'plaintext',
      theme: 'vs',
      fontSize: 12,
      fontFamily: 'Consolas, Monaco, monospace',
      lineNumbers: 'off',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      glyphMargin: true,
      readOnly: true,
      domReadOnly: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 8,
        horizontalScrollbarSize: 8
      },
      padding: { top: 8, bottom: 8 }
    })
  } else {
    monacoEditor.setValue(content)
    const model = monacoEditor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, parsed.type === 'object' ? 'json' : 'plaintext')
    }
    monacoEditor.layout()
  }
}

// 监听可见性变化
watch(() => props.visible, (visible) => {
  if (!visible && monacoEditor) {
    monacoEditor.dispose()
    monacoEditor = null
  }
})

// 监听日志变化
watch(() => props.logs, () => {
  selectedIndex.value = -1
  if (monacoEditor) {
    monacoEditor.setValue('')
  }
})
</script>

<template>
  <div class="console-panel" v-if="visible" :style="{ height: panelHeight + 'px' }">
    <div class="resize-handle" :class="{ dragging: isDragging }" @mousedown="startDrag"></div>
    
    <div class="panel-header">
      <span class="header-title">控制台</span>
      <div class="header-actions">
        <button class="clear-btn" @click="$emit('clear')">清空</button>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>
    </div>
    
    <div class="panel-body">
      <!-- 左侧日志列表 -->
      <div class="log-list-panel">
        <div v-if="logs.length === 0" class="empty-state">
          <span>暂无日志</span>
        </div>
        <div v-else class="log-list">
          <div 
            class="log-item" 
            :class="{ selected: selectedIndex === index }"
            v-for="(log, index) in logs" 
            :key="index"
            @click="selectLog(index)"
          >
            <span class="log-time">{{ log.time }}</span>
            <span class="log-type" :class="log.type">{{ log.type.toUpperCase() }}</span>
            <span class="log-summary">{{ getSummary(log) }}</span>
          </div>
        </div>
      </div>
      
      <!-- 右侧详情面板 -->
      <div class="log-detail-panel" v-if="selectedIndex >= 0">
        <div class="detail-header">
          <span class="detail-title">详情</span>
        </div>
        <div class="detail-content">
          <div ref="editorContainer" class="monaco-editor-container"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>