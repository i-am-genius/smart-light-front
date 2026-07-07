<template>
  <div class="time-container">
    <!-- Clock -->
    <div class="current-time" :class="{ 'time-tick': tick }">{{ currentTime }}</div>

    <!-- Info row -->
    <div class="time-row">
      <p v-if="weatherText" id="weatherDisplay" class="weather-text">{{ weatherText }}</p>

      <!-- Weather icon -->
      <span
        v-if="weatherIcon"
        class="weather-icon"
        :class="`weather-icon--${weatherIcon.type}`"
        aria-hidden="true"
      >
        <svg viewBox="0 0 36 36" role="img" focusable="false">
          <!-- Clear sky — sun with gentle glow pulse -->
          <g v-if="weatherIcon.type === 'clear'" class="icon-sun">
            <!-- Outer halo -->
            <circle cx="18" cy="18" r="12" class="sun-halo" />
            <!-- Core -->
            <circle cx="18" cy="18" r="6" class="sun-core" />
            <!-- 8 curved rays -->
            <g class="sun-rays">
              <path d="M18 3.5c.4 2.2.5 3.3 0 5.5" />
              <path d="M18 27c-.4 2.2-.5 3.3 0 5.5" />
              <path d="M3.5 18c2.2-.4 3.3-.5 5.5 0" />
              <path d="M27 18c2.2.4 3.3.5 5.5 0" />
              <path d="M7.8 7.8c1.6 1 2.4 1.5 3.9 2.5" />
              <path d="M24.3 24.3c1.6 1 2.4 1.5 3.9 2.5" />
              <path d="M28.2 7.8c-1 1.6-1.5 2.4-2.5 3.9" />
              <path d="M11.7 24.3c-1 1.6-1.5 2.4-2.5 3.9" />
            </g>
          </g>

          <!-- Cloud-based icons -->
          <g v-else class="icon-cloud-group">
            <!-- Sun peek (partly cloudy) -->
            <g v-if="weatherIcon.type === 'partly'" class="icon-sun-peek">
              <circle cx="13.5" cy="12" r="4.5" class="sun-peek-body" />
              <g class="sun-peek-rays">
                <path d="M13.5 4.5v2.5" />
                <path d="M7 8.5l1.8 1.8" />
                <path d="M20 8.5l-1.8 1.8" />
              </g>
            </g>

            <!-- Main cloud — float animation -->
            <g class="cloud-body">
              <path
                d="M11.2 25.8h14.7a5.4 5.4 0 0 0 .5-10.8 8 8 0 0 0-15.2-1.9 6.4 6.4 0 0 0 0 12.7Z"
                class="cloud-fill"
              />
            </g>

            <!-- Rain drops — staggered fall -->
            <g
              v-if="weatherIcon.type === 'rain'"
              class="icon-rain"
              :class="`intensity-${intensity}`"
            >
              <path d="M13 28l-1.7 3.5" class="raindrop raindrop-1" />
              <path d="M18 27.5l-1.7 3.5" class="raindrop raindrop-2" />
              <path d="M23 28l-1.5 3" class="raindrop raindrop-3" />
              <!-- Extra drops for heavy rain -->
              <path v-if="intensity === 'heavy'" d="M15.5 27l-1.5 3" class="raindrop raindrop-4" />
              <path v-if="intensity === 'heavy'" d="M20.5 27.2l-1.5 3" class="raindrop raindrop-5" />
            </g>

            <!-- Snow flakes — gentle drift -->
            <g
              v-if="weatherIcon.type === 'snow'"
              class="icon-snow"
              :class="`intensity-${intensity}`"
            >
              <g class="snowflake snowflake-1">
                <path d="M13.5 28v4M11.5 30h4" />
              </g>
              <g class="snowflake snowflake-2">
                <path d="M22 28v4M20 30h4" />
              </g>
              <g class="snowflake snowflake-3">
                <path d="M17.5 30.5v3M16 32h3" />
              </g>
              <!-- Extra flake for heavy snow -->
              <g v-if="intensity === 'heavy'" class="snowflake snowflake-4">
                <path d="M10 29.5v3.5M8.5 31.2h3" />
              </g>
            </g>

            <!-- Fog lines — wave -->
            <g v-if="weatherIcon.type === 'fog'" class="icon-fog">
              <path d="M8 29h20" class="fog-line fog-line-1" />
              <path d="M10.5 32h15" class="fog-line fog-line-2" />
            </g>

            <!-- Thunder bolt — flash -->
            <g
              v-if="weatherIcon.type === 'thunder'"
              class="icon-thunder"
              :class="`intensity-${intensity}`"
            >
              <!-- Main bolt -->
              <path
                d="M19 27l-3 5h2.8l-1 3.5 4.2-5.5h-3l.5-3Z"
                class="thunder-bolt"
              />
              <!-- Extra bolts for normal / heavy -->
              <path
                v-if="intensity !== 'light'"
                d="M13 28.5l-2.2 3.8h2l-.8 2.5 3.2-4.2h-2.2l.5-2.1Z"
                class="thunder-bolt thunder-bolt-2"
              />
              <path
                v-if="intensity === 'heavy'"
                d="M24.5 28l-1.8 3h1.6l-.6 2 2.5-3.3h-1.7l.3-1.7Z"
                class="thunder-bolt thunder-bolt-3"
              />
              <!-- Hail particles for heavy thunderstorm -->
              <g v-if="intensity === 'heavy'" class="hail">
                <circle cx="12" cy="31" r="1.2" class="hailstone hailstone-1" />
                <circle cx="25" cy="30" r="1" class="hailstone hailstone-2" />
              </g>
            </g>
          </g>
        </svg>
      </span>

      <div class="current-week">{{ weekInfo }}</div>
      <span class="time-divider">·</span>
      <div class="current-date">{{ dateInfo }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  currentTime: string
  weekInfo: string
  dateInfo: string
  weatherText?: string
  weatherIconType?: 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunder'
  weatherIntensity?: 'light' | 'normal' | 'heavy'
}>()

