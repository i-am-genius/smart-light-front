<template>
  <div class="chart-card">
    <div class="card-title">人流检测概览</div>

    <div v-if="!hasData" class="empty-block">暂无人流检测数据</div>

    <div v-else class="flow-overview-content">
      <div class="flow-overview-highlights">
        <div class="flow-highlight-item">
          <span class="flow-highlight-label">平均人数</span>
          <strong class="flow-highlight-value">{{ avgPersonCount }}</strong>
        </div>
        <div class="flow-highlight-item">
          <span class="flow-highlight-label">峰值人数</span>
          <strong class="flow-highlight-value">{{ maxPersonCount }}</strong>
        </div>
      </div>

      <div class="flow-overview-details">
        <div class="flow-detail-row">
          <span class="flow-detail-label">累计检测人次</span>
          <span class="flow-detail-value">{{ totalDetections }} 次</span>
        </div>
        <div class="flow-detail-row">
          <span class="flow-detail-label">最近检测</span>
          <span class="flow-detail-value">{{ lastDetectTimeText }}</span>
        </div>
        <div class="flow-detail-row">
          <span class="flow-detail-label">最近人数</span>
          <span class="flow-detail-value">{{ lastPersonCount }} 人</span>
        </div>
        <div class="flow-detail-row">
          <span class="flow-detail-label">置信度</span>
          <span class="flow-detail-value">{{ lastConfidenceText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getPersonFlowRecent, type PersonFlowRecordRespVO } from '../../api/personFlow'

const records = ref<PersonFlowRecordRespVO[]>([])

const hasData = computed(() => records.value.length > 0)

const totalDetections = computed(() => records.value.length)

const avgPersonCount = computed(() => {
  if (records.value.length === 0) return '—'
  const sum = records.value.reduce((acc, r) => acc + (r.personCount || 0), 0)
  return (sum / records.value.length).toFixed(1)
})

const maxPersonCount = computed(() => {
  if (records.value.length === 0) return '—'
  return Math.max(...records.value.map(r => r.personCount || 0))
})

const lastRecord = computed(() => records.value[0] || null)

const lastDetectTimeText = computed(() => {
  if (!lastRecord.value) return '—'
  const d = new Date(lastRecord.value.detectTime)
  if (Number.isNaN(d.getTime())) return '—'
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
})

const lastPersonCount = computed(() => {
  return lastRecord.value?.personCount ?? '—'
})

const lastConfidenceText = computed(() => {
  if (!lastRecord.value || lastRecord.value.confidence == null) return '—'
  return Math.round(lastRecord.value.confidence * 100) + '%'
})

async function loadData() {
  try {
    records.value = await getPersonFlowRecent(50)
  } catch {
    records.value = []
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('person-flow-updated', loadData)
})

onBeforeUnmount(() => {
  window.removeEventListener('person-flow-updated', loadData)
})
</script>

<style scoped>
.flow-overview-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flow-overview-highlights {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.flow-highlight-item {
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.flow-highlight-label {
  font-size: 12px;
  color: #86909c;
}

.flow-highlight-value {
  font-size: 20px;
  font-weight: 700;
  color: #1d2129;
}

.flow-overview-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flow-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid rgba(226, 232, 240, 0.4);
}

.flow-detail-label {
  font-size: 13px;
  color: #86909c;
}

.flow-detail-value {
  font-size: 13px;
  font-weight: 600;
  color: #1d2129;
}
</style>
