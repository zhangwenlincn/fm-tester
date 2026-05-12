<script setup>
import { useWorkspaceDialogSetup } from './index.js'

const props = defineProps({
  visible: Boolean,
  mode: String // 'create' or 'select'
})

const emit = defineEmits(['close', 'created', 'selected'])

const {
  name,
  description,
  path,
  error,
  loading,
  workspaces,
  selectedWorkspaceId,
  selectPath,
  createWorkspace,
  handleSelectWorkspaceItem,
  selectWorkspace,
  close
} = useWorkspaceDialogSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">
          {{ mode === 'create' ? '创建工作区' : '选择工作区' }}
        </span>
        <span class="dialog-close" @click="close">×</span>
      </div>

      <div class="dialog-body">
        <!-- 创建模式 -->
        <div v-if="mode === 'create'" class="create-form">
          <div class="form-group">
            <label>名称</label>
            <input 
              v-model="name" 
              type="text" 
              placeholder="输入工作区名称"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>描述</label>
            <input 
              v-model="description" 
              type="text" 
              placeholder="输入工作区描述（可选）"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>路径</label>
            <div class="path-input">
              <input 
                v-model="path" 
                type="text" 
                placeholder="选择工作区存储路径"
                class="form-input"
                readonly
              />
              <button class="btn-select" @click="selectPath">选择</button>
            </div>
          </div>
        </div>

        <!-- 选择模式 -->
        <div v-if="mode === 'select'" class="select-list">
          <div 
            v-for="ws in workspaces" 
            :key="ws.id"
            class="workspace-item"
            :class="{ selected: selectedWorkspaceId === ws.id }"
            @click="handleSelectWorkspaceItem(ws.id)"
          >
            <div class="ws-name">{{ ws.name }}</div>
            <div class="ws-path">{{ ws.path }}</div>
            <div class="ws-time">最后打开: {{ ws.last_opened }}</div>
          </div>
          
          <div v-if="workspaces.length === 0" class="empty-tip">
            暂无工作区，请先创建
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="dialog-footer">
        <button 
          v-if="mode === 'create'" 
          class="btn-primary" 
          :disabled="loading"
          @click="createWorkspace"
        >
          {{ loading ? '创建中...' : '创建' }}
        </button>
        
        <button 
          v-if="mode === 'select'" 
          class="btn-primary" 
          :disabled="loading"
          @click="selectWorkspace"
        >
          {{ loading ? '切换中...' : '切换' }}
        </button>

        <button class="btn-secondary" @click="close">取消</button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>