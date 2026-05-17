import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { formatJson, formatXml, formatHtml } from '../../utils/syntax-highlight.js'
import { showToast } from '../../composables/useToast.js'

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
  const { t } = useI18n()
  
  const tabs = computed(() => [
    { key: 'docs', name: t('tabs.docs') },
    { key: 'params', name: t('tabs.params') },
    { key: 'auth', name: t('tabs.auth') },
    { key: 'headers', name: t('tabs.headers') },
    { key: 'body', name: t('tabs.body') },
    { key: 'scripts', name: t('tabs.scripts') }
  ])
  
  const bodyTypes = computed(() => [
    { key: 'none', name: t('bodyType.none') },
    { key: 'form-data', name: t('bodyType.formData') },
    { key: 'x-www-form-urlencoded', name: t('bodyType.formUrlencoded') },
    { key: 'raw', name: t('bodyType.raw') },
    { key: 'binary', name: t('bodyType.binary') }
  ])
  
  const activeTab = ref(props.requestTab || 'params')
  
  // 监听 props.requestTab 变化
  watch(() => props.requestTab, (newVal) => {
    if (newVal && newVal !== activeTab.value) {
      activeTab.value = newVal
    }
  })
  
  // 监听 activeTab 变化，emit 更新事件
  watch(activeTab, (newVal) => {
    emit('updateTab', newVal)
  })

