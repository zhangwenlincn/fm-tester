import { computed, ref } from 'vue'

/**
 * 变量高亮 composable
 * 用于检测和高亮显示 {{变量名}} 格式的环境变量引用
 */
export function useVariableHighlight() {
  // 匹配 {{变量名}} 的正则表达式
  const variablePattern = /\{\{[^}]+\}\}/g

  /**
   * 检测文本中是否包含变量引用
   * @param {string} text - 要检测的文本
   * @returns {boolean} 是否包含变量引用
   */
  const hasVariables = (text) => {
    if (!text) return false
    return variablePattern.test(text)
  }

  /**
   * 将文本分割为高亮片段
   * @param {string} text - 要处理的文本
   * @returns {Array<{text: string, isVariable: boolean}>} 文本片段数组
   */
  const splitByVariables = (text) => {
    if (!text) return []
    
    const result = []
    let lastIndex = 0
    let match
    
    // 重置正则
    variablePattern.lastIndex = 0
    
    while ((match = variablePattern.exec(text)) !== null) {
      // 添加变量前的普通文本
      if (match.index > lastIndex) {
        result.push({
          text: text.slice(lastIndex, match.index),
          isVariable: false
        })
      }
      // 添加变量文本
      result.push({
        text: match[0],
        isVariable: true
      })
      lastIndex = match.index + match[0].length
    }
    
    // 添加剩余的普通文本
    if (lastIndex < text.length) {
      result.push({
        text: text.slice(lastIndex),
        isVariable: false
      })
    }
    
    return result
  }

  /**
   * 生成高亮后的 HTML 字符串
   * @param {string} text - 要处理的文本
   * @returns {string} 高亮后的 HTML
   */
  const highlightVariables = (text) => {
    if (!text) return ''
    
    const segments = splitByVariables(text)
    return segments.map(seg => {
      if (seg.isVariable) {
        return `<span class="var-ref">${escapeHtml(seg.text)}</span>`
      }
      return escapeHtml(seg.text)
    }).join('')
  }

  /**
   * HTML 转义
   * @param {string} text - 要转义的文本
   * @returns {string} 转义后的文本
   */
  const escapeHtml = (text) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  return {
    variablePattern,
    hasVariables,
    splitByVariables,
    highlightVariables
  }
}

/**
 * URL 输入框覆盖层 composable
 * 用于同步输入框和覆盖层的滚动、光标位置
 */
export function useUrlOverlay() {
  /**
   * 同步滚动位置
   * @param {HTMLInputElement} inputEl - 输入框元素
   * @param {HTMLElement} overlayEl - 覆盖层元素
   */
  const syncScroll = (inputEl, overlayEl) => {
    if (!inputEl || !overlayEl) return
    overlayEl.scrollLeft = inputEl.scrollLeft
  }

  /**
   * 获取输入框的样式对象（用于覆盖层同步）
   * @param {HTMLInputElement} inputEl - 输入框元素
   * @returns {Object} 样式对象
   */
  const getInputStyles = (inputEl) => {
    if (!inputEl) return {}
    
    const styles = window.getComputedStyle(inputEl)
    return {
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily,
      lineHeight: styles.lineHeight,
      padding: styles.padding,
      border: styles.border,
      borderRadius: styles.borderRadius
    }
  }

  return {
    syncScroll,
    getInputStyles
  }
}

/**
 * 变量自动补全 composable
 * 用于检测 {{ 输入并显示变量选择下拉菜单
 */
export function useVariableAutocomplete(props, emit) {
  // 下拉菜单状态
  const showAutocomplete = ref(false)
  const autocompletePosition = ref({ top: 0, left: 0 })
  const selectedIndex = ref(0)
  const triggerPosition = ref(0) // {{ 的位置
  
  // 过滤后的变量列表
  const filteredVariables = computed(() => {
    return props.variables || []
  })
  
  /**
   * 检测输入是否包含 {{ 并触发自动补全
   * @param {string} value - 输入值
   * @param {number} cursorPos - 光标位置
   */
  const handleInputAutocomplete = (value, cursorPos) => {
    // 查找光标前最近的 {{ 
    const beforeCursor = value.slice(0, cursorPos)
    const lastBraceIndex = beforeCursor.lastIndexOf('{{')
    
    if (lastBraceIndex >= 0) {
      // 检查 {{ 后面是否已经有 }}（已完成的变量）
      const afterBrace = value.slice(lastBraceIndex)
      if (afterBrace.includes('}}') && afterBrace.indexOf('}}') < cursorPos - lastBraceIndex) {
        // 已完成的变量，不触发
        showAutocomplete.value = false
        return
      }
      
      // 检查 {{ 是否在最近的 }} 之后（避免嵌套）
      const lastCloseBrace = beforeCursor.lastIndexOf('}}')
      if (lastCloseBrace > lastBraceIndex) {
        // {{ 在 }} 之后，不触发
        showAutocomplete.value = false
        return
      }
      
      // 触发自动补全
      triggerPosition.value = lastBraceIndex
      showAutocomplete.value = true
      selectedIndex.value = 0
      
      // 计算下拉菜单位置（简化：固定在输入框下方）
      autocompletePosition.value = {
        top: 32, // 输入框高度
        left: 0
      }
    } else {
      showAutocomplete.value = false
    }
  }
  
  /**
   * 选择变量并插入
   * @param {string} varKey - 变量名
   * @param {HTMLInputElement} inputEl - 输入框元素
   */
  const selectVariable = (varKey, inputEl) => {
    if (!inputEl) return
    
    const value = inputEl.value
    const cursorPos = inputEl.selectionStart
    
    // 找到 {{ 的位置
    const beforeCursor = value.slice(0, cursorPos)
    const braceIndex = beforeCursor.lastIndexOf('{{')
    
    if (braceIndex >= 0) {
      // 替换 {{ 为 {{变量名}}
      const newValue = value.slice(0, braceIndex) + '{{' + varKey + '}}' + value.slice(cursorPos)
      
      // 更新值
      emit('update:modelValue', newValue)
      emit('input', newValue)
      
      // 设置光标位置到 }} 后面
      const newCursorPos = braceIndex + varKey.length + 4
      setTimeout(() => {
        inputEl.setSelectionRange(newCursorPos, newCursorPos)
        inputEl.focus()
      }, 0)
    }
    
    closeAutocomplete()
  }
  
  /**
   * 处理键盘事件
   * @param {KeyboardEvent} e - 键盘事件
   * @param {HTMLInputElement} inputEl - 输入框元素
   */
  const handleKeyDown = (e, inputEl) => {
    if (!showAutocomplete.value) return
    
    if (e.key === 'Escape') {
      closeAutocomplete()
      e.preventDefault()
    } else if (e.key === 'ArrowDown') {
      selectedIndex.value = Math.min(selectedIndex.value + 1, filteredVariables.value.length - 1)
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (filteredVariables.value[selectedIndex.value]) {
        selectVariable(filteredVariables.value[selectedIndex.value].key, inputEl)
      }
      e.preventDefault()
    }
  }
  
  /**
   * 关闭自动补全
   */
  const closeAutocomplete = () => {
    showAutocomplete.value = false
    selectedIndex.value = 0
  }
  
  return {
    showAutocomplete,
    autocompletePosition,
    filteredVariables,
    selectedIndex,
    handleInputAutocomplete,
    selectVariable,
    handleKeyDown,
    closeAutocomplete
  }
}