<script setup>
import { useHistoryPanelSetup } from './index.js'
import Icon from '../../Icon/index.vue'

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
      <span class="panel-title">历史</span>
      <div class="panel-actions">
        <span class="action-btn" title="清空所有" @click="clearAllHistory" v-if="dates.length > 0">
          <Icon name="delete" :size="14" />
        </span>
      </div>
    </div>

    <!-- 提示：需要先选择工作区 -->
    <div v-if="!props.workspace" class="empty-panel">
      请先选择或创建工作区
    </div>

    <!-- 加载状态 -->
    <div v-else-if="loading" class="loading-panel">
      加载中...
    </div>

    <!-- 空状态 -->
    <div v-else-if="dates.length === 0" class="empty-panel">
      暂无历史记录
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
          <span class="clear-btn" title="清空当天" @click.stop="clearDateHistory(date)">
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
            <span class="delete-btn" title="删除" @click.stop="deleteHistoryEntry(date, entry.id)">
              <Icon name="delete" :size="12" />
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped src="./style.css"></style>