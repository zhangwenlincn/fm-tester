import { ref, onUnmounted } from 'vue'

export function useEnvPanelSetup(props, emit) {
  // 防抖定时器
  let saveTimer = null
  
  // 防抖保存（500ms 后触发）
  const handleInputChange = () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      emit('saveVariables')
    }, 500)
  }
  
  // 组件卸载时清理定时器并立即保存未完成的变更
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      emit('saveVariables') // 立即保存
    }
  })

  return {
    handleInputChange
  }
}