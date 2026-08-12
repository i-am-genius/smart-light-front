<template>
  <div class="auth-page">
    <AuthFollowLight />
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand-row">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" focusable="false">
              <path class="bulb-glow" d="M14 3.5a8.1 8.1 0 0 0-4.8 14.63c.67.5 1.05 1.28 1.05 2.11v.26h7.5v-.26c0-.83.38-1.61 1.05-2.11A8.1 8.1 0 0 0 14 3.5Z" />
              <path class="bulb-line" d="M10.25 20.5h7.5M11.25 23.25h5.5M12.4 25.5h3.2M14 7.25v3.5M10.95 11.2l2.05 2.05M17.05 11.2 15 13.25" />
            </svg>
          </span>
          <strong>视界随光</strong>
        </div>

        <div class="form-header">
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>

        <slot />

        <slot name="footer" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import AuthFollowLight from './AuthFollowLight.vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<style scoped>
/* ===== Page layout ===== */
.auth-page {
  min-height: 100vh;
  position: relative;
  isolation: isolate;
  padding: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  background: #070b12;
  overflow: hidden;
}

.auth-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url('/backgrounds/bg-night.png');
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  filter: saturate(0.92) brightness(0.82);
}

/* ===== Shell & card (with entrance animation) ===== */
.auth-shell {
  position: relative;
  z-index: 2;
  width: min(100%, 460px);
  animation: card-rise 0.55s cubic-bezier(0.22, 0.61, 0.36, 1) both;
}

@keyframes card-rise {
  from {
    opacity: 0;
    transform: translateY(22px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.auth-card {
  width: 100%;
  padding: 30px;
  border-radius: 22px;
  background: rgba(15, 20, 28, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.58),
    0 3px 12px rgba(0, 0, 0, 0.24),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  backdrop-filter: blur(20px) saturate(1.08);
  box-sizing: border-box;
}

/* ===== Brand row ===== */
.auth-brand-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 26px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background:
    linear-gradient(135deg, rgba(31, 48, 70, 0.96), rgba(13, 19, 28, 0.9));
  border: 1px solid rgba(124, 166, 228, 0.28);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.28);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: brand-pulse 3s ease-in-out infinite;
}

@keyframes brand-pulse {
  0%, 100% {
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.26),
      0 0 0 1px rgba(255, 255, 255, 0.08) inset;
  }
  50% {
    box-shadow:
      0 12px 38px rgba(37, 99, 235, 0.34),
      0 0 0 1px rgba(255, 255, 255, 0.1) inset,
      0 0 60px rgba(96, 165, 250, 0.2);
  }
}

.brand-mark svg {
  width: 26px;
  height: 26px;
  display: block;
  animation: bulb-breathe 3s ease-in-out infinite;
  transform-origin: center center;
}

/* ---- Bulb breathing: fill glow pulses like a real light ---- */
@keyframes bulb-breathe {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.1); }
}

.bulb-glow {
  fill: rgba(96, 165, 250, 0.22);
  stroke: #7db1ff;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: glow-breathe 3s ease-in-out infinite;
  transform-origin: 14px 14px;
}

@keyframes glow-breathe {
  0%, 100% {
    fill: rgba(96, 165, 250, 0.14);
    stroke: rgba(125, 177, 255, 0.7);
  }
  50% {
    fill: rgba(96, 165, 250, 0.4);
    stroke: rgba(143, 189, 255, 1);
  }
}

.bulb-line {
  fill: none;
  stroke: #8fbdff;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: filament-glow 3s ease-in-out infinite;
}

@keyframes filament-glow {
  0%, 100% {
    stroke: rgba(143, 189, 255, 0.6);
    stroke-width: 1.7;
  }
  50% {
    stroke: rgba(167, 200, 255, 1);
    stroke-width: 2.1;
  }
}

.auth-brand-row strong {
  color: #f2f5f9;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

/* ===== Form header ===== */
.form-header h2 {
  margin: 0 0 8px;
  font-size: 26px;
  color: #f2f5f9;
}

.form-header p {
  margin: 0 0 24px;
  color: #9ba8b8;
  font-size: 14px;
}

/* ===== Form items (slot content via :deep) ===== */
:deep(.form-item) {
  margin-bottom: 18px;
}

:deep(.form-item label) {
  display: block;
  margin-bottom: 8px;
  color: #c9d1dc;
  font-size: 13px;
  font-weight: 700;
}

:deep(.form-item input) {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid #354152;
  padding: 0 14px;
  font-size: 14px;
  color: #e6ecf3;
  outline: none;
  box-sizing: border-box;
  background: rgba(5, 9, 15, 0.72);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

:deep(.form-item input::placeholder) {
  color: #738094;
}

:deep(.form-item input:hover:not(:focus)) {
  border-color: #4b5d73;
  background: rgba(8, 13, 21, 0.84);
}

:deep(.form-item input:focus) {
  border-color: #60a5fa;
  background: #0b111a;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.16);
}

/* ===== Primary button (with hover animation) ===== */
:deep(.primary-btn) {
  width: 100%;
  height: 44px;
  border: 1px solid #2563eb;
  border-radius: 12px;
  background: #2563eb;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.15s ease;
}

:deep(.primary-btn:hover:not(:disabled)) {
  border-color: #1d4ed8;
  background: #1d4ed8;
  box-shadow: 0 12px 28px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}

:deep(.primary-btn:active:not(:disabled)) {
  transform: translateY(0);
  box-shadow: 0 6px 14px rgba(37, 99, 235, 0.18);
}

:deep(.primary-btn:disabled) {
  opacity: 0.7;
  cursor: not-allowed;
}

/* ===== Form footer (slot content via :deep) ===== */
:deep(.form-footer) {
  margin-top: 18px;
  text-align: center;
  color: #9ba8b8;
  font-size: 14px;
}

:deep(.form-footer a) {
  color: #78aaf5;
  text-decoration: none;
  font-weight: 700;
}

:deep(.form-footer a:hover) {
  color: #a7c8ff;
}

/* ===== Responsive: 640px ===== */
@media (max-width: 640px) {
  .auth-page {
    padding: 16px;
  }

  .auth-card {
    padding: 24px 20px;
  }

  .form-header h2 {
    font-size: 20px;
  }

  .form-header p {
    font-size: 12px;
    margin-bottom: 20px;
  }

  :deep(.form-item) {
    margin-bottom: 14px;
  }

  :deep(.form-item label) {
    font-size: 12px;
    margin-bottom: 6px;
  }

  :deep(.form-item input) {
    height: 42px;
    font-size: 13px;
    border-radius: 11px;
  }

  :deep(.primary-btn) {
    height: 42px;
    font-size: 14px;
    border-radius: 11px;
  }

  :deep(.form-footer) {
    font-size: 12px;
    margin-top: 14px;
  }
}

/* ===== Responsive: 760px ===== */
@media (max-width: 760px) {
  .auth-page {
    padding: 16px;
    align-items: center;
  }

  .auth-card {
    padding: 24px 20px;
  }

  :deep(.primary-btn) {
    height: 40px;
  }
}
</style>
