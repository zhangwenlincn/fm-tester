<script setup>
import { useSidebarSetup } from './index.js'
import IconNav from './IconNav/index.vue'
import CollectionPanel from './CollectionPanel/index.vue'
import EnvironmentPanel from './EnvironmentPanel/index.vue'
import WorkspacePanel from './WorkspacePanel/index.vue'
import SavedResponsesPanel from './SavedResponsesPanel/index.vue'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits([
  'selectApi',
  'selectEnvironment',
  'createWorkspace',
  'renameApi',
  'deleteApis',
  'navChange',
  'environmentUpdated',
  'workspaceDeleted',
  'selectSavedResponse'
])

// 使用 composable
const {
  activeNav,
  navItems,
  collectionPanelRef,
  environmentPanelRef,
  workspacePanelRef,
  savedResponsesPanelRef,
  handleNavChange,
  handleSelectApi,
  handleDeleteApis,
  handleRenameApi,
  handleSelectEnvironment,
  handleEnvironmentUpdated,
  handleSelectWorkspace,
  handleCreateWorkspace,
  handleWorkspaceDeleted,
  handleSelectSavedResponse,
  handleDeleteSavedResponse,
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadSavedResponses,
  setSelectedApi
} = useSidebarSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadWorkspaces,
  loadCollections,
  loadEnvironments,
  loadSavedResponses,
  setSelectedApi
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
        @delete-apis="handleDeleteApis"
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
      
      <!-- 已保存响应面板 -->
      <SavedResponsesPanel 
        v-if="navItems[activeNav]?.key === 'saved-responses'"
        ref="savedResponsesPanelRef"
        :workspace="props.workspace"
        @select="handleSelectSavedResponse"
        @delete="handleDeleteSavedResponse"
      />
      
      <!-- 其他面板（功能、性能、工具箱） -->
      <div 
        v-if="navItems[activeNav]?.key !== 'collection' && 
              navItems[activeNav]?.key !== 'workspace' && 
              navItems[activeNav]?.key !== 'environment' &&
              navItems[activeNav]?.key !== 'saved-responses'"
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