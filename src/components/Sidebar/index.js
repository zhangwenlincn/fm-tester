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
  
  // 获取当前导航项
  const currentNavItem = () => navItems[activeNav.value]
  
  // 选择导航项
  const selectNav = async (index) => {
    activeNav.value = index
    
    if (navItems[index].key === 'workspace') {
      await loadWorkspaces()
    } else if (navItems[index].key === 'collection') {
      await loadCollections()
    }
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
  
  // 删除集合或接口
  const deleteItem = async (item) => {
    if (!props.workspace?.path) return
    try {
      await invoke('delete_collection_item', {
        workspacePath: props.workspace.path,
        id: item.id
      })
      await loadCollections()
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
  
  // 全局点击关闭右键菜单
  const handleGlobalClick = () => {
    closeContextMenu()
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