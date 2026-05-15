import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useWorkspace } from './composables/useWorkspace.js'
import { useEnvironment } from './composables/useEnvironment.js'
import { useTabs } from './composables/useTabs.js'
import { useRequest } from './composables/useRequest.js'
import { useResponse } from './composables/useResponse.js'
import { useSettings } from './composables/useSettings.js'

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

  // 设置 activeTab watcher
  requestModule.setupActiveTabWatcher()

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
    await handleWorkspaceSwitch(ws)
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
    onWorkspaceDeleted: workspace.onWorkspaceDeleted,
    onSwitchWorkspace: handleWorkspaceSwitch,
    showWorkspaceInfo: responseModule.showWorkspaceInfo,

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

    // 设置
    showSettingsPanel: settings.showSettingsPanel,
    openSettings: settings.openSettings,
    closeSettings: settings.closeSettings
  }
}