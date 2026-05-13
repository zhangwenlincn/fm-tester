<script setup>
import { useSaveResponseDialogSetup } from './index.js'

const props = defineProps({
  show: Boolean,
  defaultName: String
})

const emit = defineEmits(['save', 'cancel'])

const { name, handleSave, handleCancel } = useSaveResponseDialogSetup(props, emit)
</script>

<template>
  <div v-if="show" class="dialog-overlay" @click.self="handleCancel">
    <div class="dialog-content">
      <h3>保存响应</h3>
      <input 
        v-model="name" 
        placeholder="输入响应名称" 
        class="name-input"
        @keyup.enter="handleSave"
      />
      <div class="dialog-buttons">
        <button class="cancel-btn" @click="handleCancel">取消</button>
        <button class="save-btn" @click="handleSave">保存</button>
      </div>
    </div>
  </div>
</template>

<style src="./style.css"></style>