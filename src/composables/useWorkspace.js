import { ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/**
 * 工作区管理 composable
 */
export function useWorkspace() {
  const currentWorkspace = ref(null)
  const workspaces = ref([])
  const showWorkspaceDialog = ref(false)
  const workspaceDialogMode = ref('create')

  const loadWorkspaces = async () => {
    try {
      const list = await invoke('get_workspaces')
      workspaces.value = list || []
    } catch (e) {
      console.error('加载工作区列表失败:', e)
    }
  }

  const loadLastWorkspace = async () => {
    try {
      await loadWorkspaces()
      const workspace = await invoke('get_last_workspace')
      if (workspace) {
        currentWorkspace.value = workspace
      }
      return workspace
    } catch (e) {
      console.error('加载工作区失败:', e)
      return null
    }
  }

  const openCreateWorkspace = () => {
    workspaceDialogMode.value = 'create'
    showWorkspaceDialog.value = true
  }

  const closeWorkspaceDialog = () => {
    showWorkspaceDialog.value = false
  }

  const onWorkspaceCreated = async (workspace) => {
    await loadWorkspaces() // 重新加载工作区列表
    // 不设置 currentWorkspace，保持当前工作区不变
  }

  const onWorkspaceDeleted = async (deletedId) => {
    workspaces.value = workspaces.value.filter(w => w.id !== deletedId)
  }

  const onSwitchWorkspace = async (workspace) => {
    currentWorkspace.value = workspace
    if (workspace?.path) {
      try {
        await invoke('set_last_workspace', { workspaceId: workspace.id })
      } catch (e) {
        console.error('保存工作区失败:', e)
      }
    }
  }

  return {
    currentWorkspace,
    workspaces,
    showWorkspaceDialog,
    workspaceDialogMode,
    loadWorkspaces,
    loadLastWorkspace,
    openCreateWorkspace,
    closeWorkspaceDialog,
    onWorkspaceCreated,
    onWorkspaceDeleted,
    onSwitchWorkspace
  }
}