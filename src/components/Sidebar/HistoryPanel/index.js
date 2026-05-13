import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导出 composable 函数
export function useHistoryPanelSetup(props, emit) {
  // 历史日期列表
  const dates = ref([])
  // 日期展开状态
  const expandedDates = ref({})
  // 每个日期的历史记录
  const historyByDate = ref({})
  // 加载状态
  const loading = ref(false)

  // 加载历史日期列表
  const loadHistoryDates = async () => {
    if (!props.workspace?.path) return
    loading.value = true
    try {
      const dateList = await invoke('get_history_dates', { workspacePath: props.workspace.path })
      dates.value = dateList || []
      // 默认展开第一个日期
      if (dates.value.length > 0) {
        expandedDates.value[dates.value[0]] = true
        // 加载第一个日期的历史
        await loadHistoryByDate(dates.value[0])
      }
    } catch (e) {
      console.error('加载历史日期失败:', e)
      dates.value = []
    } finally {
      loading.value = false
    }
  }

  // 加载指定日期的历史记录
  const loadHistoryByDate = async (date) => {
    if (!props.workspace?.path) return
    try {
      const entries = await invoke('get_history_by_date', {
        workspacePath: props.workspace.path,
        date
      })
      historyByDate.value[date] = entries || []
    } catch (e) {
      console.error('加载历史记录失败:', e)
      historyByDate.value[date] = []
    }
  }

  // 切换日期展开状态
  const toggleDateExpand = async (date) => {
    expandedDates.value[date] = !expandedDates.value[date]
    // 展开时加载该日期的历史
    if (expandedDates.value[date] && !historyByDate.value[date]) {
      await loadHistoryByDate(date)
    }
  }

  // 判断日期是否展开
  const isDateExpanded = (date) => expandedDates.value[date]

  // 选择历史记录（发送请求）
  const selectHistory = (entry) => {
    emit('selectHistory', entry)
  }

  // 删除历史记录
  const deleteHistoryEntry = async (date, id) => {
    if (!props.workspace?.path) return
    try {
      await invoke('delete_history_entry', {
        workspacePath: props.workspace.path,
        date,
        id
      })
      // 刷新该日期的历史
      await loadHistoryByDate(date)
      // 如果该日期没有历史了，移除日期
      if (historyByDate.value[date]?.length === 0) {
        dates.value = dates.value.filter(d => d !== date)
        delete historyByDate.value[date]
        delete expandedDates.value[date]
      }
    } catch (e) {
      console.error('删除历史记录失败:', e)
    }
  }

  // 清空指定日期的历史
  const clearDateHistory = async (date) => {
    if (!props.workspace?.path) return
    try {
      await invoke('clear_history_by_date', {
        workspacePath: props.workspace.path,
        date
      })
      // 移除该日期
      dates.value = dates.value.filter(d => d !== date)
      delete historyByDate.value[date]
      delete expandedDates.value[date]
    } catch (e) {
      console.error('清空历史记录失败:', e)
    }
  }

  // 清空所有历史
  const clearAllHistory = async () => {
    if (!props.workspace?.path) return
    try {
      await invoke('clear_all_history', {
        workspacePath: props.workspace.path
      })
      dates.value = []
      historyByDate.value = {}
      expandedDates.value = {}
    } catch (e) {
      console.error('清空所有历史失败:', e)
    }
  }

  // 获取 HTTP 方法样式类
  const getMethodClass = (method) => method?.toLowerCase() || ''

  // 获取状态码样式类
  const getStatusClass = (status) => {
    if (!status) return ''
    const code = parseInt(status)
    if (code >= 200 && code < 300) return 'success'
    if (code >= 400 && code < 500) return 'warning'
    if (code >= 500) return 'error'
    return ''
  }

  // 格式化时间（显示时分秒）
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

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

  // 格式化日期显示
  const formatDateDisplay = (dateStr) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  // 监听工作区变化
  watch(() => props.workspace, async (ws) => {
    if (ws) {
      await loadHistoryDates()
    } else {
      dates.value = []
      historyByDate.value = {}
      expandedDates.value = {}
    }
  }, { immediate: true })

  return {
    dates,
    historyByDate,
    expandedDates,
    loading,
    loadHistoryDates,
    loadHistoryByDate,
    toggleDateExpand,
    isDateExpanded,
    selectHistory,
    deleteHistoryEntry,
    clearDateHistory,
    clearAllHistory,
    getMethodClass,
    getStatusClass,
    formatTime,
    formatResponseTime,
    formatSize,
    formatDateDisplay
  }
}