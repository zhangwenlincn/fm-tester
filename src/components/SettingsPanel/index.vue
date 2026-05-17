<script setup>
import { useSettingsSetup } from './index.js'
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
  timeout, 
  gitUpdateInterval, 
  aiApiEndpoint, 
  aiApiKey, 
  aiModel, 
  aiModels, 
  loadingModels, 
  fetchModels,
  loading, 
  saveSettings, 
  close 
} = useSettingsSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="settings-panel">
    <div class="settings-header">
      <span class="settings-title">{{ t('panels.globalSettings') }}</span>
      <button class="close-btn" @click="close">✕</button>
    </div>
    
    <div class="settings-content">
      <!-- 请求设置 -->
      <div class="settings-section">
        <div class="section-title">{{ t('panels.requestSettings') }}</div>
        
        <div class="setting-item">
          <span class="setting-label">{{ t('settings.timeout') }}</span>
          <div class="setting-input-wrapper">
            <input 
              type="number" 
              class="setting-input"
              v-model.number="timeout"
              min="1"
              max="600"
              :disabled="loading"
            />
            <span class="unit-label">{{ t('settings.timeoutUnit') }}</span>
          </div>
        </div>
        
        <div class="setting-description">
          {{ t('settings.timeoutDesc') }}
        </div>
      </div>
      
      <!-- Git 设置 -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.gitSection') }}</div>
        
        <div class="setting-item">
          <span class="setting-label">{{ t('settings.gitUpdateInterval') }}</span>
          <div class="setting-input-wrapper">
            <input 
              type="number" 
              class="setting-input"
              v-model.number="gitUpdateInterval"
              min="0"
              max="3600"
              :disabled="loading"
            />
            <span class="unit-label">{{ t('settings.gitUpdateIntervalUnit') }}</span>
          </div>
        </div>
        
        <div class="setting-description">
          {{ t('settings.gitUpdateIntervalDesc') }}
        </div>
      </div>
      
      <!-- AI 设置 -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.aiSection') }}</div>
        
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
          <div class="model-input-wrapper">
            <select 
              class="setting-select"
              v-model="aiModel"
              :disabled="loading || loadingModels"
            >
              <option value="" disabled>{{ t('settings.aiModelSelectPlaceholder') }}</option>
              <option v-for="model in aiModels" :key="model" :value="model">{{ model }}</option>
            </select>
            <input 
              type="text" 
              class="setting-input model-manual-input"
              v-model="aiModel"
              :disabled="loading"
              placeholder="{{ t('settings.aiModelManualPlaceholder') }}"
            />
          </div>
          <button 
            class="fetch-models-btn"
            :disabled="loading || loadingModels || !aiApiEndpoint || !aiApiKey"
            @click="fetchModels"
          >
            {{ loadingModels ? t('settings.aiFetchingModels') : t('settings.aiFetchModels') }}
          </button>
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