<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
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

// 集合数据
const collections = ref([])
const expandedItems = ref({})
const selectedApi = ref(null)
const searchQuery = ref('')
const showCreateDialog = ref(false)
const createDialogParent = ref(null)
const newItemName = ref('')
// 重命名
const showRenameDialog = ref(false)
const renameItem = ref(null)
const renameItemType = ref('')
const renameItemName = ref('')

// 最大层级深度（集合最多三层）
const MAX_DEPTH = 2 // depth 0, 1, 2 共三层

// 右键菜单
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  item: null,
  depth: 0,
  type: '' // 'collection' 或 'root'
})

// 工作区列表
const workspaces = ref([])
const currentWorkspace = ref(null)
const activeNav = ref(0)

const emit = defineEmits(['selectApi', 'switchWorkspace', 'createWorkspace', 'renameApi'])

// 接收父组件传入的当前工作区
const props = defineProps({
  workspace: Object
})

// 获取当前导航项
const currentNavItem = () => navItems[activeNav.value]

// 选择导航项
const selectNav = async (index) => {
  activeNav.value = index
  
  if (navItems[index].key === 'workspace') {
    await loadWorkspaces()
  } else if (navItems[index].key === 'collection') {
    await loadCollections()
  }
}

// 加载集合列表
const loadCollections = async () => {
  if (!props.workspace?.path) return
  try {
    const data = await invoke('get_collections', { workspacePath: props.workspace.path })
    collections.value = data || []
    console.log('加载集合数据:', data)
  } catch (e) {
    console.error('加载集合失败:', e)
    collections.value = []
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
    await loadWorkspaces()
    if (currentWorkspace.value?.id === ws.id) {
      currentWorkspace.value = null
      emit('switchWorkspace', null)
    }
  } catch (e) {
    console.error('删除工作区失败:', e)
  }
}

// 展开/折叠
const toggleExpand = (id) => {
  expandedItems.value[id] = !expandedItems.value[id]
}

const isExpanded = (id) => expandedItems.value[id] ?? false

// 选择 API
const selectApiItem = (api) => {
  selectedApi.value = api.id
  emit('selectApi', api)
}

// 打开创建对话框（根级别）
const openRootCreateDialog = () => {
  createDialogParent.value = null
  newItemName.value = ''
  showCreateDialog.value = true
}

// 打开创建对话框（集合下）
const openCreateDialog = (parent) => {
  createDialogParent.value = parent
  newItemName.value = ''
  showCreateDialog.value = true
}

// 是否可以创建子集合（层级限制）
const canCreateSubCollection = (depth) => {
  return depth < MAX_DEPTH
}

// 打开右键菜单
const openContextMenu = (event, item, depth, type) => {
  event.preventDefault()
  event.stopPropagation()
  
  contextMenu.value = {
    visible: true,
    x: event.clientX,
    y: event.clientY,
    item: item,
    depth: depth,
    type: type
  }
}

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenu.value.visible = false
}

// 右键菜单操作
const handleContextAction = async (action) => {
  const { item, depth, type } = contextMenu.value
  
  if (action === 'new-collection') {
    if (type === 'root') {
      openRootCreateDialog()
    } else if (canCreateSubCollection(depth)) {
      openCreateDialog(item)
    }
  } else if (action === 'new-api') {
    // 直接创建接口，不弹对话框
    if (!props.workspace?.path) return
    try {
      const newApi = await invoke('create_api', {
        workspacePath: props.workspace.path,
        name: '新建接口',
        method: 'GET',
        url: '',
        parentId: type === 'root' ? null : item?.id
      })
      await loadCollections()
      // 创建后立即打开
      emit('selectApi', newApi)
    } catch (e) {
      console.error('创建接口失败:', e)
    }
  } else if (action === 'rename') {
    // 打开重命名对话框
    renameItem.value = item
    renameItemType.value = type
    renameItemName.value = item.name
    showRenameDialog.value = true
  } else if (action === 'delete') {
    deleteItem(item)
  }
  
  closeContextMenu()
}

