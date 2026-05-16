<script setup>
import { useI18n } from 'vue-i18n'
import { useEnvPanelSetup } from './index.js'
import Icon from '../Icon/index.vue'

const props = defineProps({
  activeEnvironment: Object,
  workspacePath: String
})

const emit = defineEmits(['saveVariables'])

const { t } = useI18n()

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
        <button class="add-btn" @click="addVariable">{{ t('buttons.addVariable') }}</button>
        <span class="panel-hint">{{ t('environment.hint') }}</span>
      </div>
      
      <!-- 变量表格 -->
      <div class="env-table">
        <!-- 表头 -->
        <div class="env-table-header">
          <span class="col-check"></span>
          <span class="col-key">{{ t('table.variableName') }}</span>
          <span class="col-value">{{ t('table.variableValue') }}</span>
          <span class="col-desc">{{ t('table.description') }}</span>
          <span class="col-action"></span>
        </div>
        
        <!-- 表格内容 -->
        <div class="env-table-body">
          <div v-if="localVariables.length === 0" class="empty-params">
            {{ t('empty.noVariables') }}
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
      {{ t('empty.selectEnvironment') }}
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>