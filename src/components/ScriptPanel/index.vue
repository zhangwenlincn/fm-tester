<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

const props = defineProps({
  request: Object
})

const emit = defineEmits(['update:request'])

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
  
  editor.onDidChangeModelContent(() => {
    emit('update:request', {
      ...props.request,
      [scriptType.value === 'pre' ? 'preScript' : 'postScript']: editor.getValue()
    })
  })
}

// 切换脚本类型时保存当前内容并加载新内容
watch(scriptType, (newType, oldType) => {
  if (editor) {
    // 保存当前内容
    const currentValue = editor.getValue()
    emit('update:request', {
      ...props.request,
      [oldType === 'pre' ? 'preScript' : 'postScript']: currentValue
    })
    
    // 加载新内容
    const newValue = newType === 'pre' 
      ? (props.request?.preScript || '') 
      : (props.request?.postScript || '')
    editor.setValue(newValue)
    editor.layout()
  }
})

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
      <div ref="editorContainer" class="editor-container"></div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>