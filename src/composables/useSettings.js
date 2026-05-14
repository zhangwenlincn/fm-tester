import { ref } from 'vue'

/**
 * 设置面板 composable
 */
export function useSettings() {
  const showSettingsPanel = ref(false)

  const openSettings = () => {
    showSettingsPanel.value = true
  }

  const closeSettings = () => {
    showSettingsPanel.value = false
  }

  return {
    showSettingsPanel,
    openSettings,
    closeSettings
  }
}