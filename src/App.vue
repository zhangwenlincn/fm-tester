<script setup>
import { ref, reactive, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import MenuBar from './components/MenuBar.vue'
import TabsBar from './components/TabsBar.vue'
import Sidebar from './components/Sidebar.vue'
import RequestPanel from './components/RequestPanel.vue'
import ResponsePanel from './components/ResponsePanel.vue'
import StatusBar from './components/StatusBar.vue'
import WorkspaceDialog from './components/WorkspaceDialog.vue'

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
    }
  } catch (e) {
    console.error('加载工作区失败:', e)
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
  // 刷新侧边栏工作区列表和集合列表
  sidebarRef.value?.loadWorkspaces()
  sidebarRef.value?.loadCollections()
}

// 工作区切换（来自 Sidebar）
const onSwitchWorkspace = (workspace) => {
  currentWorkspace.value = workspace
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
const selectApi = (api) => {
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
  
  const startTime = Date.now()
  
  try {
    // 构建请求头
    const headers = {}
    request.headers.forEach(h => {
      if (h.enabled && h.key) {
        headers[h.key] = h.value
      }
    })
    
    // 构建请求选项
    const options = {
      method: request.method,
      headers: headers
    }
    
    // 添加请求体（非 GET 请求）
    if (request.method !== 'GET' && request.body) {
      options.body = request.body
    }
    
    // 发送请求
    const res = await fetch(request.url, options)
    const endTime = Date.now()
    
    // 获取响应体
    let body = ''
    try {
      body = await res.text()
    } catch (e) {
      body = '无法读取响应内容'
    }
    
    // 获取响应头
    const responseHeaders = {}
    res.headers.forEach((value, key) => {
      responseHeaders[key] = value
    })
    
    // 设置响应数据
    response.value = {
      status: res.status,
      statusText: res.statusText,
      headers: responseHeaders,
      body: body,
      time: endTime - startTime,
      size: body.length
    }
  } catch (error) {
    const endTime = Date.now()
    response.value = {
      status: 0,
      statusText: '请求失败',
      headers: {},
      body: `错误: ${error.message}`,
      time: endTime - startTime,
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
</script>

<template>
  <div class="app-container">
    <!-- 顶部区域 -->
    <div class="top-area">
      <MenuBar />
      <TabsBar 
        :tabs="tabs"
        :active-tab="activeTab"
        :workspace="currentWorkspace"
        @update:active-tab="activeTab = $event"
        @close-tab="closeTab"
      />
    </div>
    
    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 左侧导航 -->
      <Sidebar 
        ref="sidebarRef"
        :workspace="currentWorkspace"
        @select-api="selectApi"
        @switch-workspace="onSwitchWorkspace"
        @create-workspace="openCreateWorkspace"
        @rename-api="onRenameApi"
      />
      
      <!-- 中间内容区 -->
      <div class="content-area">
        <!-- 请求区 -->
        <div class="request-area">
          <RequestPanel 
            :request="currentRequest"
            :has-active-tab="tabs.length > 0"
            @update:request="Object.assign(currentRequest, $event)"
            @send="sendRequest"
            @save="saveRequest"
          />
        </div>
        
        <!-- 响应区 -->
        <div class="response-area">
          <ResponsePanel 
            :response="response"
            :loading="loading"
          />
        </div>
      </div>
    </div>
    
    <!-- 底部状态栏 -->
    <StatusBar />
    
    <!-- 工作区对话框 -->
    <WorkspaceDialog 
      :visible="showWorkspaceDialog"
      :mode="workspaceDialogMode"
      @close="closeWorkspaceDialog"
      @created="onWorkspaceCreated"
    />
  </div>
</template>

<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  overflow: hidden;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
  color: #262626;
  background: #f5f5f5;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.top-area {
  flex-shrink: 0;
  background: #ffffff;
}

.main-area {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  background: #ffffff;
}

.request-area {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}

.response-area {
  flex: 1;
  min-height: 200px;
  overflow: hidden;
}
</style>