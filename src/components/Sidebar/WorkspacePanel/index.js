import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导出 composable 函数
export function useWorkspacePanelSetup(props, emit) {
  // 工作区列表
  const workspaces = ref([])
  const currentWorkspace = ref(null)
  
  // 工作区右键菜单
  const wsContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    ws: null
  })
  
  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      workspaces.value = await invoke('get_workspaces') || []
    } catch (e) {
      console.error('加载工作区失败:', e)
      workspaces.value = []
    }
  }
  
  // 启动时自动加载
  onMounted(async () => {
    await loadWorkspaces()
  })
  
  // 选择工作区（仅选中效果）
  const selectWorkspace = (workspace) => {
    currentWorkspace.value = workspace
    emit('selectWorkspace', workspace)
  }
  
  // 新建工作区
  const createWorkspace = () => {
    emit('createWorkspace')
  }
  
  // 删除工作区
  const deleteWorkspace = async (ws) => {
    try {
      await invoke('delete_workspace', { id: ws.id })
      await loadWorkspaces()
      // 通知父组件（传递被删除的工作区 id，让 App 判断是否需要清空）
      emit('workspaceDeleted', ws.id)
    } catch (e) {
      console.error('删除工作区失败:', e)
    }
  }
  
  // 打开工作区右键菜单
  const openWsContextMenu = (event, ws) => {
    event.preventDefault()
    event.stopPropagation()
    
    wsContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      ws: ws
    }
  }
  
  // 关闭工作区右键菜单
  const closeWsContextMenu = () => {
    wsContextMenu.value.visible = false
  }
  
  // 工作区右键菜单操作
  const handleWsContextAction = async (action) => {
    const { ws } = wsContextMenu.value
    
    if (action === 'delete-ws') {
      if (ws) {
        await deleteWorkspace(ws)
      }
    }
    
    closeWsContextMenu()
  }
  
  return {
    workspaces,
    currentWorkspace,
    wsContextMenu,
    loadWorkspaces,
    selectWorkspace,
    createWorkspace,
    deleteWorkspace,
    openWsContextMenu,
    closeWsContextMenu,
    handleWsContextAction
  }
}