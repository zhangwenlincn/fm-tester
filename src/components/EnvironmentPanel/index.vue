<script setup>
import { useEnvPanelSetup } from './index.js'
import VariableHighlight from '../VariableHighlight/index.vue'

const props = defineProps({
  activeEnvironment: Object,
  editingEnvVariables: Array
})

const emit = defineEmits(['saveVariables'])

const { handleInputChange } = useEnvPanelSetup(props, emit)
</script>

<template>
  <div class="env-panel">
    <!-- 有选中环境时显示表格 -->
    <div class="env-table" v-if="props.activeEnvironment">
      <!-- 表头 -->
      <div class="env-table-header">
        <span>KEY</span>
        <span>VALUE</span>
      </div>
      
      <!-- 表格内容 -->
      <div class="env-table-body">
        <div class="env-row" v-for="(v, index) in props.editingEnvVariables" :key="index">
          <input class="env-input-key" v-model="v.key" @input="handleInputChange" />
          <VariableHighlight
            mode="input"
            v-model="v.value"
            @input="handleInputChange"
            class="env-value-input"
          />
        </div>
      </div>
    </div>
    
    <!-- 未选中环境 -->
    <div class="no-env-selected" v-else>
      请先在左侧选择一个环境
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>