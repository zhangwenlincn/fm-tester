import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { showToast } from '../../composables/useToast'

export function useImportDialogSetup(props, emit) {
  const content = ref('')
  const format = ref('auto')
  const rootName = ref('')
  const targetCollectionId = ref(null)
  const error = ref('')
  const loading = ref(false)
  const inputMode = ref('paste')
  const selectedFile = ref(null)

  const formatOptions = [
    { value: 'auto', label: '自动检测' },
    { value: 'json', label: 'JSON' },
    { value: 'yaml', label: 'YAML' }
  ]

  const selectFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'OpenAPI', extensions: ['json', 'yaml', 'yml'] }
        ]
      })
      if (selected) {
        selectedFile.value = selected
        const { readFile } = await import('@tauri-apps/plugin-fs')
        const fileData = await readFile(selected)
        const decoder = new TextDecoder()
        content.value = decoder.decode(fileData)
        
        if (selected.endsWith('.yaml') || selected.endsWith('.yml')) {
          format.value = 'yaml'
        } else {
          format.value = 'json'
        }
      }
    } catch (e) {
      console.error('选择文件失败:', e)
      showToast(`选择文件失败: ${e}`, 'error')
    }
  }

  const importOpenapi = async () => {
    if (!content.value.trim()) {
      error.value = '请输入或选择 OpenAPI 内容'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const result = await invoke('import_openapi', {
        workspacePath: props.workspacePath,
        content: content.value,
        format: format.value,
        targetCollectionId: targetCollectionId.value || null,
        rootName: rootName.value.trim() || null
      })
      showToast('导入成功', 'success')
      emit('imported', result)
      close()
    } catch (e) {
      error.value = typeof e === 'string' ? e : (e.message || '导入失败')
    } finally {
      loading.value = false
    }
  }

  const resetForm = () => {
    content.value = ''
    format.value = 'auto'
    rootName.value = ''
    targetCollectionId.value = null
    error.value = ''
    inputMode.value = 'paste'
    selectedFile.value = null
  }

  const close = () => {
    resetForm()
    emit('close')
  }

  watch(() => props.visible, (visible) => {
    if (visible) {
      targetCollectionId.value = props.targetCollectionId || null
    }
  })

  return {
    content,
    format,
    rootName,
    targetCollectionId,
    error,
    loading,
    inputMode,
    selectedFile,
    formatOptions,
    selectFile,
    importOpenapi,
    close
  }
}