<script setup>
import { useI18n } from 'vue-i18n'
import { useWorkspacePanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  workspace: Object  // 当前选中的工作区，用于显示选中状态
})

const emit = defineEmits(['selectWorkspace', 'createWorkspace', 'workspaceDeleted'])

// 使用 composable
const {
  workspaces,
  currentWorkspace,
  wsContextMenu,
  dragState,
  loadWorkspaces,
  selectWorkspace,
  createWorkspace,
  openWsContextMenu,
  closeWsContextMenu,
  handleWsContextAction,
  onMouseDown
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
      <span class="panel-title">{{ t('panels.workspaces') }}</span>
      <div class="panel-actions">
        <span class="action-btn" :title="t('buttons.newWorkspace')" @click="createWorkspace">+</span>
      </div>
    </div>
    
    <!-- 工作区列表 -->
    <div class="env-list">
      <div 
        v-for="ws in workspaces" 
        :key="ws.id"
        :data-item-id="ws.id"
        class="env-item"
        :class="{
          active: currentWorkspace?.id === ws.id,
          dragging: dragState.draggingId === ws.id,
          'drag-over-before': dragState.dragOverId === ws.id && dragState.dragPosition === 'before',
          'drag-over-after': dragState.dragOverId === ws.id && dragState.dragPosition === 'after'
        }"
        @mousedown="(e) => onMouseDown(e, ws)"
        @click="selectWorkspace(ws)"
        @contextmenu.prevent="(e) => openWsContextMenu(e, ws)"
      >
        <div class="env-header">
          <span class="env-icon">
            <Icon :name="ws.workspace_type === 'git' ? 'git' : 'folder'" />
          </span>
          <span class="env-name">{{ ws.name }}</span>
          <span v-if="ws.workspace_type === 'git'" class="ws-type-badge">Git</span>
        </div>
      </div>
      
      <div v-if="workspaces.length === 0" class="empty-panel">
        {{ t('empty.noWorkspaces') }}
      </div>
    </div>
    
    <!-- 工作区右键菜单 -->
    <div 
      v-if="wsContextMenu.visible" 
      class="context-menu"
      :style="{ left: wsContextMenu.x + 'px', top: wsContextMenu.y + 'px' }"
    >
      <!-- Git 工作区菜单项 -->
      <template v-if="wsContextMenu.ws?.workspace_type === 'git'">
        <div class="menu-item" @click="handleWsContextAction('sync-ws')">
          <span class="menu-icon"><Icon name="sync" :size="14" /></span>
          {{ t('contextMenu.syncWorkspace') }}
        </div>
        <div class="menu-divider"></div>
      </template>
      <!-- 删除工作区（所有类型都有） -->
      <div class="menu-item delete" @click="handleWsContextAction('delete-ws')">
        <span class="menu-icon">🗑</span>
        {{ t('contextMenu.deleteWorkspace') }}
      </div>
    </div>
  </div>
</template>

<style src="./style.css" scoped></style>