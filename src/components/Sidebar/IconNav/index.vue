<script setup>
import { watch } from 'vue'
import { useIconNavSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  activeIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['navChange'])

const { navItems, activeNav, selectNav, getNavName } = useIconNavSetup(props, emit)

// 监听 activeIndex 变化，同步更新
watch(() => props.activeIndex, (newIndex) => {
  if (newIndex !== undefined && newIndex !== activeNav.value) {
    activeNav.value = newIndex
  }
}, { immediate: true })
</script>

<template>
  <div class="icon-nav">
    <div 
      v-for="(item, index) in navItems" 
      :key="item.key"
      class="nav-item"
      :class="{ active: activeNav === index }"
      :title="getNavName(item)"
      @click="selectNav(index)"
    >
      <span class="nav-icon"><Icon :name="item.icon" /></span>
    </div>
  </div>
</template>

<style src="./style.css"></style>