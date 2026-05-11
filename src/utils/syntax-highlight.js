/**
 * 语法高亮工具函数
 * 支持 JSON、XML、HTML 格式
 * 纯 JS 实现，无第三方依赖
 */

/**
 * 转义 HTML 特殊字符
 * @param {string} str - 原始字符串
 * @returns {string} 转义后的字符串
 */
function escapeHtml(str) {
  const htmlEntities = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }
  return str.replace(/[&<>"']/g, char => htmlEntities[char])
}

/**
 * JSON 语法高亮
 * @param {string} json - JSON 字符串
 * @returns {string} 高亮后的 HTML
 */
export function highlightJson(json) {
  if (!json || typeof json !== 'string') {
    return ''
  }

  // 先转义 HTML
  let escaped = escapeHtml(json)

  // JSON 语法高亮正则表达式
  // 匹配顺序很重要：先匹配字符串，再匹配其他
  const patterns = [
    // 字符串值（包括 key 和 value）
    {
      pattern: /("(?:[^"\\]|\\.)*")(\s*:)?/g,
      replacer: (match, str, colon) => {
        if (colon) {
          // 这是 key
          return `<span class="sh-json-key">${str}</span>${colon}`
        } else {
          // 这是 string value
          return `<span class="sh-json-string">${str}</span>`
        }
      }
    },
    // 数字
    {
      pattern: /(-?\d+\.?\d*(?:[eE][+-]?\d+)?)/g,
      replacer: '<span class="sh-json-number">$1</span>'
    },
    // 布尔值
    {
      pattern: /\b(true|false)\b/g,
      replacer: '<span class="sh-json-boolean">$1</span>'
    },
    // null
    {
      pattern: /\b(null)\b/g,
      replacer: '<span class="sh-json-null">$1</span>'
    }
  ]

  // 应用所有高亮规则
  for (const { pattern, replacer } of patterns) {
    escaped = escaped.replace(pattern, replacer)
  }

  return escaped
}

/**
 * XML 语法高亮
 * @param {string} xml - XML 字符串
 * @returns {string} 高亮后的 HTML
 */
