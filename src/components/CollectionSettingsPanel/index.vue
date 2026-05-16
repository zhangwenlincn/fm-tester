<script setup>
import { useCollectionSettingsSetup } from './index.js'
import Icon from '../Icon/index.vue'
import ScriptPanel from '../ScriptPanel/index.vue'

const props = defineProps({
  collection: {
    type: Object,
    required: true
  },
  workspacePath: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['save', 'close'])

const {
  t,
  activeTab,
  tabs,
  localSettings,
  saving,
  addHeader,
  removeHeader,
  addVariable,
  removeVariable,
  handleScriptUpdate,
  saveScripts,
  saveSettings
} = useCollectionSettingsSetup(props, emit)
</script>

<template>
  <div class="collection-settings-panel">
    <!-- 集合名称 -->
    <div class="settings-header">
      <span class="folder-icon">
        <Icon name="folder" :size="16" />
      </span>
      <span class="collection-name">{{ localSettings.name }}</span>
    </div>
    
    <!-- 标签页 -->
    <div class="settings-tabs">
      <div 
        v-for="tab in tabs" 
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        {{ tab.name }}
      </div>
    </div>
    
    <!-- 标签页内容 -->
    <div class="tab-content">
      <!-- 请求头 -->
      <div v-show="activeTab === 'headers'" class="headers-panel">
        <div class="panel-toolbar">
          <button class="add-btn" @click="addHeader">{{ t('buttons.addHeader') }}</button>
          <span class="panel-hint">{{ t('collectionSettings.headersHint') }}</span>
        </div>
        <div class="params-list">
          <div class="params-header">
            <span class="col-check"></span>
            <span class="col-key">{{ t('table.headerName') }}</span>
            <span class="col-value">{{ t('table.headerValue') }}</span>
            <span class="col-desc">{{ t('table.description') }}</span>
            <span class="col-action"></span>
          </div>
          <div v-if="localSettings.commonHeaders.length === 0" class="empty-params">
            {{ t('empty.noCollectionHeaders') }}
          </div>
          <div 
            v-for="(header, index) in localSettings.commonHeaders" 
            :key="index"
            class="param-row"
          >
            <span class="col-check">
              <input type="checkbox" v-model="header.enabled" />
            </span>
            <span class="col-key">
              <input type="text" v-model="header.key" placeholder="Header 名" />
            </span>
            <span class="col-value">
              <input type="text" v-model="header.value" placeholder="Header 值" />
            </span>
            <span class="col-desc">
              <input type="text" v-model="header.description" placeholder="描述" />
            </span>
            <span class="col-action">
              <button class="remove-btn" @click="removeHeader(index)">×</button>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 变量 -->
      <div v-show="activeTab === 'variables'" class="variables-panel">
        <div class="panel-toolbar">
          <button class="add-btn" @click="addVariable">{{ t('buttons.addVariable') }}</button>
          <span class="panel-hint">{{ t('environment.hint') }}</span>
        </div>
        <div class="params-list">
          <div class="params-header">
            <span class="col-check"></span>
            <span class="col-key">{{ t('table.variableName') }}</span>
            <span class="col-value">{{ t('table.variableValue') }}</span>
            <span class="col-desc">{{ t('table.description') }}</span>
            <span class="col-action"></span>
          </div>
          <div v-if="localSettings.collectionVariables.length === 0" class="empty-params">
            {{ t('empty.noCollectionVariables') }}
          </div>
          <div 
            v-for="(variable, index) in localSettings.collectionVariables" 
            :key="index"
            class="param-row"
          >
            <span class="col-check">
              <input type="checkbox" v-model="variable.enabled" />
            </span>
            <span class="col-key">
              <input type="text" v-model="variable.key" placeholder="变量名" />
            </span>
            <span class="col-value">
              <input type="text" v-model="variable.value" placeholder="变量值" />
            </span>
            <span class="col-desc">
              <input type="text" v-model="variable.description" placeholder="描述" />
            </span>
            <span class="col-action">
              <button class="remove-btn" @click="removeVariable(index)">×</button>
            </span>
          </div>
        </div>
      </div>
      
      <!-- 脚本 -->
      <div v-show="activeTab === 'scripts'" class="scripts-panel">
        <ScriptPanel 
          :request="localSettings"
          @update:request="handleScriptUpdate"
          @save="saveScripts"
        />
      </div>
      
      <!-- 设置 -->
      <div v-show="activeTab === 'settings'" class="settings-panel">
        <div class="placeholder-content">
          <span class="placeholder-icon">⚙️</span>
          <p>{{ t('panels.collectionSettings') }}</p>
          <p class="placeholder-hint">{{ t('common.developing') }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>