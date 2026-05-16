import { ref, reactive, watch, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导出 composable 函数
export function useWorkspaceSettingsSetup(props, emit) {
  const activeTab = ref('scripts')
  
  // 本地设置状态
  const localSettings = reactive({
    name: props.workspace?.name || '',
    preScript: '',
    postScript: ''
  })
  
  // 防抖保存定时器
  let saveTimer = null
  
  // 保存中状态
  const saving = ref(false)
  
  // 初始化标记（避免初始化时触发保存）
  let initialized = false
  
  // 初始化数据
  const initSettings = () => {
    localSettings.name = props.workspace?.name || ''
    localSettings.preScript = props.workspace?.preScript || ''
    localSettings.postScript = props.workspace?.postScript || ''
  }
  
  // 监听 workspace 变化
  watch(() => props.workspace, () => {
    initialized = false
    initSettings()
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
  
  // 监听脚本变化
  watch(
    () => [localSettings.preScript, localSettings.postScript],
    () => {
      debouncedSave()
    }
  )
  
  // 组件卸载时清理定时器并强制保存
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveSettings()
    }
  })
  
  // 处理脚本更新
  const handleScriptUpdate = (updated) => {
    localSettings.preScript = updated.preScript || ''
    localSettings.postScript = updated.postScript || ''
  }
  
  // 保存设置
  const saveSettings = async () => {
    if (saving.value) return
    
    saving.value = true
    try {
      await invoke('update_workspace_settings', {
        workspacePath: props.workspacePath,
        preScript: localSettings.preScript || null,
        postScript: localSettings.postScript || null
      })
      
      emit('save')
    } catch (e) {
      console.error('保存工作区设置失败:', e)
    } finally {
      saving.value = false
    }
  }
  
  return {
    activeTab,
    localSettings,
    saving,
    handleScriptUpdate,
    saveSettings
  }
}