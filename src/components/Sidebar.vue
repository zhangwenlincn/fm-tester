<script setup>
import { ref, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import Icon from './Icon.vue'

const navItems = [
  { icon: 'collection', name: '集合', key: 'collection' },
  { icon: 'environment', name: '环境', key: 'environment' },
  { icon: 'workspace', name: '工作区', key: 'workspace' },
  { icon: 'function', name: '功能', key: 'function' },
  { icon: 'performance', name: '性能', key: 'performance' },
  { icon: 'toolbox', name: '工具箱', key: 'toolbox' },
  { icon: 'history', name: '历史', key: 'history' }
]

const collections = ref([
  {
    id: 1,
    name: '用户管理 API',
    expanded: true,
    children: [
      {
        id: 11,
        name: '用户认证',
        expanded: true,
        children: [
          { id: 111, name: '用户登录', method: 'POST' },
          { id: 112, name: '用户注册', method: 'POST' },
          { id: 113, name: '获取用户信息', method: 'GET' }
        ]
      },
      {
        id: 12,
        name: '用户操作',
        children: [
          { id: 121, name: '更新用户', method: 'PUT' },
          { id: 122, name: '删除用户', method: 'DELETE' }
        ]
      }
    ]
  },
  {
    id: 2,
    name: '订单管理 API',
    expanded: false,
    children: [
      { id: 21, name: '创建订单', method: 'POST' },
      { id: 22, name: '查询订单', method: 'GET' },
      { id: 23, name: '取消订单', method: 'DELETE' }
    ]
  },
  {
    id: 3,
    name: '商品管理 API',
    expanded: false,
    children: [
      { id: 31, name: '商品列表', method: 'GET' },
      { id: 32, name: '商品详情', method: 'GET' }
    ]
  }
])

// 工作区列表
const workspaces = ref([])
const currentWorkspace = ref(null)
const activeNav = ref(0)
const selectedApi = ref(null)
const searchQuery = ref('')

const emit = defineEmits(['selectApi', 'switchWorkspace', 'createWorkspace'])

// 获取当前导航项
const currentNavItem = () => navItems[activeNav.value]

// 选择导航项
const selectNav = async (index) => {
  activeNav.value = index
  
  // 切换到工作区时加载工作区列表
  if (navItems[index].key === 'workspace') {
    await loadWorkspaces()
  }
}

// 加载工作区列表
const loadWorkspaces = async () => {
  try {
    workspaces.value = await invoke('get_workspaces')
  } catch (e) {
    console.error('加载工作区失败:', e)
  }
}

// 切换工作区
const switchWorkspace = async (workspace) => {
  try {
    const ws = await invoke('switch_workspace', { id: workspace.id })
    currentWorkspace.value = ws
    emit('switchWorkspace', ws)
  } catch (e) {
    console.error('切换工作区失败:', e)
  }
}

// 新建工作区
const createWorkspace = () => {
  emit('createWorkspace')
}

// 删除工作区
const deleteWorkspace = async (ws) => {
  try {
    await invoke('delete_workspace', { id: ws.id })
    
    // 刷新列表
    await loadWorkspaces()
    
    // 如果删除的是当前工作区，清空当前工作区
    if (currentWorkspace.value?.id === ws.id) {
      currentWorkspace.value = null
      emit('switchWorkspace', null)
    }
  } catch (e) {
    console.error('删除工作区失败:', e)
  }
}

// 暴露方法给父组件
defineExpose({
  loadWorkspaces
})

// 展开/折叠文件夹
const toggleFolder = (item) => {
  item.expanded = !item.expanded
}

// 选择 API
const selectApiItem = (api) => {
  selectedApi.value = api.id
  emit('selectApi', api)
}

// 获取 HTTP 方法样式类
const getMethodClass = (method) => {
  return method?.toLowerCase() || ''
}

// 接收父组件传入的当前工作区
const props = defineProps({
  workspace: Object
})

watch(() => props.workspace, (ws) => {
  if (ws) {
    currentWorkspace.value = ws
  }
})

onMounted(async () => {
  await loadWorkspaces()
})
</script>

<template>
  <div class="sidebar">
    <!-- 图标导航 -->
    <div class="icon-nav">
      <div 
        v-for="(item, index) in navItems" 
        :key="item.name"
        class="nav-item"
        :class="{ active: activeNav === index }"
        :title="item.name"
        @click="selectNav(index)"
      >
        <span class="nav-icon"><Icon :name="item.icon" /></span>
      </div>
    </div>
    
    <!-- 面板内容 -->
    <div class="collection-panel">
      <!-- 集合面板 -->
      <template v-if="currentNavItem().key === 'collection'">
        <div class="panel-header">
          <span class="panel-title">集合</span>
          <div class="panel-actions">
            <span class="action-btn" title="新建">+</span>
            <span class="action-btn" title="导入">↓</span>
          </div>
        </div>
        
        <div class="search-box">
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="搜索..."
            class="search-input"
          />
        </div>
        
        <!-- 树形列表 -->
        <div class="tree-list">
          <template v-for="item in collections" :key="item.id">
            <!-- 文件夹 -->
            <div 
              class="tree-folder"
              @click="toggleFolder(item)"
            >
              <span class="folder-icon"><Icon :name="item.expanded ? 'folder-open' : 'folder'" /></span>
              <span class="folder-name">{{ item.name }}</span>
            </div>
            
            <!-- 子项 -->
            <div v-if="item.expanded && item.children" class="tree-children">
              <template v-for="child in item.children" :key="child.id">
                <!-- 子文件夹 -->
                <div 
                  v-if="child.children"
                  class="tree-folder sub-folder"
                  @click="toggleFolder(child)"
                >
                  <span class="folder-icon"><Icon :name="child.expanded ? 'folder-open' : 'folder'" /></span>
                  <span class="folder-name">{{ child.name }}</span>
                </div>
                
                <!-- API 项 -->
                <template v-if="child.expanded && child.children">
                  <div 
                    v-for="api in child.children" 
                    :key="api.id"
                    class="tree-item"
                    :class="{ selected: selectedApi === api.id }"
                    @click="selectApiItem(api)"
                  >
                    <span class="method-tag" :class="getMethodClass(api.method)">{{ api.method }}</span>
                    <span class="item-name">{{ api.name }}</span>
                  </div>
                </template>
                
                <!-- 直接 API 项（无子文件夹） -->
                <div 
                  v-if="!child.children"
                  class="tree-item"
                  :class="{ selected: selectedApi === child.id }"
                  @click="selectApiItem(child)"
                >
                  <span class="method-tag" :class="getMethodClass(child.method)">{{ child.method }}</span>
                  <span class="item-name">{{ child.name }}</span>
                </div>
              </template>
            </div>
            
            <!-- 直接 API 项（无子文件夹） -->
            <div v-if="item.expanded && !item.children" class="tree-children">
              <div 
                v-for="api in item" 
                :key="api.id"
                class="tree-item"
                :class="{ selected: selectedApi === api.id }"
                @click="selectApiItem(api)"
              >
                <span class="method-tag" :class="getMethodClass(api.method)">{{ api.method }}</span>
                <span class="item-name">{{ api.name }}</span>
              </div>
            </div>
          </template>
        </div>
      </template>
      
      <!-- 工作区面板 -->
      <template v-if="currentNavItem().key === 'workspace'">
        <div class="panel-header">
          <span class="panel-title">工作区</span>
          <div class="panel-actions">
            <span class="action-btn" title="新建工作区" @click="createWorkspace">+</span>
          </div>
        </div>
        
        <!-- 当前工作区 -->
        <div class="current-workspace" v-if="currentWorkspace">
          <div class="ws-current-header">当前工作区</div>
          <div class="ws-current-item">
            <span class="ws-icon"><Icon name="ws" /></span>
            <div class="ws-info">
              <span class="ws-name">{{ currentWorkspace.name }}</span>
              <span class="ws-path">{{ currentWorkspace.path }}</span>
            </div>
          </div>
        </div>
        
        <!-- 工作区列表 -->
        <div class="workspace-list">
          <div class="ws-list-header">所有工作区</div>
          <div 
            v-for="ws in workspaces" 
            :key="ws.id"
            class="ws-item"
            :class="{ active: currentWorkspace?.id === ws.id }"
          >
            <span class="ws-icon" @click="switchWorkspace(ws)"><Icon name="ws" /></span>
            <div class="ws-info" @click="switchWorkspace(ws)">
              <span class="ws-name">{{ ws.name }}</span>
              <span class="ws-desc">{{ ws.description || '无描述' }}</span>
              <span class="ws-time">最后打开: {{ ws.last_opened }}</span>
            </div>
            <span class="ws-delete" @click="deleteWorkspace(ws)" title="删除工作区">×</span>
          </div>
          
          <div v-if="workspaces.length === 0" class="ws-empty">
            暂无工作区，点击上方 + 创建
          </div>
        </div>
      </template>
      
      <!-- 其他面板（占位） -->
      <template v-else>
        <div class="panel-header">
          <span class="panel-title">{{ currentNavItem().name }}</span>
        </div>
        <div class="empty-panel">
          功能开发中...
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  width: 240px;
  background: #ffffff;
  border-right: 1px solid #e8e8e8;
}

