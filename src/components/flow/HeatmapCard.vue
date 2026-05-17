<template>
  <div class="chart-card heat-card">
    <div class="card-title">热区时长分布</div>

    <div v-if="heatItems.length === 0" class="empty-block">暂无热区时长数据</div>

    <template v-else>
      <div class="heat-legend" aria-label="热区图例">
        <span><i class="legend-dot legend-cold"></i>冷区</span>
        <span><i class="legend-dot legend-mid"></i>中等</span>
        <span><i class="legend-dot legend-hot"></i>热区</span>
      </div>

      <div class="heat-zone-grid">
        <button
          v-for="item in heatItems"
          :key="item.chipId"
          class="heat-zone-item"
          type="button"
          :title="`${item.name} | 停留时长 ${item.durationText} | 占比 ${item.percentText}`"
          @click="selectedChipId = selectedChipId === item.chipId ? '' : item.chipId"
        >
          <span v-if="item.rank <= 3" class="rank-badge" :class="`rank-${item.rank}`">Top {{ item.rank }}</span>
          <span
            class="heat-bubble"
            :style="{
              width: `${item.size}px`,
              height: `${item.size}px`,
              background: `radial-gradient(circle at 50% 50%, ${item.bgColor} 0%, ${item.bgColor} 40%, ${item.edgeColor} 100%)`,
              boxShadow: `0 8px 24px ${item.glowColor}`,
            }"
          >
            <span class="heat-bubble-value">{{ item.shortDurationText }}</span>
          </span>
          <span class="heat-zone-name">{{ item.name }}</span>
          <span class="heat-zone-time">{{ item.durationText }}</span>
          <span class="heat-zone-percent">{{ item.percentText }}</span>

          <span v-if="selectedChipId === item.chipId" class="heat-detail-popover">
            <strong>{{ item.name }}</strong>
            <span>停留时长：{{ item.durationText }}</span>
            <span>占比：{{ item.percentText }}</span>
          </span>
        </button>
      </div>

    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DurationSummaryItem } from '../../types/duration'

const props = defineProps<{
  rows: DurationSummaryItem[]
}>()

const selectedChipId = ref('')

function toDisplaySeconds(value: number) {
  if (!Number.isFinite(value)) return 0
  return value > 10000 ? value / 1000 : value
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds)
  if (rounded < 60) {
    return `${rounded}秒`
  }

  const minutes = Math.floor(rounded / 60)
  const remainSeconds = rounded % 60
  if (minutes < 60) {
    return remainSeconds > 0 ? `${minutes}分${remainSeconds}秒` : `${minutes}分`
  }

  const hours = Math.floor(minutes / 60)
  const remainMinutes = minutes % 60
  return remainMinutes > 0 ? `${hours}小时${remainMinutes}分` : `${hours}小时`
}

function getHeatColor(ratio: number): { bg: string; edge: string; glow: string; cardBg: string } {
  const c = (t: number, a: number, b: number) => Math.round(a + (b - a) * t)

  if (ratio <= 0.33) {
    const t = ratio / 0.33
    const r = c(t, 56, 86)
    const g = c(t, 180, 200)
    const b = c(t, 240, 250)
    // cold: edge → deep blue (colder end)
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      edge: `rgb(56, 180, 240)`,
      glow: `rgba(${r}, ${g}, ${b}, 0.4)`,
      cardBg: `rgba(${r}, ${g}, ${b}, 0.08)`,
    }
  }
  if (ratio <= 0.66) {
    const t = (ratio - 0.33) / 0.33
    const r = c(t, 86, 250)
    const g = c(t, 200, 160)
    const b = c(t, 250, 20)
    // medium: edge → cold (blue/cyan)
    return {
      bg: `rgb(${r}, ${g}, ${b})`,
      edge: `rgb(86, 200, 250)`,
      glow: `rgba(${r}, ${g}, ${b}, 0.4)`,
      cardBg: `rgba(${r}, ${g}, ${b}, 0.08)`,
    }
  }
  const t = (ratio - 0.66) / 0.34
  const r = c(t, 250, 239)
  const g = c(t, 160, 40)
  const b = c(t, 20, 50)
  // hot: edge → medium (yellow/orange)
  return {
    bg: `rgb(${r}, ${g}, ${b})`,
    edge: `rgb(250, 160, 20)`,
    glow: `rgba(${r}, ${g}, ${b}, 0.45)`,
    cardBg: `rgba(${r}, ${g}, ${b}, 0.08)`,
  }
}

