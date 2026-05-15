<script setup>
import { useCollectionPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['selectApi', 'deleteApis', 'deleteCollection', 'renameApi', 'selectSavedResponse', 'selectCollection'])

// 使用 composable
const {
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
  expandedResponses,
  loadCollections,
  toggleExpand,
  isExpanded,
  selectApiItem,
  selectCollectionItem,
  setSelectedApiId,
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
  toggleResponses,
  selectSavedResponse,
  getStatusClass,
  formatTime,
  flatTreeList,
  dragState,
  treeListRef,
  onMouseDown
} = useCollectionPanelSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadCollections,
  setSelectedApiId
})
</script>

<template>
  <div class="collection-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="panel-title">集合</span>
      <div class="panel-actions">
        <span class="action-btn" title="新建集合" @click="openRootCreateDialog">+</span>
      </div>
    </div>

    <!-- 搜索框 -->
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
      ref="treeListRef"
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
          :data-item-id="row.item.id"
          class="tree-folder"
          :class="{
            'dragging': dragState.draggingId === row.item.id,
            'drag-over-before': dragState.dragOverId === row.item.id && dragState.dragPosition === 'before',
            'drag-over-after': dragState.dragOverId === row.item.id && dragState.dragPosition === 'after'
          }"
          :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
          @mousedown="(e) => onMouseDown(e, row)"
          @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'collection')"
        >
          <span class="folder-icon" @click.stop="selectCollectionItem(row.item)">
            <Icon :name="row.expanded ? 'folder-open' : 'folder'" :size="14" />
          </span>
          <span class="folder-name" @click.stop="selectCollectionItem(row.item)">{{ row.item.name }}</span>
          <span class="expand-arrow" :class="{ expanded: row.expanded }" @click.stop="toggleExpand(row.item.id)">
            <Icon name="arrow-right" :size="12" />
          </span>
        </div>

        <!-- API 项 -->
        <div
          v-if="!row.isCollection"
          :data-item-id="row.item.id"
          class="tree-item"
          :class="{
            selected: selectedApi === row.item.id,
            'dragging': dragState.draggingId === row.item.id,
            'drag-over-before': dragState.dragOverId === row.item.id && dragState.dragPosition === 'before',
            'drag-over-after': dragState.dragOverId === row.item.id && dragState.dragPosition === 'after'
          }"
          :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
          @mousedown="(e) => onMouseDown(e, row)"
          @click="selectApiItem(row.item)"
          @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'api')"
        >
          <span class="method-tag" :class="getMethodClass(row.item.method)">{{ row.item.method }}</span>
          <span class="item-name">{{ row.item.name }}</span>
          <!-- 如果有保存响应，显示展开箭头（在右边） -->
          <span
            v-if="row.item.saved_responses && row.item.saved_responses.length > 0"
            class="expand-arrow"
            :class="{ expanded: expandedResponses[row.item.id] }"
            @click.stop="toggleResponses(row.item.id)"
          >
            <Icon name="arrow-right" :size="12" />
          </span>
        </div>

        <!-- 保存响应子列表 -->
        <div
          v-if="!row.isCollection && expandedResponses[row.item.id] && row.item.saved_responses && row.item.saved_responses.length > 0"
          class="saved-responses-list"
        >
          <div
            v-for="resp in row.item.saved_responses"
            :key="resp.id"
            class="saved-response-item"
            @click.stop="selectSavedResponse(resp, row.item.name)"
          >
            <span class="status-tag" :class="getStatusClass(resp.status)">{{ resp.status }}</span>
            <span class="resp-name">{{ resp.name }}</span>
            <span class="resp-time">{{ formatTime(resp.created_at) }}</span>
          </div>
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