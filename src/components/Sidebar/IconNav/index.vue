<script setup>
import { useIconNavSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const props = defineProps({
  activeKey: {
    type: String,
    default: 'collection'
  }
})

const emit = defineEmits(['navChange'])

const { navItems, selectNav, getNavName } = useIconNavSetup(props, emit)
</script>

<template>
  <div class="icon-nav">
    <div 
      v-for="item in navItems" 
      :key="item.key"
      class="nav-item"
      :class="{ active: props.activeKey === item.key }"
      :title="getNavName(item)"
      @click="selectNav(item.key)"
    >
      <span class="nav-icon"><Icon :name="item.icon" /></span>
    </div>
  </div>
</template>

<style src="./style.css"></style>