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
  const customHeaders = ref([])

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
        // 加载自定义请求头
        if (settings.ai.custom_headers && settings.ai.custom_headers.length > 0) {
          customHeaders.value = settings.ai.custom_headers.map(h => ({
            key: h.key || '',
            value: h.value || '',
            enabled: h.enabled ?? true,
            description: h.description || ''
          }))
        } else {
          customHeaders.value = []
        }
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
        apiKey: aiApiKey.value,
        customHeaders: getEnabledHeaders()
      })
      aiModels.value = models || []
    } catch (e) {
      console.error('Failed to fetch AI models:', e)
      aiModels.value = []
    } finally {
      loadingModels.value = false
    }
  }

  // 获取启用的请求头
  const getEnabledHeaders = () => {
    return customHeaders.value
      .filter(h => h.enabled && h.key.trim())
      .map(h => ({
        key: h.key,
        value: h.value,
        enabled: h.enabled,
        description: h.description?.trim() || null
      }))
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

  // 添加请求头
  const addHeader = () => {
    customHeaders.value.push({
      key: '',
      value: '',
      enabled: true,
      description: ''
    })
  }

  // 移除请求头
  const removeHeader = (index) => {
    customHeaders.value.splice(index, 1)
  }

  // 保存设置
  const saveSettings = async () => {
    try {
      loading.value = true
      await invoke('update_settings', { 
        timeout: 60, // 保持默认值
        aiApiEndpoint: aiApiEndpoint.value,
        aiApiKey: aiApiKey.value,
        aiModel: aiModel.value,
        aiCustomHeaders: customHeaders.value.filter(h => h.key.trim()).map(h => ({
          key: h.key,
          value: h.value,
          enabled: h.enabled,
          description: h.description?.trim() || null
        }))
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
    customHeaders,
    fetchModels,
    selectModel,
    toggleModelDropdown,
    closeModelDropdown,
    addHeader,
    removeHeader,
    loading,
    saveSettings,
    close
  }
}