.icon-nav {
  width: 48px;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 40px;
  cursor: pointer;
}

.nav-item:hover {
  background: #e8e8e8;
}

.nav-item.active {
  background: #e6f7ff;
}

.nav-icon {
  font-size: 18px;
}

.collection-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.panel-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #8c8c8c;
}

.action-btn:hover {
  color: #1890ff;
}

.search-box {
  padding: 8px 16px;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 12px;
  outline: none;
}

.search-input:focus {
  border-color: #1890ff;
}

.tree-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.tree-folder {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  cursor: pointer;
}

.tree-folder:hover {
  background: #f5f5f5;
}

.sub-folder {
  padding-left: 32px;
}

.folder-icon {
  font-size: 14px;
  margin-right: 6px;
}

.folder-name {
  font-size: 13px;
  color: #262626;
}

.tree-children {
  padding-left: 8px;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 6px 16px 6px 32px;
  cursor: pointer;
}

.tree-item:hover {
  background: #f5f5f5;
}

.tree-item.selected {
  background: #e6f7ff;
}

.method-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 3px;
  margin-right: 8px;
}

.method-tag.post {
  background: #fff7e6;
  color: #fa8c16;
}

.method-tag.get {
  background: #f6ffed;
  color: #52c416;
}

.method-tag.put {
  background: #e6f7ff;
  color: #1890ff;
}