const localRequest = ref({
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: '',
    bodyType: 'raw',
    formData: [],
    formUrlEncoded: [],
    binaryFile: null,  // binary 文件信息 { path, name }
    timeout: null,  // 请求超时时间（秒）
    preScript: '',  // 前置脚本
    postScript: ''  // 后置脚本
  })
  
  // 加载 API 脚本
  const loadApiScripts = async () => {
    if (!props.workspacePath || !props.apiId) return
    try {
      const preScript = await invoke('get_script', {
        workspacePath: props.workspacePath,
        targetType: 'api',
        targetId: props.apiId,
        scriptKind: 'pre'
      })
      const postScript = await invoke('get_script', {
        workspacePath: props.workspacePath,
        targetType: 'api',
        targetId: props.apiId,
        scriptKind: 'post'
      })
      localRequest.value.preScript = preScript || ''
      localRequest.value.postScript = postScript || ''
    } catch (e) {
      console.error('加载 API 脚本失败:', e)
    }
  }
  
  // 监听 apiId 变化，加载脚本
  watch(() => props.apiId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      loadApiScripts()
    }
  }, { immediate: true })

  // Monaco Editor 相关
  const editorContainer = ref(null)
  let monacoEditor = null

  // 标记是否已初始化完成
  let isInitialized = false
  
  // 标记是否正在本地更新（防止 watch 循环触发）
  let isLocalUpdate = false

  // 监听 props.request 变化，同步到 localRequest
  watch(() => props.request, (newVal) => {
    // 如果是本地触发的更新，跳过同步
    if (isLocalUpdate) {
      isLocalUpdate = false
      return
    }
    if (newVal) {
      // 使用 Object.assign 更新，保持响应式追踪
      Object.assign(localRequest.value, {
        method: newVal.method || 'GET',
        url: newVal.url || '',
        params: newVal.params || [],
        headers: newVal.headers || [],
        body: newVal.body || '',
        bodyType: newVal.bodyType || 'raw',
        formData: newVal.formData || [],
        formUrlEncoded: newVal.formUrlEncoded || [],
        binaryFile: newVal.binaryFile || null,
        timeout: newVal.timeout || null,
        preScript: newVal.preScript || '',
        postScript: newVal.postScript || ''
      })
      // 确保 formData 字段有 files 属性
      localRequest.value.formData = localRequest.value.formData.map(field => ({
        ...field,
        files: field.files || []
      }))
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
    
    isLocalUpdate = true
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
      isLocalUpdate = true
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
  }, { immediate: true })

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

  // 组件挂载后初始化编辑器（如果当前是 body tab）
  onMounted(() => {
    if (activeTab.value === 'body' && !monacoEditor) {
      nextTick(() => {
        // 使用多次 nextTick 确保 DOM 完全渲染
        nextTick(() => {
          if (editorContainer.value) {
            initMonacoEditor()
          }
        })
      })
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
    isLocalUpdate = true
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
    
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }

  // 更新参数（从 params 列表）
  const updateParams = () => {
    if (!isUpdatingFromUrl) {
      isUpdatingFromParams = true
      localRequest.value.url = buildUrlWithParams(localRequest.value.url, localRequest.value.params)
      isUpdatingFromParams = false
    }
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }

  const sendRequest = () => {
    // 如果请求体不为空，切换到 body tab
    if (localRequest.value.bodyType !== 'none' && activeTab.value !== 'body') {
      activeTab.value = 'body'
    }
    emit('send', localRequest.value)
  }

  const saveRequest = () => {
    emit('save', localRequest.value)
  }

  const addParam = () => {
    if (!localRequest.value.params) {
      localRequest.value.params = []
    }
    localRequest.value.params.push({ key: '', value: '', enabled: true })
    updateParams()
  }

  const removeParam = (index) => {
    if (Array.isArray(localRequest.value.params)) {
      localRequest.value.params.splice(index, 1)
      updateParams()
    }
  }

  // 监听 params 变化同步到 URL
  watch(() => localRequest.value.params, () => {
    if (!isUpdatingFromUrl) {
      updateParams()
    }
  }, { deep: true })

  const addHeader = () => {
    if (!localRequest.value.headers) {
      localRequest.value.headers = []
    }
    localRequest.value.headers.push({ key: '', value: '', enabled: true })
  }

  const removeHeader = (index) => {
    if (Array.isArray(localRequest.value.headers)) {
      localRequest.value.headers.splice(index, 1)
    }
  }

  // form-data 相关
  const addFormField = () => {
    if (!localRequest.value.formData) {
      localRequest.value.formData = []
    }
    localRequest.value.formData.push({ key: '', value: '', type: 'text', enabled: true, files: [] })
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }

  const removeFormField = (index) => {
    if (Array.isArray(localRequest.value.formData)) {
      localRequest.value.formData.splice(index, 1)
      isLocalUpdate = true
      emit('update:request', localRequest.value)
    }
  }

  // x-www-form-urlencoded 相关
  const addFormUrlField = () => {
    console.log('addFormUrlField called, current:', localRequest.value.formUrlEncoded)
    // 确保 formUrlEncoded 是数组
    if (!localRequest.value.formUrlEncoded) {
      localRequest.value.formUrlEncoded = []
    }
    localRequest.value.formUrlEncoded.push({ key: '', value: '', enabled: true })
    console.log('after add:', localRequest.value.formUrlEncoded)
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }

  const removeFormUrlField = (index) => {
    if (Array.isArray(localRequest.value.formUrlEncoded)) {
      localRequest.value.formUrlEncoded.splice(index, 1)
      isLocalUpdate = true
      emit('update:request', localRequest.value)
    }
  }

  // 文件选择相关
  const selectBinaryFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        title: t('toast.selectBinary')
      })
      if (selected) {
        // selected 是文件路径字符串
        const path = selected
        const name = path.split(/[/\\]/).pop() || path
        localRequest.value.binaryFile = { path, name }
        isLocalUpdate = true
        emit('update:request', localRequest.value)
      }
    } catch (e) {
      console.error('选择文件失败:', e)
    }
  }

  const selectFormFieldFiles = async (fieldIndex) => {
    try {
      const selected = await open({
        multiple: true,  // 支持多文件
        title: t('buttons.selectFile')
      })
      if (selected) {
        // selected 可能是字符串或数组
        const paths = Array.isArray(selected) ? selected : [selected]
        const files = paths.map(path => ({
          path,
          name: path.split(/[/\\]/).pop() || path
        }))
        
        // 确保 formData[fieldIndex] 有 files 属性
        if (!localRequest.value.formData[fieldIndex].files) {
          localRequest.value.formData[fieldIndex].files = []
        }
        
        // 添加文件（保留原有文件）
        localRequest.value.formData[fieldIndex].files.push(...files)
        isLocalUpdate = true
        emit('update:request', localRequest.value)
      }
    } catch (e) {
      console.error('选择文件失败:', e)
    }
  }

  const removeFormFieldFile = (fieldIndex, fileIndex) => {
    if (localRequest.value.formData[fieldIndex]?.files) {
      localRequest.value.formData[fieldIndex].files.splice(fileIndex, 1)
      isLocalUpdate = true
      emit('update:request', localRequest.value)
    }
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
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }

  // 更新超时时间
  const updateTimeout = (value) => {
    const numValue = parseInt(value, 10)
    if (numValue > 0) {
      localRequest.value.timeout = numValue
    } else {
      localRequest.value.timeout = null
    }
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }
  
  // 处理脚本更新
  const handleScriptUpdate = (updatedRequest) => {
    localRequest.value.preScript = updatedRequest.preScript || ''
    localRequest.value.postScript = updatedRequest.postScript || ''
    isLocalUpdate = true
    emit('update:request', localRequest.value)
  }
  
  // 保存脚本到后端
  const saveScripts = async () => {
    if (!props.workspacePath || !props.apiId) return
    try {
      await invoke('save_script', {
        workspacePath: props.workspacePath,
        targetType: 'api',
        targetId: props.apiId,
        scriptKind: 'pre',
        content: localRequest.value.preScript
      })
      await invoke('save_script', {
        workspacePath: props.workspacePath,
        targetType: 'api',
        targetId: props.apiId,
        scriptKind: 'post',
        content: localRequest.value.postScript
      })
      showToast(t('toast.scriptSaved'), 'success')
    } catch (e) {
      console.error('保存 API 脚本失败:', e)
      showToast(t('toast.scriptSaveFailed'), 'error')
    }
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
    removeFormUrlField,
    selectBinaryFile,
    selectFormFieldFiles,
    removeFormFieldFile,
    updateTimeout,
    handleScriptUpdate,
    saveScripts
  }
}