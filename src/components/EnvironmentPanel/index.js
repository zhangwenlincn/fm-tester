import { ref, reactive, watch, onUnmounted } from 'vue'

export function useEnvPanelSetup(props, emit) {
  // 本地变量状态 - 使用 reactive 保持响应式
  const localVariables = reactive([])

  // 防抖保存定时器
  let saveTimer = null
  
  // 保存中状态
  const saving = ref(false)
  
  // 跳过下一次保存的标记（添加空项后使用）
  let skipNextSave = false
  
  // 初始化标记（避免初始化时触发保存）
  let initialized = false

  // 初始化数据 - 从 props 复制到本地状态
  const initVariables = () => {
    if (props.activeEnvironment?.variables && props.activeEnvironment.variables.length > 0) {
      localVariables.length = 0
      props.activeEnvironment.variables.forEach(v => {
        localVariables.push({
          key: v.key || '',
          value: v.value || '',
          enabled: v.enabled ?? true,
          description: v.description || ''
        })
      })
    } else {
      localVariables.length = 0
    }
  }

  // 监听 activeEnvironment 变化，重新初始化
  watch(() => props.activeEnvironment, () => {
    initialized = false
    initVariables()
    // 延迟标记为已初始化，避免初始化触发保存
    setTimeout(() => {
      initialized = true
    }, 100)
  }, { immediate: true })

  // 防抖保存（500ms 后保存）
  const debouncedSave = () => {
    if (!initialized) return
    if (skipNextSave) {
      skipNextSave = false
      return
    }
    if (saveTimer) {
      clearTimeout(saveTimer)
    }
    saveTimer = setTimeout(() => {
      saveVariables()
    }, 500)
  }

  // 监听变量变化 - deep: true 深度监听
  watch(
    () => localVariables,
    () => {
      debouncedSave()
    },
    { deep: true }
  )

  // 组件卸载时清理定时器并强制保存
  onUnmounted(() => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveVariables() // 立即保存未完成的变更
    }
  })

  // 添加变量
  const addVariable = () => {
    skipNextSave = true // 添加空项后跳过下一次保存触发
    localVariables.push({
      key: '',
      value: '',
      enabled: true,
      description: ''
    })
  }

  // 移除变量
  const removeVariable = (index) => {
    localVariables.splice(index, 1)
  }

  // 保存变量
  const saveVariables = async () => {
    if (saving.value) return // 防止重复保存
    
    // 检查是否有空项（key 为空），如果有则不保存
    const hasEmptyVariables = localVariables.some(v => !v.key.trim())
    
    if (hasEmptyVariables) {
      // 有空项时不保存，等用户填写后再保存
      return
    }
    
    saving.value = true
    try {
      // 过滤非空的变量
      const validVariables = localVariables
        .filter(v => v.key.trim())
        .map(v => ({
          key: v.key,
          value: v.value,
          enabled: v.enabled,
          description: v.description?.trim() || null
        }))
      
      emit('saveVariables', validVariables)
    } catch (e) {
      console.error('保存变量失败:', e)
    } finally {
      saving.value = false
    }
  }

  // 处理输入变化（兼容旧的接口）
  const handleInputChange = () => {
    debouncedSave()
  }

  return {
    localVariables,
    saving,
    addVariable,
    removeVariable,
    saveVariables,
    handleInputChange
  }
}