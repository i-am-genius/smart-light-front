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

      <div v-if="latestImageUrl" class="flow-latest-shot">
        <div class="flow-latest-shot-head">
          <span>最近截图</span>
          <strong>{{ lastRecord?.source || 'CAM' }}</strong>
        </div>
        <img :src="latestImageUrl" alt="person flow latest shot" />
      </div>

      <div class="flow-recent-list">
        <div
          v-for="record in recentRows"
          :key="record.id"
          class="flow-recent-row"
        >
          <div>
            <strong>{{ record.source || 'CAM' }}</strong>
            <small>{{ record.chipId || 'unknown' }}</small>
            <span>{{ formatRecordTime(record.detectTime) }}</span>
          </div>
          <div class="flow-recent-meta">
            <span>{{ record.personCount ?? 0 }} 人</span>
            <span>{{ formatConfidence(record.confidence) }}</span>
            <em :class="{ muted: !record.imageName }">{{ record.imageName ? '有图' : '无图' }}</em>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  getPersonFlowImageObjectUrl,
  getPersonFlowRecent,
  type PersonFlowRecordRespVO,
} from '../../api/personFlow'

const records = ref<PersonFlowRecordRespVO[]>([])
const latestImageUrl = ref('')

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

const recentRows = computed(() => records.value.slice(0, 5))

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
  return formatConfidence(lastRecord.value.confidence)
})

function formatConfidence(value: number | null | undefined) {
  if (value == null) return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return Math.round(Math.max(0, Math.min(1, numeric)) * 100) + '%'
}

function formatRecordTime(value: string | null | undefined) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

async function loadData() {
  try {
    records.value = await getPersonFlowRecent(50)
    await loadLatestImage()
  } catch {
    records.value = []
    clearLatestImage()
  }
}

function clearLatestImage() {
  if (latestImageUrl.value) {
    URL.revokeObjectURL(latestImageUrl.value)
  }
  latestImageUrl.value = ''
}

async function loadLatestImage() {
  clearLatestImage()
  const imageName = records.value.find(record => Boolean(record.imageName))?.imageName
  if (!imageName) return
  try {
    latestImageUrl.value = await getPersonFlowImageObjectUrl(imageName)
  } catch {
    latestImageUrl.value = ''
  }
}

onMounted(() => {
  loadData()
  window.addEventListener('person-flow-updated', loadData)
})

onBeforeUnmount(() => {
  window.removeEventListener('person-flow-updated', loadData)
  clearLatestImage()
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

.flow-latest-shot {
  overflow: hidden;
  border-radius: 10px;
  border: 1px solid #e5e6eb;
  background: #f8fafc;
}

.flow-latest-shot-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}

.flow-latest-shot-head strong {
  color: #2563eb;
  font-size: 11px;
}

.flow-latest-shot img {
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: #0f172a;
}

.flow-recent-list {
  display: grid;
  gap: 8px;
}

.flow-recent-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.flow-recent-row > div:first-child {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.flow-recent-row strong {
  color: #1d2129;
  font-size: 13px;
}

.flow-recent-row small {
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-recent-row span {
  color: #64748b;
  font-size: 12px;
}

.flow-recent-meta {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.flow-recent-meta em {
  padding: 2px 6px;
  border-radius: 999px;
  background: #ecfdf3;
  color: #16a34a;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.flow-recent-meta em.muted {
  background: #f1f5f9;
  color: #64748b;
}
</style>