export function highlightXml(xml) {
  if (!xml || typeof xml !== 'string') {
    return ''
  }

  // 先转义 HTML
  let escaped = escapeHtml(xml)

  // XML 语法高亮规则
  const patterns = [
    // 注释
    {
      pattern: /(&lt;!--[\s\S]*?--&gt;)/g,
      replacer: '<span class="sh-xml-comment">$1</span>'
    },
    // CDATA
    {
      pattern: /(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g,
      replacer: '<span class="sh-xml-cdata">$1</span>'
    },
    // 自闭合标签 <tag/>
    {
      pattern: /(&lt;)([\w:-]+)([^&]*?)(\/&gt;)/g,
      replacer: '<span class="sh-xml-tag">$1</span><span class="sh-xml-tag-name">$2</span><span class="sh-xml-attrs">$3</span><span class="sh-xml-tag">$4</span>'
    },
    // 结束标签 </tag>
    {
      pattern: /(&lt;\/)([\w:-]+)(&gt;)/g,
      replacer: '<span class="sh-xml-tag">$1</span><span class="sh-xml-tag-name">$2</span><span class="sh-xml-tag">$3</span>'
    },
    // 开始标签 <tag> 和带属性的标签
    {
      pattern: /(&lt;)([\w:-]+)([^&]*?)(&gt;)/g,
      replacer: (match, lt, tagName, attrs, gt) => {
        // 高亮属性
        const highlightedAttrs = attrs.replace(
          /([\w:-]+)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
          '<span class="sh-xml-attr-name">$1</span><span class="sh-xml-attr-eq">$2</span><span class="sh-xml-attr-value">$3</span>'
        )
        return `<span class="sh-xml-tag">${lt}</span><span class="sh-xml-tag-name">${tagName}</span><span class="sh-xml-attrs">${highlightedAttrs}</span><span class="sh-xml-tag">${gt}</span>`
      }
    }
  ]

  // 应用所有高亮规则
  for (const { pattern, replacer } of patterns) {
    escaped = escaped.replace(pattern, replacer)
  }

  return escaped
}

/**
 * HTML 语法高亮
 * @param {string} html - HTML 字符串
 * @returns {string} 高亮后的 HTML
 */
export function highlightHtml(html) {
  if (!html || typeof html !== 'string') {
    return ''
  }

  // 先转义 HTML
  let escaped = escapeHtml(html)

  // HTML 语法高亮规则（类似 XML，但增加一些 HTML 特有元素）
  const patterns = [
    // 注释
    {
      pattern: /(&lt;!--[\s\S]*?--&gt;)/g,
      replacer: '<span class="sh-html-comment">$1</span>'
    },
    // DOCTYPE
    {
      pattern: /(&lt;!DOCTYPE[^&]*?&gt;)/gi,
      replacer: '<span class="sh-html-doctype">$1</span>'
    },
    // 自闭合标签
    {
      pattern: /(&lt;)([\w:-]+)([^&]*?)(\/&gt;)/g,
      replacer: '<span class="sh-html-tag">$1</span><span class="sh-html-tag-name">$2</span><span class="sh-html-attrs">$3</span><span class="sh-html-tag">$4</span>'
    },
    // 结束标签
    {
      pattern: /(&lt;\/)([\w:-]+)(&gt;)/g,
      replacer: '<span class="sh-html-tag">$1</span><span class="sh-html-tag-name">$2</span><span class="sh-html-tag">$3</span>'
    },
    // 开始标签
    {
      pattern: /(&lt;)([\w:-]+)([^&]*?)(&gt;)/g,
      replacer: (match, lt, tagName, attrs, gt) => {
        // 高亮属性
        const highlightedAttrs = attrs.replace(
          /([\w:-]+)(=)("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g,
          '<span class="sh-html-attr-name">$1</span><span class="sh-html-attr-eq">$2</span><span class="sh-html-attr-value">$3</span>'
        )
        return `<span class="sh-html-tag">${lt}</span><span class="sh-html-tag-name">${tagName}</span><span class="sh-html-attrs">${highlightedAttrs}</span><span class="sh-html-tag">${gt}</span>`
      }
    }
  ]

  // 应用所有高亮规则
  for (const { pattern, replacer } of patterns) {
    escaped = escaped.replace(pattern, replacer)
  }

  return escaped
}

/**
 * 根据内容类型自动选择高亮方式
 * @param {string} content - 内容字符串
 * @param {string} contentType - Content-Type 头
 * @returns {string} 高亮后的 HTML
 */
export function highlightAuto(content, contentType = '') {
  if (!content || typeof content !== 'string') {
    return ''
  }

  const type = contentType.toLowerCase()

  // 根据 Content-Type 选择高亮方式
  if (type.includes('json') || type.includes('javascript')) {
    return highlightJson(content)
  }
  if (type.includes('xml')) {
    return highlightXml(content)
  }
  if (type.includes('html')) {
    return highlightHtml(content)
  }

  // 尝试自动检测格式
  const trimmed = content.trim()
  
  // 检测 JSON
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return highlightJson(content)
    } catch {
      // 不是有效的 JSON，继续检测其他格式
    }
  }

  // 检测 XML
  if (trimmed.startsWith('<') && trimmed.includes('>')) {
    // 检测 HTML
    if (/<(!DOCTYPE|html|head|body|div|span|p|a|script|style)/i.test(trimmed)) {
      return highlightHtml(content)
    }
    return highlightXml(content)
  }

  // 默认返回转义后的纯文本
  return escapeHtml(content)
}

/**
 * 格式化 JSON 字符串
 * @param {string} json - JSON 字符串
 * @param {number} indent - 缩进空格数
 * @returns {string} 格式化后的 JSON
 */
export function formatJson(json, indent = 2) {
  if (!json || typeof json !== 'string') {
    return ''
  }
  try {
    const parsed = JSON.parse(json)
    return JSON.stringify(parsed, null, indent)
  } catch {
    return json
  }
}

/**
 * 格式化 XML 字符串
 * @param {string} xml - XML 字符串
 * @returns {string} 格式化后的 XML
 */
export function formatXml(xml) {
  if (!xml || typeof xml !== 'string') {
    return ''
  }

  try {
    // 移除多余空白
    let formatted = xml.replace(/>\s*</g, '><')
    
    // 添加缩进
    let indent = 0
    const lines = []
    let current = ''
    let inTag = false
    let inContent = false

    for (let i = 0; i < formatted.length; i++) {
      const char = formatted[i]
      
      if (char === '<') {
        if (current.trim()) {
          lines.push('  '.repeat(indent) + current.trim())
        }
        current = char
        inTag = true
        inContent = false
      } else if (char === '>') {
        current += char
        inTag = false
        
        // 检查是否是自闭合标签或结束标签
        if (current.endsWith('/>') || current.startsWith('</')) {
          lines.push('  '.repeat(indent) + current)
          if (current.startsWith('</')) {
            indent = Math.max(0, indent - 1)
          }
        } else {
          lines.push('  '.repeat(indent) + current)
          indent++
        }
        current = ''
      } else {
        current += char
        if (!inTag && char.trim()) {
          inContent = true
        }
      }
    }

    if (current.trim()) {
      lines.push('  '.repeat(indent) + current.trim())
    }

    return lines.join('\n')
  } catch {
    return xml
  }
}

/**
 * 格式化 HTML 字符串
 * @param {string} html - HTML 字符串
 * @returns {string} 格式化后的 HTML
 */
export function formatHtml(html) {
  // HTML 格式化与 XML 类似
  return formatXml(html)
}