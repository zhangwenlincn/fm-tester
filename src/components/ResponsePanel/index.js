import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
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
export function useResponsePanelSetup(props, emit) {
  const { t } = useI18n()

  const tabs = computed(() => [
    { key: 'body', name: t('tabs.responseBody') },
    { key: 'headers', name: t('tabs.responseHeaders') },
    { key: 'test', name: t('tabs.testResults') },
    { key: 'network', name: t('tabs.networkLog') },
    { key: 'timeline', name: t('tabs.timeline') }
  ])

  const activeTab = ref('body')
  const editorContainer = ref(null)
  let monacoEditor = null

  // 保存响应
  const handleSaveResponse = () => {
    emit('save-response')
  }

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

  // 根据 Content-Type 检测语言
  const detectedLanguage = computed(() => {
    if (!props.response?.headers) return 'plaintext'
    
    const contentType = props.response.headers['content-type'] || 
                        props.response.headers['Content-Type'] || ''
    
    // 遍历映射表查找匹配的语言
    for (const [pattern, lang] of Object.entries(contentTypeToLanguage)) {
      if (contentType.includes(pattern)) {
        return lang
      }
    }
    
    // 尝试自动检测
    if (props.response?.body) {
      try {
        JSON.parse(props.response.body)
        return 'json'
      } catch {
        if (props.response.body.trim().startsWith('<')) {
          return 'html'
        }
      }
    }
    
    return 'plaintext'
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

  // 初始化 Monaco Editor
  const initMonacoEditor = () => {
    if (!editorContainer.value) return

    // 创建编辑器实例（只读模式）
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: formattedBody.value || '',
      language: detectedLanguage.value,
      theme: 'vs',
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      // 折叠配置
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      unfoldOnClickAfterEndOfLine: true,
      // 左侧区域配置（显示折叠图标）
      glyphMargin: true,
      // 只读配置
      readOnly: true,
      domReadOnly: true,
      renderWhitespace: 'selection',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      padding: { top: 12, bottom: 12 },
      bracketPairColorization: { enabled: true }
    })
  }

  // 更新编辑器内容和语言
  const updateEditorContent = () => {
    if (!monacoEditor) return
    
    const newValue = formattedBody.value || ''
    const currentValue = monacoEditor.getValue()
    
    // 只在内容变化时更新
    if (newValue !== currentValue) {
      monacoEditor.setValue(newValue)
    }
    
    // 更新语言
    const model = monacoEditor.getModel()
    if (model) {
      monaco.editor.setModelLanguage(model, detectedLanguage.value)
    }
  }

  // 监听响应变化，有响应时初始化或更新编辑器
  watch(() => props.response, (newResponse) => {
    if (newResponse && activeTab.value === 'body') {
      // 延迟确保容器可见且有尺寸
      setTimeout(() => {
        if (editorContainer.value) {
          if (!monacoEditor) {
            initMonacoEditor()
          } else {
            updateEditorContent()
            monacoEditor.layout()
          }
        }
      }, 50)
    }
  }, { deep: true })

  // 监听 activeTab 变化，切换到 body 时初始化/重新布局编辑器
  watch(activeTab, (newTab) => {
    if (newTab === 'body' && props.response) {
      setTimeout(() => {
        if (editorContainer.value) {
          if (!monacoEditor) {
            initMonacoEditor()
          } else if (monacoEditor) {
            monacoEditor.layout()
            updateEditorContent()
          }
        }
      }, 50)
    }
  })

  // 组件卸载时销毁编辑器
  onUnmounted(() => {
    if (monacoEditor) {
      monacoEditor.dispose()
      monacoEditor = null
    }
  })

  return {
    tabs,
    activeTab,
    statusClass,
    formattedBody,
    detectedLanguage,
    formatSize,
    formatTime,
    editorContainer,
    handleSaveResponse
  }
}