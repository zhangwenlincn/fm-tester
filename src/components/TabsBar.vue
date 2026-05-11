<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activeTab: {
    type: Number,
    default: 0
  },
  workspace: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:activeTab', 'addTab', 'closeTab'])

const selectTab = (index) => {
  emit('update:activeTab', index)
}

const addTab = () => {
  emit('addTab')
}

const closeTab = (index, event) => {
  event.stopPropagation()
  emit('closeTab', index)
}
</script>

<template>
  <div class="tabs-wrapper">
    <!-- 工作区显示栏 -->
    <div class="workspace-bar">
      <div class="workspace-info" v-if="workspace">
        <span class="ws-icon"><Icon name="ws" :size="14" /></span>
        <span class="ws-name">{{ workspace.name }}</span>
      </div>
      <div class="workspace-info no-workspace" v-else>
        <span class="ws-icon"><Icon name="ws" :size="14" /></span>
        <span class="ws-name">未选择工作区</span>
      </div>
    </div>
    
    <!-- 标签栏 -->
    <div class="tabs-bar">
      <div class="tabs-container">
        <div 
          v-for="(tab, index) in tabs" 
          :key="index"
          class="tab"
          :class="{ active: activeTab === index }"
          @click="selectTab(index)"
        >
          <span class="tab-method" :class="tab.method?.toLowerCase()">{{ tab.method }}</span>
          <span class="tab-name">{{ tab.name }}</span>
          <span class="tab-close" @click="closeTab(index, $event)">×</span>
        </div>
        <div class="tab-add" @click="addTab">
          <span>+</span>
        </div>
      </div>
      <div class="env-selector">
        <select class="env-select">
          <option value="api/master">api/master</option>
          <option value="dev">开发环境</option>
          <option value="test">测试环境</option>
          <option value="prod">生产环境</option>
        </select>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs-wrapper {
  display: flex;
  flex-direction: column;
  background: #fafafa;
}

.workspace-bar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: #f5f5f5;
  border-bottom: 1px solid #e8e8e8;
}

.workspace-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ws-icon {
  font-size: 14px;
}

.ws-name {
  font-size: 12px;
  color: #262626;
  font-weight: 500;
}

.no-workspace .ws-name {
  color: #8c8c8c;
}

.tabs-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
  padding: 0 8px;
}

.tabs-container {
  display: flex;
  align-items: center;
  flex: 1;
  overflow-x: auto;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 4px 4px 0 0;
  margin-right: 2px;
  cursor: pointer;
  min-width: 120px;
  max-width: 200px;
}

.tab.active {
  background: #e6f7ff;
  border-bottom-color: #e6f7ff;
}

.tab-method {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
}

.tab-method.get {
  color: #52c416;
  background: #f6ffed;
}

.tab-method.post {
  color: #fa8c16;
  background: #fff7e6;
}

.tab-method.put {
  color: #1890ff;
  background: #e6f7ff;
}

.tab-method.delete {
  color: #f5222d;
  background: #fff1f0;
}

.tab-name {
  flex: 1;
  font-size: 13px;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab-close {
  font-size: 14px;
  color: #8c8c8c;
  cursor: pointer;
}

.tab-close:hover {
  color: #f5222d;
}

.tab-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #ffffff;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 4px;
}

.tab-add:hover {
  background: #f5f5f5;
}

.tab-add span {
  font-size: 16px;
  color: #8c8c8c;
}

.env-selector {
  margin-left: 12px;
}

.env-select {
  padding: 4px 8px;
  font-size: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  outline: none;
}

.env-select:focus {
  border-color: #1890ff;
}
</style>