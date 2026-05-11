<script setup>
import { ref } from 'vue'

const navItems = [
  { icon: '📁', name: '集合', active: true },
  { icon: '🌐', name: '环境' },
  { icon: '🏢', name: '工作区' },
  { icon: '⚡', name: '功能' },
  { icon: '📊', name: '性能' },
  { icon: '🔧', name: '工具箱' },
  { icon: '📜', name: '历史' }
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

const activeNav = ref(0)
const selectedApi = ref(null)
const searchQuery = ref('')

const emit = defineEmits(['selectApi'])

const selectNav = (index) => {
  activeNav.value = index
}

const toggleFolder = (item) => {
  item.expanded = !item.expanded
}

const selectApi = (api) => {
  selectedApi.value = api.id
  emit('selectApi', api)
}

const getMethodClass = (method) => {
  return method?.toLowerCase() || ''
}
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
        <span class="nav-icon">{{ item.icon }}</span>
      </div>
    </div>
    
    <!-- 集合列表 -->
    <div class="collection-panel">
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
          placeholder="搜索接口..."
          class="search-input"
        />
      </div>
      
      <div class="collection-tree">
        <template v-for="item in collections" :key="item.id">
          <div 
            class="tree-folder"
            :class="{ expanded: item.expanded }"
          >
            <div class="folder-header" @click="toggleFolder(item)">
              <span class="folder-arrow">{{ item.expanded ? '▼' : '▶' }}</span>
              <span class="folder-icon">📁</span>
              <span class="folder-name">{{ item.name }}</span>
            </div>
            
            <div v-if="item.expanded" class="folder-children">
              <template v-for="child in item.children" :key="child.id">
                <!-- 子文件夹 -->
                <div 
                  v-if="child.children"
                  class="tree-folder sub-folder"
                  :class="{ expanded: child.expanded }"
                >
                  <div class="folder-header" @click="toggleFolder(child)">
                    <span class="folder-arrow">{{ child.expanded ? '▼' : '▶' }}</span>
                    <span class="folder-icon">📂</span>
                    <span class="folder-name">{{ child.name }}</span>
                  </div>
                  
                  <div v-if="child.expanded" class="folder-children">
                    <div 
                      v-for="api in child.children" 
                      :key="api.id"
                      class="api-item"
                      :class="{ selected: selectedApi === api.id }"
                      @click="selectApi(api)"
                    >
                      <span class="method-tag" :class="getMethodClass(api.method)">{{ api.method }}</span>
                      <span class="api-name">{{ api.name }}</span>
                    </div>
                  </div>
                </div>
                
                <!-- 直接的 API 项 -->
                <div 
                  v-else
                  class="api-item"
                  :class="{ selected: selectedApi === child.id }"
                  @click="selectApi(child)"
                >
                  <span class="method-tag" :class="getMethodClass(child.method)">{{ child.method }}</span>
                  <span class="api-name">{{ child.name }}</span>
                </div>
              </template>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  width: 280px;
  height: 100%;
  background: #ffffff;
  border-right: 1px solid #e8e8e8;
}

.icon-nav {
  width: 48px;
  background: #fafafa;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 0;
}

.nav-item {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 4px;
  margin-bottom: 4px;
}

.nav-item:hover {
  background: #e6f7ff;
}

.nav-item.active {
  background: #e6f7ff;
  border-left: 3px solid #1890ff;
}

.nav-icon {
  font-size: 16px;
}

.collection-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 12px 8px;
  border-bottom: 1px solid #f0f0f0;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
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
  font-size: 14px;
}

.action-btn:hover {
  color: #1890ff;
}

.search-box {
  padding: 8px 12px;
}

.search-input {
  width: 100%;
  padding: 6px 10px;
  font-size: 13px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  outline: none;
}

.search-input:focus {
  border-color: #1890ff;
}

.collection-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.tree-folder {
  user-select: none;
}

.folder-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  gap: 6px;
}

.folder-header:hover {
  background: #f5f5f5;
}

.folder-arrow {
  font-size: 10px;
  color: #8c8c8c;
  width: 12px;
}

.folder-icon {
  font-size: 14px;
}

.folder-name {
  font-size: 13px;
  color: #262626;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.folder-children {
  padding-left: 16px;
}

.sub-folder .folder-header {
  padding-left: 24px;
}

.api-item {
  display: flex;
  align-items: center;
  padding: 6px 12px 6px 36px;
  cursor: pointer;
  gap: 8px;
}

.api-item:hover {
  background: #f5f5f5;
}

.api-item.selected {
  background: #e6f7ff;
}

.method-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 3px;
  min-width: 40px;
  text-align: center;
}

.method-tag.get {
  color: #52c416;
  background: #f6ffed;
}

.method-tag.post {
  color: #fa8c16;
  background: #fff7e6;
}

.method-tag.put {
  color: #1890ff;
  background: #e6f7ff;
}

.method-tag.delete {
  color: #f5222d;
  background: #fff1f0;
}

.api-name {
  font-size: 13px;
  color: #262626;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>