<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  workspaces: {
    type: Array,
    default: () => []
  },
  currentWorkspace: {
    type: Object,
    default: null
  },
  environments: {
    type: Array,
    default: () => []
  },
  activeEnvironment: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['switchWorkspace', 'switchEnvironment', 'openSettings'])

const menus = [
  { name: '文件', items: ['新建请求', '新建集合', '打开文件', '保存', '另存为', '导入', '导出'] },
  { name: '语言', items: ['简体中文', 'English', '日本語'] },
  { name: '主题', items: ['浅色', '深色', '跟随系统'] },
  { name: '设置', items: ['偏好设置', '快捷键', '代理设置'] },
  { name: '插件', items: ['插件市场', '已安装插件', '插件设置'] },
  { name: '帮助', items: ['文档', '快捷键参考', '检查更新'] },
  { name: '关于', items: ['关于 API Tester', '许可证'] }
]

const activeMenu = ref(null)
const showWorkspaceDropdown = ref(false)
const showEnvironmentDropdown = ref(false)
const workspaceWrapperRef = ref(null)
const environmentWrapperRef = ref(null)

// 获取当前工作区显示名称
const currentWorkspaceName = () => {
  return props.currentWorkspace?.name || '未选择'
}

const toggleMenu = (index) => {
  activeMenu.value = activeMenu.value === index ? null : index
  showWorkspaceDropdown.value = false
  showEnvironmentDropdown.value = false
}

const closeMenu = () => {
  activeMenu.value = null
}

const toggleWorkspaceDropdown = (event) => {
  event.stopPropagation()
  showWorkspaceDropdown.value = !showWorkspaceDropdown.value
  showEnvironmentDropdown.value = false
  activeMenu.value = null
}

const toggleEnvironmentDropdown = (event) => {
  event.stopPropagation()
  showEnvironmentDropdown.value = !showEnvironmentDropdown.value
  showWorkspaceDropdown.value = false
  activeMenu.value = null
}

const closeDropdowns = () => {
  showWorkspaceDropdown.value = false
  showEnvironmentDropdown.value = false
}

const handleSwitchWorkspace = async (workspace) => {
  emit('switchWorkspace', workspace)
  showWorkspaceDropdown.value = false
}

const handleSwitchEnvironment = (env) => {
  emit('switchEnvironment', env.id)
  showEnvironmentDropdown.value = false
}

// 处理菜单项点击
const handleMenuItemClick = (menuName, item) => {
  closeMenu()
  // 设置菜单 - 偏好设置
  if (menuName === '设置' && item === '偏好设置') {
    emit('openSettings')
  }
}

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
  if (workspaceWrapperRef.value && !workspaceWrapperRef.value.contains(event.target)) {
    showWorkspaceDropdown.value = false
  }
  if (environmentWrapperRef.value && !environmentWrapperRef.value.contains(event.target)) {
    showEnvironmentDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="menu-bar" @mouseleave="closeMenu">
    <!-- 左侧菜单 -->
    <div class="menu-left">
      <div 
        v-for="(menu, index) in menus" 
        :key="menu.name"
        class="menu-item"
        :class="{ active: activeMenu === index }"
        @click="toggleMenu(index)"
      >
        {{ menu.name }}
        <div v-if="activeMenu === index" class="dropdown">
          <div 
            v-for="item in menu.items" 
            :key="item" 
            class="dropdown-item"
            @click.stop="handleMenuItemClick(menu.name, item)"
          >
            {{ item }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 右侧选择器 -->
    <div class="menu-right">
      <!-- 工作区选择器 -->
      <div ref="workspaceWrapperRef" class="selector-wrapper">
        <div
          class="selector"
          :class="{ active: showWorkspaceDropdown }"
          @click="toggleWorkspaceDropdown"
        >
          <span class="selector-label">工作区:</span>
          <span class="selector-value">{{ currentWorkspaceName() }}</span>
          <span class="selector-arrow">▼</span>
        </div>
        <div v-show="showWorkspaceDropdown" class="selector-dropdown">
          <div
            v-for="ws in workspaces"
            :key="ws.id"
            class="dropdown-item"
            :class="{ active: props.currentWorkspace?.id === ws.id }"
            @click.stop="handleSwitchWorkspace(ws)"
          >
            {{ ws.name }}
          </div>
          <div v-if="workspaces.length === 0" class="dropdown-item empty">
            暂无工作区
          </div>
        </div>
      </div>

      <!-- 环境选择器 -->
      <div ref="environmentWrapperRef" class="selector-wrapper">
        <div
          class="selector"
          :class="{ active: showEnvironmentDropdown }"
          @click="toggleEnvironmentDropdown($event)"
        >
          <span class="selector-label">环境:</span>
          <span class="selector-value">{{ activeEnvironment?.name || '未选择' }}</span>
          <span class="selector-arrow">▼</span>
        </div>
        <div v-show="showEnvironmentDropdown" class="selector-dropdown">
          <div
            v-for="env in environments"
            :key="env.id"
            class="dropdown-item"
            @click.stop="handleSwitchEnvironment(env)"
          >
            {{ env.name }}
          </div>
          <div v-if="environments.length === 0" class="dropdown-item empty">
            暂无环境
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>