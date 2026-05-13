import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'

// 语言映射 - Content-Type 到 Monaco 语言
const contentTypeToLanguage = {
  'application/json': 'json',
  'application/xml': 'xml',
  'text/xml': 'xml',
  'text/html': 'html',
  'application/xhtml+xml': 'html',
  'application/javascript': 'javascript',
  'text/javascript': 'javascript',
  'text/plain': 'plaintext',
  'text/css': 'css'
}

// 导出 composable 函数
export function useSavedResponseDetailSetup(props, emit) {
  const activeTab = ref('body')
  const editorContainer = ref(null)
  let monacoEditor = null

  // 状态码样式类
  const statusClass = computed(() => {
    if (!props.savedResponse?.response?.status) return ''
    const status = props.savedResponse.response.status
    if (status >= 200 && status < 300) return 'success'
    if (status >= 300 && status < 400) return 'redirect'
    if (status >= 400 && status < 500) return 'client-error'
    if (status >= 500) return 'server-error'
    return ''
  })

  // HTTP 方法样式类
  const getMethodClass = (method) => {
    if (!method) return ''
    const m = method.toLowerCase()
    return m
  }

  // 格式化时间
  const formatTime = (ms) => {
    if (!ms) return '0 ms'
    if (ms < 1000) return `${ms} ms`
    return `${(ms / 1000).toFixed(2)} s`
  }

  // 格式化大小
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

  // 格式化日期
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    try {
      const date = new Date(dateStr)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // 根据 Content-Type 检测语言
  const detectedLanguage = computed(() => {
    if (!props.savedResponse?.response?.headers) return 'plaintext'
    
    const contentType = props.savedResponse.response.headers['content-type'] || 
                        props.savedResponse.response.headers['Content-Type'] || ''
    
    // 遍历映射表查找匹配的语言
    for (const [pattern, lang] of Object.entries(contentTypeToLanguage)) {
      if (contentType.includes(pattern)) {
        return lang
      }
    }
    
    // 尝试自动检测
    if (props.savedResponse?.response?.body) {
      try {
        JSON.parse(props.savedResponse.response.body)
        return 'json'
      } catch {
        if (props.savedResponse.response.body.trim().startsWith('<')) {
          return 'html'
        }
      }
    }
    
    return 'plaintext'
  })

  // 格式化响应体
  const formattedBody = computed(() => {
    if (!props.savedResponse?.response?.body) return ''
    try {
      return JSON.stringify(JSON.parse(props.savedResponse.response.body), null, 2)
    } catch {
      return props.savedResponse.response.body
    }
  })

  // 初始化 Monaco Editor
  const initMonacoEditor = async () => {
    if (!editorContainer.value) return
    
    // 销毁旧实例
    if (monacoEditor) {
      monacoEditor.dispose()
      monacoEditor = null
    }
    
    await nextTick()
    
    // 创建编辑器
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: formattedBody.value || '',
      language: detectedLanguage.value,
      theme: 'vs',
      readOnly: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      lineNumbers: 'on',
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      automaticLayout: true,
      wordWrap: 'on',
      folding: true,
      renderLineHighlight: 'line'
    })
  }

  // 监听响应体变化
  watch(
    () => props.savedResponse?.response?.body,
    () => {
      if (monacoEditor && activeTab.value === 'body') {
        monacoEditor.setValue(formattedBody.value || '')
        monaco.editor.setModelLanguage(monacoEditor.getModel(), detectedLanguage.value)
      }
    }
  )

  // 监听标签页切换
  watch(activeTab, async (newTab) => {
    if (newTab === 'body') {
      await nextTick()
      if (!monacoEditor && editorContainer.value) {
        initMonacoEditor()
      } else if (monacoEditor) {
        monacoEditor.layout()
      }
    }
  })

  // 监听 savedResponse 变化
  watch(
    () => props.savedResponse,
    async () => {
      if (activeTab.value === 'body') {
        await nextTick()
        initMonacoEditor()
      }
    },
    { immediate: true }
  )

  // 组件卸载时清理
  onUnmounted(() => {
    if (monacoEditor) {
      monacoEditor.dispose()
      monacoEditor = null
    }
  })

  return {
    activeTab,
    statusClass,
    editorContainer,
    getMethodClass,
    formatTime,
    formatSize,
    formatDate,
    detectedLanguage,
    formattedBody
  }
}