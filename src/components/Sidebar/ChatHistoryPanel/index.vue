<script setup>
import { useChatHistorySetup } from './index.js'
import './style.css'

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['select-session', 'new-session'])

const {
  t,
  sessions,
  activeSessionId,
  loading,
  selectSession,
  createNewSession,
  deleteSession,
  loadSessions
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
      >
        <div class="session-info">
          <div class="session-title">{{ session.title || t('chat.sessionTitle', { date: session.created_at }) }}</div>
          <div class="session-date">{{ session.created_at }}</div>
          <div class="session-count">{{ t('chat.messageCount', { count: session.messages.length }) }}</div>
        </div>
        <button class="delete-btn" @click.stop="deleteSession(session.id)" :title="t('common.delete')">
          ✕
        </button>
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
</template>