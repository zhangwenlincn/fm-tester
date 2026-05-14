import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/**
 * 标签页管理 composable
 * @param {Ref} currentWorkspace - 当前工作区引用
 * @param {Ref} currentNavKey - 当前导航项引用
 * @param {Ref} sidebarRef - 侧边栏组件引用
 * @param {Object} currentRequest - 当前请求状态（响应式对象）
 * @param {Ref} response - 响应数据引用
 * @param {Ref} loading - 加载状态引用
 * @param {Ref} requestTabs - 请求子标签页状态引用
 * @param {Ref} tabs - 标签页列表引用（外部传入）
 * @param {Ref} activeTab - 当前激活标签页引用（外部传入）
 * @param {Ref} currentRequestTab - 当前请求子标签页引用（外部传入）
 */
export function useTabs(currentWorkspace, currentNavKey, sidebarRef, currentRequest, response, loading, requestTabs, tabs, activeTab, currentRequestTab) {
  const collectionTabsData = ref({})

  const displayTabs = computed(() => {
    if (currentNavKey.value !== 'collection') return []
    return tabs.value
  })

  const selectedCollection = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.tabType === 'collection') {
      return collectionTabsData.value[currentTab.id]
    }
    return null
  })

  const showRequestResponse = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    return currentNavKey.value === 'collection' && currentTab?.tabType === 'api'
  })

  const showCollectionSettings = computed(() => {
    const currentTab = tabs.value[activeTab.value]
    return currentNavKey.value === 'collection' && currentTab?.tabType === 'collection'
  })

  const findApisInCollections = (collections, apiIds) => {
    const apis = []
    for (const collection of collections) {
      if (collection.apis) {
        for (const api of collection.apis) {
          if (apiIds.includes(api.id)) {
            apis.push(api)
          }
        }
      }
      if (collection.children) {
        const childApis = findApisInCollections(collection.children, apiIds)
        apis.push(...childApis)
      }
    }
    return apis
  }

  const findCollection = (collections, collectionId) => {
    for (const collection of collections) {
      if (collection.id === collectionId) {
        return collection
      }
      if (collection.children) {
        const found = findCollection(collection.children, collectionId)
        if (found) return found
      }
    }
    return null
  }

  const loadOpenTabs = async (workspacePath) => {
    try {
      const [openTabIds, activeIndex, savedRequestTabs] = await invoke('get_open_tabs', { workspacePath })
      requestTabs.value = savedRequestTabs || {}
      if (openTabIds.length > 0) {
        const collections = await invoke('get_collections', { workspacePath })
        const apis = findApisInCollections(collections || [], openTabIds)
        for (const apiId of openTabIds) {
          const api = apis.find(a => a.id === apiId)
          if (api) {
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
              timeout: api.timeout
            })
          }
        }
        if (tabs.value.length > 0) {
          activeTab.value = Math.min(activeIndex || 0, tabs.value.length - 1)
        }
      }
    } catch (e) {
      console.error('加载打开的标签页失败:', e)
    }
  }

  const saveOpenTabs = async () => {
    if (!currentWorkspace.value?.path) return
    try {
      const openTabIds = tabs.value
        .filter(t => t.tabType === 'api')
        .map(t => t.id)
      await invoke('save_open_tabs', {
        workspacePath: currentWorkspace.value.path,
        openTabIds,
        activeIndex: activeTab.value,
        requestTabs: requestTabs.value
      })
    } catch (e) {
      console.error('保存标签页失败:', e)
    }
  }

  const selectCollection = (collection) => {
    const existingIndex = tabs.value.findIndex(t => t.id === collection.id && t.tabType === 'collection')

    if (existingIndex >= 0) {
      activeTab.value = existingIndex
    } else {
      collectionTabsData.value[collection.id] = collection
      tabs.value.push({
        id: collection.id,
        name: collection.name,
        tabType: 'collection'
      })
      activeTab.value = tabs.value.length - 1
    }

    if (sidebarRef.value) {
      sidebarRef.value.setSelectedApi(null)
    }
  }

  const onCollectionSettingsSaved = async () => {
    // 重新加载侧边栏集合列表
    sidebarRef.value?.loadCollections()

    // 更新当前打开的集合标签页数据
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.tabType === 'collection' && currentWorkspace.value?.path) {
      try {
        const collections = await invoke('get_collections', { workspacePath: currentWorkspace.value.path })
        const updatedCollection = findCollection(collections, currentTab.id)
        if (updatedCollection) {
          collectionTabsData.value[currentTab.id] = updatedCollection
        }
      } catch (e) {
        console.error('更新集合标签页数据失败:', e)
      }
    }
  }

  const closeTab = async (index) => {
    loading.value = false

    const wasActive = index === activeTab.value
    const closedTab = tabs.value[index]
    tabs.value.splice(index, 1)

    // 清理集合数据
    if (closedTab?.tabType === 'collection') {
      delete collectionTabsData.value[closedTab.id]
    }

    if (tabs.value.length === 0) {
      activeTab.value = 0
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      currentRequest.formData = []
      currentRequest.binaryFile = null
      response.value = null
      if (sidebarRef.value) {
        sidebarRef.value.setSelectedApi(null)
      }
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    } else if (wasActive) {
      const currentTab = tabs.value[activeTab.value]
      if (currentTab?.tabType === 'api' && sidebarRef.value) {
        sidebarRef.value.setSelectedApi(currentTab.id)
      }
    }

    await saveOpenTabs()
  }

  const onDeleteApis = (apiIds) => {
    for (const apiId of apiIds) {
      const index = tabs.value.findIndex(t => t.id === apiId && t.tabType === 'api')
      if (index >= 0) {
        tabs.value.splice(index, 1)
      }
    }
    if (tabs.value.length === 0) {
      activeTab.value = 0
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    }
  }

  const onDeleteCollection = (collectionId) => {
    const indicesToRemove = []
    for (let i = 0; i < tabs.value.length; i++) {
      if (tabs.value[i].id === collectionId && tabs.value[i].tabType === 'collection') {
        indicesToRemove.push(i)
      }
    }

    for (const index of indicesToRemove.reverse()) {
      tabs.value.splice(index, 1)
      delete collectionTabsData.value[collectionId]
    }

    if (tabs.value.length === 0) {
      activeTab.value = 0
    } else if (activeTab.value >= tabs.value.length) {
      activeTab.value = tabs.value.length - 1
    }
  }

  const onUpdateRequestTab = async (tabKey) => {
    currentRequestTab.value = tabKey
    const currentTab = tabs.value[activeTab.value]
    if (currentTab?.id && currentTab.tabType === 'api') {
      requestTabs.value[currentTab.id] = tabKey
      await saveOpenTabs()
    }
  }

  const updateCurrentRequest = () => {
    if (tabs.value.length === 0) {
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      currentRequest.formData = []
      currentRequest.binaryFile = null
      response.value = null
      return
    }

    const currentTab = tabs.value[activeTab.value]
    if (!currentTab || currentTab.tabType !== 'api') {
      currentRequest.method = 'GET'
      currentRequest.url = ''
      currentRequest.headers = []
      currentRequest.body = ''
      currentRequest.bodyType = 'raw'
      currentRequest.formData = []
      currentRequest.binaryFile = null
      response.value = null
      return
    }

    currentRequest.method = currentTab.method || 'GET'
    currentRequest.url = currentTab.url || ''
    currentRequest.headers = currentTab.headers || []
    currentRequest.body = currentTab.body || ''
    currentRequest.bodyType = currentTab.bodyType || 'raw'
    currentRequest.formData = currentTab.formData || []
    currentRequest.binaryFile = currentTab.binaryFile || null
    currentRequest.timeout = currentTab.timeout

    // 恢复保存的响应数据
    response.value = currentTab.lastResponseData || null
  }

  return {
    tabs,
    activeTab,
    collectionTabsData,
    currentRequestTab,
    displayTabs,
    selectedCollection,
    showRequestResponse,
    showCollectionSettings,
    findApisInCollections,
    findCollection,
    loadOpenTabs,
    saveOpenTabs,
    selectCollection,
    onCollectionSettingsSaved,
    closeTab,
    onDeleteApis,
    onDeleteCollection,
    onUpdateRequestTab,
    updateCurrentRequest
  }
}