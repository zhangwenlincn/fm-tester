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
  
  // 是否中断发送
  const abortSending = ref(false)
  
  // 当前会话ID
  const sessionId = ref(null)
  
  // 检查工作区状态
  const checkWorkspace = () => {
    hasWorkspace.value = props.workspacePath && props.workspacePath.trim() !== ''
  }
  
  // 加载聊天记录
  const loadChatHistory = async () => {
    if (!hasWorkspace.value) return
    
    // 新建对话时清空消息
    if (!sessionId.value) {
      messages.value = []
      streamingDone.value = {}
      reasoningExpanded.value = {}
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
          content: m.content,
          reasoning: m.reasoning || ''
        }))
        // 标记历史记录已完成，思考过程默认折叠
        history.forEach((_, index) => {
          streamingDone.value[index] = true
          reasoningExpanded.value[index] = false
        })
      } else {
        // 会话无历史记录时清空
        messages.value = []
        streamingDone.value = {}
        reasoningExpanded.value = {}
      }
    } catch (e) {
      console.error('Failed to load chat history:', e)
      messages.value = []
      streamingDone.value = {}
      reasoningExpanded.value = {}
    }
  }
  
  // 保存聊天记录
  const saveChatHistory = async () => {
    if (!hasWorkspace.value) return
    
    try {
      const chatMessages = messages.value.map(m => ({
        role: m.role,
        content: m.content,
        reasoning: m.reasoning || null,
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
    
    // 重置中断状态
    abortSending.value = false
    
    // 添加用户消息
    const userMessage = inputMessage.value.trim()
    messages.value.push({ role: 'user', content: userMessage })
    inputMessage.value = ''
    scrollToBottom()
    
    // 准备发送
    sending.value = true
    
    // 准备 AI 响应消息
    messages.value.push({ role: 'assistant', content: '', reasoning: '' })
    
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
      
      // 调用后端（不传递 api key，后端自动从 settings 解密）
      const result = await invoke('chat_ai', {
        messages: chatMessages
      })
      
      // 如果被中断，不更新内容
      if (abortSending.value) {
        return
      }
      
      // 标记流式完成
      streamingDone.value[aiIndex] = true
      
      // 思考完成后自动折叠
      reasoningExpanded.value[aiIndex] = false
      
      // 更新 AI 响应（确保内容完整）
      messages.value[aiIndex].content = result
      
      // 保存聊天记录
      await saveChatHistory()
    } catch (e) {
      // 如果是主动中断，不显示错误
      if (abortSending.value) {
        return
      }
      console.error('Chat error:', e)
      messages.value[messages.value.length - 1].content = `${t('chat.error')}: ${e}`
    } finally {
      sending.value = false
      scrollToBottom()
    }
  }
  
  // 停止发送
  const stopSending = () => {
    abortSending.value = true
    sending.value = false
    
    // 标记当前消息为完成
    if (messages.value.length > 0) {
      const lastIndex = messages.value.length - 1
      if (messages.value[lastIndex].role === 'assistant') {
        streamingDone.value[lastIndex] = true
        // 如果有思考内容，折叠它
        if (messages.value[lastIndex].reasoning) {
          reasoningExpanded.value[lastIndex] = false
        }
      }
    }
    
    // 保存聊天记录
    saveChatHistory()
  }
  
  // 清空消息
  const clearMessages = async () => {
    if (!hasWorkspace.value) return
    
    messages.value = []
    streamingDone.value = {}
    reasoningExpanded.value = {}
    
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
  let reasoningUnlisten = null
  
  // 思考过程展开状态（每条消息的展开状态）
  const reasoningExpanded = ref({})
  
  // 监听工作区变化
  watch(() => props.workspacePath, async (newPath) => {
    checkWorkspace()
    sessionId.value = props.sessionId
    if (hasWorkspace.value) {
      await loadChatHistory()
    } else {
      messages.value = []
      streamingDone.value = {}
      reasoningExpanded.value = {}
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
    
    if (hasWorkspace.value) {
      await loadChatHistory()
    }
    
    // 监听流式响应事件
    streamUnlisten = await listen('ai-chat-stream', (event) => {
      // 如果已中断，不再处理事件
      if (abortSending.value) return
      
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
    
    // 监听思考过程事件
    reasoningUnlisten = await listen('ai-chat-reasoning', (event) => {
      // 如果已中断，不再处理事件
      if (abortSending.value) return
      
      if (messages.value.length > 0) {
        const lastIndex = messages.value.length - 1
        if (messages.value[lastIndex].role === 'assistant') {
          messages.value[lastIndex] = {
            ...messages.value[lastIndex],
            reasoning: (messages.value[lastIndex].reasoning || '') + event.payload
          }
          // 默认展开思考过程
          reasoningExpanded.value[lastIndex] = true
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
    if (reasoningUnlisten) {
      reasoningUnlisten()
    }
  })
  
  // 渲染markdown
  const renderMarkdown = (content) => {
    if (!content) return ''
    return marked.parse(content)
  }
  
  // 切换思考过程展开/折叠
  const toggleReasoning = (index) => {
    reasoningExpanded.value[index] = !reasoningExpanded.value[index]
  }
  
  return {
    t,
    messages,
    inputMessage,
    loading,
    sending,
    streamingDone,
    hasWorkspace,
    reasoningExpanded,
    sendMessage,
    stopSending,
    clearMessages,
    renderMarkdown,
    toggleReasoning
  }
}