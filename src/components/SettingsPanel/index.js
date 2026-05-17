import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'

export function useSettingsSetup(props, emit) {
  const { t } = useI18n()
  const timeout = ref(60)
  const gitUpdateInterval = ref(300)
  const loading = ref(false)

  // 加载设置
  const loadSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      timeout.value = settings.request_timeout
      gitUpdateInterval.value = settings.git_update_check_interval || 300
    } catch (e) {
      console.error('Failed to load settings:', e)
    } finally {
      loading.value = false
    }
  }

  // 保存设置
  const saveSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('update_settings', { 
        timeout: timeout.value,
        gitUpdateCheckInterval: gitUpdateInterval.value
      })
      timeout.value = settings.request_timeout
      gitUpdateInterval.value = settings.git_update_check_interval
      
      emit('saved')
      emit('close')
    } catch (e) {
      console.error('Failed to save settings:', e)
    } finally {
      loading.value = false
    }
  }

  // 关闭面板
  const close = () => {
    emit('close')
  }

  onMounted(() => {
    loadSettings()
  })

  return {
    t,
    timeout,
    gitUpdateInterval,
    loading,
    saveSettings,
    close
  }
}