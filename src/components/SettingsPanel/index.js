import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export function useSettingsSetup(props, emit) {
  const timeout = ref(60)
  const loading = ref(false)
  const saved = ref(false)

  // 加载设置
  const loadSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      timeout.value = settings.request_timeout
    } catch (e) {
      console.error('加载设置失败:', e)
    } finally {
      loading.value = false
    }
  }

  // 保存设置
  const saveSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('update_settings', { timeout: timeout.value })
      timeout.value = settings.request_timeout
      saved.value = true
      emit('saved')
      // 保存成功后自动关闭
      setTimeout(() => {
        emit('close')
      }, 100)
    } catch (e) {
      console.error('保存设置失败:', e)
      saved.value = false
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
    timeout,
    loading,
    saved,
    saveSettings,
    close
  }
}