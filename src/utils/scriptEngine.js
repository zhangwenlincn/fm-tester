import { invoke } from '@tauri-apps/api/core'

/**
 * 脚本执行引擎
 * 
 * 执行顺序（继承链）：
 * - 前置脚本：工作区 → 父集合 → 子集合 → 接口 → HTTP请求
 * - 后置脚本：HTTP响应 → 接口 → 子集合 → 父集合 → 工作区
 */

/**
 * 解析 URL 获取 baseUrl（不含路径）
 * @param {string} url - 完整 URL
 * @returns {string} baseUrl
 */
export function extractBaseUrl(url) {
  if (!url) return ''
  try {
    // 处理带变量的 URL，先尝试匹配
    const match = url.match(/^https?:\/\/[^\/]+/)
    if (match) return match[0]
    
    // 尝试解析为 URL
    const urlObj = new URL(url)
    return urlObj.origin
  } catch {
    // URL 不完整（纯路径如 /api/users），没有 baseUrl
    if (url.startsWith('/')) {
      return ''
    }
    // 尝试手动解析
    const idx = url.indexOf('/')
    if (idx > 0 && url[idx + 1] !== '/') {
      // 找到第一个单斜杠（路径开始）
      return url.slice(0, idx)
    }
    // 没有 path，整个 URL 就是 baseUrl
    return url
  }
}

/**
 * 解析 URL 获取路径部分（不含 baseUrl）
 * @param {string} url - 完整 URL
 * @returns {string} path
 */
export function extractPath(url) {
  if (!url) return ''
  try {
    const baseUrl = extractBaseUrl(url)
    if (!baseUrl) return url
    return url.slice(baseUrl.length) || '/'
  } catch {
    return ''
  }
}

/**
 * 构建请求 URL（从 baseUrl 和 path）
 * @param {string} baseUrl 
 * @param {string} path 
 * @returns {string} 完整 URL
 */
export function buildUrl(baseUrl, path) {
  if (!baseUrl) return path || ''
  if (!path) return baseUrl
  // 确保 path 以 / 开头
  if (!path.startsWith('/')) path = '/' + path
  return baseUrl + path
}

/**
 * 创建前置脚本 fm 对象
 * @param {Object} context - 执行上下文
 * @returns {Object} fm API 对象
 */
export function createPreRequestFm(context) {
  // 内部状态（脚本可修改）
  const state = {
    environmentVariables: { ...context.environmentVariables },
    collectionVariables: { ...context.collectionVariables },
    request: {
      url: context.request.url,
      method: context.request.method,
      headers: [...context.request.headers],
      body: context.request.body
    }
  }

  return {
    // 环境变量
    environment: {
      get: (key) => state.environmentVariables[key],
      set: (key, value) => {
        state.environmentVariables[key] = value
        context.onEnvironmentChange?.(key, value)
      },
      getAll: () => ({ ...state.environmentVariables })
    },

    // 集合变量
    collection: {
      get: (key) => state.collectionVariables[key],
      set: (key, value) => {
        state.collectionVariables[key] = value
        context.onCollectionChange?.(key, value)
      },
      getAll: () => ({ ...state.collectionVariables })
    },

    // 请求操作
    request: {
      getUrl: () => state.request.url,
      setUrl: (url) => { state.request.url = url },
      getBaseUrl: () => extractBaseUrl(state.request.url),
      setBaseUrl: (baseUrl) => {
        const path = extractPath(state.request.url)
        state.request.url = buildUrl(baseUrl, path)
      },
      getPath: () => extractPath(state.request.url),
      setPath: (path) => {
        const baseUrl = extractBaseUrl(state.request.url)
        state.request.url = buildUrl(baseUrl, path)
      },
      getMethod: () => state.request.method,
      setMethod: (method) => { state.request.method = method },
      getHeader: (key) => {
        const lowerKey = key.toLowerCase()
        return state.request.headers.find(h => h.key.toLowerCase() === lowerKey)?.value
      },
      setHeader: (key, value) => {
        const lowerKey = key.toLowerCase()
        const existing = state.request.headers.find(h => h.key.toLowerCase() === lowerKey)
        if (existing) {
          existing.value = value
        } else {
          state.request.headers.push({ key, value, enabled: true })
        }
      },
      removeHeader: (key) => {
        const lowerKey = key.toLowerCase()
        state.request.headers = state.request.headers.filter(h => h.key.toLowerCase() !== lowerKey)
      },
      getHeaders: () => state.request.headers.filter(h => h.enabled),
      getBody: () => state.request.body,
      setBody: (body) => { state.request.body = body }
    },

    // 日志输出
    log: (...args) => {
      const message = args.map(arg => {
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg) }
          catch { return String(arg) }
        }
        return String(arg)
      }).join(' ')
      context.logger('script', message, context.currentLevel)
    },

    // 断言
    assert: (condition, message) => {
      if (!condition) {
        throw new Error(message || 'Assertion failed')
      }
    },

    // 等待
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // 获取修改后的数据（用于传递给 HTTP 请求）
    _getData: () => ({
      environmentVariables: state.environmentVariables,
      collectionVariables: state.collectionVariables,
      request: state.request
    })
  }
}

