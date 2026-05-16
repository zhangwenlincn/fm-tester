<script setup>
import { useWorkspaceSettingsSetup } from './index.js'
import Icon from '../Icon/index.vue'
import ScriptPanel from '../ScriptPanel/index.vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  workspaceInfo,
  handleScriptUpdate,
  saveSettings
} = useWorkspaceSettingsSetup(props, emit)
</script>

<template>
  <div class="workspace-settings-panel">
    <!-- 工作区名称 -->
    <div class="settings-header">
      <span class="workspace-icon">
        <Icon :name="workspaceInfo.isGit ? 'git' : 'workspace'" :size="16" />
      </span>
      <span class="workspace-name">{{ localSettings.name }}</span>
      <!-- Git 工作区显示同步时间 -->
      <div v-if="workspaceInfo.isGit && workspaceInfo.lastSyncAt" class="workspace-times">
        <span class="time-item">
          <Icon name="sync" :size="14" />
          <span class="time-value">{{ workspaceInfo.lastSyncAt }}</span>
        </span>
      </div>
    </div>
    
    <!-- 脚本面板 -->
    <div class="scripts-panel">
      <ScriptPanel 
        :request="localSettings"
        @update:request="handleScriptUpdate"
        @save="saveSettings"
      />
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>