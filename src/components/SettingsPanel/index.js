import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18nSetup } from '../../composables/useI18n'

export function useSettingsSetup(props, emit) {
  const { t, locale, supportedLocales, switchLanguage } = useI18nSetup()
  const timeout = ref(60)
  const selectedLanguage = ref('zh-CN')
  const loading = ref(false)
  const saved = ref(false)

  // 加载设置
  const loadSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      timeout.value = settings.request_timeout
      selectedLanguage.value = settings.language || 'zh-CN'
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
        language: selectedLanguage.value 
      })
      timeout.value = settings.request_timeout
      
      // 切换语言
      switchLanguage(selectedLanguage.value)
      
      saved.value = true
      emit('saved')
      // 保存成功后自动关闭
      setTimeout(() => {
        emit('close')
      }, 100)
    } catch (e) {
      console.error('Failed to save settings:', e)
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
    t,
    timeout,
    selectedLanguage,
    supportedLocales,
    loading,
    saved,
    saveSettings,
    close
  }
}