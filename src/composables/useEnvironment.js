import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'

/**
 * 环境变量管理 composable
 * @param {Ref} currentWorkspace - 当前工作区引用
 * @param {Ref} currentNavKey - 当前导航项引用
 */
export function useEnvironment(currentWorkspace, currentNavKey) {
  const environments = ref([])
  const activeEnvironmentId = ref(null)
  const activeEnvironment = ref(null)
  const selectedEnvironment = ref(null)
  const selectedEnvVariables = ref([])
  const activeVariables = ref([])

  const loadEnvironments = async () => {
    if (!currentWorkspace.value?.path) {
      environments.value = []
      activeEnvironmentId.value = null
      activeEnvironment.value = null
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      activeVariables.value = []
      return
    }
    try {
      const config = await invoke('get_environments', { workspacePath: currentWorkspace.value.path })
      environments.value = config.environments || []
      activeEnvironmentId.value = config.active_environment_id || null
      if (activeEnvironmentId.value) {
        activeEnvironment.value = environments.value.find(e => e.id === activeEnvironmentId.value) || null
      } else {
        activeEnvironment.value = null
      }
      selectedEnvironment.value = null
      selectedEnvVariables.value = []
      await loadActiveVariables()
    } catch (e) {
      console.error('加载环境失败:', e)
    }
  }

  const loadActiveVariables = async () => {
    if (!currentWorkspace.value?.path) {
      activeVariables.value = []
      return
    }
    try {
      const variablesMap = await invoke('get_active_variables', { workspacePath: currentWorkspace.value.path })
      activeVariables.value = Object.entries(variablesMap).map(([key, value]) => ({ key, value }))
    } catch (e) {
      console.error('加载激活变量失败:', e)
    }
  }

  const switchEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('switch_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      activeEnvironmentId.value = environmentId
      activeEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    } catch (e) {
      console.error('切换环境失败:', e)
    }
  }

  const selectEnvironment = (environmentId) => {
    selectedEnvironment.value = environments.value.find(e => e.id === environmentId) || null
    selectedEnvVariables.value = selectedEnvironment.value?.variables?.length > 0
      ? [...selectedEnvironment.value.variables]
      : [{ key: '', value: '', enabled: true }]
  }

  const saveEnvironment = async (environment) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('save_environment', {
        workspacePath: currentWorkspace.value.path,
        environment
      })
      await loadEnvironments()
    } catch (e) {
      console.error('保存环境失败:', e)
    }
  }

  const deleteEnvironment = async (environmentId) => {
    if (!currentWorkspace.value?.path) return
    try {
      await invoke('delete_environment', {
        workspacePath: currentWorkspace.value.path,
        environmentId
      })
      await loadEnvironments()
    } catch (e) {
      console.error('删除环境失败:', e)
    }
  }

  const saveEnvVariables = async () => {
    if (!currentWorkspace.value?.path || !selectedEnvironment.value) return
    try {
      await invoke('save_environment', {
        workspacePath: currentWorkspace.value.path,
        environment: {
          ...selectedEnvironment.value,
          variables: selectedEnvVariables.value.filter(v => v.key.trim())
        }
      })
      await loadEnvironments()
    } catch (e) {
      console.error('保存变量失败:', e)
    }
  }

  const onSwitchEnvironment = async (envId) => {
    await switchEnvironment(envId)
  }

  const onSelectEnvironment = (envId) => {
    selectEnvironment(envId)
  }

  const showEnvironmentInfo = computed(() => {
    return currentNavKey.value === 'environment' && currentWorkspace.value
  })

  return {
    environments,
    activeEnvironmentId,
    activeEnvironment,
    selectedEnvironment,
    selectedEnvVariables,
    activeVariables,
    loadEnvironments,
    loadActiveVariables,
    switchEnvironment,
    selectEnvironment,
    saveEnvironment,
    deleteEnvironment,
    saveEnvVariables,
    onSwitchEnvironment,
    onSelectEnvironment,
    showEnvironmentInfo
  }
}