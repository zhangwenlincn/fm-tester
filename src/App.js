import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspace } from './composables/useWorkspace.js'
import { useEnvironment } from './composables/useEnvironment.js'
import { useTabs } from './composables/useTabs.js'
import { useRequest } from './composables/useRequest.js'
import { useResponse } from './composables/useResponse.js'
import { useSettings } from './composables/useSettings.js'
import { useGitUpdateChecker } from './composables/useGitUpdateChecker.js'

// 导出 composable 函数
export function useAppSetup() {
  // 侧边栏引用（需要在组件中设置）
  const sidebarRef = ref(null)

  // 当前导航项
  const currentNavKey = ref('collection')

  // 请求子标签页状态
  const requestTabs = ref({})

  // 当前请求子标签页
  const currentRequestTab = ref('params')

  // 标签页列表
  const tabs = ref([])
  const activeTab = ref(0)

  // 当前请求状态
  const currentRequest = reactive({
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: '',
    bodyType: 'raw',
    formData: [],
    binaryFile: null,
    timeout: null
  })

  // 响应数据
  const response = ref(null)
  const loading = ref(false)

  // 初始化各个模块
  const workspace = useWorkspace()
  const settings = useSettings()

  // 标签页管理模块
  const tabsModule = useTabs(
    workspace.currentWorkspace,
    currentNavKey,
    sidebarRef,
    currentRequest,
    response,
    loading,
    requestTabs,
    tabs,
    activeTab,
    currentRequestTab
  )

  // 请求管理模块
  const requestModule = useRequest(
    workspace.currentWorkspace,
    tabs,
    activeTab,
    sidebarRef,
    requestTabs,
    currentRequestTab,
    tabsModule.updateCurrentRequest,
    tabsModule.saveOpenTabs,
    currentRequest,
    response,
    loading
  )

  // 响应管理模块
  const responseModule = useResponse(
    workspace.currentWorkspace,
    tabs,
    activeTab,
    currentNavKey,
    sidebarRef,
    response,
    currentRequest,
    tabsModule.updateCurrentRequest
  )

  // 环境管理模块
  const environment = useEnvironment(workspace.currentWorkspace, currentNavKey)

  // Git 更新检查模块
  const gitUpdateChecker = useGitUpdateChecker(workspace.currentWorkspace)

  // 设置 activeTab watcher
  requestModule.setupActiveTabWatcher()

  // 监听当前标签页变化，加载可用变量
  watch([tabs, activeTab], () => {
    const currentTab = tabs.value[activeTab.value]
    if (currentTab && currentNavKey.value === 'collection' && workspace.currentWorkspace.value?.path) {
      environment.loadAvailableVariables(currentTab.id, currentTab.tabType)
    } else {
      environment.availableVariables.value = []
    }
  }, { immediate: true })

  // 监听环境变化，重新加载可用变量
  watch(() => environment.activeEnvironmentId.value, () => {
    const currentTab = tabs.value[activeTab.value]
    if (currentTab && currentNavKey.value === 'collection' && workspace.currentWorkspace.value?.path) {
      environment.loadAvailableVariables(currentTab.id, currentTab.tabType)
    }
  })

  // 监听导航变化，更新 Chat 面板状态
  watch(currentNavKey, () => {
    showChatPanel.value = currentNavKey.value === 'chat'
  })

  // 生命周期钩子
  onMounted(async () => {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })

    await requestModule.setupHttpLogListener()
    const lastWorkspace = await workspace.loadLastWorkspace()

    if (lastWorkspace?.path) {
      await environment.loadEnvironments()
      await responseModule.loadCookies()
      await tabsModule.loadOpenTabs(lastWorkspace.path)
    }
  })

  onUnmounted(() => {
    requestModule.cleanupHttpLogListener()
  })

  // 导航切换处理
  const onNavChange = async (navKey) => {
    currentNavKey.value = navKey
    if (navKey !== 'history') {
      responseModule.selectedHistoryEntry.value = null
    }
    if (navKey === 'environment') {
      await environment.loadEnvironments()
    }
  }

  // Chat 面板显示状态
  const showChatPanel = ref(false)
  
  // Chat会话状态
  const chatSessionId = ref(null)
  
  // 监听导航变化，更新 Chat 面板状态
  const updateChatPanelState = () => {
    showChatPanel.value = currentNavKey.value === 'chat'
  }
  
  // 处理选择聊天会话
  const handleSelectChatSession = (session) => {
    chatSessionId.value = session.id
  }
  
  // 处理新建聊天会话
  const handleNewChatSession = () => {
    chatSessionId.value = null
  }
  
  // 处理会话创建完成（设置sessionId以便显示）
  const handleSessionCreated = (sessionId) => {
    chatSessionId.value = sessionId
  }

  // 工作区切换后的额外处理
  const handleWorkspaceSwitch = async (ws) => {
    await workspace.onSwitchWorkspace(ws)
    tabs.value = []
    activeTab.value = 0
    tabsModule.collectionTabsData.value = {}
    await environment.loadEnvironments()
    await responseModule.loadCookies()
    if (ws?.path) {
      await sidebarRef.value?.loadCollections()
      await sidebarRef.value?.loadEnvironments()
      await tabsModule.loadOpenTabs(ws.path)
    }
  }

  // 工作区创建后的处理
  const handleWorkspaceCreated = async (ws) => {
    await workspace.onWorkspaceCreated(ws)
    await sidebarRef.value?.loadWorkspaces() // 刷新侧边栏工作区列表
    // 不切换到新工作区，保持当前工作区不变
  }

  // 工作区删除后的处理
  const handleWorkspaceDeleted = async (deletedId) => {
    const wasCurrentWorkspace = workspace.currentWorkspace.value?.id === deletedId
    await workspace.onWorkspaceDeleted(deletedId)

    // 如果删除的是当前选中的工作区，清空所有数据
    if (wasCurrentWorkspace) {
      tabs.value = []
      activeTab.value = 0
      tabsModule.collectionTabsData.value = {}
      await environment.loadEnvironments()
      await responseModule.loadCookies()
    }

    await sidebarRef.value?.loadWorkspaces()
  }

  // 更新选中的工作区数据（同步/更新后刷新）
  const handleWorkspaceUpdated = async (ws) => {
    // 如果传入了工作区，更新选中的工作区
    if (ws) {
      responseModule.selectedWorkspace.value = ws
    }
    // 否则从后端重新获取最新数据
    if (responseModule.selectedWorkspace.value) {
      try {
        const workspaces = await invoke('get_workspaces')
        const updated = workspaces?.find(w => w.id === responseModule.selectedWorkspace.value.id)
        if (updated) {
          responseModule.selectedWorkspace.value = updated
        }
      } catch (e) {
        console.error('更新工作区数据失败:', e)
      }
    }
  }

  // 分支切换后刷新环境（仅当前工作区）
  const handleBranchSwitched = async (ws) => {
    // 更新当前工作区的分支信息
    workspace.currentWorkspace.value = ws
    // 刷新环境变量
    await environment.loadEnvironments()
    await sidebarRef.value?.loadEnvironments()
  }

  // 返回所有需要的状态和方法
  return {
    // 工作区
    currentWorkspace: workspace.currentWorkspace,
    workspaces: workspace.workspaces,
    showWorkspaceDialog: workspace.showWorkspaceDialog,
    workspaceDialogMode: workspace.workspaceDialogMode,
    sidebarRef,
    loadWorkspaces: workspace.loadWorkspaces,
    openCreateWorkspace: workspace.openCreateWorkspace,
    closeWorkspaceDialog: workspace.closeWorkspaceDialog,
    onWorkspaceCreated: handleWorkspaceCreated,
    onWorkspaceDeleted: handleWorkspaceDeleted,
    onSwitchWorkspace: handleWorkspaceSwitch,
    showWorkspaceInfo: responseModule.showWorkspaceInfo,
    selectedWorkspace: responseModule.selectedWorkspace,
    onSelectWorkspace: responseModule.onSelectWorkspace,
    onWorkspaceUpdated: handleWorkspaceUpdated,
    onBranchSwitched: handleBranchSwitched,

    // 标签页
    tabs,
    displayTabs: tabsModule.displayTabs,
    activeTab,
    collectionTabsData: tabsModule.collectionTabsData,
    selectedCollection: tabsModule.selectedCollection,
    selectCollection: tabsModule.selectCollection,
    showCollectionSettings: tabsModule.showCollectionSettings,
    onCollectionSettingsSaved: tabsModule.onCollectionSettingsSaved,
    closeTab: tabsModule.closeTab,
    closeAllTabs: tabsModule.closeAllTabs,
    closeOtherTabs: tabsModule.closeOtherTabs,
    onDeleteApis: tabsModule.onDeleteApis,
    onDeleteCollection: tabsModule.onDeleteCollection,

    // 请求
    currentRequest,
    currentRequestTab,
    response,
    loading,
    selectApi: requestModule.selectApi,
    sendRequest: requestModule.sendRequest,
    saveRequest: requestModule.saveRequest,
    updateRequest: requestModule.updateRequest,
    onRenameApi: requestModule.onRenameApi,
    onUpdateRequestTab: tabsModule.onUpdateRequestTab,
    showRequestResponse: tabsModule.showRequestResponse,

    // 环境
    environments: environment.environments,
    activeEnvironmentId: environment.activeEnvironmentId,
    activeEnvironment: environment.activeEnvironment,
    selectedEnvironment: environment.selectedEnvironment,
    activeVariables: environment.activeVariables,
    availableVariables: environment.availableVariables,
    loadEnvironments: environment.loadEnvironments,
    loadActiveVariables: environment.loadActiveVariables,
    switchEnvironment: environment.switchEnvironment,
    selectEnvironment: environment.selectEnvironment,
    saveEnvironment: environment.saveEnvironment,
    deleteEnvironment: environment.deleteEnvironment,
    saveEnvVariables: environment.saveEnvVariables,
    onSwitchEnvironment: environment.onSwitchEnvironment,
    onSelectEnvironment: environment.onSelectEnvironment,
    showEnvironmentInfo: environment.showEnvironmentInfo,

    // Cookie
    cookies: responseModule.cookies,
    showCookiePanel: responseModule.showCookiePanel,
    loadCookies: responseModule.loadCookies,
    openCookiePanel: responseModule.openCookiePanel,
    closeCookiePanel: responseModule.closeCookiePanel,

    // Console
    showConsolePanel: requestModule.showConsolePanel,
    consoleLogs: requestModule.consoleLogs,
    openConsolePanel: requestModule.openConsolePanel,
    closeConsolePanel: requestModule.closeConsolePanel,
    clearConsoleLogs: requestModule.clearConsoleLogs,

    // 保存响应
    showSaveResponseDialog: responseModule.showSaveResponseDialog,
    saveResponseDefaultName: responseModule.saveResponseDefaultName,
    onSaveResponse: responseModule.onSaveResponse,
    handleSaveResponse: responseModule.handleSaveResponse,
    onSelectSavedResponse: responseModule.onSelectSavedResponse,

    // 历史
    selectedHistoryEntry: responseModule.selectedHistoryEntry,
    onSelectHistory: responseModule.onSelectHistory,
    showHistoryDetail: responseModule.showHistoryDetail,

    // 导航
    currentNavKey,
    onNavChange,
    
    // Chat
    showChatPanel,
    chatSessionId,
    onSelectChatSession: handleSelectChatSession,
    onNewChatSession: handleNewChatSession,
    onSessionCreated: handleSessionCreated,

    // 设置
    showSettingsPanel: settings.showSettingsPanel,
    openSettings: settings.openSettings,
    closeSettings: settings.closeSettings,
    showAiSettingsPanel: settings.showAiSettingsPanel,
    openAiSettings: settings.openAiSettings,
    closeAiSettings: settings.closeAiSettings
  }
}