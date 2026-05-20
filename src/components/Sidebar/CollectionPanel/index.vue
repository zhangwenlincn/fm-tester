<script setup>
import { useI18n } from 'vue-i18n'
import { nextTick, ref, watch } from 'vue'
import { useCollectionPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'
import ImportDialog from '../../ImportDialog/index.vue'

const { t } = useI18n()

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['selectApi', 'deleteApis', 'deleteCollection', 'renameApi', 'selectSavedResponse', 'selectCollection'])

// inline 编辑输入框 ref
const inlineEditInput = ref(null)

// 导入对话框状态
const showImportDialog = ref(false)
const importTargetCollectionId = ref(null)

// 使用 composable
const {
  collections,
  expandedItems,
  selectedApi,
  selectedCollectionId,
  searchQuery,
  editingItem,
  editingName,
  finishInlineEdit,
  cancelInlineEdit,
  handleEditKeydown,
  contextMenu,
  expandedResponses,
  loadCollections,
  toggleExpand,
  isExpanded,
  selectApiItem,
  selectCollectionItem,
  setSelectedApiId,
  setSelectedCollectionId,
  canCreateSubCollection,
  openContextMenu,
  closeContextMenu,
  openSavedResponseContextMenu,
  handleContextAction,
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

// inline 编辑开始时自动聚焦并选中文本
watch(editingItem, (val) => {
  if (val) {
    nextTick(() => {
      if (inlineEditInput.value) {
        inlineEditInput.value.focus()
        inlineEditInput.value.select()
      }
    })
  }
})

// 点击编辑输入框外部时保存编辑
const handleEditBlur = () => {
  finishInlineEdit()
}

// 打开导入对话框
const openImportDialogLocal = (targetId = null) => {
  importTargetCollectionId.value = targetId
  showImportDialog.value = true
}

// 右键菜单操作包装
const handleMenuAction = (action) => {
  if (action === 'import-openapi') {
    closeContextMenu()
    openImportDialogLocal(contextMenu.value.item?.id || null)
  } else {
    handleContextAction(action)
  }
}

// 导入成功后刷新
const onImported = async () => {
  await loadCollections()
}

// 暴露方法给父组件
defineExpose({
  loadCollections,
  setSelectedApiId,
  setSelectedCollectionId,
  openImportDialog: openImportDialogLocal
})
</script>

<template>
  <div class="collection-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="panel-title">{{ t('panels.collections') }}</span>
    </div>

    <!-- 搜索框 -->
    <div class="search-box">
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="t('placeholder.search')"
        class="search-input"
      />
    </div>

    <!-- 提示：需要先选择工作区 -->
    <div v-if="!props.workspace" class="empty-panel">
      {{ t('empty.selectWorkspace') }}
    </div>

    <!-- 树形列表 -->
    <div
      v-else
      ref="treeListRef"
      class="tree-list"
      @contextmenu="(e) => openContextMenu(e, null, 0, 'root')"
    >
      <div v-if="flatTreeList.length === 0" class="empty-panel">
        {{ t('empty.noCollections') }}
      </div>

      <template v-for="row in flatTreeList" :key="row.item.id">
        <!-- 集合项 -->
        <div
          v-if="row.isCollection"
          :data-item-id="row.item.id"
          class="tree-folder"
          :class="{
            selected: selectedCollectionId === row.item.id,
            'dragging': dragState.draggingId === row.item.id,
            'drag-over-before': dragState.dragOverId === row.item.id && dragState.dragPosition === 'before',
            'drag-over-after': dragState.dragOverId === row.item.id && dragState.dragPosition === 'after',
            'drag-over-into': dragState.dragOverId === row.item.id && dragState.dragPosition === 'into',
            'editing': row.isEditing
          }"
          :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
          @mousedown="(e) => onMouseDown(e, row)"
          @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'collection')"
        >
          <!-- 编辑模式 -->
          <template v-if="row.isEditing">
            <span class="folder-icon"><Icon name="folder" :size="14" /></span>
            <input
              :ref="(el) => inlineEditInput = el"
              v-model="editingName"
              class="inline-edit-input"
              :placeholder="t('placeholder.name')"
              @keydown="handleEditKeydown"
              @blur="handleEditBlur"
              @mousedown.stop
              @click.stop
            />
          </template>
          <!-- 正常显示 -->
          <template v-else>
            <span class="folder-icon" @click.stop="selectCollectionItem(row.item)">
              <Icon :name="row.expanded ? 'folder-open' : 'folder'" :size="14" />
            </span>
            <span class="folder-name" @click.stop="selectCollectionItem(row.item)">{{ row.item.name }}</span>
            <span class="expand-arrow" :class="{ expanded: row.expanded }" @click.stop="toggleExpand(row.item.id)">
              <Icon name="arrow-right" :size="12" />
            </span>
          </template>
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
            'drag-over-after': dragState.dragOverId === row.item.id && dragState.dragPosition === 'after',
            'editing': row.isEditing
          }"
          :style="{ paddingLeft: (16 + row.depth * 16) + 'px' }"
          @mousedown="(e) => onMouseDown(e, row)"
          @contextmenu.prevent="(e) => openContextMenu(e, row.item, row.depth, 'api')"
        >
          <!-- 编辑模式 -->
          <template v-if="row.isEditing">
            <!-- 新建时显示 GET，重命名时显示原来的 method -->
            <span class="method-tag" :class="getMethodClass(row.item.id.startsWith('temp-') ? 'GET' : row.item.method)">
              {{ row.item.id.startsWith('temp-') ? 'GET' : row.item.method }}
            </span>
            <input
              :ref="(el) => inlineEditInput = el"
              v-model="editingName"
              class="inline-edit-input"
              :placeholder="t('placeholder.name')"
              @keydown="handleEditKeydown"
              @blur="handleEditBlur"
              @mousedown.stop
              @click.stop
            />
          </template>
          <!-- 正常显示 -->
          <template v-else>
            <span class="method-tag" :class="getMethodClass(row.item.method)">{{ row.item.method }}</span>
            <span class="item-name" @click="selectApiItem(row.item)">{{ row.item.name }}</span>
            <!-- 如果有保存响应，显示展开箭头（在右边） -->
            <span
              v-if="row.item.saved_responses && row.item.saved_responses.length > 0"
              class="expand-arrow"
              :class="{ expanded: expandedResponses[row.item.id] }"
              @click.stop="toggleResponses(row.item.id)"
            >
              <Icon name="arrow-right" :size="12" />
            </span>
          </template>
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
            @contextmenu.prevent.stop="(e) => openSavedResponseContextMenu(e, resp)"
          >
            <span class="status-tag" :class="getStatusClass(resp.status)">{{ resp.status }}</span>
            <span class="resp-name">{{ resp.name }}</span>
            <span class="resp-time">{{ formatTime(resp.created_at) }}</span>
          </div>
        </div>
      </template>

      <!-- 根级别拖放区域 -->
      <div
        v-if="flatTreeList.length > 0"
        class="tree-list-footer"
        :class="{ 'drag-over-root': dragState.dragPosition === 'root' }"
      ></div>
    </div>

    <!-- 右键菜单遮罩 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu-overlay"
      @click="closeContextMenu"
    ></div>

    <!-- 右键菜单 -->
    <div
      v-if="contextMenu.visible"
      class="context-menu"
      :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      @click.stop
    >
      <!-- 根级别菜单 -->
      <template v-if="contextMenu.type === 'root'">
        <div class="menu-item" @click="handleMenuAction('new-collection')">
          <span class="menu-icon"><Icon name="folder" :size="14" /></span>
          <span>{{ t('buttons.newCollection') }}</span>
        </div>
        <div class="menu-item" @click="handleMenuAction('new-api')">
          <span class="menu-icon"><Icon name="api" :size="14" /></span>
          <span>{{ t('buttons.newApi') }}</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleMenuAction('import-openapi')">
          <span class="menu-icon"><Icon name="import" :size="14" /></span>
          <span>{{ t('contextMenu.importOpenapi') }}</span>
        </div>
      </template>

      <!-- 集合菜单 -->
      <template v-if="contextMenu.type === 'collection'">
        <div
          v-if="canCreateSubCollection(contextMenu.depth)"
          class="menu-item"
          @click="handleMenuAction('new-collection')"
        >
          <span class="menu-icon"><Icon name="folder" :size="14" /></span>
          <span>{{ t('buttons.newSubCollection') }}</span>
        </div>
        <div class="menu-item" @click="handleMenuAction('new-api')">
          <span class="menu-icon"><Icon name="api" :size="14" /></span>
          <span>{{ t('buttons.newApi') }}</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item" @click="handleMenuAction('rename')">
          <span class="menu-icon"><Icon name="edit" :size="14" /></span>
          <span>{{ t('common.rename') }}</span>
        </div>
        <div class="menu-item delete" @click="handleMenuAction('delete')">
          <span class="menu-icon"><Icon name="delete" :size="14" /></span>
          <span>{{ t('common.delete') }}</span>
        </div>
      </template>

      <!-- API 菜单 -->
      <template v-if="contextMenu.type === 'api'">
        <div class="menu-item" @click="handleMenuAction('rename')">
          <span class="menu-icon"><Icon name="edit" :size="14" /></span>
          <span>{{ t('common.rename') }}</span>
        </div>
        <div class="menu-divider"></div>
        <div class="menu-item delete" @click="handleMenuAction('delete')">
          <span class="menu-icon"><Icon name="delete" :size="14" /></span>
          <span>{{ t('common.delete') }}</span>
        </div>
      </template>

      <!-- 保存响应菜单 -->
      <template v-if="contextMenu.type === 'saved-response'">
        <div class="menu-item delete" @click="handleMenuAction('delete-saved-response')">
          <span class="menu-icon"><Icon name="delete" :size="14" /></span>
          <span>{{ t('common.delete') }}</span>
        </div>
      </template>
    </div>

    <!-- 导入对话框 -->
    <ImportDialog
      :visible="showImportDialog"
      :workspace-path="props.workspace?.path || ''"
      :target-collection-id="importTargetCollectionId"
      :collections="collections"
      @close="showImportDialog = false"
      @imported="onImported"
    />
  </div>
</template>

<style scoped src="./style.css"></style>