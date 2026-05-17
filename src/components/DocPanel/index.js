import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import * as monaco from 'monaco-editor'
import { invoke } from '@tauri-apps/api/core'
import { marked } from 'marked'
import { showToast } from '../../composables/useToast.js'

export function useDocPanelSetup(props) {
  const { t } = useI18n()
  
  // 文档内容
  const docContent = ref('')
  
  // 文档模式：'view' 展示模式 | 'edit' 编辑模式
  const docMode = ref('view')
  
  // Monaco 编辑器容器
  const docEditorContainer = ref(null)
  let docEditor = null
  
  // 渲染后的 Markdown HTML
  const renderedDocHtml = computed(() => {
    const content = docContent.value || ''
    if (!content) return ''
    try {
      return marked(content)
    } catch (e) {
      console.error('Markdown 渲染失败:', e)
      return content
    }
  })
  
  // 加载 API 文档
  const loadApiDoc = async () => {
    if (!props.workspacePath || !props.apiId) return
    try {
      const content = await invoke('get_api_doc', {
        workspacePath: props.workspacePath,
        apiId: props.apiId
      })
      docContent.value = content || ''
      // 同步到编辑器
      if (docEditor) {
        if (docEditor.getValue() !== docContent.value) {
          docEditor.setValue(docContent.value)
        }
      }
    } catch (e) {
      console.error('加载 API 文档失败:', e)
      docContent.value = ''
    }
  }
  
  // 初始化 Monaco 编辑器
  const initDocEditor = () => {
    if (!docEditorContainer.value) return
    
    docEditor = monaco.editor.create(docEditorContainer.value, {
      value: docContent.value || '',
      language: 'markdown',
      theme: 'vs',
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      tabSize: 2,
      wordWrap: 'on',
      folding: true,
      foldingStrategy: 'indentation',
      showFoldingControls: 'always',
      glyphMargin: true,
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        verticalScrollbarSize: 10,
        horizontalScrollbarSize: 10
      },
      padding: { top: 12, bottom: 12 }
    })
    
    // 监听内容变化
    docEditor.onDidChangeModelContent(() => {
      docContent.value = docEditor.getValue()
    })
  }
  
  // 切换文档模式
  const toggleDocMode = () => {
    if (docMode.value === 'view') {
      docMode.value = 'edit'
      // 切换到编辑模式时初始化编辑器
      setTimeout(() => {
        if (docEditorContainer.value) {
          if (!docEditor) {
            initDocEditor()
          } else {
            docEditor.layout()
            if (docEditor.getValue() !== docContent.value) {
              docEditor.setValue(docContent.value)
            }
          }
        }
      }, 50)
    } else {
      docMode.value = 'view'
    }
  }
  
  // 保存文档
  const saveDoc = async () => {
    if (!props.workspacePath || !props.apiId) return
    try {
      await invoke('save_api_doc', {
        workspacePath: props.workspacePath,
        apiId: props.apiId,
        content: docContent.value
      })
      showToast(t('toast.saved'), 'success')
    } catch (e) {
      console.error('保存 API 文档失败:', e)
      showToast(t('toast.saveFailed'), 'error')
    }
  }
  
  // 监听 apiId 变化，加载文档
  watch(() => props.apiId, (newId, oldId) => {
    if (newId && newId !== oldId) {
      // 切换 API 时重置为展示模式
      docMode.value = 'view'
      loadApiDoc()
    }
  }, { immediate: true })
  
  // 组件卸载时销毁编辑器
  onUnmounted(() => {
    if (docEditor) {
      docEditor.dispose()
    }
  })
  
  return {
    docContent,
    docMode,
    renderedDocHtml,
    docEditorContainer,
    toggleDocMode,
    saveDoc
  }
}