import { ref, computed, watch, onUnmounted, nextTick } from 'vue'
import * as monaco from 'monaco-editor'
import { formatJson, formatXml, formatHtml } from '../../utils/syntax-highlight.js'

// 注册 JSON5 语言
monaco.languages.register({ id: 'json5', extensions: ['.json5'], aliases: ['JSON5', 'json5'] })

// 定义 JSON5 Monarch tokenizer (语法高亮)
monaco.languages.setMonarchTokensProvider('json5', {
  tokenizer: {
    root: [
      // 单行注释
      [/\/\/.*$/, 'comment'],
      // 多行注释
      [/\/\*/, 'comment', '@comment'],
      // 单引号字符串
      [/'/, 'string', '@singleQuoteString'],
      // 双引号字符串
      [/"/, 'string', '@doubleQuoteString'],
      // 数字 (包括十六进制、小数)
      [/0[xX][0-9a-fA-F]+/, 'number.hex'],
      [/\d*\.\d+([eE][\-+]?\d+)?/, 'number.float'],
      [/\d+/, 'number'],
      // 标识符 (无引号的键名)
      [/[a-zA-Z_$][\w$]*/, 'identifier'],
      // 括号和分隔符
      [/[{}()\[\]]/, '@brackets'],
      [/:/, 'delimiter'],
      [/,/, 'delimiter'],
    ],
    comment: [
      [/\*\//, 'comment', '@pop'],
      [/[^*]+/, 'comment'],
      [/\*/, 'comment']
    ],
    singleQuoteString: [
      [/[^\\']+/,'string'],
      [/\\./, 'string.escape'],
      [/'/, 'string', '@pop']
    ],
    doubleQuoteString: [
      [/[^\\"]+/,'string'],
      [/\\./, 'string.escape'],
      [/"/, 'string', '@pop']
    ]
  }
})

// 设置 JSON5 语言配置
monaco.languages.setLanguageConfiguration('json5', {
  comments: {
    lineComment: '//',
    blockComment: ['/*', '*/']
  },
  brackets: [
    ['{', '}'],
    ['[', ']']
  ],
  autoClosingPairs: [
    { open: '{', close: '}', notIn: ['string', 'comment'] },
    { open: '[', close: ']', notIn: ['string', 'comment'] },
    { open: '"', close: '"', notIn: ['string', 'comment'] },
    { open: "'", close: "'", notIn: ['string', 'comment'] }
  ]
})

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
  'JSON': 'json5',  // 使用 json5 语言支持 JSON5 语法
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
    bodyType: 'raw',
    formData: [],
    formUrlEncoded: []
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
        bodyType: newVal.bodyType || 'raw',
        formData: newVal.formData || [],
        formUrlEncoded: newVal.formUrlEncoded || []
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

  // 监听 bodyType 变化，当切换到需要编辑器的类型时初始化
  watch(() => localRequest.value.bodyType, (newType) => {
    if (activeTab.value === 'body' && newType !== 'none' && newType !== 'binary') {
      setTimeout(() => {
        if (editorContainer.value && !monacoEditor) {
          initMonacoEditor()
        } else if (monacoEditor) {
          monacoEditor.layout()
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

  // URL 和参数同步的标记，防止循环更新
  let isUpdatingFromUrl = false
  let isUpdatingFromParams = false

  // 从 URL 解析查询参数
  const parseUrlParams = (url) => {
    if (!url) return []
    
    try {
      const urlObj = new URL(url)
      const params = []
      urlObj.searchParams.forEach((value, key) => {
        params.push({ key, value, enabled: true })
      })
      return params
    } catch {
      // URL 不完整时尝试手动解析
      const queryIndex = url.indexOf('?')
      if (queryIndex < 0) return []
      
      const queryStr = url.slice(queryIndex + 1)
      if (!queryStr) return []
      
      const params = []
      queryStr.split('&').forEach(pair => {
        const [key, value = ''] = pair.split('=')
        if (key) {
          params.push({ key: decodeURIComponent(key), value: decodeURIComponent(value), enabled: true })
        }
      })
      return params
    }
  }

  // 从 params 构建带参数的 URL
  const buildUrlWithParams = (baseUrl, params) => {
    if (!baseUrl) return ''
    
    const enabledParams = params.filter(p => p.enabled && p.key)
    if (enabledParams.length === 0) {
      // 移除 URL 中的查询参数
      const queryIndex = baseUrl.indexOf('?')
      return queryIndex < 0 ? baseUrl : baseUrl.slice(0, queryIndex)
    }
    
    const queryStr = enabledParams
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`)
      .join('&')
    
    // 移除原有查询参数
    const queryIndex = baseUrl.indexOf('?')
    const cleanUrl = queryIndex < 0 ? baseUrl : baseUrl.slice(0, queryIndex)
    
    return `${cleanUrl}?${queryStr}`
  }

  // 更新 URL（从输入框）
  const updateUrl = (eventOrValue) => {
    // 支持两种输入：event 对象或直接值
    const newUrl = typeof eventOrValue === 'string' 
      ? eventOrValue 
      : eventOrValue.target.value
    localRequest.value.url = newUrl
    
    // 从 URL 解析参数到 params
    if (!isUpdatingFromParams) {
      isUpdatingFromUrl = true
      localRequest.value.params = parseUrlParams(newUrl)
      isUpdatingFromUrl = false
    }
    
    emit('update:request', localRequest.value)
  }

  // 更新参数（从 params 列表）
  const updateParams = () => {
    if (!isUpdatingFromUrl) {
      isUpdatingFromParams = true
      localRequest.value.url = buildUrlWithParams(localRequest.value.url, localRequest.value.params)
      isUpdatingFromParams = false
    }
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
    updateParams()
  }

  const removeParam = (index) => {
    localRequest.value.params.splice(index, 1)
    updateParams()
  }

  // 监听 params 变化同步到 URL
  watch(() => localRequest.value.params, () => {
    if (!isUpdatingFromUrl) {
      updateParams()
    }
  }, { deep: true })

  const addHeader = () => {
    localRequest.value.headers.push({ key: '', value: '', enabled: true })
  }

  const removeHeader = (index) => {
    localRequest.value.headers.splice(index, 1)
  }

  // form-data 相关
  const addFormField = () => {
    localRequest.value.formData.push({ key: '', value: '', type: 'text', enabled: true })
    emit('update:request', localRequest.value)
  }

  const removeFormField = (index) => {
    localRequest.value.formData.splice(index, 1)
    emit('update:request', localRequest.value)
  }

  // x-www-form-urlencoded 相关
  const addFormUrlField = () => {
    localRequest.value.formUrlEncoded.push({ key: '', value: '', enabled: true })
    emit('update:request', localRequest.value)
  }

  const removeFormUrlField = (index) => {
    localRequest.value.formUrlEncoded.splice(index, 1)
    emit('update:request', localRequest.value)
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
    handleFormat,
    addFormField,
    removeFormField,
    addFormUrlField,
    removeFormUrlField
  }
}