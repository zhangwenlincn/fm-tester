import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { formatJson, formatXml, formatHtml } from '../../utils/syntax-highlight.js'

const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

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

// 语言映射
const languageMap = {
  'JSON': 'json',
  'Text': 'plaintext',
  'JavaScript': 'javascript',
  'HTML': 'html',
  'XML': 'xml'
}

// 导出 composable 函数
export function useRequestPanelSetup(props, emit) {
  const activeTab = ref('params')

  const localRequest = ref({
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: '',
    bodyType: 'raw'
  })

  // Monaco Editor 相关
  const editorContainer = ref(null)
  let monacoEditor = null

  // 标记是否已初始化完成
  let isInitialized = false

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
      // 同步到 Monaco Editor（如果已初始化）
      if (monacoEditor) {
        const newBody = newVal.body || ''
        if (newBody !== monacoEditor.getValue()) {
          monacoEditor.setValue(newBody)
        }
      }
      // 第一次同步完成后标记已初始化
      if (!isInitialized) {
        isInitialized = true
      }
    }
  }, { immediate: true, deep: true })

  // Content-Type 映射
  const contentTypeMap = {
    'none': null,
    'form-data': 'multipart/form-data',
    'x-www-form-urlencoded': 'application/x-www-form-urlencoded',
    'binary': 'application/octet-stream',
    'raw': {
      'JSON': 'application/json',
      'Text': 'text/plain',
      'JavaScript': 'application/javascript',
      'HTML': 'text/html',
      'XML': 'application/xml'
    }
  }

  const selectedRawType = ref('JSON')

  const methodClass = computed(() => localRequest.value.method.toLowerCase())

  // 自动更新 Content-Type 请求头
  const updateContentTypeHeader = () => {
    if (!isInitialized) return
    
    const bodyType = localRequest.value.bodyType
    let contentType = null

    if (bodyType === 'raw') {
      contentType = contentTypeMap['raw'][selectedRawType.value]
    } else {
      contentType = contentTypeMap[bodyType]
    }

    if (!contentType) {
      // 移除 Content-Type
      localRequest.value.headers = localRequest.value.headers.filter(
        h => h.key.toLowerCase() !== 'content-type'
      )
    } else {
      // 查找是否已有 Content-Type
      const existingIndex = localRequest.value.headers.findIndex(
        h => h.key.toLowerCase() === 'content-type'
      )
      
      if (existingIndex >= 0) {
        // 更新现有值
        localRequest.value.headers[existingIndex].value = contentType
      } else {
        // 添加新的 Content-Type
        localRequest.value.headers.push({
          key: 'Content-Type',
          value: contentType,
          enabled: true
        })
      }
    }
    
    emit('update:request', localRequest.value)
  }

  // 监听 bodyType 变化
  watch(() => localRequest.value.bodyType, () => {
    updateContentTypeHeader()
  })

  // 监听 rawType 变化（当 bodyType 为 raw 时）
  watch(selectedRawType, () => {
    if (localRequest.value.bodyType === 'raw') {
      updateContentTypeHeader()
    }
  })

  // 初始化 Monaco Editor
  const initMonacoEditor = () => {
    if (!editorContainer.value) return

    // 创建编辑器实例
    monacoEditor = monaco.editor.create(editorContainer.value, {
      value: localRequest.value.body || '',
      language: languageMap[selectedRawType.value],
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
      glyphMargin: true,
      renderWhitespace: 'selection',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      padding: { top: 12, bottom: 12 }
    })

    // 监听内容变化
    monacoEditor.onDidChangeModelContent(() => {
      const value = monacoEditor.getValue()
      localRequest.value.body = value
      emit('update:request', localRequest.value)
    })
  }

  // 监听语言类型变化，更新 Monaco Editor 语言
  watch(selectedRawType, (newType) => {
    if (monacoEditor) {
      monaco.editor.setModelLanguage(monacoEditor.getModel(), languageMap[newType])
    }
  })

  // 监听 activeTab 变化，切换到 body 时初始化编辑器
  watch(activeTab, (newTab) => {
    if (newTab === 'body') {
      // 延迟确保容器可见后有尺寸
      setTimeout(() => {
        if (editorContainer.value) {
          if (!monacoEditor) {
            initMonacoEditor()
          } else {
            // 已存在，重新布局并同步内容
            monacoEditor.layout()
            const currentBody = localRequest.value.body || ''
            if (monacoEditor.getValue() !== currentBody) {
              monacoEditor.setValue(currentBody)
            }
          }
        }
      }, 50)
    }
  })

  // 组件卸载时销毁编辑器
  onUnmounted(() => {
    if (monacoEditor) {
      monacoEditor.dispose()
    }
  })

  const updateMethod = (method) => {
    localRequest.value.method = method
    emit('update:request', localRequest.value)
  }

  const updateUrl = (event) => {
    localRequest.value.url = event.target.value
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

  // 格式化按钮功能
  const handleFormat = () => {
    if (!monacoEditor) return
    
    const rawType = selectedRawType.value
    const body = monacoEditor.getValue()
    
    let formatted = body
    switch (rawType) {
      case 'JSON':
        formatted = formatJson(body)
        break
      case 'XML':
        formatted = formatXml(body)
        break
      case 'HTML':
        formatted = formatHtml(body)
        break
      default:
        // Text 和 JavaScript 不格式化
        return
    }
    
    monacoEditor.setValue(formatted)
    localRequest.value.body = formatted
    emit('update:request', localRequest.value)
  }

  return {
    methods,
    tabs,
    bodyTypes,
    rawTypes,
    activeTab,
    localRequest,
    selectedRawType,
    methodClass,
    editorContainer,
    updateMethod,
    updateUrl,
    sendRequest,
    saveRequest,
    addParam,
    removeParam,
    addHeader,
    removeHeader,
    handleFormat
  }
}