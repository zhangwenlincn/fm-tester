import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import JSON5 from 'json5'
import { 
  executePreScripts, 
  executePostScripts, 
  mergeCollectionVariablesToObject 
} from '../utils/scriptEngine.js'

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
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    const time = `${year}-${month}-${day} ${hour}:${minute}:${second}`
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

  const selectApi = async (apiOrId) => {
    loading.value = false

    // 支持传入 api 对象或 apiId 字符串
    let api
    let apiId

    if (typeof apiOrId === 'string') {
      apiId = apiOrId
      // 从已打开的 tabs 中找到 api 数据
      const existingTab = tabs.value.find(t => t.id === apiId && t.tabType === 'api')
      if (existingTab) {
        api = existingTab
      } else {
        // 如果 tab 不存在，只通知侧边栏展开父集合
        if (sidebarRef.value) {
          sidebarRef.value.setSelectedApi(apiId)
        }
        return
      }
    } else {
      api = apiOrId
      apiId = api.id
    }

    const existingIndex = tabs.value.findIndex(t => t.id === apiId && t.tabType === 'api')

    if (existingIndex >= 0) {
      tabs.value[existingIndex].params = api.params || []
      tabs.value[existingIndex].commonHeaders = api.commonHeaders || []
      tabs.value[existingIndex].collectionVariables = api.collectionVariables || []
      tabs.value[existingIndex].timeout = api.timeout
      activeTab.value = existingIndex
    } else {
      tabs.value.push({
        id: apiId,
        name: api.name,
        method: api.method || 'GET',
        url: api.url || '',
        params: api.params || [],
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

    // 通知侧边栏展开父集合并选中 API
    if (sidebarRef.value) {
      sidebarRef.value.setSelectedApi(apiId)
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

    const apiId = sendTab?.tabType === 'api' ? sendTab?.id : null
    const apiName = sendTab?.tabType === 'api' ? sendTab?.name : null
    const workspacePath = currentWorkspace.value?.path

    // 脚本日志函数（只输出用户 fm.log() 和错误日志）
    const scriptLogger = (type, message, level) => {
      // 只输出用户调用的 fm.log() 和错误日志
      if (type !== 'script' && type !== 'error') return
      
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const second = String(now.getSeconds()).padStart(2, '0')
      const time = `${year}-${month}-${day} ${hour}:${minute}:${second}`
      const logType = type === 'error' ? 'error' : 'log'
      consoleLogs.value.push({ type: logType, message, time, level })
      if (consoleLogs.value.length > maxConsoleLogs) {
        consoleLogs.value.shift()
      }
    }

    try {
      // ========== 前置脚本执行 ==========
      let modifiedRequest = request
      let modifiedEnvVars = {}
      let modifiedCollVars = {}
      let ancestorCollections = []
      let collectionsData = []
      let envConfig = null

      if (apiId && workspacePath) {
        // 获取集合数据
        collectionsData = await invoke('get_collections', { workspacePath })
        
        // 查找祖先集合链（从根到父）
        const findAncestorCollectionsForApi = (collections, targetApiId) => {
          const search = (items, path = []) => {
            for (const item of items) {
              if (item.type === 'api' && item.id === targetApiId) {
                return path
              }
              if (item.type === 'collection' && item.children) {
                const newPath = [...path, item]
                const found = search(item.children, newPath)
                if (found) return found
              }
            }
            return null
          }
          return search(collections) || []
        }
        
        ancestorCollections = findAncestorCollectionsForApi(collectionsData, apiId)
        
        // 获取当前环境变量和环境配置
        envConfig = await invoke('get_environments', { workspacePath })
        const activeEnvVars = await invoke('get_active_variables', { workspacePath })
        const collVarsObj = mergeCollectionVariablesToObject(ancestorCollections)
        
        // 获取当前激活环境的 ID
        const environmentId = envConfig.active_environment_id
        
        // 执行前置脚本链
        const preScriptResult = await executePreScripts({
          workspacePath,
          apiId,
          environmentId,
          ancestorCollections,
          environmentVariables: activeEnvVars || {},
          collectionVariables: collVarsObj,
          request: {
            url: request.url,
            method: request.method,
            headers: [...request.headers],
            body: request.body
          },
          logger: scriptLogger
        })
        
        if (!preScriptResult.success) {
          // 前置脚本失败，记录错误日志，但不中断请求
          scriptLogger('error', `前置脚本执行失败: ${preScriptResult.errors?.map(e => e.error).join(', ')}`, '')
          // 使用原始请求参数继续发送
          modifiedRequest = request
          modifiedEnvVars = activeEnvVars || {}
          modifiedCollVars = collVarsObj
        } else {
          // 使用脚本修改后的请求参数
          modifiedRequest = preScriptResult.data.request
          modifiedEnvVars = preScriptResult.data.environmentVariables
          modifiedCollVars = preScriptResult.data.collectionVariables
          
          // 保存脚本修改的环境变量
          if (envConfig.active_environment_id && Object.keys(modifiedEnvVars).length > 0) {
            const activeEnv = envConfig.environments.find(e => e.id === envConfig.active_environment_id)
            if (activeEnv) {
              // 更新环境变量：已存在的更新值，不存在的添加新变量
              const updatedVariables = [...(activeEnv.variables || [])]
              for (const [key, value] of Object.entries(modifiedEnvVars)) {
                const existingVar = updatedVariables.find(v => v.key === key)
                if (existingVar) {
                  existingVar.value = value
                } else {
                  updatedVariables.push({ key, value, enabled: true })
                }
              }
              await invoke('save_environment', {
                workspacePath,
                environment: { ...activeEnv, variables: updatedVariables }
              })
            }
          }
        }
      }

      // ========== HTTP 请求发送 ==========
      let bodyToSend = modifiedRequest.body

      const commonHeaders = sendTab?.commonHeaders || []
      const collectionVariables = sendTab?.collectionVariables || []

      const headersMap = new Map()

      // 合并环境请求头（优先级最低）
      if (envConfig && envConfig.active_environment_id) {
        const activeEnv = envConfig.environments.find(e => e.id === envConfig.active_environment_id)
        if (activeEnv && activeEnv.common_headers) {
          for (const h of activeEnv.common_headers) {
            if (h.enabled && h.key.trim()) {
              headersMap.set(h.key.toLowerCase(), h)
            }
          }
        }
      }

      // 合并集合公共请求头（覆盖环境请求头）
      for (const h of commonHeaders) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }

      // 合并接口请求头（覆盖集合和环境请求头）
      for (const h of (modifiedRequest.headers || [])) {
        if (h.enabled && h.key.trim()) {
          headersMap.set(h.key.toLowerCase(), h)
        }
      }

      const headersToSend = Array.from(headersMap.values())

      const contentTypeHeader = headersToSend.find(
        h => h.key.toLowerCase() === 'content-type'
      )

      if (contentTypeHeader?.value?.includes('json') && modifiedRequest.body) {
        try {
          const parsed = JSON5.parse(modifiedRequest.body)
          bodyToSend = JSON.stringify(parsed)
        } catch {
          try {
            const parsed = JSON.parse(modifiedRequest.body)
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

      // 构建集合变量数组（用于后端变量替换）
      const collectionVariablesArray = Object.entries(modifiedCollVars).map(([key, value]) => ({
        key,
        value,
        enabled: true
      }))

      const result = await invoke('send_http_request', {
        method: modifiedRequest.method,
        url: modifiedRequest.url,
        headers: headersToSend,
        body: bodyToSend || null,
        bodyType: request.bodyType || null,
        formFields: formFields,
        binaryFilePath: binaryFilePath,
        workspacePath: workspacePath,
        timeout: request.timeout || null,
        apiId: apiId,
        apiName: apiName,
        collectionVariables: collectionVariablesArray.length > 0 ? collectionVariablesArray : null
      })

      const responseData = {
        status: result.status,
        statusText: result.status_text,
        headers: result.headers,
        body: result.body,
        time: result.time,
        size: result.size,
        resolvedUrl: result.resolved_url,
        resolvedHeaders: result.resolved_headers,
      }

      // ========== 后置脚本执行 ==========
      if (apiId && workspacePath) {
        const postScriptResult = await executePostScripts({
          workspacePath,
          apiId,
          environmentId: envConfig?.active_environment_id,
          ancestorCollections,
          environmentVariables: modifiedEnvVars,
          collectionVariables: modifiedCollVars,
          request: modifiedRequest,
          response: responseData,
          logger: scriptLogger
        })
        
        if (!postScriptResult.success) {
          scriptLogger('error', `后置脚本执行有错误: ${postScriptResult.errors?.map(e => e.error).join(', ')}`, '')
        }
        
        // 保存后置脚本修改的环境变量
        if (postScriptResult.data && envConfig.active_environment_id) {
          const postEnvVars = postScriptResult.data.environmentVariables
          if (Object.keys(postEnvVars).length > 0) {
            const activeEnv = envConfig.environments.find(e => e.id === envConfig.active_environment_id)
            if (activeEnv) {
              const updatedVariables = [...(activeEnv.variables || [])]
              for (const [key, value] of Object.entries(postEnvVars)) {
                const existingVar = updatedVariables.find(v => v.key === key)
                if (existingVar) {
                  existingVar.value = value
                } else {
                  updatedVariables.push({ key, value, enabled: true })
                }
              }
              await invoke('save_environment', {
                workspacePath,
                environment: { ...activeEnv, variables: updatedVariables }
              })
            }
          }
        }
      }

      // ========== 更新响应数据 ==========
      const targetTab = tabs.value.find(t => t.id === sendingTabId.value)
      if (targetTab && targetTab.tabType === 'api') {
        targetTab.lastResponseData = responseData
      }

      if (sendingTabId.value === tabs.value[activeTab.value]?.id) {
        response.value = responseData
      }
    } catch (error) {
      scriptLogger('error', `请求失败: ${error}`, '')
      
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

  const onRenameApi = async (data) => {
    // data 可能是对象 { id, name } 或者两个参数 (apiId, newName)
    const apiId = typeof data === 'object' ? data.id : data
    const newName = typeof data === 'object' ? data.name : arguments[1]
    
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