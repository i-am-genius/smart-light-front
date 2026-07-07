<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-card">
        <div class="auth-brand-row">
          <span class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" focusable="false">
              <path class="bulb-glow" d="M14 3.5a8.1 8.1 0 0 0-4.8 14.63c.67.5 1.05 1.28 1.05 2.11v.26h7.5v-.26c0-.83.38-1.61 1.05-2.11A8.1 8.1 0 0 0 14 3.5Z" />
              <path class="bulb-line" d="M10.25 20.5h7.5M11.25 23.25h5.5M12.4 25.5h3.2M14 7.25v3.5M10.95 11.2l2.05 2.05M17.05 11.2 15 13.25" />
            </svg>
          </span>
          <strong>智能灯控</strong>
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
  background: #eef4fb;
  overflow: hidden;
}

.auth-page::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -2;
  background-image: url('/backgrounds/bg-day.png');
  background-size: cover;
  background-position: center right;
  background-repeat: no-repeat;
  opacity: 0.95;
  filter: blur(8px);
  transform: scale(1.02);
}

.auth-page::after {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(245, 248, 252, 0.28) 0%, rgba(245, 248, 252, 0.14) 48%, rgba(245, 248, 252, 0.04) 100%);
  pointer-events: none;
}

/* ===== Shell & card (with entrance animation) ===== */
.auth-shell {
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
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.76);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.10);
  backdrop-filter: blur(16px);
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
    linear-gradient(135deg, rgba(255, 255, 255, 0.92), rgba(219, 234, 254, 0.72));
  border: 1px solid rgba(191, 219, 254, 0.82);
  box-shadow: 0 10px 22px rgba(37, 99, 235, 0.22);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  animation: brand-pulse 3s ease-in-out infinite;
}

@keyframes brand-pulse {
  0%, 100% {
    box-shadow:
      0 10px 22px rgba(37, 99, 235, 0.18),
      0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  }
  50% {
    box-shadow:
      0 12px 38px rgba(37, 99, 235, 0.42),
      0 0 0 1px rgba(255, 255, 255, 0.5) inset,
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
  fill: rgba(96, 165, 250, 0.2);
  stroke: #2563eb;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: glow-breathe 3s ease-in-out infinite;
  transform-origin: 14px 14px;
}

@keyframes glow-breathe {
  0%, 100% {
    fill: rgba(96, 165, 250, 0.12);
    stroke: rgba(37, 99, 235, 0.6);
  }
  50% {
    fill: rgba(96, 165, 250, 0.45);
    stroke: rgba(37, 99, 235, 1);
  }
}

.bulb-line {
  fill: none;
  stroke: #1d4ed8;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  animation: filament-glow 3s ease-in-out infinite;
}

@keyframes filament-glow {
  0%, 100% {
    stroke: rgba(29, 78, 216, 0.5);
    stroke-width: 1.7;
  }
  50% {
    stroke: rgba(29, 78, 216, 1);
    stroke-width: 2.1;
  }
}

.auth-brand-row strong {
  color: #111827;
  font-size: 18px;
  font-weight: 800;
  line-height: 1;
}

/* ===== Form header ===== */
.form-header h2 {
  margin: 0 0 8px;
  font-size: 26px;
  color: #111827;
}

.form-header p {
  margin: 0 0 24px;
  color: #64748b;
  font-size: 14px;
}

/* ===== Form items (slot content via :deep) ===== */
:deep(.form-item) {
  margin-bottom: 18px;
}

:deep(.form-item label) {
  display: block;
  margin-bottom: 8px;
  color: #475569;
  font-size: 13px;
  font-weight: 700;
}

:deep(.form-item input) {
  width: 100%;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(203, 213, 225, 0.92);
  padding: 0 14px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.88);
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

:deep(.form-item input:focus) {
  border-color: #60a5fa;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.14);
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
  color: #64748b;
  font-size: 14px;
}

:deep(.form-footer a) {
  color: #2563eb;
  text-decoration: none;
  font-weight: 700;
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
    align-items: flex-start;
  }

  .auth-card {
    padding: 24px 20px;
  }

  :deep(.primary-btn) {
    height: 40px;
  }
}
</style>
