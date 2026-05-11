<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

const props = defineProps({
  visible: Boolean,
  mode: String // 'create' or 'select'
})

const emit = defineEmits(['close', 'created', 'selected'])

// 表单数据
const name = ref('')
const description = ref('')
const path = ref('')
const error = ref('')
const loading = ref(false)

// 工作区列表
const workspaces = ref([])
const selectedWorkspaceId = ref(null)

// 加载工作区列表
const loadWorkspaces = async () => {
  try {
    workspaces.value = await invoke('get_workspaces')
  } catch (e) {
    console.error('加载工作区列表失败:', e)
  }
}

// 选择路径
const selectPath = async () => {
  try {
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择工作区路径'
    })
    if (selected) {
      path.value = selected
    }
  } catch (e) {
    console.error('选择路径失败:', e)
  }
}

// 创建工作区
const createWorkspace = async () => {
  if (!name.value.trim()) {
    error.value = '请输入工作区名称'
    return
  }
  if (!path.value.trim()) {
    error.value = '请选择工作区路径'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const workspace = await invoke('create_workspace', {
      name: name.value,
      description: description.value,
      path: path.value
    })
    emit('created', workspace)
    resetForm()
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

// 选择工作区
const selectWorkspace = async () => {
  if (!selectedWorkspaceId.value) {
    error.value = '请选择一个工作区'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const workspace = await invoke('switch_workspace', { id: selectedWorkspaceId.value })
    emit('selected', workspace)
  } catch (e) {
    error.value = e
  } finally {
    loading.value = false
  }
}

// 重置表单
const resetForm = () => {
  name.value = ''
  description.value = ''
  path.value = ''
  error.value = ''
}

// 关闭对话框
const close = () => {
  resetForm()
  emit('close')
}

// 监听显示状态
watch(() => props.visible, (visible) => {
  if (visible && props.mode === 'select') {
    loadWorkspaces()
  }
})
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
            @click="selectedWorkspaceId = ws.id"
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

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  border-radius: 8px;
  width: 400px;
  max-width: 90%;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e8e8e8;
}

.dialog-title {
  font-size: 16px;
  font-weight: 600;
  color: #262626;
}

.dialog-close {
  font-size: 20px;
  color: #8c8c8c;
  cursor: pointer;
  line-height: 1;
}

.dialog-close:hover {
  color: #262626;
}

.dialog-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 14px;
  color: #262626;
  margin-bottom: 6px;
}

.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.form-input:focus {
  border-color: #1890ff;
}

.path-input {
  display: flex;
  gap: 8px;
}

.path-input .form-input {
  flex: 1;
}

.btn-select {
  padding: 8px 16px;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-select:hover {
  background: #e8e8e8;
}

.select-list {
  max-height: 300px;
  overflow-y: auto;
}

.workspace-item {
  padding: 12px;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  margin-bottom: 8px;
  cursor: pointer;
}

.workspace-item:hover {
  background: #f5f5f5;
}

.workspace-item.selected {
  background: #e6f7ff;
  border-color: #1890ff;
}

.ws-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.ws-path {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 4px;
}

.ws-time {
  font-size: 12px;
  color: #8c8c8c;
  margin-top: 2px;
}

.empty-tip {
  text-align: center;
  color: #8c8c8c;
  padding: 20px;
}

.error-msg {
  color: #f5222d;
  font-size: 14px;
  margin-top: 12px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 16px 20px;
  border-top: 1px solid #e8e8e8;
}

.btn-primary {
  padding: 8px 20px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-primary:hover:not(:disabled) {
  background: #40a9ff;
}

.btn-primary:disabled {
  background: #d9d9d9;
  cursor: not-allowed;
}

.btn-secondary {
  padding: 8px 20px;
  background: #fff;
  color: #262626;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #f5f5f5;
}
</style>