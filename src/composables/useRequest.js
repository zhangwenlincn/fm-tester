import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import JSON5 from 'json5'

/**
 * HTTP请求管理 composable（包含Console日志）
 * @param {Ref} currentWorkspace - 当前工作区引用
 * @param {Ref} tabs - 标签页列表引用
 * @param {Ref} activeTab - 当前激活标签页引用
 * @param {Ref} sidebarRef - 侧边栏组件引用
 * @param {Ref} requestTabs - 请求子标签页状态引用
 * @param {Ref} currentRequestTab - 当前请求子标签页引用
 * @param {Function} updateCurrentRequest - 更新当前请求函数
 * @param {Function} saveOpenTabs - 保存标签页函数
 * @param {Object} currentRequest - 当前请求状态（外部传入）
 * @param {Ref} response - 响应数据引用（外部传入）
 * @param {Ref} loading - 加载状态引用（外部传入）
 */
export function useRequest(currentWorkspace, tabs, activeTab, sidebarRef, requestTabs, currentRequestTab, updateCurrentRequest, saveOpenTabs, currentRequest, response, loading) {
  // 发送请求时的 tab ID
  const sendingTabId = ref(null)

  // Console 日志
  const showConsolePanel = ref(false)
  const consoleLogs = ref([])
  const maxConsoleLogs = 100

  let unlistenHttpLog = null

  const openConsolePanel = () => {
    showConsolePanel.value = !showConsolePanel.value
  }

  const closeConsolePanel = () => {
    showConsolePanel.value = false
  }

  const clearConsoleLogs = () => {
    consoleLogs.value = []
  }

  const addConsoleLog = (type, message) => {
    const now = new Date()
    const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    consoleLogs.value.push({ type, message, time })
    if (consoleLogs.value.length > maxConsoleLogs) {
      consoleLogs.value.shift()
    }
  }

  const setupHttpLogListener = async () => {
    unlistenHttpLog = await listen('http-log', (event) => {
      const log = event.payload
      const logType = log.log_type === 'error' ? 'error' :
                      log.log_type === 'response' ? 'info' : 'log'
      const message = JSON.stringify(log, null, 2)
      const timestamp = log.timestamp
      consoleLogs.value.push({ type: logType, message, time: timestamp })
      if (consoleLogs.value.length > maxConsoleLogs) {
        consoleLogs.value.shift()
      }
    })
  }

  const cleanupHttpLogListener = () => {
    if (unlistenHttpLog) {
      unlistenHttpLog()
    }
  }

  const selectApi = async (api) => {
    loading.value = false

    const existingIndex = tabs.value.findIndex(t => t.id === api.id && t.tabType === 'api')

    if (existingIndex >= 0) {
      tabs.value[existingIndex].commonHeaders = api.commonHeaders || []
      tabs.value[existingIndex].collectionVariables = api.collectionVariables || []
      tabs.value[existingIndex].timeout = api.timeout
      activeTab.value = existingIndex
    } else {
      tabs.value.push({
        id: api.id,
        name: api.name,
        method: api.method || 'GET',
        url: api.url || '',
        headers: api.headers || [],
        body: api.body || '',
        bodyType: api.body_type || 'raw',
        formData: api.form_fields || [],
        binaryFile: api.binary_file_path ? { path: api.binary_file_path, name: api.binary_file_path.split(/[/\\]/).pop() } : null,
        tabType: 'api',
        commonHeaders: api.commonHeaders || [],
        collectionVariables: api.collectionVariables || [],
        timeout: api.timeout
      })
      activeTab.value = tabs.value.length - 1
    }

    updateCurrentRequest()
    await saveOpenTabs()
  }

  const updateRequest = (newRequest) => {
    currentRequest.method = newRequest.method
    currentRequest.url = newRequest.url
    currentRequest.params = newRequest.params
    currentRequest.headers = newRequest.headers
    currentRequest.body = newRequest.body
    currentRequest.bodyType = newRequest.bodyType
    currentRequest.formData = newRequest.formData
    currentRequest.binaryFile = newRequest.binaryFile
    currentRequest.timeout = newRequest.timeout
  }

  const sendRequest = async (request) => {
    loading.value = true
    response.value = null

    const sendTabIndex = activeTab.value
    const sendTabId = tabs.value[sendTabIndex]?.id
    sendingTabId.value = sendTabId

    const sendTab = tabs.value[sendTabIndex]
    if (sendTab && sendTab.tabType === 'api') {
      sendTab.lastResponseData = null
    }

    try {
      let bodyToSend = request.body

      const commonHeaders = sendTab?.commonHeaders || []
      const collectionVariables = sendTab?.collectionVariables || []

      const headersMap = new Map()

      for (const h of commonHeaders) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }

      for (const h of (request.headers || [])) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }

      const headersToSend = Array.from(headersMap.values())

      const contentTypeHeader = headersToSend.find(
        h => h.key.toLowerCase() === 'content-type'
      )

      if (contentTypeHeader?.value?.includes('json') && request.body) {
        try {
          const parsed = JSON5.parse(request.body)
          bodyToSend = JSON.stringify(parsed)
        } catch {
          try {
            const parsed = JSON.parse(request.body)
            bodyToSend = JSON.stringify(parsed)
          } catch {}
        }
      }

      const formFields = request.formData?.map(field => ({
        key: field.key,
        value: field.value,
        type: field.type,
        enabled: field.enabled,
        files: field.files
      })) || null

      const binaryFilePath = request.binaryFile?.path || null

      const apiId = sendTab?.tabType === 'api' ? sendTab?.id : null
      const apiName = sendTab?.tabType === 'api' ? sendTab?.name : null

      const result = await invoke('send_http_request', {
        method: request.method,
        url: request.url,
        headers: headersToSend,
        body: bodyToSend || null,
        bodyType: request.bodyType || null,
        formFields: formFields,
        binaryFilePath: binaryFilePath,
        workspacePath: currentWorkspace.value?.path,
        timeout: request.timeout || null,
        apiId: apiId,
        apiName: apiName,
        collectionVariables: collectionVariables
      })

      const responseData = {
        status: result.status,
        statusText: result.status_text,
        headers: result.headers,
        body: result.body,
        time: result.time,
        size: result.size
      }

      const targetTab = tabs.value.find(t => t.id === sendingTabId.value)
      if (targetTab && targetTab.tabType === 'api') {
        targetTab.lastResponseData = responseData
      }

      if (sendingTabId.value === tabs.value[activeTab.value]?.id) {
        response.value = responseData
      }
    } catch (error) {
      const errorResponse = {
        status: 0,
        statusText: '请求失败',
        headers: {},
        body: `错误: ${error}`,
        time: 0,
        size: 0
      }

      const targetTab = tabs.value.find(t => t.id === sendingTabId.value)
      if (targetTab && targetTab.tabType === 'api') {
        targetTab.lastResponseData = errorResponse
      }

      if (sendingTabId.value === tabs.value[activeTab.value]?.id) {
        response.value = errorResponse
      }
    } finally {
      loading.value = false
      sendingTabId.value = null
    }
  }

  const saveRequest = async (request) => {
    if (!currentWorkspace.value?.path) return
    if (tabs.value.length === 0) return

    const currentTab = tabs.value[activeTab.value]
    if (!currentTab?.id || currentTab.tabType !== 'api') return

    const formFields = request.formData?.map(field => ({
      key: field.key,
      value: field.value,
      type: field.type,
      enabled: field.enabled,
      files: field.files
    })) || null

    const binaryFilePath = request.binaryFile?.path || null

    try {
      await invoke('update_api', {
        workspacePath: currentWorkspace.value.path,
        id: currentTab.id,
        name: currentTab.name,
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
        bodyType: request.bodyType,
        formFields: formFields,
        binaryFilePath: binaryFilePath
      })

      currentTab.method = request.method
      currentTab.url = request.url
      currentTab.headers = request.headers
      currentTab.body = request.body
      currentTab.bodyType = request.bodyType

      sidebarRef.value?.loadCollections()
    } catch (e) {
      console.error('保存失败:', e)
    }
  }

  const onRenameApi = async (apiId, newName) => {
    if (!currentWorkspace.value?.path) return

    try {
      await invoke('update_api', {
        workspacePath: currentWorkspace.value.path,
        id: apiId,
        name: newName
      })

      const tabIndex = tabs.value.findIndex(t => t.id === apiId && t.tabType === 'api')
      if (tabIndex >= 0) {
        tabs.value[tabIndex].name = newName
      }

      sidebarRef.value?.loadCollections()
    } catch (e) {
      console.error('重命名失败:', e)
    }
  }

  // 监听 activeTab 变化
  const setupActiveTabWatcher = () => {
    watch(activeTab, async () => {
      loading.value = false

      updateCurrentRequest()
      const currentTab = tabs.value[activeTab.value]
      if (currentTab?.id) {
        if (currentTab.tabType === 'api' && sidebarRef.value) {
          sidebarRef.value.setSelectedApi(currentTab.id)
        }
        currentRequestTab.value = requestTabs.value[currentTab.id] || 'params'
      }
      await saveOpenTabs()
    })
  }

  return {
    currentRequest,
    response,
    loading,
    sendingTabId,
    showConsolePanel,
    consoleLogs,
    openConsolePanel,
    closeConsolePanel,
    clearConsoleLogs,
    addConsoleLog,
    setupHttpLogListener,
    cleanupHttpLogListener,
    selectApi,
    updateRequest,
    sendRequest,
    saveRequest,
    onRenameApi,
    setupActiveTabWatcher
  }
}