/**
 * 创建后置脚本 fm 对象（继承前置脚本 API + 响应数据）
 * @param {Object} context - 执行上下文（包含 response）
 * @returns {Object} fm API 对象
 */
export function createPostResponseFm(context) {
  const preFm = createPreRequestFm(context)
  
  // 响应数据（只读）
  const responseData = context.response || {}

  return {
    ...preFm,

    // 响应操作
    response: {
      getStatus: () => responseData.status,
      getStatusText: () => responseData.statusText,
      getHeader: (key) => {
        const lowerKey = key.toLowerCase()
        return responseData.headers?.[lowerKey] || responseData.headers?.[key]
      },
      getHeaders: () => responseData.headers || {},
      getBody: () => responseData.body || '',
      getJson: () => {
        try {
          return JSON.parse(responseData.body || '')
        } catch {
          return null
        }
      },
      getTime: () => responseData.time || 0,
      getSize: () => responseData.size || 0
    }
  }
}

/**
 * 在隔离环境中执行脚本
 * @param {string} code - 脚本代码
 * @param {Object} fm - fm API 对象
 * @returns {Promise<void>}
 */
export async function executeInSandbox(code, fm) {
  if (!code || !code.trim()) return

  // 创建执行函数
  const wrappedCode = `
    (async function(fm) {
      ${code}
    })
  `

  try {
    // eval 创建函数
    const fn = eval(wrappedCode)
    // 执行函数
    await fn(fm)
  } catch (error) {
    throw new Error(`脚本执行错误: ${error.message}`)
  }
}

/**
 * 加载脚本继承链
 * @param {Object} options - 加载选项
 * @returns {Promise<Array<{source: string, content: string}>>}
 */
export async function loadScriptsChain(options) {
  const {
    workspacePath,
    apiId,
    ancestorCollections,  // [rootCollection, ..., parentCollection]（按层级顺序）
    scriptKind  // 'pre' 或 'post'
  } = options

  const scripts = []

  // 1. 工作区脚本
  try {
    const workspaceScript = await invoke('get_script', {
      workspacePath,
      targetType: 'workspace',
      targetId: null,
      scriptKind
    })
    if (workspaceScript && workspaceScript.trim()) {
      scripts.push({ source: 'workspace', content: workspaceScript })
    }
  } catch (e) {
    // 工作区脚本不存在，忽略
  }

  // 2. 集合脚本（按层级顺序：父集合 → 子集合）
  for (const collection of ancestorCollections || []) {
    try {
      const collectionScript = await invoke('get_script', {
        workspacePath,
        targetType: 'collection',
        targetId: collection.id,
        scriptKind
      })
      if (collectionScript && collectionScript.trim()) {
        scripts.push({ source: `collection:${collection.name}`, content: collectionScript })
      }
    } catch (e) {
      // 集合脚本不存在，忽略
    }
  }

  // 3. 接口脚本
  if (apiId) {
    try {
      const apiScript = await invoke('get_script', {
        workspacePath,
        targetType: 'api',
        targetId: apiId,
        scriptKind
      })
      if (apiScript && apiScript.trim()) {
        scripts.push({ source: 'api', content: apiScript })
      }
    } catch (e) {
      // 接口脚本不存在，忽略
    }
  }

  return scripts
}

