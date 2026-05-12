import { ref, watch, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

export function useEnvironmentPanelSetup(props, emit) {
  // 环境数据
  const environments = ref([])
  const activeEnvironmentId = ref(null)
  const showEnvDialog = ref(false)
  const editingEnv = ref(null)
  const editingEnvName = ref('')
  const editingEnvVariables = ref([])
  
  // 环境右键菜单
  const envContextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    env: null,
    type: '' // 'root' 或 'env'
  })
  
  // 加载环境列表
  const loadEnvironments = async () => {
    if (!props.workspace?.path) return
    try {
      const config = await invoke('get_environments', { workspacePath: props.workspace.path })
      environments.value = config.environments || []
      activeEnvironmentId.value = config.active_environment_id || null
    } catch (e) {
      console.error('加载环境失败:', e)
      environments.value = []
    }
  }
  
  // 监听 workspace 变化，自动加载环境
  watch(() => props.workspace, async (ws) => {
    if (ws) {
      await loadEnvironments()
    }
  }, { immediate: true })
  
  // 选择环境（仅选中效果，通知父组件更新显示）
  const selectEnvironment = (envId) => {
    activeEnvironmentId.value = envId
    emit('selectEnvironment', envId)
  }
  
  // 打开新建环境对话框
  const openCreateEnvDialog = () => {
    editingEnv.value = null
    editingEnvName.value = ''
    editingEnvVariables.value = [{ key: '', value: '', enabled: true }]
    showEnvDialog.value = true
  }
  
  // 打开编辑环境对话框
  const openEditEnvDialog = (env) => {
    editingEnv.value = env
    editingEnvName.value = env.name
    editingEnvVariables.value = env.variables.length > 0 
      ? [...env.variables] 
      : [{ key: '', value: '', enabled: true }]
    showEnvDialog.value = true
  }
  
  // 添加变量行
  const addEnvVariable = () => {
    editingEnvVariables.value.push({ key: '', value: '', enabled: true })
  }
  
  // 删除变量行
  const removeEnvVariable = (index) => {
    if (editingEnvVariables.value.length > 1) {
      editingEnvVariables.value.splice(index, 1)
    }
  }
  
  // 保存环境
  const handleSaveEnv = async () => {
    if (!props.workspace?.path) return
    if (!editingEnvName.value.trim()) return
    
    // 编辑时保留原有变量，新建时变量为空
    let variables = []
    if (editingEnv.value) {
      variables = editingEnv.value.variables || []
    }
    
    const envId = editingEnv.value?.id || `env_${Date.now()}`
    const environment = {
      id: envId,
      name: editingEnvName.value.trim(),
      variables
    }
    
    try {
      await invoke('save_environment', {
        workspacePath: props.workspace.path,
        environment
      })
      await loadEnvironments()
      showEnvDialog.value = false
      // 通知父组件刷新环境列表
      emit('environmentUpdated')
    } catch (e) {
      console.error('保存环境失败:', e)
    }
  }
  
  // 删除环境
  const deleteEnvironment = async (envId) => {
    if (!props.workspace?.path) return
    try {
      await invoke('delete_environment', {
        workspacePath: props.workspace.path,
        environmentId: envId
      })
      await loadEnvironments()
      // 通知父组件刷新环境列表
      emit('environmentUpdated')
    } catch (e) {
      console.error('删除环境失败:', e)
    }
  }
  
  // 打开环境右键菜单
  const openEnvContextMenu = (event, env, type) => {
    event.preventDefault()
    event.stopPropagation()
    
    envContextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      env: env,
      type: type
    }
  }
  
  // 关闭环境右键菜单
  const closeEnvContextMenu = () => {
    envContextMenu.value.visible = false
  }
  
  // 环境右键菜单操作
  const handleEnvContextAction = async (action) => {
    const { env, type } = envContextMenu.value
    
    if (action === 'new-env') {
      openCreateEnvDialog()
    } else if (action === 'edit-env') {
      if (env) {
        openEditEnvDialog(env)
      }
    } else if (action === 'delete-env') {
      if (env) {
        await deleteEnvironment(env.id)
      }
    }
    
    closeEnvContextMenu()
  }
  
  return {
    // 状态
    environments,
    activeEnvironmentId,
    showEnvDialog,
    editingEnv,
    editingEnvName,
    editingEnvVariables,
    envContextMenu,
    // 函数
    loadEnvironments,
    selectEnvironment,
    openCreateEnvDialog,
    openEditEnvDialog,
    addEnvVariable,
    removeEnvVariable,
    handleSaveEnv,
    deleteEnvironment,
    openEnvContextMenu,
    closeEnvContextMenu,
    handleEnvContextAction
  }
}