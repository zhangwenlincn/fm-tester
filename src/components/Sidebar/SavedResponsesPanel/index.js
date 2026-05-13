import { ref, watch, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导出 composable 函数
export function useSavedResponsesPanelSetup(props, emit) {
  // 响应列表数据
  const responses = ref([])

  // 加载已保存响应列表
  const loadResponses = async () => {
    if (!props.workspace?.path) return
    try {
      const data = await invoke('get_saved_responses', {
        workspacePath: props.workspace.path
      })
      responses.value = data || []
      console.log('加载已保存响应:', data)
    } catch (e) {
      console.error('加载已保存响应失败:', e)
      responses.value = []
    }
  }

  // 选择响应条目
  const handleSelect = (item) => {
    emit('select', item)
  }

  // 删除响应条目
  const handleDelete = (item) => {
    emit('delete', item)
  }

  // 获取 HTTP 方法对应的颜色类
  const getMethodClass = (method) => {
    if (!method) return ''
    const methodLower = method.toLowerCase()
    return methodLower
  }

  // 监听工作区变化
  watch(
    () => props.workspace,
    (newWorkspace) => {
      if (newWorkspace?.path) {
        loadResponses()
      } else {
        responses.value = []
      }
    },
    { immediate: true }
  )

  // 组件挂载时加载数据
  onMounted(() => {
    if (props.workspace?.path) {
      loadResponses()
    }
  })

  return {
    responses,
    loadResponses,
    handleSelect,
    handleDelete,
    getMethodClass
  }
}