import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'

export function useAiSettingsSetup(props, emit) {
  const { t } = useI18n()
  const loading = ref(false)
  
  // AI 设置
  const aiApiEndpoint = ref('https://api.openai.com/v1')
  const aiApiKey = ref('')
  const aiModel = ref('')
  const aiModels = ref([])
  const loadingModels = ref(false)
  const showModelDropdown = ref(false)

  // 加载设置
  const loadSettings = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      // 加载 AI 设置
      if (settings.ai) {
        aiApiEndpoint.value = settings.ai.api_endpoint || 'https://api.openai.com/v1'
        aiApiKey.value = settings.ai.api_key || ''
        aiModel.value = settings.ai.model || ''
      }
    } catch (e) {
      console.error('Failed to load AI settings:', e)
    } finally {
      loading.value = false
    }
  }

  // 获取模型列表
  const fetchModels = async () => {
    if (!aiApiEndpoint.value || !aiApiKey.value) {
      return
    }
    
    closeModelDropdown()
    
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

  // 选择模型
  const selectModel = (model) => {
    aiModel.value = model
    showModelDropdown.value = false
  }

  // 切换下拉框
  const toggleModelDropdown = () => {
    showModelDropdown.value = !showModelDropdown.value
  }

  // 关闭下拉框
  const closeModelDropdown = () => {
    showModelDropdown.value = false
  }

  // 点击外部关闭下拉框
  const handleClickOutside = (event) => {
    const container = document.querySelector('.model-input-container')
    if (container && !container.contains(event.target)) {
      showModelDropdown.value = false
    }
  }

  // 保存设置
  const saveSettings = async () => {
    try {
      loading.value = true
      await invoke('update_settings', { 
        timeout: 60, // 保持默认值
        aiApiEndpoint: aiApiEndpoint.value,
        aiApiKey: aiApiKey.value,
        aiModel: aiModel.value
      })
      
      emit('saved')
      emit('close')
    } catch (e) {
      console.error('Failed to save AI settings:', e)
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
    document.addEventListener('click', handleClickOutside)
  })

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside)
  })

  return {
    t,
    aiApiEndpoint,
    aiApiKey,
    aiModel,
    aiModels,
    loadingModels,
    showModelDropdown,
    fetchModels,
    selectModel,
    toggleModelDropdown,
    closeModelDropdown,
    loading,
    saveSettings,
    close
  }
}