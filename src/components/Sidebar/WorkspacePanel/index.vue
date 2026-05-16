<script setup>
import { useWorkspacePanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  workspace: Object  // 当前选中的工作区，用于显示选中状态
})

const emit = defineEmits(['selectWorkspace', 'createWorkspace', 'workspaceDeleted'])

// 使用 composable
const {
  workspaces,
  currentWorkspace,
  wsContextMenu,
  loadWorkspaces,
  selectWorkspace,
  createWorkspace,
  openWsContextMenu,
  closeWsContextMenu,
  handleWsContextAction
} = useWorkspacePanelSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadWorkspaces
})
</script>

<template>
  <div class="workspace-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="panel-title">工作区</span>
      <div class="panel-actions">
        <span class="action-btn" title="新建工作区" @click="createWorkspace">+</span>
      </div>
    </div>
    
    <!-- 工作区列表 -->
    <div class="env-list">
      <div 
        v-for="ws in workspaces" 
        :key="ws.id"
        class="env-item"
        :class="{ active: currentWorkspace?.id === ws.id }"
        @click="selectWorkspace(ws)"
        @contextmenu.prevent="(e) => openWsContextMenu(e, ws)"
      >
        <div class="env-header">
          <span class="env-icon"><Icon name="workspace" /></span>
          <span class="env-name">{{ ws.name }}</span>
        </div>
      </div>
      
      <div v-if="workspaces.length === 0" class="empty-panel">
        暂无工作区，点击上方 + 创建
      </div>
    </div>
    
    <!-- 工作区右键菜单 -->
    <div 
      v-if="wsContextMenu.visible" 
      class="context-menu"
      :style="{ left: wsContextMenu.x + 'px', top: wsContextMenu.y + 'px' }"
    >
      <div class="menu-item delete" @click="handleWsContextAction('delete-ws')">
        <span class="menu-icon">🗑</span>
        删除工作区
      </div>
    </div>
  </div>
</template>

<style src="./style.css" scoped></style>