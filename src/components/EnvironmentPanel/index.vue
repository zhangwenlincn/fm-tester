<script setup>
import { useEnvPanelSetup } from './index.js'
import Icon from '../Icon/index.vue'

const props = defineProps({
  activeEnvironment: Object,
  workspacePath: String
})

const emit = defineEmits(['saveVariables'])

const {
  localVariables,
  saving,
  addVariable,
  removeVariable
} = useEnvPanelSetup(props, emit)
</script>

<template>
  <div class="env-panel">
    <!-- 有选中环境时显示表格 -->
    <div v-if="props.activeEnvironment">
      <!-- 环境名称 -->
      <div class="env-header">
        <span class="env-icon">
          <Icon name="environment" :size="16" />
        </span>
        <span class="env-name">{{ props.activeEnvironment.name }}</span>
      </div>
      
      <!-- 工具栏 -->
      <div class="env-toolbar">
        <button class="add-btn" @click="addVariable">+ 添加变量</button>
        <span class="panel-hint">使用 {{变量名}} 在 URL、请求头、请求体中引用这些变量</span>
      </div>
      
      <!-- 变量表格 -->
      <div class="env-table">
        <!-- 表头 -->
        <div class="env-table-header">
          <span class="col-check"></span>
          <span class="col-key">变量名</span>
          <span class="col-value">变量值</span>
          <span class="col-desc">描述</span>
          <span class="col-action"></span>
        </div>
        
        <!-- 表格内容 -->
        <div class="env-table-body">
          <div v-if="localVariables.length === 0" class="empty-params">
            暂无环境变量，点击上方按钮添加
          </div>
          <div 
            v-for="(v, index) in localVariables" 
            :key="index"
            class="env-row"
          >
            <span class="col-check">
              <input type="checkbox" v-model="v.enabled" />
            </span>
            <span class="col-key">
              <input type="text" v-model="v.key" placeholder="变量名" />
            </span>
            <span class="col-value">
              <input type="text" v-model="v.value" placeholder="变量值" />
            </span>
            <span class="col-desc">
              <input type="text" v-model="v.description" placeholder="描述" />
            </span>
            <span class="col-action">
              <button class="remove-btn" @click="removeVariable(index)">×</button>
            </span>
          </div>
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