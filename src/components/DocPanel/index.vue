<script setup>
import { useI18n } from 'vue-i18n'
import { useDocPanelSetup } from './index.js'
import Icon from '../Icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  workspacePath: {
    type: String,
    default: ''
  },
  apiId: {
    type: String,
    default: ''
  }
})

const {
  docContent,
  docMode,
  renderedDocHtml,
  docEditorContainer,
  toggleDocMode,
  saveDoc
} = useDocPanelSetup(props)
</script>

<template>
  <div class="doc-panel">
    <!-- 工具栏 -->
    <div class="doc-toolbar">
      <button class="toggle-btn" @click="toggleDocMode">
        {{ docMode === 'view' ? t('common.edit') : t('tabs.docs') }}
      </button>
      <button v-if="docMode === 'edit'" class="save-btn" @click="saveDoc">{{ t('common.save') }}</button>
    </div>
    
    <!-- 展示模式 -->
    <div v-if="docMode === 'view'" class="doc-view-container">
      <div v-if="renderedDocHtml" class="doc-content" v-html="renderedDocHtml"></div>
      <div v-else class="doc-empty">
        <span class="empty-icon"><Icon name="file" :size="48" /></span>
        <p>{{ t('empty.noDoc') }}</p>
        <button class="edit-btn" @click="toggleDocMode">{{ t('common.edit') }}</button>
      </div>
    </div>
    
    <!-- 编辑模式 -->
    <div v-show="docMode === 'edit'" class="doc-editor-container" ref="docEditorContainer"></div>
  </div>
</template>

<style scoped src="./style.css"></style>