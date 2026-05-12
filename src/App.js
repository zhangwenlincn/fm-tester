import { ref, reactive, onMounted, watch, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import JSON5 from 'json5'

// 导出 composable 函数
export function useAppSetup() {
  // 工作区数据
  const currentWorkspace = ref(null)
  const workspaces = ref([])  // 工作区列表
  const showWorkspaceDialog = ref(false)
  const workspaceDialogMode = ref('create')
  const sidebarRef = ref(null)

  // 标签页数据
  const tabs = ref([])
  const activeTab = ref(0)

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
  const activeEnvironmentId = ref(null)  // 后端激活环境 ID（MenuBar 显示）
  const activeEnvironment = ref(null)    // 后端激活环境对象（MenuBar 显示）
  const selectedEnvironment = ref(null)  // Sidebar 选中的环境（EnvironmentPanel 显示）
  const selectedEnvVariables = ref([])   // Sidebar 选中环境的变量列表
  const activeVariables = ref([])        // 当前激活环境的变量列表（用于自动补全）

  // 当前侧边栏导航项
  const currentNavKey = ref('collection')

  // 加载环境配置
  const loadEnvironments = async () => {
    if (!currentWorkspace.value?.path) {
      // 清空环境数据
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
      // 设置 MenuBar 显示的激活环境
      if (activeEnvironmentId.value) {
        activeEnvironment.value = environments.value.find(e => e.id === activeEnvironmentId.value) || null
      } else {
        activeEnvironment.value = null
      }
      // Sidebar 选中环境清空
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      // 加载激活环境变量（用于自动补全）
      await loadActiveVariables()
    } catch (e) {
      console.error('加载环境失败:', e)
      environments.value = []
      activeEnvironmentId.value = null
      activeEnvironment.value = null
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      activeVariables.value = []
    }
  }

  // 加载当前激活环境的变量（用于自动补全）
  const loadActiveVariables = async () => {
    if (!currentWorkspace.value?.path) {
      activeVariables.value = []
      return
    }
    try {
      const variablesMap = await invoke('get_active_variables', { workspacePath: currentWorkspace.value.path })
      // 转换为数组格式 [{ key, value }]
      activeVariables.value = Object.entries(variablesMap).map(([key, value]) => ({ key, value }))
    } catch (e) {
      console.error('加载激活变量失败:', e)
      activeVariables.value = []
    }
  }

  // 切换环境（来自 MenuBar 下拉，调用后端，更新 MenuBar 显示）
  const switchEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('switch_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      // 更新 MenuBar 显示的激活环境
      activeEnvironmentId.value = environmentId
      activeEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    } catch (e) {
      console.error('切换环境失败:', e)
    }
  }
  
  // 选择环境（来自 Sidebar 选中，更新 EnvironmentPanel 显示）
  const selectEnvironment = (environmentId) => {
    selectedEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    // 同步编辑变量列表
    selectedEnvVariables.value = selectedEnvironment.value?.variables?.length > 0 
      ? [...selectedEnvironment.value.variables] 
      : [{ key: '', value: '', enabled: true }]
  }

  // 保存环境
  const saveEnvironment = async (environment) => {
    if (!currentWorkspace.value?.path) return
    try {
      const result = await invoke('save_environment', {
        workspacePath: currentWorkspace.value.path,
        environment
      })
      // 更新本地列表
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

  // 删除环境
  const deleteEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('delete_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      environments.value = environments.value.filter(e => e.id !== environmentId)
      // 如果删除的是 MenuBar 激活环境，切换到第一个
      if (activeEnvironmentId.value === environmentId) {
        const firstEnv = environments.value[0]
        if (firstEnv) {
          await switchEnvironment(firstEnv.id)
        } else {
          activeEnvironmentId.value = null
          activeEnvironment.value = null
        }
      }
      // 如果删除的是 Sidebar 选中的环境，清空
      if (selectedEnvironment.value?.id === environmentId) {
        selectedEnvironment.value = null
        selectedEnvVariables.value = []
      }
    } catch (e) {
      console.error('删除环境失败:', e)
    }
  }

  // 保存环境变量
  const saveEnvVariables = async () => {
    if (!currentWorkspace.value?.path || !selectedEnvironment.value) return
    // 过滤非空变量
    const nonEmptyVars = selectedEnvVariables.value.filter(v => v.key.trim())
    const environment = {
      ...selectedEnvironment.value,
      variables: nonEmptyVars
    }
    try {
      const result = await saveEnvironment(environment)
      // 更新本地状态，保留一个空行用于添加新变量
      selectedEnvironment.value = result
      selectedEnvVariables.value = [...result.variables, { key: '', value: '', enabled: true }]
    } catch (e) {
      console.error('保存环境变量失败:', e)
    }
  }

  // 禁用右键菜单
  onMounted(() => {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    
    // 加载最近打开的工作区
    loadLastWorkspace()
  })

  // 加载工作区列表
  const loadWorkspaces = async () => {
    try {
      const list = await invoke('get_workspaces')
      workspaces.value = list || []
    } catch (e) {
      console.error('加载工作区列表失败:', e)
      workspaces.value = []
    }
  }

  // 加载最近工作区
  const loadLastWorkspace = async () => {
    try {
      // 先加载工作区列表
      await loadWorkspaces()
      
      const workspace = await invoke('get_last_workspace')
      if (workspace) {
        currentWorkspace.value = workspace
        // 加载环境配置
        await loadEnvironments()
        // 加载最后打开的接口
        await loadLastApi(workspace.id)
      }
    } catch (e) {
      console.error('加载工作区失败:', e)
    }
  }

  // 加载最后打开的接口
  const loadLastApi = async (workspaceId) => {
    try {
      const lastApi = await invoke('get_last_api', { workspaceId })
      if (lastApi) {
        // 自动打开最后接口
        selectApi(lastApi)
      }
    } catch (e) {
      console.error('加载最后接口失败:', e)
    }
  }

  // 创建工作区
  const openCreateWorkspace = () => {
    workspaceDialogMode.value = 'create'
    showWorkspaceDialog.value = true
  }

  // 工作区创建完成（不自动切换，保持原选中状态）
  const onWorkspaceCreated = async (workspace) => {
    showWorkspaceDialog.value = false
    // 刷新工作区列表（App.js、MenuBar、Sidebar）
    await loadWorkspaces()
    sidebarRef.value?.loadWorkspaces()
  }

  // 工作区删除完成（检查是否是当前选中）
  const onWorkspaceDeleted = async (deletedId) => {
    // 刷新工作区列表
    await loadWorkspaces()
    // 如果删除的是当前选中的工作区，清空相关状态
    if (currentWorkspace.value?.id === deletedId) {
      currentWorkspace.value = null
      tabs.value = []
      activeTab.value = 0
      // 清空环境
      activeEnvironmentId.value = null
      activeEnvironment.value = null
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
    }
  }

  // 工作区切换（来自 Sidebar 或 MenuBar）
  const onSwitchWorkspace = async (workspace) => {
    currentWorkspace.value = workspace
    // 清空当前标签页
    tabs.value = []
    activeTab.value = 0
    // 加载该工作区的环境配置（如果 workspace 为 null，会清空环境）
    await loadEnvironments()
    // 加载该工作区的最后接口
    if (workspace?.id) {
      await loadLastApi(workspace.id)
      // 保存为最后打开的工作区
      try {
        await invoke('set_last_workspace', { workspaceId: workspace.id })
      } catch (e) {
        console.error('保存工作区失败:', e)
      }
    }
    // 刷新侧边栏
    sidebarRef.value?.loadCollections()
    sidebarRef.value?.loadEnvironments()
  }

  // 导航切换（来自 Sidebar）
  const onNavChange = async (navKey) => {
    currentNavKey.value = navKey
    // 切换到环境面板时加载环境数据
    if (navKey === 'environment') {
      await loadEnvironments()
    }
  }

  // 环境切换（来自 MenuBar 下拉，调用后端）
  const onSwitchEnvironment = async (envId) => {
    await switchEnvironment(envId)
  }
  
  // 环境选中（来自 Sidebar，更新显示）
  const onSelectEnvironment = (envId) => {
    selectEnvironment(envId)
  }

  // 是否显示请求/响应面板
  const showRequestResponse = computed(() => {
    return currentNavKey.value === 'collection' && tabs.value.length > 0
  })

  // 是否显示工作区信息面板
  const showWorkspaceInfo = computed(() => {
    return currentNavKey.value === 'workspace' && currentWorkspace.value
  })

  // 是否显示环境信息面板
  const showEnvironmentInfo = computed(() => {
    return currentNavKey.value === 'environment' && currentWorkspace.value
  })

  // 关闭对话框
  const closeWorkspaceDialog = () => {
    showWorkspaceDialog.value = false
  }

  // 关闭标签页
  const closeTab = (index) => {
    tabs.value.splice(index, 1)
    if (tabs.value.length === 0) {
      activeTab.value = 0
      // 清空当前请求
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    }
  }

  // 删除接口时关闭对应标签页
  const onDeleteApis = (apiIds) => {
    for (const apiId of apiIds) {
      const index = tabs.value.findIndex(t => t.id === apiId)
      if (index >= 0) {
        tabs.value.splice(index, 1)
      }
    }
    // 如果全部关闭，清空当前请求
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

  // 选择 API - 添加新标签页（如果不存在）
  const selectApi = async (api) => {
    // 查找是否已存在该接口的标签
    const existingIndex = tabs.value.findIndex(t => t.id === api.id)
    
    if (existingIndex >= 0) {
      // 已存在，切换到该标签
      activeTab.value = existingIndex
    } else {
      // 不存在，添加新标签
      tabs.value.push({
        id: api.id,
        name: api.name,
        method: api.method || 'GET',
        url: api.url || '',
        headers: api.headers || [],
        body: api.body || '',
        bodyType: api.body_type || 'raw',
        formData: api.form_fields || [],
        binaryFile: api.binary_file_path ? { path: api.binary_file_path, name: api.binary_file_path.split(/[/\\]/).pop() } : null
      })
      activeTab.value = tabs.value.length - 1
    }
    
    // 更新当前请求
    updateCurrentRequest()
    
    // 保存为最后打开的接口
    if (currentWorkspace.value?.id) {
      try {
        await invoke('set_last_api', {
          workspaceId: currentWorkspace.value.id,
          apiId: api.id
        })
      } catch (e) {
        console.error('保存最后接口失败:', e)
      }
    }
  }

  // 监听标签切换，更新请求内容
  watch(activeTab, () => {
    updateCurrentRequest()
    // 切换标签时清空响应
    response.value = null
  })

  // 更新当前请求
  const updateCurrentRequest = () => {
    if (tabs.value.length === 0) {
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      currentRequest.formData = []
      currentRequest.binaryFile = null
      return
    }
    
    const currentTab = tabs.value[activeTab.value]
    if (currentTab) {
      currentRequest.method = currentTab.method
      currentRequest.url = currentTab.url
      currentRequest.headers = currentTab.headers && currentTab.headers.length > 0 
        ? currentTab.headers 
        : [{ key: 'Content-Type', value: 'application/json', enabled: true }]
      currentRequest.body = currentTab.body || ''
      currentRequest.bodyType = currentTab.bodyType || 'raw'
      currentRequest.formData = currentTab.formData || []
      currentRequest.binaryFile = currentTab.binaryFile || null
    }
  }

// 更新请求（来自 RequestPanel）
  const updateRequest = (newRequest) => {
    // 逐个属性更新，确保 Vue 响应式系统正确追踪
    currentRequest.method = newRequest.method
    currentRequest.url = newRequest.url
    currentRequest.params = newRequest.params
    currentRequest.headers = newRequest.headers
    currentRequest.body = newRequest.body
    currentRequest.bodyType = newRequest.bodyType
    currentRequest.formData = newRequest.formData
    currentRequest.binaryFile = newRequest.binaryFile
  }

// 发送请求
  const sendRequest = async (request) => {
    loading.value = true
    response.value = null
    
    try {
      // 处理请求体
      let bodyToSend = request.body
      const headersToSend = request.headers || []
      
      // 检查 Content-Type 并处理 JSON
      const contentTypeHeader = headersToSend.find(
        h => h.key.toLowerCase() === 'content-type'
      )
      
      // 如果是 JSON 类型，用 JSON5 解析并转换为标准 JSON
      if (contentTypeHeader?.value?.includes('json') && request.body) {
        try {
          const parsed = JSON5.parse(request.body)
          bodyToSend = JSON.stringify(parsed)
        } catch {
          try {
            const parsed = JSON.parse(request.body)
            bodyToSend = JSON.stringify(parsed)
          } catch {
            // 解析失败，保持原样发送
          }
        }
      }
      
      // 准备 form_fields 数据（转换字段名以匹配后端）
      const formFields = request.formData?.map(field => ({
        key: field.key,
        value: field.value,
        type: field.type,
        enabled: field.enabled,
        files: field.files
      })) || null
      
      // 准备 binary 文件路径
      const binaryFilePath = request.binaryFile?.path || null
      
      // 使用 Rust 后端发送请求（绕过 CORS，支持环境变量替换）
      const result = await invoke('send_http_request', {
        method: request.method,
        url: request.url,
        headers: headersToSend,
        body: request.method !== 'GET' ? bodyToSend : null,
        bodyType: request.bodyType,
        formFields: formFields,
        binaryFilePath: binaryFilePath,
        workspacePath: currentWorkspace.value?.path || ''
      })
      
      response.value = {
        status: result.status,
        statusText: result.status_text,
        headers: result.headers,
        body: result.body,
        time: result.time,
        size: result.size
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
    } finally {
      loading.value = false
    }
  }

  // 保存请求
  const saveRequest = async (request) => {
    if (!currentWorkspace.value?.path) {
      console.error('未选择工作区')
      return
    }
    
    if (tabs.value.length === 0) {
      console.error('没有打开的接口')
      return
    }
    
    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.id) {
      console.error('当前标签没有接口 ID')
      return
    }
    
    // 准备 form_fields 数据（转换字段名以匹配后端）
    const formFields = request.formData?.map(field => ({
      key: field.key,
      value: field.value,
      type: field.type,
      enabled: field.enabled,
      files: field.files
    })) || null
    
    // 准备 binary 文件路径
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
      
      // 更新 tabs 中的信息
      currentTab.method = request.method
      currentTab.url = request.url
      currentTab.headers = request.headers
      currentTab.body = request.body
      currentTab.bodyType = request.bodyType
      
      // 刷新集合列表
      sidebarRef.value?.loadCollections()
      
      console.log('保存成功')
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  // 重命名接口后更新 tabs
  const onRenameApi = ({ id, name }) => {
    const tab = tabs.value.find(t => t.id === id)
    if (tab) {
      tab.name = name
    }
  }

  return {
    currentWorkspace,
    workspaces,
    showWorkspaceDialog,
    workspaceDialogMode,
    sidebarRef,
    tabs,
    activeTab,
    currentRequest,
    response,
    loading,
    // 环境相关
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
    // 导航相关
    currentNavKey,
    onNavChange,
    onSwitchEnvironment,
    onSelectEnvironment,
    showRequestResponse,
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
    onDeleteApis
  }
}