import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 最大层级深度（集合最多三层）
const MAX_DEPTH = 2 // depth 0, 1, 2 共三层

// 导出 composable 函数
export function useCollectionPanelSetup(props, emit) {
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
    type: '' // 'collection' 或 'root' 或 'api'
  })
  
  // 拖拽状态
  const draggingApiId = ref(null)
  const dropTargetId = ref(null)

  // 保存响应展开状态
  const expandedResponses = ref({})
  
  // 加载集合列表
  const loadCollections = async () => {
    if (!props.workspace?.path) return
    try {
      const data = await invoke('get_collections', { workspacePath: props.workspace.path })
      collections.value = data || []
      
      // 恢复展开状态
      const expandedIds = await invoke('get_expanded_collections', { workspacePath: props.workspace.path })
      expandedItems.value = {}
      for (const id of expandedIds || []) {
        expandedItems.value[id] = true
      }
    } catch (e) {
      console.error('加载集合失败:', e)
      collections.value = []
    }
  }
  
  // 保存展开状态
  const saveExpandState = async () => {
    if (!props.workspace?.path) return
    const expandedIds = Object.keys(expandedItems.value).filter(id => expandedItems.value[id])
    try {
      await invoke('save_expanded_collections', {
        workspacePath: props.workspace.path,
        expandedIds
      })
    } catch (e) {
      console.error('保存展开状态失败:', e)
    }
  }
  
  // 展开/折叠
  const toggleExpand = async (id) => {
    expandedItems.value[id] = !expandedItems.value[id]
    await saveExpandState()
  }
  
  const isExpanded = (id) => expandedItems.value[id]
  
  // 查找 API 所属的所有祖先集合（从根到直接父集合）
  const findAncestorCollections = (apiId) => {
    const ancestors = []
    const search = (items, path = []) => {
      for (const item of items) {
        if (item.type === 'api' && item.id === apiId) {
          // 找到 API，返回祖先路径
          return path
        }
        if (item.type === 'collection' && item.children) {
          const newPath = [...path, item]
          const found = search(item.children, newPath)
          if (found) return found
        }
      }
      return null
    }
    return search(collections.value) || []
  }
  
  // 选择 API
  const selectApiItem = (api) => {
    selectedApi.value = api.id
    // 查找所有祖先集合，收集 common_headers 和 collection_variables
    const ancestorCollections = findAncestorCollections(api.id)
    
    // 合并所有祖先集合的请求头（从根到父，子覆盖父）
    const commonHeaders = []
    for (const collection of ancestorCollections) {
      if (collection.common_headers) {
        for (const h of collection.common_headers) {
          if (h.enabled && h.key.trim()) {
            // 查找是否已存在同名请求头
            const existingIndex = commonHeaders.findIndex(ch => ch.key.toLowerCase() === h.key.toLowerCase())
            if (existingIndex >= 0) {
              // 子集合请求头覆盖祖先请求头
              commonHeaders[existingIndex] = h
            } else {
              commonHeaders.push(h)
            }
          }
        }
      }
    }
    
    // 合并所有祖先集合的变量（从根到父，子覆盖父）
    const collectionVariables = []
    for (const collection of ancestorCollections) {
      if (collection.collection_variables) {
        for (const v of collection.collection_variables) {
          // 查找是否已存在同名变量
          const existingIndex = collectionVariables.findIndex(cv => cv.key === v.key)
          if (existingIndex >= 0) {
            // 子集合变量覆盖祖先变量
            collectionVariables[existingIndex] = v
          } else {
            collectionVariables.push(v)
          }
        }
      }
    }
    
    const apiWithHeaders = {
      ...api,
      commonHeaders,
      collectionVariables
    }
    emit('selectApi', apiWithHeaders)
  }
  
  // 选择集合（打开设置页面）
  const selectCollectionItem = (collection) => {
    emit('selectCollection', collection)
  }
  
  // 外部设置选中 API（用于标签页联动）
  const setSelectedApiId = (apiId) => {
    selectedApi.value = apiId
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
      
      // 如果删除的是集合，通知关闭集合设置 tab
      if (item.type === 'collection') {
        emit('deleteCollection', item.id)
      }
    } catch (e) {
      console.error('删除失败:', e)
    }
  }
  
  // 拖拽开始
  const onDragStart = (e, api) => {
    e.stopPropagation()
    draggingApiId.value = api.id
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', api.id)
    // 添加拖拽样式
    e.target.classList.add('dragging')
  }
  
  // 拖拽结束
  const onDragEnd = (e) => {
    e.stopPropagation()
    draggingApiId.value = null
    dropTargetId.value = null
    e.target.classList.remove('dragging')
  }
  
  // 拖拽经过集合
  const onDragOver = (e, collection) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    // 设置目标高亮（只在集合上设置，不在根级别设置）
    if (collection) {
      dropTargetId.value = collection.id
    }
  }
  
  // 拖拽离开集合（简化处理）
  const onDragLeave = (e) => {
    dropTargetId.value = null
  }
  
  // 放置到集合
  const onDrop = async (e, collection) => {
    e.preventDefault()
    const apiId = e.dataTransfer.getData('text/plain')
    
    if (!apiId || !props.workspace?.path) {
      draggingApiId.value = null
      dropTargetId.value = null
      return
    }
    
    // 不能移动到自己
    if (collection && apiId === collection.id) {
      draggingApiId.value = null
      dropTargetId.value = null
      return
    }
    
    try {
      await invoke('move_api', {
        workspacePath: props.workspace.path,
        apiId: apiId,
        targetCollectionId: collection?.id || null
      })
      await loadCollections()
    } catch (err) {
      console.error('移动失败:', err)
    }
    
    draggingApiId.value = null
    dropTargetId.value = null
  }
  
  // 获取 HTTP 方法样式类
  const getMethodClass = (method) => method?.toLowerCase() || ''

  // 切换保存响应展开状态
  const toggleResponses = (apiId) => {
    expandedResponses.value[apiId] = !expandedResponses.value[apiId]
  }

  // 选择保存响应
  const selectSavedResponse = (response, apiName) => {
    emit('selectSavedResponse', { ...response, apiName })
  }

  // 获取状态码样式类
  const getStatusClass = (status) => {
    if (!status) return ''
    const code = parseInt(status)
    if (code >= 200 && code < 300) return 'success'
    if (code >= 400 && code < 500) return 'warning'
    if (code >= 500) return 'error'
    return ''
  }

  // 格式化时间
  const formatTime = (timestamp) => {
    if (!timestamp) return ''
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString()
  }
  
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
      await loadCollections()
    }
  }, { immediate: true })
  
  // 全局点击关闭右键菜单
  const handleGlobalClick = () => {
    closeContextMenu()
  }
  
  onMounted(() => {
    // 全局点击事件
    document.addEventListener('click', handleGlobalClick)
  })
  
  onUnmounted(() => {
    document.removeEventListener('click', handleGlobalClick)
  })
  
return {
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
    draggingApiId,
    dropTargetId,
    expandedResponses,
    loadCollections,
    toggleExpand,
    isExpanded,
    selectApiItem,
    selectCollectionItem,
    setSelectedApiId,
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
    toggleResponses,
    selectSavedResponse,
    getStatusClass,
    formatTime,
    flatTreeList,
    onDragStart,
    onDragEnd,
    onDragOver,
    onDragLeave,
    onDrop
  }
}