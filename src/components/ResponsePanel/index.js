import { ref, computed } from 'vue'

const tabs = [
  { key: 'body', name: '响应体' },
  { key: 'headers', name: '响应头' },
  { key: 'test', name: '测试结果' },
  { key: 'network', name: '网络日志' },
  { key: 'timeline', name: '时间线' }
]

// 导出 composable 函数
export function useResponsePanelSetup(props) {
  const activeTab = ref('body')

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

  const getLineNumbers = computed(() => {
    if (!formattedBody.value) return ''
    const lines = formattedBody.value.split('\n')
    return lines.map((_, i) => i + 1).join('\n')
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

  return {
    tabs,
    activeTab,
    statusClass,
    formattedBody,
    getLineNumbers,
    formatSize,
    formatTime
  }
}