// 重命名
const handleRename = async () => {
  if (!props.workspace?.path) return
  if (!renameItemName.value.trim()) return
  
  try {
    if (renameItemType.value === 'collection') {
      await invoke('update_collection', {
        workspacePath: props.workspace.path,
        id: renameItem.value.id,
        name: renameItemName.value,
        description: renameItem.value.description
      })
    } else {
      await invoke('update_api', {
        workspacePath: props.workspace.path,
        id: renameItem.value.id,
        name: renameItemName.value,
        method: null,
        url: null,
        headers: null,
        body: null,
        bodyType: null
      })
      // 通知父组件更新 tabs 中的名称
      emit('renameApi', { id: renameItem.value.id, name: renameItemName.value })
    }
    await loadCollections()
    showRenameDialog.value = false
  } catch (e) {
    console.error('重命名失败:', e)
  }
}

// 创建集合
const handleCreate = async () => {
  if (!props.workspace?.path) return
  if (!newItemName.value.trim()) return
  
  try {
    await invoke('create_collection', {
      workspacePath: props.workspace.path,
      name: newItemName.value,
      description: null,
      parentId: createDialogParent.value?.id || null
    })
    await loadCollections()
    showCreateDialog.value = false
  } catch (e) {
    console.error('创建失败:', e)
  }
}

// 删除集合或接口
const deleteItem = async (item) => {
  if (!props.workspace?.path) return
  try {
    await invoke('delete_collection_item', {
      workspacePath: props.workspace.path,
      id: item.id
    })
    await loadCollections()
  } catch (e) {
    console.error('删除失败:', e)
  }
}

// 获取 HTTP 方法样式类
const getMethodClass = (method) => method?.toLowerCase() || ''

// 计算扁平化的树列表（用于渲染）
const flatTreeList = computed(() => {
  const result = []
  const processItems = (items, depth = 0) => {
    for (const item of items) {
      const isCollection = item.type === 'collection'
      const hasChildren = item.children && item.children.length > 0
      const expanded = isExpanded(item.id)
      
      result.push({
        item,
        isCollection,
        hasChildren,
        expanded,
        depth
      })
      
      if (hasChildren && expanded) {
        processItems(item.children, depth + 1)
      }
    }
  }
  processItems(collections.value)
  return result
})

// 监听工作区变化
watch(() => props.workspace, async (ws) => {
  if (ws) {
    currentWorkspace.value = ws
    await loadCollections()
  }
}, { immediate: true })

// 暴露方法
defineExpose({
  loadWorkspaces,
  loadCollections
})

// 全局点击关闭右键菜单
const handleGlobalClick = () => {
  closeContextMenu()
}

onMounted(async () => {
  await loadWorkspaces()
  // 全局点击事件
  document.addEventListener('click', handleGlobalClick)
})

