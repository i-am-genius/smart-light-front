<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast-item"
          :class="t.type"
        >
          <span class="toast-icon" aria-hidden="true">{{ iconForType(t.type) }}</span>
          <span class="toast-text">{{ t.text }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../../composables/useToast'

const { toasts } = useToast()

function iconForType(type: string): string {
  if (type === 'success') return '✓'
  if (type === 'error') return '!'
  return 'i'
}
</script>

<style>
.toast-container {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  pointer-events: none;
  max-width: calc(100vw - 32px);
}

.toast-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 18px;
  border-radius: 14px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
  pointer-events: auto;
  border: 1px solid transparent;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
  max-width: 420px;
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 900;
  line-height: 1;
}

.toast-text {
  min-width: 0;
}

.toast-item.success {
  background: #f0fdf4;
  color: #15803d;
  border-color: #bbf7d0;
}

.toast-item.success .toast-icon {
  background: #22c55e;
  color: #fff;
}

.toast-item.error {
  background: #fff5f5;
  color: #b91c1c;
  border-color: #fecaca;
}

.toast-item.error .toast-icon {
  background: #ef4444;
  color: #fff;
}

.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.toast-leave-active {
  transition: all 0.25s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-16px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}

@media (max-width: 768px) {
  .toast-container {
    top: calc(env(safe-area-inset-top, 0px) + 88px);
    left: 16px;
    right: 16px;
    transform: none;
    align-items: stretch;
    gap: 8px;
    max-width: none;
  }

  .toast-item {
    max-width: none;
    width: 100%;
    padding: 11px 16px;
    font-size: 13px;
    border-radius: 12px;
  }
}
</style>
