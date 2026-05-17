<template>
  <div class="time-container">
    <div class="current-time">{{ currentTime }}</div>
    <div class="time-row">
      <p id="weatherDisplay">{{ weatherText }}</p>
      <span
        v-if="weatherIconType"
        class="weather-icon"
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" role="img" focusable="false">
          <g v-if="weatherIconType === 'clear'" class="icon-sun">
            <circle cx="18" cy="18" r="6.5" />
            <path d="M18 4.5v4M18 27.5v4M4.5 18h4M27.5 18h4M8.4 8.4l2.8 2.8M24.8 24.8l2.8 2.8M27.6 8.4l-2.8 2.8M11.2 24.8l-2.8 2.8" />
          </g>
          <g v-else>
            <path
              v-if="weatherIconType === 'partly'"
              class="icon-sun-muted"
              d="M13.5 9.5a5.5 5.5 0 0 1 6 5.1"
            />
            <path
              class="icon-cloud"
              d="M11.2 25.8h14.7a5.4 5.4 0 0 0 .5-10.8 8 8 0 0 0-15.2-1.9 6.4 6.4 0 0 0 0 12.7Z"
            />
            <g v-if="weatherIconType === 'rain'" class="icon-detail">
              <path d="M14 28.5l-1.7 3M21 28.5l-1.7 3M27 28.2l-1.5 2.6" />
            </g>
            <g v-if="weatherIconType === 'snow'" class="icon-detail">
              <path d="M14 29.5v3M12.7 31h2.6M22 29.5v3M20.7 31h2.6" />
            </g>
            <g v-if="weatherIconType === 'fog'" class="icon-detail">
              <path d="M9 29h18M11 32h14" />
            </g>
            <g v-if="weatherIconType === 'thunder'" class="icon-detail">
              <path d="M19.5 27.8l-3.2 4.9h3l-1.1 3.1 4.1-5.1h-3.1l.3-2.9Z" />
            </g>
          </g>
        </svg>
      </span>
      <div class="current-week">{{ weekInfo }}</div>
      <div class="current-date">{{ dateInfo }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  currentTime: string
  weekInfo: string
  dateInfo: string
  weatherText?: string
  weatherIconType?: 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'
}>()
</script>

<style scoped>
.time-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 14px;
}

.current-time {
  font-size: 2rem;
  font-weight: bold;
  line-height: 1;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 7px;
  color: #666;
  font-size: 14px;
  font-weight: 700;
}

#weatherDisplay {
  margin: 0;
}

.weather-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  margin-left: -4px;
  color: #475569;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.weather-icon svg {
  width: 36px;
  height: 36px;
  display: block;
}

.weather-icon path,
.weather-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-sun circle {
  fill: rgba(251, 191, 36, 0.22);
}

.icon-sun-muted {
  opacity: 0.68;
}

.icon-cloud {
  fill: rgba(148, 163, 184, 0.14);
}

.icon-detail {
  opacity: 0.9;
}

:global(.app-container.night-mode) .current-time {
  color: rgba(248, 250, 252, 0.96);
}

:global(.app-container.night-mode) .time-row {
  color: rgba(226, 232, 240, 0.78);
}

:global(.app-container.night-mode) .weather-icon {
  color: rgba(226, 232, 240, 0.86);
}

@media (max-width: 768px) {
  .time-container {
    align-items: flex-start;
  }

  .time-row {
    flex-wrap: wrap;
  }
}
</style>
