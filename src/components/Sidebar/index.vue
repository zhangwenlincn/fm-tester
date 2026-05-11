<script setup>
import { useSidebarSetup } from './index.js'
import Icon from '../Icon/index.vue'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['selectApi', 'switchWorkspace', 'createWorkspace', 'renameApi', 'deleteApis'])

// 使用 composable
const {
  navItems,
  collections,
  expandedItems,
  selectedApi,
  searchQuery,
  showCreateDialog,
  createDialogParent,
  newItemName,
  showRenameDialog,
  renameItem,
  renameItemType,
  renameItemName,
  contextMenu,
  workspaces,
  currentWorkspace,
  activeNav,
  currentNavItem,
  selectNav,
  loadCollections,
  loadWorkspaces,
  switchWorkspace,
  createWorkspace,
  deleteWorkspace,
  toggleExpand,
  isExpanded,
  selectApiItem,
  openRootCreateDialog,
  openCreateDialog,
  canCreateSubCollection,
  openContextMenu,
  closeContextMenu,
  handleContextAction,
  handleRename,
  handleCreate,
  deleteItem,
  getMethodClass,
  flatTreeList
} = useSidebarSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadWorkspaces,
  loadCollections
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

<style scoped src="./style.css"></style>