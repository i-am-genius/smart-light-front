<template>
  <div class="chart-card energy-card">
    <div class="energy-title-row">
      <div class="card-title">节能效果</div>
      <span v-if="data?.estimated" class="estimate-badge">预计</span>
    </div>

    <div v-if="!hasData" class="empty-block energy-empty">
      <strong>暂无节能估算</strong>
      <span>{{ data?.emptyReason || '等待灯具亮度数据后自动生成' }}</span>
    </div>

    <div v-else class="energy-content">
      <div class="energy-hero">
        <div>
          <span class="energy-hero-label">今日预计节能率</span>
          <strong class="energy-hero-value">{{ formatPercent(data?.todaySavingRatePercent) }}</strong>
        </div>
        <div class="saved-energy">
          <span>今日预计节省</span>
          <strong>{{ formatEnergy(data?.savedEnergyKwh) }}</strong>
        </div>
      </div>

      <div class="energy-comparison" aria-label="传统照明与智能照明预计能耗对比">
        <div class="energy-bar-row">
          <div class="energy-bar-meta">
            <span>传统照明基准</span>
            <strong>{{ formatEnergy(data?.baselineEnergyKwh) }}</strong>
          </div>
          <div class="energy-track">
            <span class="energy-fill energy-fill-baseline"></span>
          </div>
        </div>

        <div class="energy-bar-row">
          <div class="energy-bar-meta">
            <span>智能照明预计</span>
            <strong>{{ formatEnergy(data?.smartEnergyKwh) }}</strong>
          </div>
          <div class="energy-track">
            <span
              class="energy-fill energy-fill-smart"
              :style="{ width: smartBarWidth }"
            ></span>
          </div>
        </div>
      </div>

      <div class="energy-support-grid">
        <div class="energy-support-item">
          <span>自动调光灯具</span>
          <strong>{{ data?.autoDimmingDeviceCount ?? 0 }}/{{ data?.lampCount ?? 0 }}</strong>
        </div>
        <div class="energy-support-item">
          <span>平均亮度下降</span>
          <strong>{{ formatPercent(data?.averageBrightnessReductionPercent) }}</strong>
        </div>
        <div class="energy-support-item">
          <span>数据覆盖率</span>
          <strong>{{ formatPercent(data?.dataCoveragePercent, 0) }}</strong>
        </div>
      </div>

      <p class="energy-basis">{{ data?.calculationBasis }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { StrategyCompareData } from '../../types/analytics'

const props = defineProps<{
  data: StrategyCompareData | null
}>()

const hasData = computed(() => Boolean(props.data?.hasData))

const smartBarWidth = computed(() => {
  if (props.data?.baselineEnergyKwh == null || props.data?.smartEnergyKwh == null) return '0%'
  const baseline = Number(props.data?.baselineEnergyKwh)
  const smart = Number(props.data?.smartEnergyKwh)
  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(smart)) return '0%'
  const ratio = Math.max(0, Math.min(1, smart / baseline))
  return `${Math.round(ratio * 100)}%`
})

function formatEnergy(value: number | null | undefined) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `${numeric.toFixed(2)} kWh`
}

function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null) return '—'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '—'
  return `${numeric.toFixed(digits)}%`
}
</script>

<style scoped>
.energy-card {
  overflow: hidden;
}

.energy-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.energy-title-row .card-title {
  margin-bottom: 14px;
}

.estimate-badge {
  align-self: flex-start;
  padding: 3px 8px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.10);
  color: #15803d;
  font-size: 11px;
  font-weight: 700;
}

.energy-empty {
  min-height: 210px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-sizing: border-box;
  text-align: center;
}

.energy-empty strong {
  color: #475569;
  font-size: 15px;
}

.energy-empty span {
  color: #94a3b8;
  font-size: 13px;
}

.energy-content {
  display: flex;
  flex-direction: column;
  gap: 13px;
}

.energy-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 13px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(16, 185, 129, 0.05));
  border: 1px solid rgba(34, 197, 94, 0.14);
}

.energy-hero-label,
.saved-energy span {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.energy-hero-value {
  display: block;
  margin-top: 2px;
  color: #15803d;
  font-size: 32px;
  line-height: 1;
  letter-spacing: -0.04em;
}

.saved-energy {
  text-align: right;
}

.saved-energy strong {
  display: block;
  margin-top: 5px;
  color: #166534;
  font-size: 16px;
}

.energy-comparison {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.energy-bar-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 5px;
  color: #64748b;
  font-size: 12px;
}

.energy-bar-meta strong {
  color: #334155;
  font-size: 12px;
}

.energy-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.energy-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  transition: width 0.45s ease;
}

.energy-fill-baseline {
  width: 100%;
  background: #94a3b8;
}

.energy-fill-smart {
  background: linear-gradient(90deg, #22c55e, #10b981);
}

.energy-support-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border-top: 1px solid rgba(148, 163, 184, 0.16);
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.energy-support-item {
  min-width: 0;
  padding: 8px 7px;
  text-align: center;
}

.energy-support-item + .energy-support-item {
  border-left: 1px solid rgba(148, 163, 184, 0.16);
}

.energy-support-item span {
  display: block;
  overflow: hidden;
  color: #94a3b8;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.energy-support-item strong {
  display: block;
  margin-top: 3px;
  color: #334155;
  font-size: 14px;
}

.energy-basis {
  margin: 0;
  overflow: hidden;
  color: #94a3b8;
  font-size: 10px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.night-mode) .estimate-badge {
  background: rgba(34, 197, 94, 0.16);
  color: #86efac;
}

:global(.night-mode) .energy-hero {
  background: linear-gradient(135deg, rgba(22, 163, 74, 0.17), rgba(16, 185, 129, 0.06));
  border-color: rgba(74, 222, 128, 0.16);
}

:global(.night-mode) .energy-hero-label,
:global(.night-mode) .saved-energy span,
:global(.night-mode) .energy-bar-meta,
:global(.night-mode) .energy-support-item span,
:global(.night-mode) .energy-basis {
  color: #94a3b8;
}

:global(.night-mode) .energy-hero-value,
:global(.night-mode) .saved-energy strong {
  color: #86efac;
}

:global(.night-mode) .energy-bar-meta strong,
:global(.night-mode) .energy-support-item strong,
:global(.night-mode) .energy-empty strong {
  color: #e2e8f0;
}

:global(.night-mode) .energy-empty span {
  color: #94a3b8;
}

:global(.night-mode) .energy-track {
  background: rgba(148, 163, 184, 0.18);
}

@media (max-width: 480px) {
  .energy-hero-value {
    font-size: 28px;
  }

  .energy-support-item {
    padding-inline: 4px;
  }
}
</style>
