<script setup>
import { useAiSettingsSetup } from './index.js'
import './style.css'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'saved'])

const { 
  t, 
  aiApiEndpoint, 
  aiApiKey, 
  aiModel, 
  aiModels, 
  loadingModels, 
  showModelDropdown,
  fetchModels,
  selectModel,
  toggleModelDropdown,
  closeModelDropdown,
  loading, 
  saveSettings, 
  close 
} = useAiSettingsSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="ai-settings-panel">
    <div class="settings-header">
      <span class="settings-title">{{ t('menu.aiSettings') }}</span>
      <button class="close-btn" @click="close">✕</button>
    </div>
    
    <div class="settings-content">
      <!-- AI 设置 -->
      <div class="settings-section">
        <div class="setting-item">
          <span class="setting-label">{{ t('settings.aiApiEndpoint') }}</span>
          <input 
            type="text" 
            class="setting-input full-width"
            v-model="aiApiEndpoint"
            :disabled="loading"
            placeholder="https://api.openai.com/v1"
          />
        </div>
        
        <div class="setting-description">
          {{ t('settings.aiApiEndpointDesc') }}
        </div>
        
        <div class="setting-item">
          <span class="setting-label">{{ t('settings.aiApiKey') }}</span>
          <input 
            type="password" 
            class="setting-input full-width"
            v-model="aiApiKey"
            :disabled="loading"
            placeholder="sk-..."
          />
        </div>
        
        <div class="setting-description">
          {{ t('settings.aiApiKeyDesc') }}
        </div>
        
        <div class="setting-item">
          <span class="setting-label">{{ t('settings.aiModel') }}</span>
          <div class="model-combo-wrapper">
            <div class="model-input-container">
              <input 
                type="text" 
                class="model-input"
                v-model="aiModel"
                :disabled="loading"
                :placeholder="t('settings.aiModelPlaceholder')"
                @focus="closeModelDropdown"
              />
              <button 
                class="model-dropdown-btn"
                :disabled="loading || aiModels.length === 0"
                @click="toggleModelDropdown"
              >
                ▼
              </button>
              <div v-if="showModelDropdown" class="model-dropdown">
                <div 
                  v-for="model in aiModels" 
                  :key="model" 
                  class="model-dropdown-item"
                  @click="selectModel(model)"
                >
                  {{ model }}
                </div>
              </div>
            </div>
            <button 
              class="fetch-models-btn"
              :disabled="loading || loadingModels || !aiApiEndpoint || !aiApiKey"
              @click="fetchModels"
            >
              {{ loadingModels ? t('settings.aiFetchingModels') : t('settings.aiFetchModels') }}
            </button>
          </div>
        </div>
        
        <div class="setting-description">
          {{ t('settings.aiModelDesc') }}
        </div>
      </div>
    </div>
    
    <div class="settings-footer">
      <button class="cancel-btn" @click="close">{{ t('common.cancel') }}</button>
      <button 
        class="save-btn" 
        :disabled="loading"
        @click="saveSettings"
      >
        {{ t('common.save') }}
      </button>
    </div>
  </div>
</template>