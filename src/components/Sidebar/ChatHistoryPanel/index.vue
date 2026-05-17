<script setup>
import { useChatHistorySetup } from './index.js'
import './style.css'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['select-session', 'new-session', 'session-created'])

const {
  t,
  sessions,
  activeSessionId,
  loading,
  renamingSessionId,
  renamingTitle,
  showContextMenu,
  contextMenuPosition,
  contextMenuSession,
  selectSession,
  createNewSession,
  loadSessions,
  startRename,
  cancelRename,
  confirmRename,
  handleContextMenu,
  closeContextMenu,
  handleRenameFromMenu,
  handleDeleteFromMenu
} = useChatHistorySetup(props, emit)
</script>

<template>
  <div class="chat-history-panel">
    <div class="panel-header">
      <span class="panel-title">{{ t('nav.chat') }}</span>
      <button class="new-btn" @click="createNewSession" :title="t('buttons.new')">
        +
      </button>
    </div>
    
    <div class="session-list" v-if="!loading && sessions.length > 0">
      <div 
        v-for="session in sessions" 
        :key="session.id"
        class="session-item"
        :class="{ active: activeSessionId === session.id }"
        @click="selectSession(session)"
        @contextmenu.prevent="handleContextMenu(session, $event)"
      >
        <div class="session-info">
          <!-- 重命名模式 -->
          <template v-if="renamingSessionId === session.id">
            <input 
              v-model="renamingTitle"
              class="rename-input"
              :placeholder="t('chat.sessionTitle', { date: session.created_at })"
              @keyup.enter="confirmRename(session)"
              @keyup.escape="cancelRename"
              @blur="confirmRename(session)"
              ref="renameInput"
            />
          </template>
          <!-- 正常显示模式 -->
          <template v-else>
            <div class="session-title">{{ session.title || t('chat.sessionTitle', { date: session.created_at }) }}</div>
            <div class="session-date">{{ session.created_at }}</div>
            <div class="session-count">{{ t('chat.messageCount', { count: session.messages.length }) }}</div>
          </template>
        </div>
      </div>
    </div>
    
    <div class="empty-sessions" v-else-if="!loading">
      <div class="empty-text">{{ t('chat.noSessions') }}</div>
      <button class="create-btn" @click="createNewSession">{{ t('chat.newSession') }}</button>
    </div>
    
    <div class="loading-sessions" v-else>
      {{ t('common.loading') }}
    </div>
  </div>
  
  <!-- 右键菜单（放在面板外部，确保fixed定位相对于视口） -->
  <Teleport to="body">
    <div 
      v-if="showContextMenu"
      class="chat-context-menu"
      :style="{ top: contextMenuPosition.y + 'px', left: contextMenuPosition.x + 'px' }"
      @click.stop
    >
      <div class="context-menu-item" @click.stop="handleRenameFromMenu">
        {{ t('common.rename') }}
      </div>
      <div class="context-menu-item danger" @click.stop="handleDeleteFromMenu">
        {{ t('common.delete') }}
      </div>
    </div>
  </Teleport>
</template>