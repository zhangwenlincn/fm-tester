import { ref, reactive, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { showToast } from '../../composables/useToast.js'

// 导出 composable 函数
export function useWorkspaceSettingsSetup(props, emit) {
  // 本地设置状态
  const localSettings = reactive({
    name: props.workspace?.name || '',
    preScript: '',
    postScript: ''
  })
  
  // 工作区信息（包含 Git 相关信息）
  const workspaceInfo = computed(() => {
    const ws = props.workspace
    return {
      isGit: ws?.workspace_type === 'git',
      lastSyncAt: ws?.last_sync_at || null
    }
  })
  
  // 初始化数据
  const initSettings = async () => {
    localSettings.name = props.workspace?.name || ''
    
    // 从后端加载脚本
    if (props.workspacePath) {
      try {
        const preScript = await invoke('get_script', {
          workspacePath: props.workspacePath,
          targetType: 'workspace',
          targetId: null,
          scriptKind: 'pre'
        })
        const postScript = await invoke('get_script', {
          workspacePath: props.workspacePath,
          targetType: 'workspace',
          targetId: null,
          scriptKind: 'post'
        })
        localSettings.preScript = preScript || ''
        localSettings.postScript = postScript || ''
      } catch (e) {
        console.error('加载工作区脚本失败:', e)
        localSettings.preScript = ''
        localSettings.postScript = ''
      }
    }
  }
  
  // 监听 workspace 变化
  watch(() => props.workspace, () => {
    initSettings()
  }, { immediate: true })
  
  // 处理脚本更新
  const handleScriptUpdate = (updated) => {
    localSettings.preScript = updated.preScript || ''
    localSettings.postScript = updated.postScript || ''
  }
  
  // 保存设置
  const saveSettings = async () => {
    if (!props.workspacePath) return
    
    try {
      // 保存前置脚本
      await invoke('save_script', {
        workspacePath: props.workspacePath,
        targetType: 'workspace',
        targetId: null,
        scriptKind: 'pre',
        content: localSettings.preScript
      })
      
      // 保存后置脚本
      await invoke('save_script', {
        workspacePath: props.workspacePath,
        targetType: 'workspace',
        targetId: null,
        scriptKind: 'post',
        content: localSettings.postScript
      })
      
      showToast('脚本保存成功', 'success')
      emit('save')
    } catch (e) {
      console.error('保存工作区脚本失败:', e)
      showToast('脚本保存失败', 'error')
    }
  }
  
  return {
    localSettings,
    workspaceInfo,
    handleScriptUpdate,
    saveSettings
  }
}