// Weather icon layout — data-driven to avoid inline template conditionals
// intensity drives particle count, animation speed and visual weight
const weatherIcons: Record<string, { type: string; label: string }> = {
  clear: { type: 'clear', label: '晴' },
  partly: { type: 'partly', label: '多云' },
  cloudy: { type: 'cloudy', label: '阴' },
  rain: { type: 'rain', label: '雨' },
  snow: { type: 'snow', label: '雪' },
  fog: { type: 'fog', label: '雾' },
  thunder: { type: 'thunder', label: '雷' },
}

// Default intensity per icon type when prop is not provided
const defaultIntensity: Record<string, string> = {
  rain: 'normal', snow: 'normal', thunder: 'normal',
}

const intensity = computed(() =>
  props.weatherIntensity ?? defaultIntensity[props.weatherIconType ?? ''] ?? 'normal'
)

const weatherIcon = computed(() => {
  if (!props.weatherIconType) return null
  return weatherIcons[props.weatherIconType] ?? null
})

// Clock tick — brief scale pulse on each second change
const tick = ref(false)
let prevTime = props.currentTime
let tickTimer: ReturnType<typeof setTimeout> | null = null

function pulseTick() {
  tick.value = true
  if (tickTimer) clearTimeout(tickTimer)
  tickTimer = setTimeout(() => { tick.value = false }, 400)
}

// Watch currentTime prop changes for tick animation
watch(() => props.currentTime, (newVal) => {
  if (newVal !== prevTime) {
    prevTime = newVal
    pulseTick()
  }
})

onUnmounted(() => {
  if (tickTimer) clearTimeout(tickTimer)
})
</script>

<style scoped>
/* ================================================================
   Layout
   ================================================================ */
.time-container {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  margin-bottom: 14px;
}

/* ================================================================
   Clock — bold + subtle glow pulse
   ================================================================ */
.current-time {
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0.02em;
  color: #1e293b;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform;
}

.current-time.time-tick {
  transform: scale(1.03);
}

/* ================================================================
   Info row — bolder text, refined spacing
   ================================================================ */
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  color: #475569;
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.weather-text {
  margin: 0;
  font-weight: 800;
}

.time-divider {
  opacity: 0.35;
  font-weight: 800;
  user-select: none;
}

.current-week,
.current-date {
  font-weight: 800;
}

/* ================================================================
   Weather icon layout
   ================================================================ */
.weather-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  margin-left: -4px;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.weather-icon:hover {
  transform: scale(1.12) rotate(-3deg);
}

.weather-icon svg {
  width: 36px;
  height: 36px;
  display: block;
  overflow: visible;
}

/* ================================================================
   Weather icon palette — shared stroke rules
   ================================================================ */
