import { ref, computed, watch } from 'vue'

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

  return {
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
  }
}