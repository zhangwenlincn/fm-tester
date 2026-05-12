<script setup>
import { useIconNavSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  activeIndex: {
    type: Number,
    default: 0
  }
})

const emit = defineEmits(['navChange'])

const { navItems, activeNav, selectNav } = useIconNavSetup(props, emit)

// 如果传入了 activeIndex，同步更新
if (props.activeIndex !== undefined && props.activeIndex !== activeNav.value) {
  activeNav.value = props.activeIndex
}
</script>

<template>
  <div class="icon-nav">
    <div 
      v-for="(item, index) in navItems" 
      :key="item.name"
      class="nav-item"
      :class="{ active: activeNav === index }"
      :title="item.name"
      @click="selectNav(index)"
    >
      <span class="nav-icon"><Icon :name="item.icon" /></span>
    </div>
  </div>
</template>

<style src="./style.css"></style>