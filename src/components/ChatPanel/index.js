import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useI18n } from 'vue-i18n'
import { marked } from 'marked'

// 配置marked选项
marked.setOptions({
  breaks: true, // 支持换行
  gfm: true // GitHub风格markdown
})

export function useChatSetup(props) {
  const { t } = useI18n()
  
  // 消息列表
  const messages = ref([])
  
  // 输入消息
  const inputMessage = ref('')
  
  // 加载状态
  const loading = ref(false)
  const sending = ref(false)
  
  // 是否有工作区
  const hasWorkspace = ref(false)
  
  // 是否完成渲染（用于区分流式和最终显示）
  const streamingDone = ref({})
  
  // 当前会话ID
  const sessionId = ref(null)
  
  // AI 配置
  const aiConfig = ref({
    endpoint: '',
    key: '',
    model: '',
    customHeaders: []
  })
  
  // 检查工作区状态
  const checkWorkspace = () => {
    hasWorkspace.value = props.workspacePath && props.workspacePath.trim() !== ''
  }
  
  // 加载 AI 配置
  const loadAiConfig = async () => {
    try {
      loading.value = true
      const settings = await invoke('get_settings')
      if (settings.ai) {
        aiConfig.value = {
          endpoint: settings.ai.api_endpoint || '',
          key: settings.ai.api_key || '',
          model: settings.ai.model || '',
          customHeaders: settings.ai.custom_headers || []
        }
      }
    } catch (e) {
      console.error('Failed to load AI config:', e)
    } finally {
      loading.value = false
    }
  }
  
  // 加载聊天记录
  const loadChatHistory = async () => {
    if (!hasWorkspace.value) return
    
    // 新建对话时清空消息
    if (!sessionId.value) {
      messages.value = []
      streamingDone.value = {}
      return
    }
    
    try {
      const history = await invoke('get_chat_history', {
        workspacePath: props.workspacePath,
        sessionId: sessionId.value
      })
      
      if (history && history.length > 0) {
        messages.value = history.map(m => ({
          role: m.role,
          content: m.content
        }))
        // 标记历史记录已完成
        history.forEach((_, index) => {
          streamingDone.value[index] = true
        })
      } else {
        // 会话无历史记录时清空
        messages.value = []
        streamingDone.value = {}
      }
    } catch (e) {
      console.error('Failed to load chat history:', e)
      messages.value = []
      streamingDone.value = {}
    }
  }
  
  // 保存聊天记录
  const saveChatHistory = async () => {
    if (!hasWorkspace.value) return
    
    try {
      const chatMessages = messages.value.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString()
      }))
      
      const id = await invoke('save_chat_history', {
        workspacePath: props.workspacePath,
        sessionId: sessionId.value,
        messages: chatMessages
      })
      
      sessionId.value = id
    } catch (e) {
      console.error('Failed to save chat history:', e)
    }
  }
  
  // 滚动到底部
  const scrollToBottom = () => {
    nextTick(() => {
      const container = document.querySelector('.chat-messages')
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    })
  }
  
  // 发送消息
  const sendMessage = async () => {
    if (!inputMessage.value.trim() || sending.value || !hasWorkspace.value) return
    
    // 添加用户消息
    const userMessage = inputMessage.value.trim()
    messages.value.push({ role: 'user', content: userMessage })
    inputMessage.value = ''
    scrollToBottom()
    
    // 准备发送
    sending.value = true
    
    // 准备 AI 响应消息
    messages.value.push({ role: 'assistant', content: '' })
    
    // 记录当前AI消息索引
    const aiIndex = messages.value.length - 1
    streamingDone.value[aiIndex] = false
    
    scrollToBottom()
    
    try {
      // 构建消息历史
      const chatMessages = messages.value.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content
      }))
      
      // 调用后端
      const result = await invoke('chat_ai', {
        apiEndpoint: aiConfig.value.endpoint,
        apiKey: aiConfig.value.key,
        model: aiConfig.value.model,
        messages: chatMessages,
        customHeaders: aiConfig.value.customHeaders.filter(h => h.enabled && h.key.trim()).map(h => ({
          key: h.key,
          value: h.value,
          enabled: h.enabled,
          description: h.description?.trim() || null
        }))
      })
      
      // 标记流式完成
      streamingDone.value[aiIndex] = true
      
      // 更新 AI 响应（确保内容完整）
      messages.value[aiIndex].content = result
      
      // 保存聊天记录
      await saveChatHistory()
    } catch (e) {
      console.error('Chat error:', e)
      messages.value[messages.value.length - 1].content = `${t('chat.error')}: ${e}`
    } finally {
      sending.value = false
      scrollToBottom()
    }
  }
  
  // 清空消息
  const clearMessages = async () => {
    if (!hasWorkspace.value) return
    
    messages.value = []
    streamingDone.value = {}
    
    // 清空聊天记录
    try {
      await invoke('clear_chat_history', {
        workspacePath: props.workspacePath,
        sessionId: sessionId.value
      })
      sessionId.value = null
    } catch (e) {
      console.error('Failed to clear chat history:', e)
    }
  }
  
  // 流式响应监听
  let streamUnlisten = null
  
  // 监听工作区变化
  watch(() => props.workspacePath, async (newPath) => {
    checkWorkspace()
    sessionId.value = props.sessionId
    if (hasWorkspace.value) {
      await loadChatHistory()
    } else {
      messages.value = []
      streamingDone.value = {}
      sessionId.value = null
    }
  })
  
  // 监听sessionId变化
  watch(() => props.sessionId, async (newSessionId) => {
    sessionId.value = newSessionId
    if (hasWorkspace.value) {
      await loadChatHistory()
    }
  })
  
  // 初始化
  onMounted(async () => {
    checkWorkspace()
    sessionId.value = props.sessionId
    await loadAiConfig()
    
    if (hasWorkspace.value) {
      await loadChatHistory()
    }
    
    // 监听流式响应事件
    streamUnlisten = await listen('ai-chat-stream', (event) => {
      if (messages.value.length > 0) {
        const lastIndex = messages.value.length - 1
        if (messages.value[lastIndex].role === 'assistant') {
          // 直接修改数组元素以触发响应式更新
          messages.value[lastIndex] = {
            ...messages.value[lastIndex],
            content: messages.value[lastIndex].content + event.payload
          }
          scrollToBottom()
        }
      }
    })
  })
  
  // 清理
  onUnmounted(() => {
    if (streamUnlisten) {
      streamUnlisten()
    }
  })
  
  // 渲染markdown
  const renderMarkdown = (content) => {
    if (!content) return ''
    return marked.parse(content)
  }
  
  return {
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
  }
}