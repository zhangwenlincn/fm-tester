import { ref, watch } from 'vue'

export function useSaveResponseDialogSetup(props, emit) {
  const name = ref('')

  // 监听 show 变化，重置名称
  watch(() => props.show, (show) => {
    if (show) {
      name.value = props.defaultName || ''
    }
  })

  // 保存
  const handleSave = () => {
    const saveName = name.value.trim() || props.defaultName || '未命名响应'
    emit('save', saveName)
  }

  // 取消
  const handleCancel = () => {
    emit('cancel')
  }

  return {
    name,
    handleSave,
    handleCancel
  }
}