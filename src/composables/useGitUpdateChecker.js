import { ref, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import { showToast } from './useToast.js'

/**
 * Git 工作区更新检查 composable
 * 根据设置检查 Git 工作区是否有远程更新（间隔单位：秒）
 */
export function useGitUpdateChecker(currentWorkspace) {
  const { t } = useI18n()
  const isChecking = ref(false)
  const lastCheckTime = ref(null)
  const hasUpdate = ref(false)
  const checkIntervalSeconds = ref(300) // 默认 300 秒（5 分钟）
  let checkInterval = null
  let settingsUnlisten = null

  /**
   * 加载检查间隔设置
   */
  const loadSettings = async () => {
    try {
      const settings = await invoke('get_settings')
      const interval = settings.git_update_check_interval || 300
      checkIntervalSeconds.value = interval
      
      // 如果当前是 git 工作区，重启定时器
      if (currentWorkspace.value?.workspace_type === 'git') {
        restartChecker()
      }
    } catch (e) {
      console.error('加载 git 更新检查设置失败:', e)
    }
  }

  /**
   * 检查 git 工作区是否有更新
   */
  const checkForUpdates = async () => {
    // 检查当前工作区是否存在且是 git 类型
    if (!currentWorkspace.value) {
      return
    }

    if (currentWorkspace.value.workspace_type !== 'git') {
      return
    }

    // 检查间隔为 0 表示禁用
    if (checkIntervalSeconds.value === 0) {
      return
    }

    // 避免重复检查
    if (isChecking.value) {
      return
    }

    isChecking.value = true

    try {
      const hasRemoteUpdate = await invoke('check_git_updates', {
        workspaceId: currentWorkspace.value.id
      })

      lastCheckTime.value = new Date()

      if (hasRemoteUpdate) {
        hasUpdate.value = true
        showToast(t('toast.gitUpdateDetected'), 'warning', 5000)
      }
    } catch (error) {
      console.error('检查 git 更新失败:', error)
      // 不显示错误 toast，避免打扰用户
    } finally {
      isChecking.value = false
    }
  }

  /**
   * 重启定时检查（根据新设置）
   */
  const restartChecker = () => {
    // 清除之前的定时器
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }

    // 检查间隔为 0 表示禁用检查
    if (checkIntervalSeconds.value === 0) {
      return
    }

    // 立即执行一次检查
    checkForUpdates()

    // 设置定时检查（秒转换为毫秒）
    const intervalMs = checkIntervalSeconds.value * 1000
    checkInterval = setInterval(checkForUpdates, intervalMs)
  }

  /**
   * 启动定时检查
   */
  const startChecker = () => {
    restartChecker()
  }

  /**
   * 停止定时检查
   */
  const stopChecker = () => {
    if (checkInterval) {
      clearInterval(checkInterval)
      checkInterval = null
    }
  }

  // 监听检查间隔变化
  watch(checkIntervalSeconds, (newInterval, oldInterval) => {
    if (newInterval !== oldInterval && currentWorkspace.value?.workspace_type === 'git') {
      restartChecker()
    }
  })

  // 监听工作区变化
  watch(currentWorkspace, (newWorkspace, oldWorkspace) => {
    // 工作区 ID 变化时，重置状态并重新开始检查
    if (newWorkspace?.id !== oldWorkspace?.id) {
      hasUpdate.value = false
      lastCheckTime.value = null

      // 如果新工作区是 git 类型，启动检查
      if (newWorkspace?.workspace_type === 'git') {
        startChecker()
      } else {
        // 非 git 工作区，停止检查
        stopChecker()
      }
    }
  }, { immediate: true })

  // 组件挂载时启动
  onMounted(async () => {
    // 加载设置
    await loadSettings()
    
    // 监听设置更新事件
    settingsUnlisten = await listen('settings-updated', (event) => {
      const settings = event.payload
      if (settings.git_update_check_interval !== undefined) {
        checkIntervalSeconds.value = settings.git_update_check_interval
      }
    })

    if (currentWorkspace.value?.workspace_type === 'git' && checkIntervalSeconds.value > 0) {
      startChecker()
    }
  })

  // 组件卸载时清理
  onUnmounted(() => {
    stopChecker()
    if (settingsUnlisten) {
      settingsUnlisten()
    }
  })

  return {
    isChecking,
    lastCheckTime,
    hasUpdate,
    checkIntervalSeconds,
    checkForUpdates,
    startChecker,
    stopChecker,
    loadSettings
  }
}