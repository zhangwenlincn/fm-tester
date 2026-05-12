import { ref, watch } from 'vue'

export function useEnvPanelSetup(props, emit) {
  // 输入变化时触发保存
  const handleInputChange = () => {
    emit('saveVariables')
  }

  return {
    handleInputChange
  }
}