.weather-icon path,
.weather-icon circle {
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* ── Sun ────────────────────────────────────────────────────── */
.icon-sun .sun-halo {
  fill: rgba(251, 191, 36, 0.08);
  stroke: rgba(251, 191, 36, 0.2);
  stroke-width: 1.5;
  animation: halo-breathe 3s ease-in-out infinite;
}

.icon-sun .sun-core {
  fill: #fbbf24;
  stroke: #f59e0b;
  stroke-width: 1.5;
  animation: core-breathe 3s ease-in-out infinite;
}

.icon-sun .sun-rays {
  transform-origin: 18px 18px;
  animation: ray-spin 20s linear infinite;
}

.icon-sun .sun-rays path {
  stroke: #f59e0b;
  stroke-width: 2;
  opacity: 0.9;
  animation: ray-breathe 3s ease-in-out infinite;
}

@keyframes ray-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

@keyframes halo-breathe {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50%      { opacity: 1; transform: scale(1.06); }
}

@keyframes core-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.04); }
}

@keyframes ray-breathe {
  0%, 100% { opacity: 0.7; }
  50%      { opacity: 1; }
}

/* ── Sun peek (partly cloudy) ───────────────────────────────── */
.icon-sun-peek .sun-peek-body {
  fill: rgba(251, 191, 36, 0.2);
  stroke: #f59e0b;
  animation: sun-peek-pulse 3s ease-in-out infinite;
}

.icon-sun-peek .sun-peek-rays {
  transform-origin: 13.5px 12px;
  opacity: 0.7;
  animation: sun-peek-pulse 3s ease-in-out infinite;
}

@keyframes sun-peek-pulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.7; }
}

/* ── Cloud ──────────────────────────────────────────────────── */
.cloud-body {
  animation: cloud-float 4s ease-in-out infinite;
}

.cloud-fill {
  fill: rgba(148, 163, 184, 0.18);
  stroke: #94a3b8;
}

/* Cloud palette per weather type */
.weather-icon--partly .cloud-fill {
  fill: rgba(203, 213, 225, 0.22);
  stroke: #b0bec5;
}

.weather-icon--cloudy .cloud-fill {
  fill: rgba(120, 135, 150, 0.28);
  stroke: #78909c;
}

.weather-icon--rain .cloud-fill {
  fill: rgba(96, 125, 139, 0.28);
  stroke: #607d8b;
}

.weather-icon--snow .cloud-fill {
  fill: rgba(224, 231, 240, 0.32);
  stroke: #cfd8dc;
}

.weather-icon--fog .cloud-fill {
  fill: rgba(176, 190, 197, 0.24);
  stroke: #b0bec5;
}

.weather-icon--thunder .cloud-fill {
  fill: rgba(69, 90, 100, 0.3);
  stroke: #546e7a;
}

@keyframes cloud-float {
  0%, 100% { transform: translateX(0); }
  50%      { transform: translateX(1.2px); }
}

/* ── Rain ───────────────────────────────────────────────────── */
.icon-rain .raindrop {
  stroke: #60a5fa;
  stroke-width: 2;
  opacity: 0;
  animation: rain-fall 1.2s ease-in infinite;
}

.raindrop-1 { animation-delay: 0s; }
.raindrop-2 { animation-delay: 0.35s; }
.raindrop-3 { animation-delay: 0.7s; }
.raindrop-4 { animation-delay: 0.15s; }
.raindrop-5 { animation-delay: 0.55s; }

/* Light rain: slower, thinner */
.icon-rain.intensity-light .raindrop {
  animation-duration: 1.8s;
  stroke-width: 1.6;
  opacity: 0.7;
}

/* Heavy rain: faster, thicker, bolder */
.icon-rain.intensity-heavy .raindrop {
  animation-duration: 0.7s;
  stroke-width: 2.5;
  stroke: #3b82f6;
}

@keyframes rain-fall {
  0%   { opacity: 0; transform: translateY(-3px); }
  20%  { opacity: 1; }
  80%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(3px); }
}

/* ── Snow ───────────────────────────────────────────────────── */
.icon-snow .snowflake {
  opacity: 0;
  animation: snow-drift 2s ease-in-out infinite;
}

.icon-snow .snowflake path {
  stroke: #ffffff;
  stroke-width: 2;
}

.snowflake-1 { animation-delay: 0s; }
.snowflake-2 { animation-delay: 0.7s; }
.snowflake-3 { animation-delay: 1.3s; }
.snowflake-4 { animation-delay: 0.4s; }

