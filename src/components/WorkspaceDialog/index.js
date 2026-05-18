import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { showToast } from '../../composables/useToast'

// 导出 composable 函数
export function useWorkspaceDialogSetup(props, emit) {
  // 表单数据
  const name = ref('')
  const description = ref('')
  const path = ref('')
  const error = ref('')
  const loading = ref(false)

  // 工作区类型和 Git 配置
  const workspaceType = ref('local') // 'local' 或 'git'
  const gitUrl = ref('')
  const gitBranch = ref('master')
  const gitUsername = ref('')
  const gitPassword = ref('')

  // 工作区列表
  const workspaces = ref([])
  const selectedWorkspaceId = ref(null)

  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      workspaces.value = await invoke('get_workspaces')
    } catch (e) {
      console.error('加载工作区列表失败:', e)
    }
  }

  // 选择路径（使用安全的 safe_pick_directory 命令）
  const selectPath = async () => {
    try {
      const selected = await invoke('safe_pick_directory')
      if (selected) {
        path.value = selected
      }
    } catch (e) {
      console.error('选择路径失败:', e)
      showToast(`选择路径失败: ${e}`, 'error')
    }
  }

  // 创建工作区
  const createWorkspace = async () => {
    if (!name.value.trim()) {
      error.value = '请输入工作区名称'
      return
    }
    if (!path.value.trim()) {
      error.value = '请选择工作区路径'
      return
    }
    // Git 工作区验证
    if (workspaceType.value === 'git' && !gitUrl.value.trim()) {
      error.value = '请输入 Git 仓库地址'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const params = {
        name: name.value,
        description: description.value,
        path: path.value,
        workspaceType: workspaceType.value
      }
      
      // Git 工作区额外参数
      if (workspaceType.value === 'git') {
        params.gitUrl = gitUrl.value
        params.gitBranch = gitBranch.value || 'master'
        // 只传递非空的凭据
        if (gitUsername.value && gitUsername.value.trim()) {
          params.gitUsername = gitUsername.value.trim()
        }
        if (gitPassword.value && gitPassword.value.trim()) {
          params.gitPassword = gitPassword.value.trim()
        }
      }
      
      const workspace = await invoke('create_workspace', params)
      
      // Git 工作区：创建成功后自动克隆仓库
      if (workspaceType.value === 'git') {
        showToast('正在克隆仓库...', 'info')
        try {
          await invoke('sync_git_workspace', {
            workspaceId: workspace.id,
            commitMessage: '初始化工作区'
          })
          showToast('Git 仓库克隆成功', 'success')
        } catch (syncError) {
          // 克隆失败，删除刚创建的工作区并提示
          console.error('Git 克隆失败:', syncError)
          showToast(`Git 克隆失败: ${syncError}`, 'error')
          try {
            await invoke('delete_workspace', { id: workspace.id })
          } catch (deleteError) {
            console.error('删除工作区失败:', deleteError)
          }
          error.value = `Git 克隆失败: ${syncError}\n请检查 Git 地址和网络连接后重试`
          loading.value = false
          return
        }
      }
      
      showToast('工作区创建成功', 'success')
      emit('created', workspace)
      close() // 创建成功后关闭对话框
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  // 选中工作区项
  const handleSelectWorkspaceItem = (id) => {
    selectedWorkspaceId.value = id
  }

  // 选择工作区（确认按钮）
  const selectWorkspace = async () => {
    if (!selectedWorkspaceId.value) {
      error.value = '请选择一个工作区'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const workspace = await invoke('switch_workspace', { id: selectedWorkspaceId.value })
      emit('selected', workspace)
    } catch (e) {
      error.value = e
    } finally {
      loading.value = false
    }
  }

  // 重置表单
  const resetForm = () => {
    name.value = ''
    description.value = ''
    path.value = ''
    error.value = ''
    workspaceType.value = 'local'
    gitUrl.value = ''
    gitBranch.value = 'master'
    gitUsername.value = ''
    gitPassword.value = ''
  }

  // 关闭对话框
  const close = () => {
    resetForm()
    emit('close')
  }

  // 监听显示状态
  watch(() => props.visible, (visible) => {
    if (visible && props.mode === 'select') {
      loadWorkspaces()
    }
  })

  return {
    name,
    description,
    path,
    error,
    loading,
    workspaceType,
    gitUrl,
    gitBranch,
    gitUsername,
    gitPassword,
    workspaces,
    selectedWorkspaceId,
    loadWorkspaces,
    selectPath,
    createWorkspace,
    handleSelectWorkspaceItem,
    selectWorkspace,
    resetForm,
    close
  }
}