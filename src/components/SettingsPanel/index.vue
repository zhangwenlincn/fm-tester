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

const { timeout, loading, saved, saveSettings, close } = useSettingsSetup(props, emit)
</script>

<template>
  <div v-if="visible" class="settings-panel">
    <div class="settings-header">
      <span class="settings-title">全局设置</span>
      <button class="close-btn" @click="close">✕</button>
    </div>
    
    <div class="settings-content">
      <div class="settings-section">
        <div class="section-title">请求设置</div>
        
        <div class="setting-item">
          <span class="setting-label">请求超时时间</span>
          <div class="setting-input-wrapper">
            <input 
              type="number" 
              class="setting-input"
              v-model.number="timeout"
              min="1"
              max="600"
              :disabled="loading"
            />
            <span class="unit-label">秒</span>
          </div>
        </div>
        
        <div class="setting-description">
          设置 HTTP 请求的最大等待时间，超过该时间请求将自动取消。
          默认值为 60 秒。
        </div>
      </div>
    </div>
    
    <div class="settings-footer">
      <button class="cancel-btn" @click="close">取消</button>
      <button 
        class="save-btn" 
        :class="{ saved: saved }"
        :disabled="loading"
        @click="saveSettings"
      >
        {{ saved ? '已保存' : '保存' }}
      </button>
    </div>
  </div>
</template>