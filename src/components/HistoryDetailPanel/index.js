import { ref, computed } from 'vue'
import JSON5 from 'json5'

export function useHistoryDetailSetup(props) {
  // 请求标签页
  const requestTab = ref('params')
  // 响应标签页
  const responseTab = ref('body')
  // 响应体格式
  const responseFormat = ref('pretty')
  
  // 格式化响应体
  const formattedBody = computed(() => {
    if (!props.entry?.response_body) return ''
    
    try {
      const parsed = JSON5.parse(props.entry.response_body)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return props.entry.response_body
    }
  })
  
  // 格式化响应时间
  const formatResponseTime = (time) => {
    if (!time) return '0ms'
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(2)}s`
  }
  
  // 格式化响应大小
  const formatSize = (size) => {
    if (!size) return '0B'
    if (size < 1024) return `${size}B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}KB`
    return `${(size / 1024 / 1024).toFixed(1)}MB`
  }
  
  // 获取状态码样式类
  const getStatusClass = (status) => {
    if (!status) return ''
    const code = parseInt(status)
    if (code >= 200 && code < 300) return 'success'
    if (code >= 300 && code < 400) return 'redirect'
    if (code >= 400 && code < 500) return 'client-error'
    if (code >= 500) return 'server-error'
    return ''
  }
  
  // 获取方法样式类
  const getMethodClass = (method) => method?.toLowerCase() || ''
  
  // 格式化时间戳
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN')
  }
  
  return {
    requestTab,
    responseTab,
    responseFormat,
    formattedBody,
    formatResponseTime,
    formatSize,
    getStatusClass,
    getMethodClass,
    formatTime
  }
}