onUnmounted(() => {
  document.removeEventListener('click', handleGlobalClick)
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
            <span class="action-btn" title="新建集合" @click="openRootCreateDialog">+</span>
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
        
        <!-- 提示：需要先选择工作区 -->
        <div v-if="!props.workspace" class="empty-panel">
          请先选择或创建工作区
        </div>
        
        <!-- 树形列表 -->
        <div 
          v-else 
          class="tree-list" 
          @contextmenu="(e) => openContextMenu(e, null, 0, 'root')"
        >
          <div v-if="flatTreeList.length === 0" class="empty-panel">
            暂无集合，右键创建
          </div>
          
          <template v-for="row in flatTreeList" :key="row.item.id">
            <!-- 集合项 -->
            <div 
              v-if="row.isCollection"
              class="tree-folder"
              :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
              @click.stop="toggleExpand(row.item.id)"
              @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'collection')"
            >
              <span class="folder-icon">
                <Icon :name="row.expanded ? 'folder-open' : 'folder'" :size="14" />
              </span>
              <span class="folder-name">{{ row.item.name }}</span>
            </div>
            
            <!-- API 项 -->
            <div 
              v-if="!row.isCollection"
              class="tree-item"
              :class="{ selected: selectedApi === row.item.id }"
              :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
              @click="selectApiItem(row.item)"
              @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'api')"
            >
              <span class="method-tag" :class="getMethodClass(row.item.method)">{{ row.item.method }}</span>
              <span class="item-name">{{ row.item.name }}</span>
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
      
      <!-- 其他面板 -->
      <template v-if="currentNavItem().key !== 'collection' && currentNavItem().key !== 'workspace'">
        <div class="panel-header">
          <span class="panel-title">{{ currentNavItem().name }}</span>
        </div>
        <div class="empty-panel">
          功能开发中...
        </div>
      </template>
    </div>
    
    <!-- 创建对话框 -->
    <div v-if="showCreateDialog" class="create-dialog-overlay" @click.self="showCreateDialog = false">
      <div class="create-dialog">
        <div class="dialog-header">
          <span>新建集合</span>
          <span class="dialog-close" @click="showCreateDialog = false">×</span>
        </div>
        
        <div class="dialog-body">
          <div class="dialog-row">
            <label>名称</label>
            <input v-model="newItemName" type="text" placeholder="请输入名称" />
          </div>
          
          <div v-if="createDialogParent" class="dialog-row">
            <label>父级</label>
            <span class="parent-name">{{ createDialogParent.name }}</span>
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-cancel" @click="showCreateDialog = false">取消</button>
          <button class="btn-confirm" @click="handleCreate">确定</button>
        </div>
      </div>
    </div>
    
    <!-- 重命名对话框 -->
    <div v-if="showRenameDialog" class="create-dialog-overlay" @click.self="showRenameDialog = false">
      <div class="create-dialog">
        <div class="dialog-header">
          <span>重命名</span>
          <span class="dialog-close" @click="showRenameDialog = false">×</span>
        </div>
        
        <div class="dialog-body">
          <div class="dialog-row">
            <label>名称</label>
            <input v-model="renameItemName" type="text" placeholder="请输入名称" />
          </div>
        </div>
        
        <div class="dialog-footer">
          <button class="btn-cancel" @click="showRenameDialog = false">取消</button>
          <button class="btn-confirm" @click="handleRename">确定</button>
        </div>
      </div>
    </div>
    
    <!-- 右键菜单 -->
    <div 
      v-if="contextMenu.visible" 
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <!-- 根级别菜单 -->
      <template v-if="contextMenu.type === 'root'">
        <div class="menu-item" @click="handleContextAction('new-collection')">
          <span class="menu-icon"><Icon name="folder" :size="14" /></span>
          <span>新建集合</span>
        </div>
        <div class="menu-item" @click="handleContextAction('new-api')">
          <span class="menu-icon"><Icon name="api" :size="14" /></span>
          <span>新建接口</span>
        </div>
      </template>
      
      <!-- 集合菜单 -->
      <template v-if="contextMenu.type === 'collection'">
        <div 
          v-if="canCreateSubCollection(contextMenu.depth)" 
          class="menu-item" 
          @click="handleContextAction('new-collection')"
        >
          <span class="menu-icon"><Icon name="folder" :size="14" /></span>
          <span>新建子集合</span>
        </div>
        <div class="menu-item" @click="handleContextAction('new-api')">
          <span class="menu-icon"><Icon name="api" :size="14" /></span>
          <span>新建接口</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleContextAction('rename')">
          <span>重命名</span>
        </div>
        <div class="menu-item delete" @click="handleContextAction('delete')">
          <span>删除</span>
        </div>
      </template>
      
      <!-- API 菜单 -->
      <template v-if="contextMenu.type === 'api'">
        <div class="menu-item" @click="handleContextAction('rename')">
          <span>重命名</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item delete" @click="handleContextAction('delete')">
          <span>删除</span>
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
  position: relative;
}

.tree-folder:hover {
  background: #f5f5f5;
}

.folder-icon {
  font-size: 14px;
  margin-right: 6px;
  cursor: pointer;
}

