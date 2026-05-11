<script setup>
import { useAppSetup } from './App.js'
import MenuBar from './components/MenuBar/index.vue'
import TabsBar from './components/TabsBar/index.vue'
import Sidebar from './components/Sidebar/index.vue'
import RequestPanel from './components/RequestPanel/index.vue'
import ResponsePanel from './components/ResponsePanel/index.vue'
import StatusBar from './components/StatusBar/index.vue'
import WorkspaceDialog from './components/WorkspaceDialog/index.vue'

// 使用 composable
const {
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
  onRenameApi,
  onDeleteApis
} = useAppSetup()
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
        @delete-apis="onDeleteApis"
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

<style scoped src="./App.css"></style>