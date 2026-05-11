import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const navItems = [
  { icon: 'collection', name: '集合', key: 'collection' },
  { icon: 'environment', name: '环境', key: 'environment' },
  { icon: 'workspace', name: '工作区', key: 'workspace' },
  { icon: 'function', name: '功能', key: 'function' },
  { icon: 'performance', name: '性能', key: 'performance' },
  { icon: 'toolbox', name: '工具箱', key: 'toolbox' },
  { icon: 'history', name: '历史', key: 'history' }
]

// 最大层级深度（集合最多三层）
const MAX_DEPTH = 2 // depth 0, 1, 2 共三层

// 导出 composable 函数
export function useSidebarSetup(props, emit) {
  // 集合数据
  const collections = ref([])
  const expandedItems = ref({})
  const selectedApi = ref(null)
  const searchQuery = ref('')
  const showCreateDialog = ref(false)
  const createDialogParent = ref(null)
  const newItemName = ref('')
  // 重命名
  const showRenameDialog = ref(false)
  const renameItem = ref(null)
  const renameItemType = ref('')
  const renameItemName = ref('')
  
  // 右键菜单
  const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    item: null,
    depth: 0,
    type: '' // 'collection' 或 'root'
  })
  
  // 工作区列表
  const workspaces = ref([])
  const currentWorkspace = ref(null)
  const activeNav = ref(0)
  
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
  
  // 获取当前导航项
  const currentNavItem = () => navItems[activeNav.value]
  
  // 选择导航项
  const selectNav = async (index) => {
    activeNav.value = index
    
    if (navItems[index].key === 'workspace') {
      await loadWorkspaces()
    } else if (navItems[index].key === 'collection') {
      await loadCollections()
    } else if (navItems[index].key === 'environment') {
      await loadEnvironments()
    }
  }
  
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
  
  // 切换环境
  const switchEnvironment = async (envId) => {
    if (!props.workspace?.path) return
    try {
      await invoke('switch_environment', {
        workspacePath: props.workspace.path,
        environmentId: envId
      })
      activeEnvironmentId.value = envId
      // 通知父组件更新 activeEnvironment
      const env = environments.value.find(e => e.id === envId)
      emit('switchEnvironment', env)
    } catch (e) {
      console.error('切换环境失败:', e)
    }
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
  
  // 加载集合列表
  const loadCollections = async () => {
    if (!props.workspace?.path) return
    try {
      const data = await invoke('get_collections', { workspacePath: props.workspace.path })
      collections.value = data || []
      console.log('加载集合数据:', data)
    } catch (e) {
      console.error('加载集合失败:', e)
      collections.value = []
    }
  }
  
  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      workspaces.value = await invoke('get_workspaces')
    } catch (e) {
      console.error('加载工作区失败:', e)
    }
  }
  
  // 切换工作区
  const switchWorkspace = async (workspace) => {
    try {
      const ws = await invoke('switch_workspace', { id: workspace.id })
      currentWorkspace.value = ws
      emit('switchWorkspace', ws)
    } catch (e) {
      console.error('切换工作区失败:', e)
    }
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
      if (currentWorkspace.value?.id === ws.id) {
        currentWorkspace.value = null
        emit('switchWorkspace', null)
      }
    } catch (e) {
      console.error('删除工作区失败:', e)
    }
  }
  
  // 展开/折叠
  const toggleExpand = (id) => {
    expandedItems.value[id] = !expandedItems.value[id]
  }
  
  const isExpanded = (id) => expandedItems.value[id] ?? false
  
  // 选择 API
  const selectApiItem = (api) => {
    selectedApi.value = api.id
    emit('selectApi', api)
  }
  
  // 打开创建对话框（根级别）
  const openRootCreateDialog = () => {
    createDialogParent.value = null
    newItemName.value = ''
    showCreateDialog.value = true
  }
  
  // 打开创建对话框（集合下）
  const openCreateDialog = (parent) => {
    createDialogParent.value = parent
    newItemName.value = ''
    showCreateDialog.value = true
  }
  
  // 是否可以创建子集合（层级限制）
  const canCreateSubCollection = (depth) => {
    return depth < MAX_DEPTH
  }
  
  // 打开右键菜单
  const openContextMenu = (event, item, depth, type) => {
    event.preventDefault()
    event.stopPropagation()
    
    contextMenu.value = {
      visible: true,
      x: event.clientX,
      y: event.clientY,
      item: item,
      depth: depth,
      type: type
    }
  }
  
  // 关闭右键菜单
  const closeContextMenu = () => {
    contextMenu.value.visible = false
  }
  
  // 右键菜单操作
  const handleContextAction = async (action) => {
    const { item, depth, type } = contextMenu.value
    
    if (action === 'new-collection') {
      if (type === 'root') {
        openRootCreateDialog()
      } else if (canCreateSubCollection(depth)) {
        openCreateDialog(item)
      }
    } else if (action === 'new-api') {
      // 直接创建接口，不弹对话框
      if (!props.workspace?.path) return
      try {
        const newApi = await invoke('create_api', {
          workspacePath: props.workspace.path,
          name: '新建接口',
          method: 'GET',
          url: '',
          parentId: type === 'root' ? null : item?.id
        })
        await loadCollections()
        // 创建后立即打开
        emit('selectApi', newApi)
      } catch (e) {
        console.error('创建接口失败:', e)
      }
    } else if (action === 'rename') {
      // 打开重命名对话框
      renameItem.value = item
      renameItemType.value = type
      renameItemName.value = item.name
      showRenameDialog.value = true
    } else if (action === 'delete') {
      deleteItem(item)
    }
    
    closeContextMenu()
  }
  
  // 重命名
  const handleRename = async () => {
    if (!props.workspace?.path) return
    if (!renameItemName.value.trim()) return
    
    try {
      if (renameItemType.value === 'collection') {
        await invoke('update_collection', {
          workspacePath: props.workspace.path,
          id: renameItem.value.id,
          name: renameItemName.value,
          description: renameItem.value.description
        })
      } else {
        await invoke('update_api', {
          workspacePath: props.workspace.path,
          id: renameItem.value.id,
          name: renameItemName.value,
          method: null,
          url: null,
          headers: null,
          body: null,
          bodyType: null
        })
        // 通知父组件更新 tabs 中的名称
        emit('renameApi', { id: renameItem.value.id, name: renameItemName.value })
      }
      await loadCollections()
      showRenameDialog.value = false
    } catch (e) {
      console.error('重命名失败:', e)
    }
  }
  
  // 创建集合
  const handleCreate = async () => {
    if (!props.workspace?.path) return
    if (!newItemName.value.trim()) return
    
    try {
      await invoke('create_collection', {
        workspacePath: props.workspace.path,
        name: newItemName.value,
        description: null,
        parentId: createDialogParent.value?.id || null
      })
      await loadCollections()
      showCreateDialog.value = false
    } catch (e) {
      console.error('创建失败:', e)
    }
  }
  
  // 递归收集集合下的所有接口 ID
  const collectApiIds = (item) => {
    const ids = []
    if (item.type === 'api') {
      ids.push(item.id)
    } else if (item.type === 'collection' && item.children) {
      for (const child of item.children) {
        ids.push(...collectApiIds(child))
      }
    }
    return ids
  }

  // 删除集合或接口
  const deleteItem = async (item) => {
    if (!props.workspace?.path) return
    try {
      // 先收集要删除的接口 ID
      const apiIds = collectApiIds(item)
      
      await invoke('delete_collection_item', {
        workspacePath: props.workspace.path,
        id: item.id
      })
      await loadCollections()
      
      // 通知 App 关闭所有相关标签页
      if (apiIds.length > 0) {
        emit('deleteApis', apiIds)
      }
    } catch (e) {
      console.error('删除失败:', e)
    }
  }
  
  // 获取 HTTP 方法样式类
  const getMethodClass = (method) => method?.toLowerCase() || ''
  
  // 计算扁平化的树列表（用于渲染）
  const flatTreeList = computed(() => {
    const result = []
    const processItems = (items, depth = 0) => {
      for (const item of items) {
        const isCollection = item.type === 'collection'
        const hasChildren = item.children && item.children.length > 0
        const expanded = isExpanded(item.id)
        
        result.push({
          item,
          isCollection,
          hasChildren,
          expanded,
          depth
        })
        
        if (hasChildren && expanded) {
          processItems(item.children, depth + 1)
        }
      }
    }
    processItems(collections.value)
    return result
  })
  
  // 监听工作区变化
  watch(() => props.workspace, async (ws) => {
    if (ws) {
      currentWorkspace.value = ws
      await loadCollections()
    }
  }, { immediate: true })
  
  // 监听导航切换，通知父组件
  watch(activeNav, (index) => {
    emit('navChange', navItems[index].key)
  }, { immediate: true })
  
  // 全局点击关闭右键菜单
  const handleGlobalClick = () => {
    closeContextMenu()
    closeEnvContextMenu()
  }
  
  onMounted(async () => {
    await loadWorkspaces()
    // 全局点击事件
    document.addEventListener('click', handleGlobalClick)
  })
  
  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
  })
  
  return {
    navItems,
    collections,
    expandedItems,
    selectedApi,
    searchQuery,
    showCreateDialog,
    createDialogParent,
    newItemName,
    showRenameDialog,
    renameItem,
    renameItemType,
    renameItemName,
    contextMenu,
    workspaces,
    currentWorkspace,
    activeNav,
    // 环境相关
    environments,
    activeEnvironmentId,
    showEnvDialog,
    editingEnv,
    editingEnvName,
    editingEnvVariables,
    loadEnvironments,
    switchEnvironment,
    openCreateEnvDialog,
    openEditEnvDialog,
    addEnvVariable,
    removeEnvVariable,
    handleSaveEnv,
    deleteEnvironment,
    // 环境右键菜单
    envContextMenu,
    openEnvContextMenu,
    closeEnvContextMenu,
    handleEnvContextAction,
    currentNavItem,
    selectNav,
    loadCollections,
    loadWorkspaces,
    switchWorkspace,
    createWorkspace,
    deleteWorkspace,
    toggleExpand,
    isExpanded,
    selectApiItem,
    openRootCreateDialog,
    openCreateDialog,
    canCreateSubCollection,
    openContextMenu,
    closeContextMenu,
    handleContextAction,
    handleRename,
    handleCreate,
    deleteItem,
    getMethodClass,
    flatTreeList
  }
}