/* Light snow: smaller, slower */
.icon-snow.intensity-light .snowflake {
  animation-duration: 3s;
}

.icon-snow.intensity-light .snowflake path {
  stroke-width: 1.4;
}

/* Heavy snow: faster, larger */
.icon-snow.intensity-heavy .snowflake {
  animation-duration: 1.3s;
}

.icon-snow.intensity-heavy .snowflake path {
  stroke-width: 2.6;
}

@keyframes snow-drift {
  0%   { opacity: 0; transform: translateY(-2px) rotate(0deg); }
  30%  { opacity: 1; }
  70%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(3px) rotate(25deg); }
}

/* ── Fog ────────────────────────────────────────────────────── */
.icon-fog .fog-line {
  stroke: #94a3b8;
  stroke-width: 2;
  opacity: 0;
  animation: fog-drift 3s ease-in-out infinite;
}

.fog-line-1 { animation-delay: 0s; }
.fog-line-2 { animation-delay: 1s; }

@keyframes fog-drift {
  0%   { opacity: 0; transform: translateX(-3px); }
  40%  { opacity: 0.8; }
  60%  { opacity: 0.8; }
  100% { opacity: 0; transform: translateX(3px); }
}

/* ── Thunder ────────────────────────────────────────────────── */
.icon-thunder .thunder-bolt {
  fill: rgba(250, 204, 21, 0.15);
  stroke: #eab308;
  stroke-width: 2;
  animation: thunder-flash 2.5s ease-in-out infinite;
}

/* Staggered flash — bolts fire at different moments */
.thunder-bolt-2 {
  animation-delay: 0.8s;
  transform-origin: 13px 28.5px;
}

.thunder-bolt-3 {
  animation-delay: 1.6s;
  transform-origin: 24.5px 28px;
}

/* Light thunder: calmer flash */
.icon-thunder.intensity-light .thunder-bolt {
  animation-duration: 3.5s;
  stroke-width: 1.8;
}

/* Heavy thunder: rapid violent flash */
.icon-thunder.intensity-heavy .thunder-bolt {
  animation-duration: 1.2s;
  stroke-width: 2.5;
  fill: rgba(250, 204, 21, 0.25);
}

/* Normal thunder: moderate cycle */
.icon-thunder.intensity-normal .thunder-bolt {
  animation-duration: 2.5s;
}

/* Hail stones for heavy thunderstorm */
.icon-thunder .hailstone {
  fill: rgba(200, 220, 240, 0.7);
  stroke: none;
  animation: hail-fall 1s ease-in infinite;
}

.hailstone-1 { animation-delay: 0s; }
.hailstone-2 { animation-delay: 0.5s; }

@keyframes thunder-flash {
  0%, 100% { opacity: 1; }
  10%      { opacity: 0.3; }
  20%      { opacity: 1; }
  30%      { opacity: 0.5; }
  40%      { opacity: 1; }
}

@keyframes hail-fall {
  0%   { opacity: 0; transform: translateY(-3px); }
  25%  { opacity: 1; }
  75%  { opacity: 1; }
  100% { opacity: 0; transform: translateY(4px); }
}

/* ================================================================
   Night mode overrides
   ================================================================ */
:global(.app-container.night-mode) .current-time {
  color: rgba(248, 250, 252, 0.96);
  text-shadow: 0 0 20px rgba(148, 163, 184, 0.15);
}

:global(.app-container.night-mode) .time-row {
  color: rgba(226, 232, 240, 0.78);
}

:global(.app-container.night-mode) .weather-icon {
  color: rgba(203, 213, 225, 0.88);
}

:global(.app-container.night-mode) .icon-snow .snowflake path {
  stroke: rgba(255, 255, 255, 0.95);
}

:global(.app-container.night-mode) .weather-icon--snow .cloud-fill {
  fill: rgba(200, 210, 220, 0.2);
  stroke: rgba(200, 210, 220, 0.5);
}

:global(.app-container.night-mode) .time-divider {
  opacity: 0.25;
}

/* ================================================================
   Mobile
   ================================================================ */
@media (max-width: 768px) {
  .current-time {
    font-size: 1.4rem;
  }

  .time-row {
    flex-wrap: wrap;
    gap: 6px;
    font-size: 12px;
    margin-top: 7px;
  }

  .time-container {
    margin-bottom: 6px;
  }

  .weather-icon,
  .weather-icon svg {
    width: 24px;
    height: 24px;
  }

  .time-divider {
    display: none;
  }
}
</style>
