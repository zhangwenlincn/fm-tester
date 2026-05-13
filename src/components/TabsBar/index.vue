<script setup>
import { useTabsBarSetup } from './index.js'
import Icon from '../Icon/index.vue'

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

const emit = defineEmits(['update:activeTab', 'closeTab'])

const { selectTab, closeTab } = useTabsBarSetup(props, emit)
</script>

<template>
  <div class="tabs-wrapper">
    <!-- 标签栏 -->
    <div class="tabs-bar">
      <div class="tabs-container">
        <div 
          v-for="(tab, index) in tabs" 
          :key="tab.id || index"
          class="tab"
          :class="{ active: activeTab === index }"
          :title="tab.fullName || tab.name"
          @click="selectTab(index)"
        >
          <span class="tab-method" :class="tab.method?.toLowerCase()">{{ tab.method }}</span>
          <span class="tab-name">{{ tab.name }}</span>
          <span class="tab-close" @click="closeTab(index, $event)">×</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>