<script setup>
import { useSavedResponsesPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['select', 'delete'])

const {
  responses,
  loadResponses,
  handleSelect,
  handleDelete,
  getMethodClass
} = useSavedResponsesPanelSetup(props, emit)

// 暴露方法给父组件
defineExpose({
  loadResponses
})
</script>

<template>
  <div class="saved-responses-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="header-title">已保存响应</span>
      <button class="refresh-btn" @click="loadResponses" title="刷新">
        <Icon name="refresh" :size="16" />
      </button>
    </div>

    <!-- 提示：需要先选择工作区 -->
    <div v-if="!props.workspace" class="empty-panel">
      请先选择或创建工作区
    </div>

    <!-- 响应列表 -->
    <div v-else class="responses-list">
      <div
        v-for="item in responses"
        :key="item.id"
        class="response-item"
        @click="handleSelect(item)"
        @contextmenu.prevent="handleDelete(item)"
      >
        <span class="method" :class="getMethodClass(item.method)">{{ item.method }}</span>
        <span class="name">{{ item.name }}</span>
        <span class="status">{{ item.status }}</span>
      </div>
      <div v-if="responses.length === 0" class="empty-state">
        暂无保存的响应
      </div>
    </div>
  </div>
</template>