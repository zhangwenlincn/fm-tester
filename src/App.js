import { ref, reactive, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

// 导出 composable 函数
export function useAppSetup() {
  // 工作区数据
  const currentWorkspace = ref(null)
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
    bodyType: 'raw'
  })

  // 响应数据
  const response = ref(null)
  const loading = ref(false)

  // 禁用右键菜单
  onMounted(() => {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault()
    })
    
    // 加载最近打开的工作区
    loadLastWorkspace()
  })

  // 加载最近工作区
  const loadLastWorkspace = async () => {
    try {
      const workspace = await invoke('get_last_workspace')
      if (workspace) {
        currentWorkspace.value = workspace
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

  // 工作区创建完成
  const onWorkspaceCreated = (workspace) => {
    currentWorkspace.value = workspace
    showWorkspaceDialog.value = false
    // 清空标签页
    tabs.value = []
    activeTab.value = 0
    // 刷新侧边栏工作区列表和集合列表
    sidebarRef.value?.loadWorkspaces()
    sidebarRef.value?.loadCollections()
  }

  // 工作区切换（来自 Sidebar）
  const onSwitchWorkspace = async (workspace) => {
    currentWorkspace.value = workspace
    // 清空当前标签页
    tabs.value = []
    activeTab.value = 0
    // 加载该工作区的最后接口
    if (workspace?.id) {
      await loadLastApi(workspace.id)
    }
  }

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
        bodyType: api.body_type || 'raw'
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
    }
  }

  // 发送请求
  const sendRequest = async (request) => {
    loading.value = true
    response.value = null
    
    try {
      // 使用 Rust 后端发送请求（绕过 CORS）
      const result = await invoke('send_http_request', {
        method: request.method,
        url: request.url,
        headers: request.headers || [],
        body: request.method !== 'GET' ? request.body : null
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
    
    try {
      await invoke('update_api', {
        workspacePath: currentWorkspace.value.path,
        id: currentTab.id,
        name: currentTab.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        bodyType: request.bodyType
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
    showWorkspaceDialog,
    workspaceDialogMode,
    sidebarRef,
    tabs,
    activeTab,
    currentRequest,
    response,
    loading,
    openCreateWorkspace,
    onWorkspaceCreated,
    onSwitchWorkspace,
    closeWorkspaceDialog,
    closeTab,
    selectApi,
    sendRequest,
    saveRequest,
    onRenameApi
  }
}