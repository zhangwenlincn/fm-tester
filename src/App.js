import { ref, reactive, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import JSON5 from 'json5'

// 导出 composable 函数
export function useAppSetup() {
  // 工作区数据
  const currentWorkspace = ref(null)
  const workspaces = ref([])
  const showWorkspaceDialog = ref(false)
  const workspaceDialogMode = ref('create')
  const sidebarRef = ref(null)

  // 标签页数据（统一管理 API 和集合 tabs）
  const tabs = ref([])
  const activeTab = ref(0)
  
  // 集合数据缓存
  const collectionTabsData = ref({})
  
  // 每个接口的子标签页状态
  const requestTabs = ref({})
  const currentRequestTab = ref('params')

  // 当前请求
  const currentRequest = reactive({
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: '',
    bodyType: 'raw',
    formData: [],
    binaryFile: null
  })

  // 响应数据
  const response = ref(null)
  const loading = ref(false)

  // 环境数据
  const environments = ref([])
  const activeEnvironmentId = ref(null)
  const activeEnvironment = ref(null)
  const selectedEnvironment = ref(null)
  const selectedEnvVariables = ref([])
  const activeVariables = ref([])

  // Cookie 数据
  const cookies = ref([])
  const showCookiePanel = ref(false)

  // 控制台数据
  const showConsolePanel = ref(false)
  const consoleLogs = ref([])
  const maxConsoleLogs = 100

  // 保存响应对话框
  const showSaveResponseDialog = ref(false)
  const saveResponseDefaultName = ref('')

  // 当前侧边栏导航项
  const currentNavKey = ref('collection')

  // 加载环境配置
  const loadEnvironments = async () => {
    if (!currentWorkspace.value?.path) {
      environments.value = []
      activeEnvironmentId.value = null
      activeEnvironment.value = null
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      activeVariables.value = []
      return
    }
    try {
      const config = await invoke('get_environments', { workspacePath: currentWorkspace.value.path })
      environments.value = config.environments || []
      activeEnvironmentId.value = config.active_environment_id || null
      if (activeEnvironmentId.value) {
        activeEnvironment.value = environments.value.find(e => e.id === activeEnvironmentId.value) || null
      } else {
        activeEnvironment.value = null
      }
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      await loadActiveVariables()
    } catch (e) {
      console.error('加载环境失败:', e)
    }
  }

  const loadActiveVariables = async () => {
    if (!currentWorkspace.value?.path) {
      activeVariables.value = []
      return
    }
    try {
      const variablesMap = await invoke('get_active_variables', { workspacePath: currentWorkspace.value.path })
      activeVariables.value = Object.entries(variablesMap).map(([key, value]) => ({ key, value }))
    } catch (e) {
      console.error('加载激活变量失败:', e)
    }
  }

  const loadCookies = async () => {
    if (!currentWorkspace.value?.path) {
      cookies.value = []
      return
    }
    try {
      const cookieList = await invoke('get_cookies', { workspacePath: currentWorkspace.value.path })
      cookies.value = cookieList || []
    } catch (e) {
      console.error('加载 Cookies 失败:', e)
    }
  }

  const openCookiePanel = async () => {
    await loadCookies()
    showCookiePanel.value = true
  }

  const closeCookiePanel = () => {
    showCookiePanel.value = false
  }

  const openConsolePanel = () => {
    showConsolePanel.value = !showConsolePanel.value
  }

  const closeConsolePanel = () => {
    showConsolePanel.value = false
  }

  const clearConsoleLogs = () => {
    consoleLogs.value = []
  }

  const addConsoleLog = (type, message) => {
    const now = new Date()
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    consoleLogs.value.push({ type, message, time })
    if (consoleLogs.value.length > maxConsoleLogs) {
      consoleLogs.value.shift()
    }
  }

  const switchEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('switch_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      activeEnvironmentId.value = environmentId
      activeEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    } catch (e) {
      console.error('切换环境失败:', e)
    }
  }
  
  const selectEnvironment = (environmentId) => {
    selectedEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    selectedEnvVariables.value = selectedEnvironment.value?.variables?.length > 0 
      ? [...selectedEnvironment.value.variables] 
      : [{ key: '', value: '', enabled: true }]
  }

  const saveEnvironment = async (environment) => {
    if (!currentWorkspace.value?.path) return
    try {
      const result = await invoke('save_environment', {
        workspacePath: currentWorkspace.value.path,
        environment
      })
      const existingIndex = environments.value.findIndex(e => e.id === result.id)
      if (existingIndex >= 0) {
        environments.value[existingIndex] = result
      } else {
        environments.value.push(result)
      }
      return result
    } catch (e) {
      console.error('保存环境失败:', e)
      throw e
    }
  }

  const deleteEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('delete_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      environments.value = environments.value.filter(e => e.id !== environmentId)
      if (activeEnvironmentId.value === environmentId) {
        const firstEnv = environments.value[0]
        if (firstEnv) {
          await switchEnvironment(firstEnv.id)
        } else {
          activeEnvironmentId.value = null
          activeEnvironment.value = null
        }
      }
      if (selectedEnvironment.value?.id === environmentId) {
        selectedEnvironment.value = null
        selectedEnvVariables.value = []
      }
    } catch (e) {
      console.error('删除环境失败:', e)
    }
  }

  const saveEnvVariables = async () => {
    if (!currentWorkspace.value?.path || !selectedEnvironment.value) return
    const nonEmptyVars = selectedEnvVariables.value.filter(v => v.key.trim())
    const environment = {
      ...selectedEnvironment.value,
      variables: nonEmptyVars
    }
    try {
      const result = await saveEnvironment(environment)
      selectedEnvironment.value = result
      selectedEnvVariables.value = [...result.variables, { key: '', value: '', enabled: true }]
    } catch (e) {
      console.error('保存环境变量失败:', e)
    }
  }

  // 监听 HTTP 日志事件
  let unlistenHttpLog = null
  
  onMounted(async () => {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    
    // 监听后端发送的 HTTP 日志事件
    unlistenHttpLog = await listen('http-log', (event) => {
      const log = event.payload
      // 将后端日志转换为前端日志格式
      const logType = log.log_type === 'error' ? 'error' : 
                      log.log_type === 'response' ? 'info' : 'log'
      const message = JSON.stringify(log, null, 2)
      const timestamp = log.timestamp
      consoleLogs.value.push({ type: logType, message, time: timestamp })
      if (consoleLogs.value.length > maxConsoleLogs) {
        consoleLogs.value.shift()
      }
    })
    
    await loadLastWorkspace()
  })
  
  onUnmounted(() => {
    if (unlistenHttpLog) {
      unlistenHttpLog()
    }
  })

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
        await loadEnvironments()
        await loadCookies()
        await loadOpenTabs(workspace.path)
      }
    } catch (e) {
      console.error('加载工作区失败:', e)
    }
  }

  const loadOpenTabs = async (workspacePath) => {
    try {
      const [openTabIds, activeIndex, savedRequestTabs] = await invoke('get_open_tabs', { workspacePath })
      requestTabs.value = savedRequestTabs || {}
      if (openTabIds.length > 0) {
        const collections = await invoke('get_collections', { workspacePath })
        const apis = findApisInCollections(collections || [], openTabIds)
        for (const apiId of openTabIds) {
          const api = apis.find(a => a.id === apiId)
          if (api) {
            tabs.value.push({
              id: api.id,
              name: api.name,
              method: api.method || 'GET',
              url: api.url || '',
              headers: api.headers || [],
              body: api.body || '',
              bodyType: api.body_type || 'raw',
              formData: api.form_fields || [],
              binaryFile: api.binary_file_path ? { path: api.binary_file_path, name: api.binary_file_path.split(/[/\\]/).pop() } : null,
              tabType: 'api'
            })
          }
        }
        if (tabs.value.length > 0 && activeIndex < tabs.value.length) {
          activeTab.value = activeIndex
          const activeApiId = tabs.value[activeIndex].id
          currentRequestTab.value = requestTabs.value[activeApiId] || 'params'
          updateCurrentRequest()
          await nextTick()
          if (sidebarRef.value) {
            sidebarRef.value.setSelectedApi(activeApiId)
          }
        }
      }
    } catch (e) {
      console.error('加载标签页失败:', e)
    }
  }
  
  const findApisInCollections = (collections, apiIds) => {
    const apis = []
    for (const item of collections) {
      if (item.type === 'api' && apiIds.includes(item.id)) {
        apis.push(item)
      }
      if (item.children && item.children.length > 0) {
        apis.push(...findApisInCollections(item.children, apiIds))
      }
    }
    return apis
  }
  
  const saveOpenTabs = async () => {
    if (!currentWorkspace.value?.path) return
    try {
      // 只保存 API tabs（不保存集合 tabs）
      const apiTabIds = tabs.value.filter(t => t.tabType === 'api').map(t => t.id)
      await invoke('save_open_tabs', {
        workspacePath: currentWorkspace.value.path,
        openTabs: apiTabIds,
        activeTabIndex: activeTab.value,
        requestTabs: requestTabs.value
      })
    } catch (e) {
      console.error('保存标签页失败:', e)
    }
  }

  const openCreateWorkspace = () => {
    workspaceDialogMode.value = 'create'
    showWorkspaceDialog.value = true
  }

  const onWorkspaceCreated = async (workspace) => {
    showWorkspaceDialog.value = false
    await loadWorkspaces()
    sidebarRef.value?.loadWorkspaces()
  }

  const onWorkspaceDeleted = async (deletedId) => {
    await loadWorkspaces()
    if (currentWorkspace.value?.id === deletedId) {
      currentWorkspace.value = null
      tabs.value = []
      activeTab.value = 0
      collectionTabsData.value = {}
      activeEnvironmentId.value = null
      activeEnvironment.value = null
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
    }
  }

  const onSwitchWorkspace = async (workspace) => {
    currentWorkspace.value = workspace
    tabs.value = []
    activeTab.value = 0
    collectionTabsData.value = {}
    await loadEnvironments()
    await loadCookies()
    if (workspace?.path) {
      await sidebarRef.value?.loadCollections()
      await sidebarRef.value?.loadEnvironments()
      await loadOpenTabs(workspace.path)
      try {
        await invoke('set_last_workspace', { workspaceId: workspace.id })
      } catch (e) {
        console.error('保存工作区失败:', e)
      }
    }
  }

  const onNavChange = async (navKey) => {
    currentNavKey.value = navKey
    if (navKey !== 'history') {
      selectedHistoryEntry.value = null
    }
    if (navKey === 'environment') {
      await loadEnvironments()
    }
  }

  const onSwitchEnvironment = async (envId) => {
    await switchEnvironment(envId)
  }
  
  const onSelectEnvironment = (envId) => {
    selectEnvironment(envId)
  }

  const displayTabs = computed(() => {
    if (currentNavKey.value !== 'collection') return []
    return tabs.value
  })

  // 计算当前选中的集合
  const selectedCollection = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.tabType === 'collection') {
      return collectionTabsData.value[currentTab.id]
    }
    return null
  })

  // 是否显示请求/响应面板
  const showRequestResponse = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    return currentNavKey.value === 'collection' && currentTab?.tabType === 'api'
  })
  
  // 是否显示集合设置面板
  const showCollectionSettings = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    return currentNavKey.value === 'collection' && currentTab?.tabType === 'collection'
  })

  // 选择集合（打开设置页面）
  const selectCollection = (collection) => {
    const existingIndex = tabs.value.findIndex(t => t.id === collection.id && t.tabType === 'collection')
    
    if (existingIndex >= 0) {
      activeTab.value = existingIndex
    } else {
      collectionTabsData.value[collection.id] = collection
      tabs.value.push({
        id: collection.id,
        name: collection.name,
        tabType: 'collection'
      })
      activeTab.value = tabs.value.length - 1
    }
    
    if (sidebarRef.value) {
      sidebarRef.value.setSelectedApi(null)
    }
  }
  
  const onCollectionSettingsSaved = async () => {
    // 重新加载侧边栏集合列表
    sidebarRef.value?.loadCollections()
    
    // 更新当前打开的集合标签页数据
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.tabType === 'collection' && currentWorkspace.value?.path) {
      try {
        const collections = await invoke('get_collections', { workspacePath: currentWorkspace.value.path })
        // 递归查找当前集合
        const findCollection = (items, id) => {
          for (const item of items) {
            if (item.id === id) return item
            if (item.children?.length > 0) {
              const found = findCollection(item.children, id)
              if (found) return found
            }
          }
          return null
        }
        const updatedCollection = findCollection(collections, currentTab.id)
        if (updatedCollection) {
          collectionTabsData.value[currentTab.id] = updatedCollection
        }
      } catch (e) {
        console.error('更新集合标签页数据失败:', e)
      }
    }
  }

  const selectedHistoryEntry = ref(null)
  
  const onSelectHistory = (historyEntry) => {
    selectedHistoryEntry.value = historyEntry
  }

  const showHistoryDetail = computed(() => {
    return currentNavKey.value === 'history'
  })

  const showWorkspaceInfo = computed(() => {
    return currentNavKey.value === 'workspace' && currentWorkspace.value
  })

  const showEnvironmentInfo = computed(() => {
    return currentNavKey.value === 'environment' && currentWorkspace.value
  })

  const closeWorkspaceDialog = () => {
    showWorkspaceDialog.value = false
  }

  const closeTab = async (index) => {
    const wasActive = index === activeTab.value
    const closedTab = tabs.value[index]
    tabs.value.splice(index, 1)
    
    // 清理集合数据
    if (closedTab?.tabType === 'collection') {
      delete collectionTabsData.value[closedTab.id]
    }
    
    if (tabs.value.length === 0) {
      activeTab.value = 0
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      if (sidebarRef.value) {
        sidebarRef.value.setSelectedApi(null)
      }
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    } else if (wasActive) {
      // 如果关闭的是当前激活的 tab，同步选中状态
      const currentTab = tabs.value[activeTab.value]
      if (currentTab?.tabType === 'api' && sidebarRef.value) {
        sidebarRef.value.setSelectedApi(currentTab.id)
      }
    }
    
    // 只保存 API tabs
    await saveOpenTabs()
  }

  const onDeleteApis = (apiIds) => {
    for (const apiId of apiIds) {
      const index = tabs.value.findIndex(t => t.id === apiId && t.tabType === 'api')
      if (index >= 0) {
        tabs.value.splice(index, 1)
      }
    }
    if (tabs.value.length === 0) {
      activeTab.value = 0
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    }
  }

  // 删除集合时关闭对应的设置 tab
  const onDeleteCollection = (collectionId) => {
    const index = tabs.value.findIndex(t => t.id === collectionId && t.tabType === 'collection')
    if (index >= 0) {
      // 清理集合数据
      delete collectionTabsData.value[collectionId]
      tabs.value.splice(index, 1)
      
      if (tabs.value.length === 0) {
        activeTab.value = 0
      } else if (activeTab.value >= tabs.value.length) {
        activeTab.value = tabs.value.length - 1
      } else if (index === activeTab.value) {
        // 关闭的是当前激活的 tab
        // activeTab 值不变但指向新内容，需要更新显示
      }
    }
  }

  const selectApi = async (api) => {
    const existingIndex = tabs.value.findIndex(t => t.id === api.id && t.tabType === 'api')
    
    if (existingIndex >= 0) {
      // 更新已存在 tab 的 commonHeaders（集合设置可能已修改）
      tabs.value[existingIndex].commonHeaders = api.commonHeaders || []
      activeTab.value = existingIndex
    } else {
      tabs.value.push({
        id: api.id,
        name: api.name,
        method: api.method || 'GET',
        url: api.url || '',
        headers: api.headers || [],
        body: api.body || '',
        bodyType: api.body_type || 'raw',
        formData: api.form_fields || [],
        binaryFile: api.binary_file_path ? { path: api.binary_file_path, name: api.binary_file_path.split(/[/\\]/).pop() } : null,
        tabType: 'api',
        commonHeaders: api.commonHeaders || []
      })
      activeTab.value = tabs.value.length - 1
    }
    
    updateCurrentRequest()
    await saveOpenTabs()
  }

  watch(activeTab, async () => {
    updateCurrentRequest()
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.id) {
      if (currentTab.tabType === 'api' && sidebarRef.value) {
        sidebarRef.value.setSelectedApi(currentTab.id)
      }
      currentRequestTab.value = requestTabs.value[currentTab.id] || 'params'
    }
    await saveOpenTabs()
  })
  
  const onUpdateRequestTab = async (tabKey) => {
    currentRequestTab.value = tabKey
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.id && currentTab.tabType === 'api') {
      requestTabs.value[currentTab.id] = tabKey
      await saveOpenTabs()
    }
  }

  const updateCurrentRequest = () => {
    if (tabs.value.length === 0) {
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      currentRequest.formData = []
      currentRequest.binaryFile = null
      response.value = null
      return
    }
    
    const currentTab = tabs.value[activeTab.value]
    if (currentTab && currentTab.tabType === 'api') {
      currentRequest.method = currentTab.method
      currentRequest.url = currentTab.url
      currentRequest.headers = currentTab.headers && currentTab.headers.length > 0 
        ? currentTab.headers 
        : [{ key: 'Content-Type', value: 'application/json', enabled: true }]
      currentRequest.body = currentTab.body || ''
      currentRequest.bodyType = currentTab.bodyType || 'raw'
      currentRequest.formData = currentTab.formData || []
      currentRequest.binaryFile = currentTab.binaryFile || null
      
      if (currentTab.savedResponseData) {
        response.value = currentTab.savedResponseData
      } else if (currentTab.lastResponseData) {
        response.value = currentTab.lastResponseData
      } else {
        response.value = null
      }
    }
  }

  const updateRequest = (newRequest) => {
    currentRequest.method = newRequest.method
    currentRequest.url = newRequest.url
    currentRequest.params = newRequest.params
    currentRequest.headers = newRequest.headers
    currentRequest.body = newRequest.body
    currentRequest.bodyType = newRequest.bodyType
    currentRequest.formData = newRequest.formData
    currentRequest.binaryFile = newRequest.binaryFile
  }

  const sendRequest = async (request) => {
    loading.value = true
    response.value = null
    
    try {
      let bodyToSend = request.body
      
      // 获取当前 tab 的 commonHeaders
      const currentTab = tabs.value[activeTab.value]
      const commonHeaders = currentTab?.commonHeaders || []
      
      // 合并 headers：集合级别 + 接口级别（接口级别覆盖集合级别同名 header）
      const headersMap = new Map()
      
      // 先添加集合通用 headers
      for (const h of commonHeaders) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }
      
      // 然后添加接口 headers（覆盖同名）
      for (const h of (request.headers || [])) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }
      
      const headersToSend = Array.from(headersMap.values())
      
      const contentTypeHeader = headersToSend.find(
        h => h.key.toLowerCase() === 'content-type'
      )
      
      if (contentTypeHeader?.value?.includes('json') && request.body) {
        try {
          const parsed = JSON5.parse(request.body)
          bodyToSend = JSON.stringify(parsed)
        } catch {
          try {
            const parsed = JSON.parse(request.body)
            bodyToSend = JSON.stringify(parsed)
          } catch {}
        }
      }
      
      const formFields = request.formData?.map(field => ({
        key: field.key,
        value: field.value,
        type: field.type,
        enabled: field.enabled,
        files: field.files
      })) || null
      
      const binaryFilePath = request.binaryFile?.path || null
      
      // 使用前面已声明的 currentTab
      const apiId = currentTab?.tabType === 'api' ? currentTab?.id : null
      const apiName = currentTab?.tabType === 'api' ? currentTab?.name : null
      
      const result = await invoke('send_http_request', {
        method: request.method,
        url: request.url,
        headers: headersToSend,
        body: request.method !== 'GET' ? bodyToSend : null,
        bodyType: request.bodyType,
        formFields: formFields,
        binaryFilePath: binaryFilePath,
        workspacePath: currentWorkspace.value?.path || '',
        apiId: apiId,
        apiName: apiName
      })
      
      response.value = {
        status: result.status,
        statusText: result.status_text,
        headers: result.headers,
        body: result.body,
        time: result.time,
        size: result.size
      }
      
      if (currentTab && currentTab.tabType === 'api') {
        currentTab.lastResponseData = response.value
      }
    } catch (error) {
      response.value = {
        status: 0,
        statusText: '请求失败',
        headers: {},
        body: `错误: ${error}`,
        time: 0,
        size: 0
      }
      
      const currentTab = tabs.value[activeTab.value]
      if (currentTab && currentTab.tabType === 'api') {
        currentTab.lastResponseData = response.value
      }
    } finally {
      loading.value = false
    }
  }

  const saveRequest = async (request) => {
    if (!currentWorkspace.value?.path) return
    if (tabs.value.length === 0) return
    
    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.id || currentTab.tabType !== 'api') return
    
    const formFields = request.formData?.map(field => ({
      key: field.key,
      value: field.value,
      type: field.type,
      enabled: field.enabled,
      files: field.files
    })) || null
    
    const binaryFilePath = request.binaryFile?.path || null
    
    try {
      await invoke('update_api', {
        workspacePath: currentWorkspace.value.path,
        id: currentTab.id,
        name: currentTab.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        bodyType: request.bodyType,
        formFields: formFields,
        binaryFilePath: binaryFilePath
      })
      
      currentTab.method = request.method
      currentTab.url = request.url
      currentTab.headers = request.headers
      currentTab.body = request.body
      currentTab.bodyType = request.bodyType
      
      sidebarRef.value?.loadCollections()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  const onRenameApi = ({ id, name }) => {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.name = name
    }
  }

  const onSaveResponse = () => {
    if (!response.value) return
    const now = new Date()
    const dateStr = now.toLocaleDateString('zh-CN')
    const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    saveResponseDefaultName.value = `响应 - ${dateStr} ${timeStr}`
    showSaveResponseDialog.value = true
  }

  const handleSaveResponse = async (name) => {
    if (!currentWorkspace.value?.path || !response.value || tabs.value.length === 0) return
    
    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.id || currentTab.tabType !== 'api') return
    
    const formFields = currentRequest.formData?.map(field => ({
      key: field.key,
      value: field.value,
      type: field.type,
      enabled: field.enabled,
      files: field.files
    })) || null
    
    const binaryFilePath = currentRequest.binaryFile?.path || null
    
    const request = {
      method: currentRequest.method,
      url: currentRequest.url,
      resolved_url: currentRequest.url,
      headers: currentRequest.headers || [],
      body: currentRequest.body || null,
      body_type: currentRequest.bodyType || null,
      form_fields: formFields,
      binary_file_path: binaryFilePath
    }
    
    const responseData = {
      status: response.value.status,
      status_text: response.value.statusText,
      headers: response.value.headers || {},
      body: response.value.body || '',
      time: response.value.time || 0,
      size: response.value.size || 0
    }
    
    try {
      await invoke('save_response', {
        workspacePath: currentWorkspace.value.path,
        name: name,
        apiId: currentTab.id,
        request: request,
        response: responseData,
        cookies: cookies.value
      })
      
      showSaveResponseDialog.value = false
      sidebarRef.value?.loadCollections()
    } catch (e) {
      console.error('保存响应失败:', e)
    }
  }

  const onSelectSavedResponse = async (responseItem) => {
    if (!currentWorkspace.value?.path) return
    
    try {
      const fullResponse = await invoke('get_saved_response', {
        workspacePath: currentWorkspace.value.path,
        id: responseItem.id
      })
      
      const savedTabId = `saved_${responseItem.id}`
      
      const existingIndex = tabs.value.findIndex(t => t.id === savedTabId)
      
      const apiId = responseItem.api_id
      const apiTab = tabs.value.find(t => t.id === apiId)
      const apiName = apiTab?.name || '接口'
      const fullTabName = `[${apiName}] ${fullResponse.name}`
      
      if (existingIndex >= 0) {
        activeTab.value = existingIndex
      } else {
        tabs.value.push({
          id: savedTabId,
          name: fullTabName,
          fullName: fullTabName,
          method: fullResponse.request.method,
          url: fullResponse.request.url,
          headers: fullResponse.request.headers || [],
          body: fullResponse.request.body || '',
          bodyType: fullResponse.request.body_type || 'raw',
          formData: fullResponse.request.form_fields || [],
          binaryFile: fullResponse.request.binary_file_path ? { path: fullResponse.request.binary_file_path, name: fullResponse.request.binary_file_path.split(/[/\\]/).pop() } : null,
          tabType: 'api',
          savedResponseData: {
            status: fullResponse.response.status,
            statusText: fullResponse.response.status_text,
            headers: fullResponse.response.headers || {},
            body: fullResponse.response.body || '',
            time: fullResponse.response.time || 0,
            size: fullResponse.response.size || 0
          }
        })
        activeTab.value = tabs.value.length - 1
      }
      
      updateCurrentRequest()
      response.value = tabs.value[activeTab.value]?.savedResponseData || null
      
    } catch (e) {
      console.error('获取保存响应失败:', e)
    }
  }

  return {
    currentWorkspace,
    workspaces,
    showWorkspaceDialog,
    workspaceDialogMode,
    sidebarRef,
    tabs,
    displayTabs,
    activeTab,
    currentRequest,
    currentRequestTab,
    response,
    loading,
    environments,
    activeEnvironmentId,
    activeEnvironment,
    selectedEnvironment,
    selectedEnvVariables,
    activeVariables,
    loadEnvironments,
    loadActiveVariables,
    switchEnvironment,
    selectEnvironment,
    saveEnvironment,
    deleteEnvironment,
    saveEnvVariables,
    cookies,
    showCookiePanel,
    loadCookies,
    openCookiePanel,
    closeCookiePanel,
    showConsolePanel,
    consoleLogs,
    openConsolePanel,
    closeConsolePanel,
    clearConsoleLogs,
    showSaveResponseDialog,
    saveResponseDefaultName,
    onSaveResponse,
    handleSaveResponse,
    onSelectSavedResponse,
    onSelectHistory,
    selectedHistoryEntry,
    collectionTabsData,
    selectedCollection,
    selectCollection,
    showCollectionSettings,
    onCollectionSettingsSaved,
    currentNavKey,
    onNavChange,
    onSwitchEnvironment,
    onSelectEnvironment,
    showRequestResponse,
    showHistoryDetail,
    showWorkspaceInfo,
    showEnvironmentInfo,
    openCreateWorkspace,
    onWorkspaceCreated,
    onWorkspaceDeleted,
    onSwitchWorkspace,
    loadWorkspaces,
    closeWorkspaceDialog,
    closeTab,
    selectApi,
    sendRequest,
    saveRequest,
    updateRequest,
    onRenameApi,
    onDeleteApis,
    onDeleteCollection,
    onUpdateRequestTab
  }
}