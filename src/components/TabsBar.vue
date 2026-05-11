<script setup>
import { ref } from 'vue'

const props = defineProps({
  tabs: {
    type: Array,
    default: () => []
  },
  activeTab: {
    type: Number,
    default: 0
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
</template>

<style scoped>
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
  font-size: 16px;
  color: #8c8c8c;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.tab-close:hover {
  background: #ff4d4f;
  color: #ffffff;
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
  margin-left: 8px;
  cursor: pointer;
  font-size: 18px;
  color: #8c8c8c;
}

.tab-add:hover {
  background: #e6f7ff;
  color: #1890ff;
}

.env-selector {
  margin-left: 16px;
}

.env-select {
  padding: 4px 24px 4px 8px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  background: #ffffff;
  color: #262626;
  cursor: pointer;
  outline: none;
}

.env-select:focus {
  border-color: #1890ff;
}
</style>