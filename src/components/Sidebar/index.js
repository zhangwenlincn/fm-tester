import { ref, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导航项配置（从 IconNav 导入）
import { navItems } from './IconNav/index.js'

// 导出 composable 函数
export function useSidebarSetup(props, emit) {
  // 当前激活的导航索引
  const activeNav = ref(0)
  
  // 子组件引用（用于调用子组件方法）
  const collectionPanelRef = ref(null)
  const environmentPanelRef = ref(null)
  const workspacePanelRef = ref(null)
  const historyPanelRef = ref(null)
  
  // 处理导航切换
  const handleNavChange = (key) => {
    const index = navItems.findIndex(item => item.key === key)
    if (index !== -1) {
      activeNav.value = index
      emit('navChange', key)
    }
  }
  
  // 处理子组件事件转发
  const handleSelectApi = (api) => emit('selectApi', api)
  const handleSelectCollection = (collection) => emit('selectCollection', collection)
  const handleDeleteApis = (ids) => emit('deleteApis', ids)
  const handleDeleteCollection = (collectionId) => emit('deleteCollection', collectionId)
  const handleRenameApi = (api) => emit('renameApi', api)
  const handleSelectEnvironment = (envId) => emit('selectEnvironment', envId)
  const handleEnvironmentUpdated = () => emit('environmentUpdated')
  const handleSelectWorkspace = (ws) => emit('selectWorkspace', ws)
  const handleCreateWorkspace = () => emit('createWorkspace')
  const handleWorkspaceDeleted = (wsId) => emit('workspaceDeleted', wsId)
  
  // 处理已保存响应事件
  const handleSelectSavedResponse = (item) => emit('selectSavedResponse', item)
  
  // 处理历史选择事件
  const handleSelectHistory = (entry) => emit('selectHistory', entry)
  
  // 加载方法（暴露给父组件）
  const loadWorkspaces = async () => {
    if (workspacePanelRef.value) {
      await workspacePanelRef.value.loadWorkspaces()
    }
  }
  
  const loadCollections = async () => {
    if (collectionPanelRef.value) {
      await collectionPanelRef.value.loadCollections()
    }
  }
  
  const loadEnvironments = async () => {
    if (environmentPanelRef.value) {
      await environmentPanelRef.value.loadEnvironments()
    }
  }
  
  const loadHistory = async () => {
    if (historyPanelRef.value) {
      await historyPanelRef.value.loadHistoryDates()
    }
  }
  
  // 设置选中 API（用于标签页联动）
  const setSelectedApi = (apiId) => {
    if (collectionPanelRef.value) {
      collectionPanelRef.value.setSelectedApiId(apiId)
    }
  }
  
  // 监听工作区变化，通知子组件加载数据
  watch(() => props.workspace, async (ws) => {
    if (ws) {
      await loadCollections()
      await loadEnvironments()
    }
  }, { immediate: true })
  
  // 启动时加载工作区列表
  onMounted(async () => {
    await loadWorkspaces()
  })
  
  // 监听导航切换，加载对应数据
  watch(activeNav, async (index) => {
    const key = navItems[index]?.key
    if (key === 'workspace') {
      await loadWorkspaces()
    } else if (key === 'collection') {
      await loadCollections()
    } else if (key === 'environment') {
      await loadEnvironments()
    } else if (key === 'history') {
      await loadHistory()
    }
  })
  
  return {
    // 状态
    activeNav,
    navItems,
    
    // 子组件引用
    collectionPanelRef,
    environmentPanelRef,
    workspacePanelRef,
    historyPanelRef,
    
    // 事件处理
    handleNavChange,
    handleSelectApi,
    handleSelectCollection,
    handleDeleteApis,
    handleDeleteCollection,
    handleRenameApi,
    handleSelectEnvironment,
    handleEnvironmentUpdated,
    handleSelectWorkspace,
    handleCreateWorkspace,
    handleWorkspaceDeleted,
    handleSelectSavedResponse,
    handleSelectHistory,
    
    // 暴露给父组件的方法
    loadWorkspaces,
    loadCollections,
    loadEnvironments,
    loadHistory,
    setSelectedApi
  }
}