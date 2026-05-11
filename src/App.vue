<script setup>
import { ref, reactive } from 'vue'
import MenuBar from './components/MenuBar.vue'
import TabsBar from './components/TabsBar.vue'
import Sidebar from './components/Sidebar.vue'
import RequestPanel from './components/RequestPanel.vue'
import ResponsePanel from './components/ResponsePanel.vue'
import StatusBar from './components/StatusBar.vue'

// 标签页数据
const tabs = ref([
  { name: '用户登录', method: 'POST', url: 'https://api.example.com/users/login' }
])
const activeTab = ref(0)

// 当前请求
const currentRequest = reactive({
  method: 'POST',
  url: 'https://api.example.com/users/login',
  params: [],
  headers: [
    { key: 'Content-Type', value: 'application/json', enabled: true }
  ],
  body: '{\n  "username": "admin",\n  "password": "123456"\n}',
  bodyType: 'raw'
})

// 响应数据
const response = ref(null)
const loading = ref(false)

// 添加标签页
const addTab = () => {
  const newTab = {
    name: '新请求',
    method: 'GET',
    url: ''
  }
  tabs.value.push(newTab)
  activeTab.value = tabs.value.length - 1
}

// 关闭标签页
const closeTab = (index) => {
  if (tabs.value.length > 1) {
    tabs.value.splice(index, 1)
    if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    }
  }
}

// 选择 API
const selectApi = (api) => {
  // 更新当前请求
  currentRequest.method = api.method
  currentRequest.url = `https://api.example.com/${api.name.toLowerCase().replace(/\s+/g, '/')}`
  
  // 更新标签页
  tabs.value[activeTab.value].name = api.name
  tabs.value[activeTab.value].method = api.method
  tabs.value[activeTab.value].url = currentRequest.url
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
const saveRequest = (request) => {
  console.log('保存请求:', request)
  // TODO: 实现保存功能
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
        @update:active-tab="activeTab = $event"
        @add-tab="addTab"
        @close-tab="closeTab"
      />
    </div>
    
    <!-- 主内容区 -->
    <div class="main-area">
      <!-- 左侧导航 -->
      <Sidebar @select-api="selectApi" />
      
      <!-- 中间内容区 -->
      <div class="content-area">
        <!-- 请求区 -->
        <div class="request-area">
          <RequestPanel 
            :request="currentRequest"
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