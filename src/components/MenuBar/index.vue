<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useI18nSetup } from '../../composables/useI18n'

const { t, locale, supportedLocales, switchLanguage } = useI18nSetup()

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

// 菜单配置 - 使用 computed 以响应语言变化
const menus = computed(() => [
  { name: t('menu.file') },
  { name: t('menu.language'), items: supportedLocales.map(l => l.name) },
  { name: t('menu.theme') },
  { name: t('menu.settings'), items: [t('menu.preferences')] },
  { name: t('menu.plugin') },
  { name: t('menu.help'), items: [t('menu.scriptApiRef')] },
  { name: t('menu.about') }
])

const activeMenu = ref(null)
const showWorkspaceDropdown = ref(false)
const showEnvironmentDropdown = ref(false)
const showScriptHelp = ref(false)
const workspaceWrapperRef = ref(null)
const environmentWrapperRef = ref(null)

// 获取当前工作区显示名称
const currentWorkspaceName = () => {
  return props.currentWorkspace?.name || t('workspace.notSelected')
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
  
  // 语言切换
  if (menuName === t('menu.language')) {
    const localeCode = supportedLocales.find(l => l.name === item)?.code
    if (localeCode) {
      switchLanguage(localeCode)
    }
    return
  }
  
  // 设置菜单 - 偏好设置
  if (menuName === t('menu.settings') && item === t('menu.preferences')) {
    emit('openSettings')
  }
  
  // 帮助菜单 - 脚本 API 参考
  if (menuName === t('menu.help') && item === t('menu.scriptApiRef')) {
    showScriptHelp.value = true
  }
}

// 关闭脚本帮助面板
const closeScriptHelp = () => {
  showScriptHelp.value = false
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
        <div v-if="activeMenu === index && menu.items" class="dropdown">
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
          <span class="selector-label">{{ t('workspace.selector') }}</span>
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
            {{ t('workspace.noWorkspace') }}
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
          <span class="selector-label">{{ t('environment.selector') }}</span>
          <span class="selector-value">{{ activeEnvironment?.name || t('environment.notSelected') }}</span>
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
            {{ t('environment.noEnvironment') }}
          </div>
        </div>
      </div>
    </div>
    
    <!-- 脚本 API 参考面板 -->
    <div v-if="showScriptHelp" class="script-help-panel">
      <div class="help-header">
        <span class="help-title">脚本 API 参考</span>
        <button class="close-btn" @click="closeScriptHelp">×</button>
      </div>
      <div class="help-content">
        <div class="help-section">
          <h3>前置脚本</h3>
          <p class="section-desc">前置脚本在请求发送前执行，可修改请求参数。</p>
          <div class="api-group">
            <h4>环境变量</h4>
            <code>fm.environment.get(key)</code>
            <code>fm.environment.set(key, value)</code>
            <code>fm.environment.getAll()</code>
          </div>
          <div class="api-group">
            <h4>集合变量</h4>
            <code>fm.collection.get(key)</code>
            <code>fm.collection.set(key, value)</code>
            <code>fm.collection.getAll()</code>
          </div>
          <div class="api-group">
            <h4>请求参数</h4>
            <code>fm.request.getUrl() / fm.request.setUrl(url)</code>
            <code>fm.request.getBaseUrl() / fm.request.setBaseUrl(baseUrl)</code>
            <code>fm.request.getPath() / fm.request.setPath(path)</code>
            <code>fm.request.getMethod() / fm.request.setMethod(method)</code>
            <code>fm.request.getHeader(key) / fm.request.setHeader(key, value)</code>
            <code>fm.request.removeHeader(key) / fm.request.getHeaders()</code>
            <code>fm.request.getBody() / fm.request.setBody(body)</code>
          </div>
          <div class="api-group">
            <h4>工具方法</h4>
            <code>fm.log(...args) - 输出日志到 Console</code>
            <code>fm.assert(condition, message) - 断言</code>
            <code>fm.sleep(ms) - 异步等待</code>
          </div>
        </div>
        
        <div class="help-section">
          <h3>后置脚本</h3>
          <p class="section-desc">后置脚本在响应返回后执行，可处理响应数据。继承前置脚本所有 API。</p>
          <div class="api-group">
            <h4>响应数据</h4>
            <code>fm.response.getStatus() / fm.response.getStatusText()</code>
            <code>fm.response.getHeader(key) / fm.response.getHeaders()</code>
            <code>fm.response.getBody() / fm.response.getJson()</code>
            <code>fm.response.getTime() / fm.response.getSize()</code>
          </div>
        </div>
        
        <div class="help-section">
          <h3>执行顺序（继承链）</h3>
          <p class="section-desc">
            前置脚本：工作区 → 父集合 → 子集合 → 接口 → HTTP请求<br>
            后置脚本：HTTP响应 → 接口 → 子集合 → 父集合 → 工作区
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>