/**
 * 执行前置脚本链
 * @param {Object} options - 执行选项
 * @returns {Promise<{success: boolean, data?: Object, error?: string}>}
 */
export async function executePreScripts(options) {
  const {
    workspacePath,
    apiId,
    ancestorCollections,
    environmentVariables,
    collectionVariables,
    request,
    logger  // (type, message, level) => void
  } = options

  // 加载脚本链
  const scripts = await loadScriptsChain({
    workspacePath,
    apiId,
    ancestorCollections,
    scriptKind: 'pre'
  })

  if (scripts.length === 0) {
    // 无脚本，直接返回原始请求
    return {
      success: true,
      data: {
        environmentVariables,
        collectionVariables,
        request
      }
    }
  }

  // 构建执行上下文
  const context = {
    environmentVariables,
    collectionVariables,
    request: {
      url: request.url,
      method: request.method,
      headers: [...(request.headers || [])],
      body: request.body
    },
    logger,
    currentLevel: ''
  }

  // 执行脚本链
  for (const script of scripts) {
    context.currentLevel = script.source
    
    try {
      const fm = createPreRequestFm(context)
      await executeInSandbox(script.content, fm)
      
      // 获取修改后的数据，传递给下一个脚本
      const modifiedData = fm._getData()
      context.environmentVariables = modifiedData.environmentVariables
      context.collectionVariables = modifiedData.collectionVariables
      context.request = modifiedData.request
    } catch (error) {
      logger('error', `[${script.source}] 执行失败: ${error.message}`, script.source)
      return {
        success: false,
        error: error.message,
        source: script.source
      }
    }
  }

  // 返回最终修改后的数据
  return {
    success: true,
    data: {
      environmentVariables: context.environmentVariables,
      collectionVariables: context.collectionVariables,
      request: context.request
    }
  }
}

/**
 * 执行后置脚本链（反向顺序）
 * @param {Object} options - 执行选项
 * @returns {Promise<{success: boolean, errors?: Array}>}
 */
export async function executePostScripts(options) {
  const {
    workspacePath,
    apiId,
    ancestorCollections,
    environmentVariables,
    collectionVariables,
    request,
    response,
    logger
  } = options

  // 加载脚本链
  const scripts = await loadScriptsChain({
    workspacePath,
    apiId,
    ancestorCollections,
    scriptKind: 'post'
  })

  if (scripts.length === 0) {
    return { success: true }
  }

  // 后置脚本反向执行：接口 → 子集合 → 父集合 → 工作区
  scripts.reverse()

  // 构建执行上下文
  const context = {
    environmentVariables,
    collectionVariables,
    request: {
      url: request.url,
      method: request.method,
      headers: [...(request.headers || [])],
      body: request.body
    },
    response,
    logger,
    currentLevel: ''
  }

  const errors = []

  // 执行脚本链
  for (const script of scripts) {
    context.currentLevel = script.source
    
    try {
      const fm = createPostResponseFm(context)
      await executeInSandbox(script.content, fm)
    } catch (error) {
      logger('error', `[${script.source}] 执行失败: ${error.message}`, script.source)
      errors.push({ source: script.source, error: error.message })
      // 后置脚本错误不中断，继续执行后续脚本
    }
  }

  return {
    success: errors.length === 0,
    errors
  }
}

/**
 * 合并集合变量为对象
 * @param {Array} ancestorCollections - 祖先集合数组（按层级顺序）
 * @returns {Object} 变量对象
 */
export function mergeCollectionVariablesToObject(ancestorCollections) {
  const variables = {}
  
  for (const collection of ancestorCollections || []) {
    if (collection.collection_variables) {
      for (const v of collection.collection_variables) {
        if (v.enabled) {
          variables[v.key] = v.value
        }
      }
    }
  }
  
  return variables
}