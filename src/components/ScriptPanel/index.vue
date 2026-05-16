<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps({
  request: Object
})

const emit = defineEmits(['update:request', 'save'])

const scriptType = ref('pre')
const editorContainer = ref(null)
let editor = null

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value || editor) return
  
  const value = scriptType.value === 'pre' 
    ? (props.request?.preScript || '') 
    : (props.request?.postScript || '')
  
  editor = monaco.editor.create(editorContainer.value, {
    value,
    language: 'javascript',
    theme: 'vs',
    fontSize: 13,
    fontFamily: 'Consolas, Monaco, monospace',
    lineNumbers: 'on',
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on'
  })
}

// 监听 request 变化，切换接口时更新编辑器内容
watch(() => props.request, (newRequest) => {
  if (editor && newRequest) {
    const newValue = scriptType.value === 'pre' 
      ? (newRequest.preScript || '') 
      : (newRequest.postScript || '')
    editor.setValue(newValue)
  }
}, { deep: true })

// 切换脚本类型时加载新内容
watch(scriptType, (newType) => {
  if (editor) {
    const newValue = newType === 'pre' 
      ? (props.request?.preScript || '') 
      : (props.request?.postScript || '')
    editor.setValue(newValue)
    editor.layout()
  }
})

// 保存脚本
const saveScript = () => {
  if (!editor) return
  const content = editor.getValue()
  emit('update:request', {
    ...props.request,
    [scriptType.value === 'pre' ? 'preScript' : 'postScript']: content
  })
  emit('save')
}

onMounted(() => {
  nextTick(() => {
    setTimeout(() => {
      // 确保容器有尺寸
      if (editorContainer.value && editorContainer.value.offsetHeight > 0) {
        initEditor()
      } else {
        // 如果没有尺寸，再等一下
        setTimeout(() => initEditor(), 200)
      }
    }, 50)
  })
})

onUnmounted(() => {
  editor?.dispose()
})
</script>

<template>
  <div class="script-panel">
    <div class="script-tabs">
      <div class="script-btn" :class="{ active: scriptType === 'pre' }" @click="scriptType = 'pre'">前置脚本</div>
      <div class="script-btn" :class="{ active: scriptType === 'post' }" @click="scriptType = 'post'">后置脚本</div>
    </div>
    
    <div class="editor-wrapper">
      <div class="editor-header">
        <button class="save-btn" @click="saveScript">保存</button>
      </div>
      <div ref="editorContainer" class="editor-container"></div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>