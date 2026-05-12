<script setup>
import { useAppSetup } from './App.js'
import MenuBar from './components/MenuBar/index.vue'
import TabsBar from './components/TabsBar/index.vue'
import Sidebar from './components/Sidebar/index.vue'
import RequestPanel from './components/RequestPanel/index.vue'
import ResponsePanel from './components/ResponsePanel/index.vue'
import StatusBar from './components/StatusBar/index.vue'
import WorkspaceDialog from './components/WorkspaceDialog/index.vue'
import EnvironmentPanel from './components/EnvironmentPanel/index.vue'

// 使用 composable
const {
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
  showRequestResponse,
  showWorkspaceInfo,
  showEnvironmentInfo,
  onSwitchEnvironment,
  onSelectEnvironment,
  openCreateWorkspace,
  onWorkspaceCreated,
  onWorkspaceDeleted,
  onSwitchWorkspace,
  loadWorkspaces,
  onNavChange,
  closeWorkspaceDialog,
  closeTab,
  selectApi,
  sendRequest,
  saveRequest,
  updateRequest,
  onRenameApi,
  onDeleteApis
} = useAppSetup()
</script>

<template>
  <div class="app-container">
    <!-- 顶部区域 -->
    <div class="top-area">
      <MenuBar
        ref="menuBarRef"
        :workspaces="workspaces"
        :current-workspace="currentWorkspace"
        :environments="environments"
        :active-environment="activeEnvironment"
        @switch-workspace="onSwitchWorkspace"
        @switch-environment="onSwitchEnvironment"
      />
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
        @nav-change="onNavChange"
        @select-environment="onSelectEnvironment"
        @environment-updated="loadEnvironments"
        @workspace-deleted="onWorkspaceDeleted"
      />
      
      <!-- 中间内容区 -->
      <div class="content-area" v-if="showRequestResponse">
        <!-- 请求区 -->
        <div class="request-area">
          <RequestPanel 
            :request="currentRequest"
            :has-active-tab="tabs.length > 0"
            :variables="activeVariables"
            @update:request="updateRequest($event)"
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
      
      <!-- 工作区信息面板 -->
      <div class="content-area workspace-info-panel" v-else-if="showWorkspaceInfo">
      </div>
      
      <!-- 环境信息面板 -->
      <div class="content-area" v-else-if="showEnvironmentInfo">
        <EnvironmentPanel 
          :active-environment="selectedEnvironment"
          :editing-env-variables="selectedEnvVariables"
          @save-variables="saveEnvVariables"
        />
      </div>
      
      <!-- 空状态提示 -->
      <div class="empty-content" v-else>
        <div class="empty-message">
          {{ currentWorkspace ? '请选择或创建接口' : '请先选择或创建工作区' }}
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