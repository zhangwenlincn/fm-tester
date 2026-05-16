import { ref, computed, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/**
 * 响应管理 composable（包含Cookie、历史记录、保存响应）
 * @param {Ref} currentWorkspace - 当前工作区引用
 * @param {Ref} tabs - 标签页列表引用
 * @param {Ref} activeTab - 当前激活标签页引用
 * @param {Ref} currentNavKey - 当前导航项引用
 * @param {Ref} sidebarRef - 侧边栏组件引用
 * @param {Ref} response - 响应数据引用
 * @param {Object} currentRequest - 当前请求状态
 * @param {Function} updateCurrentRequest - 更新当前请求函数
 */
export function useResponse(currentWorkspace, tabs, activeTab, currentNavKey, sidebarRef, response, currentRequest, updateCurrentRequest) {
  // Cookie 管理
  const cookies = ref([])
  const showCookiePanel = ref(false)

  // 保存响应对话框
  const showSaveResponseDialog = ref(false)
  const saveResponseDefaultName = ref('')

  // 历史记录
  const selectedHistoryEntry = ref(null)

  // 选中查看的工作区（用于设置面板）
  const selectedWorkspace = ref(null)

  const loadCookies = async () => {
    if (!currentWorkspace.value?.path) {
      cookies.value = []
      return
    }
    try {
      const cookieList = await invoke('get_cookies', { workspacePath: currentWorkspace.value.path })
      cookies.value = cookieList || []
    } catch (e) {
      console.error('加载 Cookies 失败:', e)
    }
  }

  const openCookiePanel = async () => {
    await loadCookies()
    showCookiePanel.value = true
  }

  const closeCookiePanel = () => {
    showCookiePanel.value = false
  }

  const showHistoryDetail = computed(() => {
    return currentNavKey.value === 'history'
  })

  const showWorkspaceInfo = computed(() => {
    return currentNavKey.value === 'workspace' && selectedWorkspace.value
  })

  // 选择工作区（用于显示设置面板）
  const onSelectWorkspace = (ws) => {
    selectedWorkspace.value = ws
  }

  // 更新选中的工作区数据（同步/更新后刷新）
  const onUpdateSelectedWorkspace = async () => {
    if (!selectedWorkspace.value) return
    try {
      const workspaces = await invoke('get_workspaces')
      const updated = workspaces?.find(w => w.id === selectedWorkspace.value.id)
      if (updated) {
        selectedWorkspace.value = updated
      }
    } catch (e) {
      console.error('更新工作区数据失败:', e)
    }
  }

  const onSelectHistory = (historyEntry) => {
    selectedHistoryEntry.value = historyEntry
  }

  const onSaveResponse = () => {
    if (!response.value) return

    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.name) return

    const now = new Date()
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`

    saveResponseDefaultName.value = timestamp
    showSaveResponseDialog.value = true
  }

  const handleSaveResponse = async (name) => {
    if (!currentWorkspace.value?.path || !response.value || tabs.value.length === 0) return

    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.id || currentTab.tabType !== 'api') return

    const formFields = currentRequest.formData?.map(field => ({
      key: field.key,
      value: field.value,
      type: field.type,
      enabled: field.enabled,
      files: field.files
    })) || null

    const binaryFilePath = currentRequest.binaryFile?.path || null

    // 获取解析后的 URL（来自上次响应）
    const resolvedUrl = currentTab?.lastResponseData?.resolvedUrl || currentRequest.url
    // 获取解析后的 Headers（来自上次响应）
    const resolvedHeaders = currentTab?.lastResponseData?.resolvedHeaders || currentRequest.headers

    const request = {
      method: currentRequest.method,
      url: currentRequest.url,
      resolved_url: resolvedUrl,
      headers: currentRequest.headers || [],
      resolved_headers: resolvedHeaders || [],
      body: currentRequest.body || null,
      body_type: currentRequest.bodyType || null,
      form_fields: formFields,
      binary_file_path: binaryFilePath
    }

    const responseData = {
      status: response.value.status,
      status_text: response.value.statusText,
      headers: response.value.headers || {},
      body: response.value.body || '',
      time: response.value.time || 0,
      size: response.value.size || 0
    }

    try {
      await invoke('save_response', {
        workspacePath: currentWorkspace.value.path,
        name: name,
        apiId: currentTab.id,
        request: request,
        response: responseData,
        cookies: cookies.value
      })

      showSaveResponseDialog.value = false
      sidebarRef.value?.loadCollections()
    } catch (e) {
      console.error('保存响应失败:', e)
    }
  }

  const onSelectSavedResponse = async (responseItem) => {
    if (!currentWorkspace.value?.path) return

    try {
      const fullResponse = await invoke('get_saved_response', {
        workspacePath: currentWorkspace.value.path,
        id: responseItem.id
      })

      const savedTabId = `saved_${responseItem.id}`

      const existingIndex = tabs.value.findIndex(t => t.id === savedTabId)

      const apiId = responseItem.api_id
      const apiTab = tabs.value.find(t => t.id === apiId)
      const apiName = apiTab?.name || '接口'
      const fullTabName = `[${apiName}] ${fullResponse.name}`

      if (existingIndex >= 0) {
        activeTab.value = existingIndex
      } else {
        tabs.value.push({
          id: savedTabId,
          name: fullTabName,
          fullName: fullTabName,
          method: fullResponse.request.method,
          url: fullResponse.request.resolved_url, // 使用解析后的真实 URL
          headers: fullResponse.request.resolved_headers || [], // 使用解析后的真实 Headers
          body: fullResponse.request.body || '',
          bodyType: fullResponse.request.body_type || 'raw',
          formData: fullResponse.request.form_fields || [],
          binaryFile: fullResponse.request.binary_file_path ? { path: fullResponse.request.binary_file_path, name: fullResponse.request.binary_file_path.split(/[/\\]/).pop() } : null,
          tabType: 'api',
          savedResponseData: {
            status: fullResponse.response.status,
            statusText: fullResponse.response.status_text,
            headers: fullResponse.response.headers || {},
            body: fullResponse.response.body || '',
            time: fullResponse.response.time || 0,
            size: fullResponse.response.size || 0
          }
        })
        activeTab.value = tabs.value.length - 1
      }

      // 等待 Vue 响应式更新完成
      await nextTick()
      updateCurrentRequest()
      response.value = tabs.value[activeTab.value]?.savedResponseData || null

    } catch (e) {
      console.error('获取保存响应失败:', e)
    }
  }

  return {
    cookies,
    showCookiePanel,
    loadCookies,
    openCookiePanel,
    closeCookiePanel,
    showSaveResponseDialog,
    saveResponseDefaultName,
    selectedHistoryEntry,
    showHistoryDetail,
    showWorkspaceInfo,
    selectedWorkspace,
    onSelectWorkspace,
    onUpdateSelectedWorkspace,
    onSelectHistory,
    onSaveResponse,
    handleSaveResponse,
    onSelectSavedResponse
  }
}