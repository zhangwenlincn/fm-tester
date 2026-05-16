<template>
  <div class="environment-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="panel-title">环境</span>
      <div class="panel-actions">
        <span class="action-btn" title="新建环境" @click="openCreateEnvDialog">+</span>
      </div>
    </div>
    
    <!-- 提示：需要先选择工作区 -->
    <div v-if="!workspace" class="empty-panel">
      请先选择或创建工作区
    </div>
    
    <!-- 环境列表 -->
    <div 
      v-else 
      class="env-list" 
      @contextmenu="(e) => openEnvContextMenu(e, null, 'root')"
    >
      <div 
        v-for="env in environments" 
        :key="env.id"
        :data-item-id="env.id"
        class="env-item"
        :class="{ 
          active: activeEnvironmentId === env.id,
          dragging: dragState.draggingId === env.id,
          'drag-over-before': dragState.dragOverId === env.id && dragState.dragPosition === 'before',
          'drag-over-after': dragState.dragOverId === env.id && dragState.dragPosition === 'after'
        }"
        @mousedown="(e) => onMouseDown(e, env)"
        @click="selectEnvironment(env.id)"
        @contextmenu.prevent="(e) => openEnvContextMenu(e, env, 'env')"
      >
        <div class="env-header">
          <span class="env-icon"><Icon name="environment" /></span>
          <span class="env-name">{{ env.name }}</span>
        </div>
      </div>
      
      <div v-if="environments.length === 0" class="empty-panel">
        暂无环境，右键创建
      </div>
    </div>
    
    <!-- 环境编辑对话框 -->
    <div v-if="showEnvDialog" class="create-dialog-overlay" @click.self="showEnvDialog = false">
      <div class="create-dialog env-dialog">
        <div class="dialog-header">
          <span>{{ editingEnv ? '编辑环境' : '新建环境' }}</span>
          <span class="dialog-close" @click="showEnvDialog = false">×</span>
        </div>
        
        <div class="dialog-body">
          <div class="dialog-row">
            <label>环境名称</label>
            <input v-model="editingEnvName" type="text" placeholder="如：开发环境、测试环境" />
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-cancel" @click="showEnvDialog = false">取消</button>
          <button class="btn-confirm" @click="handleSaveEnv">保存</button>
        </div>
      </div>
    </div>
    
    <!-- 环境右键菜单 -->
    <div 
      v-if="envContextMenu.visible" 
      class="context-menu"
      :style="{ left: envContextMenu.x + 'px', top: envContextMenu.y + 'px' }"
      @click.stop
    >
      <!-- 根级别菜单 -->
      <template v-if="envContextMenu.type === 'root'">
        <div class="menu-item" @click="handleEnvContextAction('new-env')">
          <span class="menu-icon"><Icon name="environment" :size="14" /></span>
          <span>新建环境</span>
        </div>
      </template>
      
      <!-- 环境菜单 -->
      <template v-if="envContextMenu.type === 'env'">
        <div class="menu-item" @click="handleEnvContextAction('edit-env')">
          <span>编辑环境</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item delete" @click="handleEnvContextAction('delete-env')">
          <span>删除环境</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { useEnvironmentPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  workspace: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['selectEnvironment', 'environmentUpdated'])

const {
  environments,
  activeEnvironmentId,
  showEnvDialog,
  editingEnv,
  editingEnvName,
  editingEnvVariables,
  envContextMenu,
  dragState,
  loadEnvironments,
  selectEnvironment,
  openCreateEnvDialog,
  openEditEnvDialog,
  addEnvVariable,
  removeEnvVariable,
  handleSaveEnv,
  deleteEnvironment,
  openEnvContextMenu,
  closeEnvContextMenu,
  handleEnvContextAction,
  onMouseDown
} = useEnvironmentPanelSetup(props, emit)

// 暴露方法供父组件调用
defineExpose({
  loadEnvironments
})
</script>

<style scoped src="./style.css"></style>