.folder-name {
  font-size: 13px;
  color: #262626;
  flex: 1;
}

.item-actions {
  display: none;
  gap: 4px;
  margin-left: 8px;
}

.tree-folder:hover .item-actions,
.tree-item:hover .item-actions {
  display: flex;
}

.action-icon {
  font-size: 12px;
  color: #8c8c8c;
  cursor: pointer;
  padding: 2px;
}

.action-icon:hover {
  color: #1890ff;
}

.action-icon.delete:hover {
  color: #ff4d4f;
}

.tree-item {
  display: flex;
  align-items: center;
  padding: 6px 16px;
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

.method-tag.post { background: #fff7e6; color: #fa8c16; }
.method-tag.get { background: #f6ffed; color: #52c416; }
.method-tag.put { background: #e6f7ff; color: #1890ff; }
.method-tag.delete { background: #fff1f0; color: #ff4d4f; }
.method-tag.patch { background: #f9f0ff; color: #722ed1; }

.item-name {
  font-size: 13px;
  color: #262626;
  flex: 1;
}

.empty-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #8c8c8c;
  font-size: 13px;
  padding: 16px;
  text-align: center;
}

/* 工作区样式 */
.current-workspace {
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
}

.ws-current-header {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.ws-current-item {
  display: flex;
  align-items: center;
  padding: 8px;
  background: #e6f7ff;
  border-radius: 4px;
}

.ws-icon {
  font-size: 18px;
  margin-right: 8px;
}

.ws-info {
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
  display: block;
}

.workspace-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.ws-list-header {
  font-size: 12px;
  color: #8c8c8c;
  margin-bottom: 8px;
}

.ws-item {
  display: flex;
  align-items: center;
  padding: 8px;
  margin-bottom: 8px;
  border-radius: 4px;
  cursor: pointer;
  position: relative;
}

.ws-item:hover {
  background: #f5f5f5;
}

.ws-item.active {
  background: #e6f7ff;
}

.ws-info {
  flex: 1;
}

.ws-desc {
  font-size: 12px;
  color: #8c8c8c;
  display: block;
}

.ws-time {
  font-size: 11px;
  color: #bfbfbf;
  display: block;
}

.ws-delete {
  display: none;
  font-size: 14px;
  color: #ff4d4f;
  cursor: pointer;
  padding: 4px;
}

.ws-item:hover .ws-delete {
  display: block;
}

.ws-empty {
  text-align: center;
  color: #8c8c8c;
  font-size: 13px;
  padding: 16px;
}

/* 创建对话框 */
.create-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.create-dialog {
  width: 320px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  font-size: 14px;
  font-weight: 500;
}

.dialog-close {
  font-size: 18px;
  cursor: pointer;
  color: #8c8c8c;
}

.dialog-close:hover {
  color: #ff4d4f;
}

.dialog-body {
  padding: 16px;
}

.dialog-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.dialog-row label {
  width: 60px;
  font-size: 13px;
  color: #595959;
}

.dialog-row input,
.dialog-row select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.dialog-row input:focus,
.dialog-row select:focus {
  border-color: #1890ff;
}

.parent-name {
  font-size: 13px;
  color: #1890ff;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e8e8e8;
}

.btn-cancel,
.btn-confirm {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
}

.btn-cancel {
  background: #fff;
  border: 1px solid #d9d9d9;
  color: #595959;
}

.btn-cancel:hover {
  border-color: #1890ff;
  color: #1890ff;
}

.btn-confirm {
  background: #1890ff;
  border: 1px solid #1890ff;
  color: #fff;
}

.btn-confirm:hover {
  background: #40a9ff;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  padding: 4px 0;
  min-width: 120px;
  z-index: 2000;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  color: #262626;
}

.menu-item:hover {
  background: #f5f5f5;
}

.menu-item.delete {
  color: #ff4d4f;
}

.menu-icon {
  margin-right: 8px;
}

.menu-divider {
  height: 1px;
  background: #e8e8e8;
  margin: 4px 0;
}
</style>