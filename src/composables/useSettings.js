import { ref } from 'vue'

/**
 * 设置面板 composable
 */
export function useSettings() {
  const showSettingsPanel = ref(false)
  const showAiSettingsPanel = ref(false)

  const openSettings = () => {
    showSettingsPanel.value = true
  }

  const closeSettings = () => {
    showSettingsPanel.value = false
  }

  const openAiSettings = () => {
    showAiSettingsPanel.value = true
  }

  const closeAiSettings = () => {
    showAiSettingsPanel.value = false
  }

  return {
    showSettingsPanel,
    openSettings,
    closeSettings,
    showAiSettingsPanel,
    openAiSettings,
    closeAiSettings
  }
}