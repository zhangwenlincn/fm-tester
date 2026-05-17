import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'

export function useSettingsSetup(props, emit) {
  const { t } = useI18n()
  const timeout = ref(60)
  const gitUpdateInterval = ref(300)
  const loading = ref(false)
  
  // AI 设置
  const aiApiEndpoint = ref('https://api.openai.com/v1')
  const aiApiKey = ref('')
  const aiModel = ref('')
  const aiModels = ref([])
  const loadingModels = ref(false)

  // 加载设置
  const loadSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      timeout.value = settings.request_timeout
      gitUpdateInterval.value = settings.git_update_check_interval || 300
      // 加载 AI 设置
      if (settings.ai) {
        aiApiEndpoint.value = settings.ai.api_endpoint || 'https://api.openai.com/v1'
        aiApiKey.value = settings.ai.api_key || ''
        aiModel.value = settings.ai.model || ''
      }
    } catch (e) {
      console.error('Failed to load settings:', e)
    } finally {
      loading.value = false
    }
  }

  // 获取模型列表
  const fetchModels = async () => {
    if (!aiApiEndpoint.value || !aiApiKey.value) {
      return
    }
    
    try {
      loadingModels.value = true
      const models = await invoke('get_ai_models', {
        apiEndpoint: aiApiEndpoint.value,
        apiKey: aiApiKey.value
      })
      aiModels.value = models || []
    } catch (e) {
      console.error('Failed to fetch AI models:', e)
      aiModels.value = []
    } finally {
      loadingModels.value = false
    }
  }

  // 保存设置
  const saveSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('update_settings', { 
        timeout: timeout.value,
        gitUpdateCheckInterval: gitUpdateInterval.value,
        aiApiEndpoint: aiApiEndpoint.value,
        aiApiKey: aiApiKey.value,
        aiModel: aiModel.value
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
    aiApiEndpoint,
    aiApiKey,
    aiModel,
    aiModels,
    loadingModels,
    fetchModels,
    loading,
    saveSettings,
    close
  }
}