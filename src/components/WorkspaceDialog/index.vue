<script setup>
import { useI18n } from 'vue-i18n'
import { useWorkspaceDialogSetup } from './index.js'
import Icon from '../Icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  visible: Boolean,
  mode: String // 'create' or 'select'
})

const emit = defineEmits(['close', 'created', 'selected'])

const {
  name,
  description,
  path,
  error,
  loading,
  workspaceType,
  gitUrl,
  gitBranch,
  gitUsername,
  gitPassword,
  workspaces,
  selectedWorkspaceId,
  selectPath,
  createWorkspace,
  handleSelectWorkspaceItem,
  selectWorkspace,
  close
} = useWorkspaceDialogSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog">
      <div class="dialog-header">
        <span class="dialog-title">
          {{ mode === 'create' ? t('dialogs.newWorkspace') : t('dialogs.switchWorkspace') }}
        </span>
        <span class="dialog-close" @click="close">×</span>
      </div>

      <div class="dialog-body">
        <!-- 创建模式 -->
        <div v-if="mode === 'create'" class="create-form">
          <div class="form-group">
            <label>{{ t('common.name') }}</label>
            <input
              v-model="name"
              type="text"
              :placeholder="t('placeholder.workspaceName')"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('common.description') }}</label>
            <input
              v-model="description"
              type="text"
              :placeholder="t('placeholder.workspaceDesc')"
              class="form-input"
            />
          </div>

          <div class="form-group">
            <label>{{ t('common.type') }}</label>
            <div class="radio-group">
              <label class="radio-item">
                <input type="radio" v-model="workspaceType" value="local" />
                <span>{{ t('workspaceType.local') }}</span>
              </label>
              <label class="radio-item">
                <input type="radio" v-model="workspaceType" value="git" />
                <span>{{ t('workspaceType.git') }}</span>
              </label>
            </div>
          </div>

          <!-- Git 配置字段 -->
          <div v-if="workspaceType === 'git'" class="git-config">
            <div class="form-group">
              <label>{{ t('gitConfig.url') }}</label>
              <input
                v-model="gitUrl"
                type="text"
                placeholder="https://github.com/user/repo.git"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>{{ t('gitConfig.branch') }}</label>
              <input
                v-model="gitBranch"
                type="text"
                placeholder="master"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>{{ t('gitConfig.username') }}</label>
              <input
                v-model="gitUsername"
                type="text"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label>{{ t('gitConfig.password') }}</label>
              <input
                v-model="gitPassword"
                type="password"
                class="form-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label>{{ t('dialogs.workspacePath') }}</label>
            <div class="path-input">
              <input
                v-model="path"
                type="text"
                :placeholder="t('placeholder.workspacePath')"
                class="form-input"
                readonly
              />
              <button class="btn-select" @click="selectPath">{{ t('buttons.selectFile') }}</button>
            </div>
          </div>
        </div>

        <!-- 选择模式 -->
        <div v-if="mode === 'select'" class="select-list">
          <div 
            v-for="ws in workspaces" 
            :key="ws.id"
            class="workspace-item"
            :class="{ selected: selectedWorkspaceId === ws.id }"
            @click="handleSelectWorkspaceItem(ws.id)"
          >
            <div class="ws-header">
              <Icon :name="ws.workspace_type === 'git' ? 'git' : 'folder'" :size="16" />
              <span class="ws-name">{{ ws.name }}</span>
              <span v-if="ws.workspace_type === 'git'" class="ws-type-badge">Git</span>
            </div>
            <div class="ws-path">{{ ws.path }}</div>
            <div class="ws-time">{{ t('workspace.lastOpened') }} {{ ws.last_opened }}</div>
          </div>
          
          <div v-if="workspaces.length === 0" class="empty-tip">
            {{ t('empty.noWorkspaces') }}
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="dialog-footer">
        <button
          v-if="mode === 'create'"
          class="btn-primary"
          :disabled="loading"
          @click="createWorkspace"
        >
          {{ loading ? t('common.loading') : t('common.new') }}
        </button>

        <button
          v-if="mode === 'select'"
          class="btn-primary"
          :disabled="loading"
          @click="selectWorkspace"
        >
          {{ loading ? t('common.loading') : t('common.confirm') }}
        </button>

        <button class="btn-secondary" @click="close">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>