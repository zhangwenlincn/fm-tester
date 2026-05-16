<script setup>
import { useWorkspaceSettingsSetup } from './index.js'
import Icon from '../Icon/index.vue'
import ScriptPanel from '../ScriptPanel/index.vue'

const props = defineProps({
  workspace: {
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
  localSettings,
  saving,
  handleScriptUpdate,
  saveSettings
} = useWorkspaceSettingsSetup(props, emit)
</script>

<template>
  <div class="workspace-settings-panel">
    <!-- 工作区名称 -->
    <div class="settings-header">
      <span class="workspace-icon">
        <Icon name="workspace" :size="16" />
      </span>
      <span class="workspace-name">{{ localSettings.name }}</span>
    </div>
    
    <!-- 脚本面板 -->
    <div class="scripts-panel">
      <ScriptPanel 
        :request="localSettings"
        @update:request="handleScriptUpdate"
      />
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>