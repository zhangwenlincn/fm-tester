import { ref, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useI18n } from 'vue-i18n'

export function useChatHistorySetup(props, emit) {
  const { t } = useI18n()
  const sessions = ref([])
  const activeSessionId = ref(null)
  const loading = ref(false)

  // 加载聊天会话列表
  const loadSessions = async () => {
    if (!props.workspace?.path) {
      sessions.value = []
      return
    }

    try {
      loading.value = true
      const result = await invoke('get_chat_sessions', {
        workspacePath: props.workspace.path
      })
      sessions.value = result || []
    } catch (e) {
      console.error('Failed to load chat sessions:', e)
      sessions.value = []
    } finally {
      loading.value = false
    }
  }

  // 选择会话
  const selectSession = (session) => {
    activeSessionId.value = session.id
    emit('select-session', session)
  }

  // 创建新会话
  const createNewSession = () => {
    activeSessionId.value = null
    emit('new-session')
  }

  // 删除会话
  const deleteSession = async (sessionId) => {
    if (!props.workspace?.path) return

    try {
      await invoke('delete_chat_session', {
        workspacePath: props.workspace.path,
        sessionId: sessionId
      })
      
      // 如果删除的是当前活动的会话，清空选择
      if (activeSessionId.value === sessionId) {
        activeSessionId.value = null
        emit('new-session')
      }
      
      // 重新加载会话列表
      await loadSessions()
    } catch (e) {
      console.error('Failed to delete chat session:', e)
    }
  }

  // 监听工作区变化
  watch(() => props.workspace?.path, () => {
    loadSessions()
  })

  onMounted(() => {
    loadSessions()
  })

  return {
    t,
    sessions,
    activeSessionId,
    loading,
    selectSession,
    createNewSession,
    deleteSession,
    loadSessions
  }
}