.method-tag.delete {
  background: #fff1f0;
  color: #f5222d;
}

.item-name {
  font-size: 13px;
  color: #262626;
}

/* 工作区样式 */
.current-workspace {
  padding: 16px;
  border-bottom: 1px solid #e8e8e8;
}

.ws-current-header {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.ws-current-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  background: #e6f7ff;
  border-radius: 4px;
}

.workspace-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.ws-list-header {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.ws-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  margin-bottom: 8px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.ws-icon, .ws-info {
  cursor: pointer;
}

.ws-item:hover {
  background: #f5f5f5;
}

.ws-item.active {
  background: #e6f7ff;
  border-color: #1890ff;
}

.ws-icon {
  font-size: 16px;
}

.ws-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.ws-name {
  font-size: 14px;
  font-weight: 500;
  color: #262626;
}

.ws-path {
  font-size: 12px;
  color: #8c8c8c;
}

.ws-desc {
  font-size: 12px;
  color: #8c8c8c;
}

.ws-time {
  font-size: 11px;
  color: #bfbfbf;
}

.ws-delete {
  font-size: 16px;
  color: #bfbfbf;
  cursor: pointer;
  padding: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.ws-item:hover .ws-delete {
  opacity: 1;
}

.ws-delete:hover {
  color: #f5222d;
}

.ws-empty {
  text-align: center;
  color: #8c8c8c;
  padding: 20px;
}

.empty-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
}
</style>