import { ref, watch, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导航项配置
export const navItems = [
  { icon: "collection", nameKey: "nav.collections", key: "collection" },
  { icon: "environment", nameKey: "nav.environments", key: "environment" },
  { icon: "workspace", nameKey: "nav.workspaces", key: "workspace" },
  { icon: "history", nameKey: "nav.history", key: "history" },
  { icon: "chat", nameKey: "nav.chat", key: "chat" },
  { icon: "function", nameKey: "nav.features", key: "function" },
  { icon: "performance", nameKey: "nav.performance", key: "performance" },
  { icon: "toolbox", nameKey: "nav.toolbox", key: "toolbox" },
]

// 导出 composable 函数
export function useSidebarSetup(props, emit) {
  // 当前激活的导航 key
  const activeNavKey = ref('collection')
  
  // 子组件引用
  const collectionPanelRef = ref(null)
  const environmentPanelRef = ref(null)
  const workspacePanelRef = ref(null)
  const historyPanelRef = ref(null)
  const chatHistoryPanelRef = ref(null)
  
  // 处理导航切换
  const handleNavChange = (key) => {
    activeNavKey.value = key
    emit('navChange', key)
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
  const handleWorkspaceUpdated = (ws) => emit('workspaceUpdated', ws)
  
  // 处理已保存响应事件
  const handleSelectSavedResponse = (item) => emit('selectSavedResponse', item)
  
  // 处理历史选择事件
  const handleSelectHistory = (entry) => emit('selectHistory', entry)
  
  // 处理聊天会话事件
  const handleSelectChatSession = (session) => emit('selectChatSession', session)
  const handleNewChatSession = () => emit('newChatSession')
  
  // 加载方法
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
  
  const loadChatSessions = async () => {
    if (chatHistoryPanelRef.value) {
      await chatHistoryPanelRef.value.loadSessions()
    }
  }
  
  // 设置选中 API
  const setSelectedApi = (apiId) => {
    if (collectionPanelRef.value) {
      collectionPanelRef.value.setSelectedApiId(apiId)
    }
  }

  // 设置选中集合
  const setSelectedCollection = (collectionId) => {
    if (collectionPanelRef.value) {
      collectionPanelRef.value.setSelectedCollectionId(collectionId)
    }
  }
  
  // 监听工作区变化
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
  watch(activeNavKey, async (key) => {
    if (key === 'workspace') {
      await loadWorkspaces()
    } else if (key === 'collection') {
      await loadCollections()
    } else if (key === 'environment') {
      await loadEnvironments()
    } else if (key === 'history') {
      await loadHistory()
    } else if (key === 'chat') {
      await loadChatSessions()
    }
  })
  
  return {
    activeNavKey,
    navItems,
    
    collectionPanelRef,
    environmentPanelRef,
    workspacePanelRef,
    historyPanelRef,
    chatHistoryPanelRef,
    
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
    handleWorkspaceUpdated,
    handleSelectSavedResponse,
    handleSelectHistory,
    handleSelectChatSession,
    handleNewChatSession,
    
    loadWorkspaces,
    loadCollections,
    loadEnvironments,
    loadHistory,
    loadChatSessions,
    setSelectedApi,
    setSelectedCollection
  }
}