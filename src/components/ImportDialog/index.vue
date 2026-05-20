<script setup>
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'
import { useImportDialogSetup } from './index.js'
import Icon from '../Icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  visible: Boolean,
  workspacePath: String,
  targetCollectionId: String,
  collections: Array
})

const emit = defineEmits(['close', 'imported'])

const {
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
} = useImportDialogSetup(props, emit)

const findCollectionOption = (collections, options = [], path = []) => {
  if (!collections) return options
  for (const col of collections) {
    if (col.type === 'collection') {
      const label = path.length > 0 ? [...path, col.name].join(' / ') : col.name
      options.push({ id: col.id, label, depth: path.length })
      findCollectionOption(col.children, options, [...path, col.name])
    }
  }
  return options
}

const collectionOptions = computed(() => {
  const options = [{ id: null, label: t('import.rootLevel') }]
  return findCollectionOption(props.collections, options)
})
</script>

<template>
  <div v-if="visible" class="dialog-overlay" @click.self="close">
    <div class="dialog import-dialog">
      <div class="dialog-header">
        <span class="dialog-title">{{ t('dialogs.importOpenapi') }}</span>
        <span class="dialog-close" @click="close">×</span>
      </div>

      <div class="dialog-body">
        <div class="tabs">
          <button 
            :class="['tab-btn', { active: inputMode === 'paste' }]" 
            @click="inputMode = 'paste'"
          >
            {{ t('import.pasteContent') }}
          </button>
          <button 
            :class="['tab-btn', { active: inputMode === 'file' }]" 
            @click="inputMode = 'file'"
          >
            {{ t('import.selectFile') }}
          </button>
        </div>

        <div v-if="inputMode === 'paste'" class="form-group">
          <textarea
            v-model="content"
            class="content-input"
            :placeholder="t('import.pasteJsonPlaceholder')"
          ></textarea>
        </div>

        <div v-if="inputMode === 'file'" class="form-group file-group">
          <button class="btn-select-file" @click="selectFile">
            <Icon name="folder" :size="16" />
            {{ t('buttons.selectFile') }}
          </button>
          <div v-if="selectedFile" class="selected-file">
            {{ selectedFile }}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group half">
            <label>{{ t('import.format') }}</label>
            <select v-model="format" class="form-select">
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="form-group half">
            <label>{{ t('import.rootName') }}</label>
            <input
              v-model="rootName"
              type="text"
              :placeholder="t('import.rootNamePlaceholder')"
              class="form-input"
            />
          </div>
        </div>

        <div class="form-group">
          <label>{{ t('import.targetCollection') }}</label>
          <select v-model="targetCollectionId" class="form-select">
            <option v-for="opt in collectionOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>

      <div class="dialog-footer">
        <button
          class="btn-primary"
          :disabled="loading"
          @click="importOpenapi"
        >
          {{ loading ? t('common.loading') : t('buttons.import') }}
        </button>
        <button class="btn-secondary" @click="close">{{ t('common.cancel') }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>