<template>
  <div class="settings-card">
    <h2 class="settings-title">📅 热区时长查询</h2>

    <div class="form-row">
      <label>起始日期：</label>
      <input v-model="startDate" type="date" class="date-input" />
    </div>

    <div class="form-row">
      <label>结束日期：</label>
      <input v-model="endDate" type="date" class="date-input" />
    </div>

    <div class="form-row">
      <label>最近天数：</label>
        <BaseSelect
          v-model="recentDays"
          :options="recentDayOptions"
          placeholder="请选择最近天数"
        />
    </div>

    <div class="query-actions">
      <button class="btn-primary" :class="{ shake: shaking }" :disabled="loading" @click="handleQuery">
        {{ loading ? '查询中...' : '查询' }}
      </button>
    </div>

    <div class="result-block">
      <table v-if="rows.length > 0" class="result-table">
        <thead>
          <tr>
            <th>设备编码</th>
            <th>停留时长（秒）</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in rows" :key="item.chipId">
            <td>{{ item.chipId }}</td>
            <td>{{ formatSeconds(item.totalDuration) }}</td>
          </tr>
        </tbody>
      </table>

      <div v-else class="empty-block">
        {{ loading ? '正在加载...' : '暂无数据' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { getDurationSummary } from '../../api/duration'
import type { DurationSummaryItem } from '../../types/duration'
import BaseSelect from '../common/BaseSelect.vue'
import { useToast } from '../../composables/useToast'
import { useShake } from '../../composables/useShake'

const toast = useToast()
const { shaking, trigger: doShake } = useShake()

const recentDayOptions = [
  { label: '不使用', value: '' },
  { label: '1 天内', value: '1' },
  { label: '3 天内', value: '3' },
  { label: '7 天内', value: '7' },
  { label: '14 天内', value: '14' },
  { label: '30 天内', value: '30' },
]
const rows = ref<DurationSummaryItem[]>([])
const loading = ref(false)
const errorText = ref('')
const startDate = ref('')
const endDate = ref('')
const recentDays = ref('')

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatSeconds(msOrSeconds: number) {
  if (!Number.isFinite(msOrSeconds)) return '-'

  const seconds = msOrSeconds > 10000 ? Math.round(msOrSeconds / 1000) : Math.round(msOrSeconds)
  return seconds
}

function resolveDateRange() {
  if (recentDays.value) {
    const end = new Date()
    const start = new Date()
    start.setDate(end.getDate() - Number(recentDays.value) + 1)

    return {
      startDate: formatDate(start),
      endDate: formatDate(end),
    }
  }

  return {
    startDate: startDate.value,
    endDate: endDate.value,
  }
}

async function handleQuery() {
  errorText.value = ''

  const range = resolveDateRange()

  if (!range.startDate || !range.endDate) {
    errorText.value = '请选择开始和结束日期，或者选择最近天数'
    toast.show('请选择开始和结束日期，或者选择最近天数', 'error')
    doShake()
    return
  }

  if (range.startDate > range.endDate) {
    errorText.value = '开始日期不能晚于结束日期'
    toast.show('开始日期不能晚于结束日期', 'error')
    doShake()
    return
  }

  loading.value = true
  try {
    rows.value = await getDurationSummary(range.startDate, range.endDate)
  } catch (error) {
    console.error('getDurationSummary error =', error)
    errorText.value = '查询失败'
    rows.value = []
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
:global(.settings-card) {
  overflow: visible;
}

.settings-card {
  overflow: visible;
}

.form-row {
  overflow: visible;
}

.query-actions {
  margin: 16px 0;
}

.result-block {
  margin-top: 18px;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 10px;
}

.result-table th,
.result-table td {
  border: 1px solid #ebeef5;
  padding: 10px 12px;
  text-align: left;
}

.result-table thead {
  background: #f7f8fa;
}

@media (max-width: 768px) {
  .settings-card {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 10px;
  }

  .settings-title {
    grid-column: 1 / -1;
    font-size: 16px;
  }

  .form-row:nth-child(2),
  .form-row:nth-child(3) {
    grid-column: span 1;
  }

  .form-row:nth-child(4),
  .query-actions,
  .result-block {
    grid-column: 1 / -1;
  }

  .form-row {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  }

  .form-row label {
    min-width: auto;
    font-size: 12px;
  }

  .date-input {
    width: 100%;
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
    font-size: 12px;
  }

  .form-row :deep(.select-trigger) {
    font-size: 12px;
  }

  .query-actions .btn-primary {
    width: 100%;
  }

  .result-block {
    overflow-x: auto;
  }

  .result-table {
    min-width: 320px;
  }

  .result-table th,
  .result-table td {
    padding: 8px 10px;
    font-size: 14px;
    white-space: nowrap;
  }
}
</style>