const heatItems = computed(() => {
  const validRows = props.rows
    .map(item => ({
      chipId: item.chipId,
      name: item.chipId || '未命名热区',
      seconds: toDisplaySeconds(item.totalDuration),
    }))
    .filter(item => item.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds)

  const maxDuration = Math.max(...validRows.map(item => item.seconds), 1)
  const totalDuration = validRows.reduce((sum, item) => sum + item.seconds, 0)

  return validRows.map((item, index) => {
    const ratio = Math.min(item.seconds / maxDuration, 1)
    const color = getHeatColor(ratio)
    const size = Math.round(42 + ratio * 46)

    return {
      ...item,
      rank: index + 1,
      ratio,
      size,
      bgColor: color.bg,
      edgeColor: color.edge,
      glowColor: color.glow,
      cardBgColor: color.cardBg,
      durationText: formatDuration(item.seconds),
      shortDurationText: formatDuration(item.seconds),
      percentText: totalDuration > 0 ? `${Math.round((item.seconds / totalDuration) * 100)}%` : '0%',
    }
  })
})
</script>

<style scoped>
.heat-card {
  overflow: visible;
}

.heat-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 18px;
  color: #606266;
  font-size: 13px;
}

.heat-legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 999px;
  display: inline-block;
}

.legend-cold { background: rgb(56, 180, 240); }
.legend-mid { background: rgb(250, 160, 20); }
.legend-hot { background: rgb(239, 40, 50); }

.heat-zone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 14px;
  align-items: stretch;
}

.heat-zone-item {
  position: relative;
  border: 1px solid rgba(226, 232, 240, 0.5);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
  padding: 18px 10px 14px;
  min-height: 170px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: 5px;
  color: inherit;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease, background 0.2s ease;
}

.heat-zone-item:hover {
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.12);
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.75);
}

.rank-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  border-radius: 999px;
  padding: 3px 7px;
  font-size: 11px;
  font-weight: 700;
  background: #eef2ff;
  color: #4f46e5;
}

.rank-1 {
  background: #fee2e2;
  color: #dc2626;
}

.rank-2 {
  background: #fef3c7;
  color: #d97706;
}

.rank-3 {
  background: #e0f2fe;
  color: #0284c7;
}

.heat-bubble {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.heat-zone-item:hover .heat-bubble {
  transform: scale(1.08);
}

.heat-bubble-value {
  font-size: 13px;
  white-space: nowrap;
}

.heat-zone-name {
  max-width: 100%;
  color: #303133;
  font-weight: 700;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.heat-zone-time,
.heat-zone-percent {
  color: #606266;
  font-size: 12px;
}

.heat-detail-popover {
  position: absolute;
  z-index: 2;
  left: 50%;
  bottom: calc(100% + 8px);
  transform: translateX(-50%);
  width: max-content;
  max-width: 220px;
  border-radius: 10px;
  background: rgba(17, 24, 39, 0.94);
  color: #fff;
  padding: 9px 10px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
  display: grid;
  gap: 4px;
  font-size: 12px;
  text-align: left;
}

@media (max-width: 768px) {
  .heat-zone-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .heat-zone-item {
    min-height: 130px;
    padding: 10px 8px 8px;
  }

  .heat-detail-popover {
    left: 8px;
    right: 8px;
    bottom: calc(100% + 6px);
    transform: none;
    width: auto;
  }

  .heat-bubble-value {
    font-size: 11px;
  }

  .heat-zone-name {
    font-size: 12px;
  }

  .heat-zone-time,
  .heat-zone-percent {
    font-size: 11px;
  }
}
</style>
