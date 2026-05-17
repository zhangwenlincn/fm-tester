<script setup>
import { useChatSetup } from './index.js'
import './style.css'

const props = defineProps({
  workspacePath: {
    type: String,
    default: ''
  },
  sessionId: {
    type: String,
    default: null
  }
})

const {
  t,
  messages,
  inputMessage,
  loading,
  sending,
  streamingDone,
  hasWorkspace,
  sendMessage,
  clearMessages,
  renderMarkdown
} = useChatSetup(props)
</script>

<template>
  <div class="chat-panel">
    <div class="chat-header">
      <span class="chat-title">{{ t('nav.chat') }}</span>
      <button class="clear-btn" @click="clearMessages" :disabled="messages.length === 0 || !hasWorkspace">
        {{ t('common.clear') }}
      </button>
    </div>
    
    <div class="chat-messages">
      <!-- 无工作区提示 -->
      <div v-if="!hasWorkspace" class="no-workspace-hint">
        {{ t('chat.noWorkspaceHint') }}
      </div>
      
      <!-- 空聊天提示 -->
      <div v-else-if="messages.length === 0" class="empty-chat">
        {{ t('chat.emptyHint') }}
      </div>
      
      <!-- 消息列表 -->
      <template v-else>
        <div 
          v-for="(msg, index) in messages" 
          :key="index"
          class="message"
          :class="msg.role"
        >
          <div class="message-role">
            {{ msg.role === 'user' ? t('chat.you') : t('chat.ai') }}
          </div>
          <div class="message-content" :class="{ 'loading-content': msg.role === 'assistant' && !msg.content && sending }">
            <template v-if="msg.role === 'assistant' && !msg.content && sending">
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
              <span class="loading-dot"></span>
            </template>
            <template v-else-if="msg.role === 'assistant' && !streamingDone[index]">
              <div class="streaming-text">{{ msg.content }}</div>
            </template>
            <template v-else-if="msg.role === 'assistant'">
              <div class="markdown-content" v-html="renderMarkdown(msg.content)"></div>
            </template>
            <template v-else>
              {{ msg.content }}
            </template>
          </div>
        </div>
      </template>
    </div>
    
    <div class="chat-input-area">
      <textarea 
        v-model="inputMessage"
        :disabled="sending || loading || !hasWorkspace"
        :placeholder="hasWorkspace ? t('chat.inputPlaceholder') : t('chat.noWorkspaceHint')"
        class="chat-input"
        rows="3"
        @keydown.enter.ctrl="sendMessage"
      ></textarea>
      <div class="input-actions">
        <button 
          class="send-btn"
          :disabled="!inputMessage.trim() || sending || loading || !hasWorkspace"
          @click="sendMessage"
        >
          {{ t('buttons.send') }}
        </button>
        <span class="input-hint">{{ t('chat.sendHint') }}</span>
      </div>
    </div>
  </div>
</template>