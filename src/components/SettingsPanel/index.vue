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

const { t, timeout, selectedLanguage, supportedLocales, loading, saved, saveSettings, close } = useSettingsSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="settings-panel">
    <div class="settings-header">
      <span class="settings-title">{{ t('panels.globalSettings') }}</span>
      <button class="close-btn" @click="close">✕</button>
    </div>
    
    <div class="settings-content">
      <!-- 语言设置 -->
      <div class="settings-section">
        <div class="section-title">{{ t('settings.language') }}</div>
        <div class="setting-item">
          <select 
            class="setting-select"
            v-model="selectedLanguage"
            :disabled="loading"
          >
            <option v-for="lang in supportedLocales" :key="lang.code" :value="lang.code">
              {{ lang.name }}
            </option>
          </select>
        </div>
      </div>
      
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
    </div>
    
    <div class="settings-footer">
      <button class="cancel-btn" @click="close">{{ t('common.cancel') }}</button>
      <button 
        class="save-btn" 
        :class="{ saved: saved }"
        :disabled="loading"
        @click="saveSettings"
      >
        {{ saved ? t('toast.saved') : t('common.save') }}
      </button>
    </div>
  </div>
</template>