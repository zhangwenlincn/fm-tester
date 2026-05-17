<script setup>
import { useI18n } from 'vue-i18n'
import { useSidebarSetup, navItems } from './index.js'
import IconNav from './IconNav/index.vue'
import CollectionPanel from './CollectionPanel/index.vue'
import EnvironmentPanel from './EnvironmentPanel/index.vue'
import WorkspacePanel from './WorkspacePanel/index.vue'
import HistoryPanel from './HistoryPanel/index.vue'
import ChatHistoryPanel from './ChatHistoryPanel/index.vue'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits([
  'selectApi',
  'selectCollection',
  'deleteCollection',
  'selectEnvironment',
  'createWorkspace',
  'renameApi',
  'deleteApis',
  'navChange',
  'environmentUpdated',
  'workspaceDeleted',
  'selectSavedResponse',
  'selectHistory',
  'selectWorkspace',
  'workspaceUpdated',
  'selectChatSession',
  'newChatSession',
  'sessionCreated'
])

// 使用 composable
const { t } = useI18n()
const {
  activeNavKey,
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
  handleSessionCreated,
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadHistory,
  loadChatSessions,
  setSelectedApi,
  setSelectedCollection
} = useSidebarSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadHistory,
  loadChatSessions,
  setSelectedApi,
  setSelectedCollection
})
</script>

<template>
  <div class="sidebar">
    <!-- 图标导航 -->
    <IconNav 
      :active-key="activeNavKey"
      @nav-change="handleNavChange"
    />
    
    <!-- 面板内容区域 -->
    <div class="panel-container">
      <!-- 集合面板 -->
      <CollectionPanel 
        v-if="activeNavKey === 'collection'"
        ref="collectionPanelRef"
        :workspace="props.workspace"
        @select-api="handleSelectApi"
        @select-collection="handleSelectCollection"
        @delete-apis="handleDeleteApis"
        @delete-collection="handleDeleteCollection"
        @rename-api="handleRenameApi"
        @select-saved-response="handleSelectSavedResponse"
      />
      
      <!-- 环境面板 -->
      <EnvironmentPanel 
        v-if="activeNavKey === 'environment'"
        ref="environmentPanelRef"
        :workspace="props.workspace"
        @select-environment="handleSelectEnvironment"
        @environment-updated="handleEnvironmentUpdated"
      />
      
      <!-- 工作区面板 -->
      <WorkspacePanel 
        v-if="activeNavKey === 'workspace'"
        ref="workspacePanelRef"
        :workspace="props.workspace"
        @select-workspace="handleSelectWorkspace"
        @create-workspace="handleCreateWorkspace"
        @workspace-deleted="handleWorkspaceDeleted"
        @workspace-updated="handleWorkspaceUpdated"
      />
      
      <!-- 历史面板 -->
      <HistoryPanel 
        v-if="activeNavKey === 'history'"
        ref="historyPanelRef"
        :workspace="props.workspace"
        @select-history="handleSelectHistory"
      />
      
      <!-- 聊天会话面板 -->
      <ChatHistoryPanel 
        v-if="activeNavKey === 'chat'"
        ref="chatHistoryPanelRef"
        :workspace="props.workspace"
        @select-session="handleSelectChatSession"
        @new-session="handleNewChatSession"
        @session-created="handleSessionCreated"
      />
      
      <!-- 其他面板 -->
      <div 
        v-if="['function', 'performance', 'toolbox'].includes(activeNavKey)"
        class="other-panel"
      >
        <div class="panel-header">
          <span class="panel-title">{{ t(navItems.find(n => n.key === activeNavKey)?.nameKey || '') }}</span>
        </div>
        <div class="empty-panel">
          {{ t('common.developing') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>