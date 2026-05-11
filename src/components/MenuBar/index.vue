<script setup>
import { ref } from 'vue'

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

const toggleMenu = (index) => {
  activeMenu.value = activeMenu.value === index ? null : index
}

const closeMenu = () => {
  activeMenu.value = null
}
</script>

<template>
  <div class="menu-bar" @mouseleave="closeMenu">
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
          @click.stop="closeMenu"
        >
          {{ item }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>