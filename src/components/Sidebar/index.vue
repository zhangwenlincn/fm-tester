<script setup>
import { useSidebarSetup } from './index.js'
import IconNav from './IconNav/index.vue'
import CollectionPanel from './CollectionPanel/index.vue'
import EnvironmentPanel from './EnvironmentPanel/index.vue'
import WorkspacePanel from './WorkspacePanel/index.vue'
import HistoryPanel from './HistoryPanel/index.vue'


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
  'selectWorkspace'
])

// 使用 composable
const {
  activeNav,
  navItems,
  collectionPanelRef,
  environmentPanelRef,
  workspacePanelRef,
  historyPanelRef,
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
  handleSelectSavedResponse,
  handleSelectHistory,
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadHistory,
  setSelectedApi,
  setSelectedCollection
} = useSidebarSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadHistory,
  setSelectedApi,
  setSelectedCollection
})
</script>

<template>
  <div class="sidebar">
    <!-- 图标导航 -->
    <IconNav 
      :active-index="activeNav"
      @nav-change="handleNavChange"
    />
    
    <!-- 面板内容区域 -->
    <div class="panel-container">
      <!-- 集合面板 -->
      <CollectionPanel 
        v-if="navItems[activeNav]?.key === 'collection'"
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
        v-if="navItems[activeNav]?.key === 'environment'"
        ref="environmentPanelRef"
        :workspace="props.workspace"
        @select-environment="handleSelectEnvironment"
        @environment-updated="handleEnvironmentUpdated"
      />
      
      <!-- 工作区面板 -->
      <WorkspacePanel 
        v-if="navItems[activeNav]?.key === 'workspace'"
        ref="workspacePanelRef"
        :workspace="props.workspace"
        @select-workspace="handleSelectWorkspace"
        @create-workspace="handleCreateWorkspace"
        @workspace-deleted="handleWorkspaceDeleted"
      />
      
      <!-- 历史面板 -->
      <HistoryPanel 
        v-if="navItems[activeNav]?.key === 'history'"
        ref="historyPanelRef"
        :workspace="props.workspace"
        @select-history="handleSelectHistory"
      />
      
      <!-- 其他面板（功能、性能、工具箱） -->
      <div 
        v-if="navItems[activeNav]?.key !== 'collection' && 
              navItems[activeNav]?.key !== 'workspace' && 
              navItems[activeNav]?.key !== 'environment' &&
              navItems[activeNav]?.key !== 'history'"
        class="other-panel"
      >
        <div class="panel-header">
          <span class="panel-title">{{ navItems[activeNav]?.name }}</span>
        </div>
        <div class="empty-panel">
          功能开发中...
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>