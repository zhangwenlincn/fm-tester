import { ref, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { showToast } from '../../../composables/useToast'
import { useI18n } from 'vue-i18n'

// 导出 composable 函数
export function useWorkspacePanelSetup(props, emit) {
  const { t } = useI18n()
  
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
  
  // 拖拽排序状态
  const dragState = ref({
    draggingId: null,
    dragOverId: null,
    dragPosition: null // 'before' | 'after'
  })
  let isDragging = false
  let dragStartY = 0
  let dragStartId = null
  const DRAG_THRESHOLD = 4
  
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
    
    // 监听 Git 同步日志事件
    unlistenGitSyncLog = await listen('git-sync-log', (event) => {
      const { logType, message, data, error } = event.payload
      if (logType === 'error') {
        console.error('Git 同步错误:', message, error)
      } else {
        console.log('Git 同步:', message, data)
      }
    })
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
      emit('workspaceDeleted', ws.id)
    } catch (e) {
      console.error('删除工作区失败:', e)
    }
  }
  
  // 同步 Git 工作区（先拉取再推送）
  const syncWorkspace = async (ws) => {
    showToast(t('toast.syncing'), 'info')
    try {
      await invoke('sync_git_workspace_full', { workspaceId: ws.id })
      showToast(t('toast.syncSuccess'), 'success')
      // 同步后刷新数据
      await loadWorkspaces()
      // 找到更新后的工作区并通知父组件
      const updatedWs = workspaces.value.find(w => w.id === ws.id)
      if (updatedWs) {
        emit('selectWorkspace', updatedWs)
      }
    } catch (e) {
      console.error('同步工作区失败:', e)
      showToast(`${t('toast.syncFailed')}: ${e}`, 'error')
    }
  }
  
  // Git 同步日志监听
  let unlistenGitSyncLog = null
  
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
    } else if (action === 'sync-ws') {
      if (ws && ws.workspace_type === 'git') {
        await syncWorkspace(ws)
      }
    }
    
    closeWsContextMenu()
  }
  
  // ============ 拖拽排序 ============
  
  const getItemEl = (id) => {
    return document.querySelector(`[data-item-id="${id}"]`)
  }
  
  const onMouseDown = (e, ws) => {
    if (e.button !== 0) return
    dragStartY = e.clientY
    dragStartId = ws.id
    isDragging = false
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
  
  const onMouseMove = (e) => {
    if (!dragStartId) {
      cleanupDrag()
      return
    }
    
    const deltaY = Math.abs(e.clientY - dragStartY)
    if (!isDragging && deltaY < DRAG_THRESHOLD) return
    
    if (!isDragging) {
      isDragging = true
      dragState.value = {
        draggingId: dragStartId,
        dragOverId: null,
        dragPosition: null
      }
    }
    
    const target = findItemAtY(e.clientY)
    if (target) {
      dragState.value = {
        ...dragState.value,
        dragOverId: target.id,
        dragPosition: target.position
      }
    } else {
      dragState.value = {
        ...dragState.value,
        dragOverId: null,
        dragPosition: null
      }
    }
  }
  
  const onMouseUp = async (e) => {
    if (isDragging && dragState.value.dragOverId && dragState.value.draggingId !== dragState.value.dragOverId) {
      await performReorder()
    }
    cleanupDrag()
  }
  
  const performReorder = async () => {
    const { draggingId, dragOverId, dragPosition } = dragState.value
    if (!draggingId || !dragOverId || !dragPosition || draggingId === dragOverId) return
    
    // 找到目标索引
    const targetIndex = workspaces.value.findIndex(ws => ws.id === dragOverId)
    if (targetIndex === -1) return
    
    const newIndex = dragPosition === 'before' ? targetIndex : targetIndex + 1
    
    try {
      await invoke('reorder_workspaces', {
        workspaceId: draggingId,
        newIndex
      })
      await loadWorkspaces()
    } catch (e) {
      console.error('排序失败:', e)
    }
  }
  
  const cleanupDrag = () => {
    isDragging = false
    dragStartId = null
    dragStartY = 0
    dragState.value = {
      draggingId: null,
      dragOverId: null,
      dragPosition: null
    }
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  
  const findItemAtY = (clientY) => {
    for (const ws of workspaces.value) {
      if (ws.id === dragState.value.draggingId) continue
      
      const el = getItemEl(ws.id)
      if (!el) continue
      
      const rect = el.getBoundingClientRect()
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const midY = rect.top + rect.height / 2
        const position = clientY < midY ? 'before' : 'after'
        return { id: ws.id, position }
      }
    }
    return null
  }
  
  // 全局点击关闭右键菜单
  const handleGlobalClick = () => {
    closeWsContextMenu()
  }
  
  onMounted(() => {
    document.addEventListener('click', handleGlobalClick)
  })
  
  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
    if (unlistenGitSyncLog) {
      unlistenGitSyncLog()
    }
  })
  
  return {
    workspaces,
    currentWorkspace,
    wsContextMenu,
    dragState,
    loadWorkspaces,
    selectWorkspace,
    createWorkspace,
    deleteWorkspace,
    syncWorkspace,
    openWsContextMenu,
    closeWsContextMenu,
    handleWsContextAction,
    onMouseDown
  }
}