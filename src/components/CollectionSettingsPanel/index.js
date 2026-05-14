import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const tabs = [
  { key: 'headers', name: '请求头' },
  { key: 'variables', name: '变量' },
  { key: 'scripts', name: '脚本' },
  { key: 'settings', name: '设置' }
]

// 导出 composable 函数
export function useCollectionSettingsSetup(props, emit) {
  const activeTab = ref('headers')
  
  // 本地设置状态
  const localSettings = reactive({
    name: props.collection?.name || '',
    commonHeaders: [],
    collectionVariables: []
  })
  
  // 防抖保存定时器
  let saveTimer = null
  
  // 保存中状态
  const saving = ref(false)
  
  // 初始化数据
  const initSettings = () => {
    localSettings.name = props.collection?.name || ''
    
    // 通用请求头
    if (props.collection?.common_headers && props.collection.common_headers.length > 0) {
      localSettings.commonHeaders = props.collection.common_headers.map(h => ({
        key: h.key || '',
        value: h.value || '',
        enabled: h.enabled ?? true,
        description: h.description || ''
      }))
    } else {
      localSettings.commonHeaders = []
    }
    
    // 集合变量
    if (props.collection?.collection_variables && props.collection.collection_variables.length > 0) {
      localSettings.collectionVariables = props.collection.collection_variables.map(v => ({
        key: v.key || '',
        value: v.value || '',
        enabled: v.enabled ?? true,
        description: v.description || ''
      }))
    } else {
      localSettings.collectionVariables = []
    }
  }
  
  // 初始化标记（避免初始化时触发保存）
  let initialized = false
  
  // 监听 collection 变化
  watch(() => props.collection, () => {
    initialized = false
    initSettings()
    // 延迟标记为已初始化，避免初始化触发保存
    setTimeout(() => {
      initialized = true
    }, 100)
  }, { immediate: true })
  
  // 防抖保存（500ms 后保存）
  const debouncedSave = () => {
    if (!initialized) return
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveSettings()
    }, 500)
  }
  
  // 监听请求头变化
  watch(
    () => localSettings.commonHeaders,
    () => {
      debouncedSave()
    },
    { deep: true }
  )
  
  // 监听变量变化
  watch(
    () => localSettings.collectionVariables,
    () => {
      debouncedSave()
    },
    { deep: true }
  )
  
  // 组件卸载时清理定时器并强制保存
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveSettings() // 立即保存未完成的变更
    }
  })
  
  // 添加请求头
  const addHeader = () => {
    localSettings.commonHeaders.push({
      key: '',
      value: '',
      enabled: true,
      description: ''
    })
  }
  
  // 移除请求头
  const removeHeader = (index) => {
    localSettings.commonHeaders.splice(index, 1)
  }
  
  // 添加变量
  const addVariable = () => {
    localSettings.collectionVariables.push({
      key: '',
      value: '',
      enabled: true,
      description: ''
    })
  }
  
  // 移除变量
  const removeVariable = (index) => {
    localSettings.collectionVariables.splice(index, 1)
  }
  
  // 保存设置
  const saveSettings = async () => {
    if (saving.value) return // 防止重复保存
    saving.value = true
    try {
      // 过滤非空的请求头
      const validHeaders = localSettings.commonHeaders
        .filter(h => h.key.trim())
        .map(h => ({
          key: h.key,
          value: h.value,
          enabled: h.enabled,
          description: h.description?.trim() || null
        }))
      
      // 过滤非空的变量
      const validVariables = localSettings.collectionVariables
        .filter(v => v.key.trim())
        .map(v => ({
          key: v.key,
          value: v.value,
          enabled: v.enabled,
          description: v.description?.trim() || null
        }))
      
      await invoke('update_collection_settings', {
        workspacePath: props.workspacePath,
        id: props.collection.id,
        commonHeaders: validHeaders.length > 0 ? validHeaders : null,
        collectionVariables: validVariables.length > 0 ? validVariables : null
      })
      
      emit('save')
    } catch (e) {
      console.error('保存集合设置失败:', e)
    } finally {
      saving.value = false
    }
  }
  
  return {
    activeTab,
    tabs,
    localSettings,
    saving,
    addHeader,
    removeHeader,
    addVariable,
    removeVariable,
    saveSettings
  }
}