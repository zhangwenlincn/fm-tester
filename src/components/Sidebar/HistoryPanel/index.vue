<script setup>
import { useI18n } from 'vue-i18n'
import { useHistoryPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

const { t } = useI18n()

const props = defineProps({
  workspace: Object
})

const emit = defineEmits(['selectHistory'])

// 使用 composable
const {
  dates,
  historyByDate,
  loading,
  toggleDateExpand,
  isDateExpanded,
  selectHistory,
  deleteHistoryEntry,
  clearDateHistory,
  clearAllHistory,
  getMethodClass,
  getStatusClass,
  formatTime,
  formatResponseTime,
  formatSize,
  formatDateDisplay
} = useHistoryPanelSetup(props, emit)
</script>

<template>
  <div class="history-panel">
    <!-- 面板头部 -->
    <div class="panel-header">
      <span class="panel-title">{{ t('panels.history') }}</span>
      <div class="panel-actions">
        <span class="action-btn" :title="t('buttons.clearAll')" @click="clearAllHistory" v-if="dates.length > 0">
          <Icon name="delete" :size="14" />
        </span>
      </div>
    </div>

    <!-- 提示：需要先选择工作区 -->
    <div v-if="!props.workspace" class="empty-panel">
      {{ t('empty.selectWorkspace') }}
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-panel">
      {{ t('common.loading') }}
    </div>

    <!-- 空状态 -->
    <div v-else-if="dates.length === 0" class="empty-panel">
      {{ t('empty.noHistory') }}
    </div>

    <!-- 日期分组列表 -->
    <div v-else class="date-list">
      <div v-for="date in dates" :key="date" class="date-group">
        <!-- 日期头部 -->
        <div class="date-header" @click="toggleDateExpand(date)">
          <span class="expand-icon">
            <Icon :name="isDateExpanded(date) ? 'arrow-down' : 'arrow-right'" :size="12" />
          </span>
<span class="date-label">{{ formatDateDisplay(date) }}</span>
           <span class="clear-btn" :title="t('buttons.clearToday')" @click.stop="clearDateHistory(date)">
             <Icon name="delete" :size="12" />
           </span>
        </div>

        <!-- 历史记录列表 -->
        <div v-if="isDateExpanded(date)" class="history-list">
          <div
            v-for="entry in historyByDate[date]"
            :key="entry.id"
            class="history-item"
            @click="selectHistory(entry)"
          >
            <span class="method-tag" :class="getMethodClass(entry.method)">{{ entry.method }}</span>
<span class="item-url" :title="entry.url">{{ entry.url }}</span>
             <span class="delete-btn" :title="t('common.delete')" @click.stop="deleteHistoryEntry(date, entry.id)">
               <Icon name="delete" :size="12" />
             </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>