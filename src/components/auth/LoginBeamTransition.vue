<template>
  <div
    v-if="state.active"
    :key="state.runId"
    class="login-beam-transition"
    :class="{
      'is-aperture': state.mode === 'aperture',
      'is-fade': state.mode === 'fade',
    }"
    :style="transitionStyle"
    aria-hidden="true"
  >
    <div class="route-cover">
      <span class="reveal-panel reveal-panel--top"></span>
      <span class="reveal-panel reveal-panel--bottom"></span>
      <span class="reveal-panel reveal-panel--left"></span>
      <span class="reveal-panel reveal-panel--right"></span>
    </div>
    <div class="swap-shield"></div>
    <div class="beam-aperture"></div>
    <div class="lamp-snapshot lamp-model">
      <span class="lamp-adapter"></span>
      <span class="lamp-joint"></span>
      <span class="lamp-barrel"></span>
      <span class="lamp-heat-ring lamp-heat-ring--one"></span>
      <span class="lamp-heat-ring lamp-heat-ring--two"></span>
      <span class="lamp-bezel"></span>
      <span class="lamp-lens"></span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import {
  cancelLoginBeamTransition,
  computeContinuousFanGeometry,
  loginBeamTransitionState as state,
} from './loginBeamTransition'

const transitionStyle = computed(() => {
  const snapshot = state.snapshot
  const viewportWidth = typeof window === 'undefined' ? 1 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 1 : window.innerHeight
  const geometry = computeContinuousFanGeometry(snapshot, viewportWidth, viewportHeight)
  const points: Record<string, string> = {}

  for (const [phase, polygon] of [['start', geometry.start], ['end', geometry.end]] as const) {
    polygon.forEach((point, index) => {
      points[`--beam-${phase}-${index + 1}-x`] = `${point.x}px`
      points[`--beam-${phase}-${index + 1}-y`] = `${point.y}px`
    })
  }

  return {
    '--lamp-x': `${snapshot.lampXRatio * 100}%`,
    '--lamp-y': `${snapshot.lampYRatio * 100}%`,
    '--light-x': `${snapshot.lightXRatio * 100}%`,
    '--light-y': `${snapshot.lightYRatio * 100}%`,
    '--lamp-angle': `${-snapshot.lampAngle}rad`,
    '--beam-gradient-angle': `${Math.atan2(geometry.axis.x, -geometry.axis.y)}rad`,
    ...points,
  }
})

onBeforeUnmount(cancelLoginBeamTransition)
</script>

<style scoped>
.login-beam-transition {
  --lamp-x: 50%;
  --lamp-y: 10%;
  --light-x: 50%;
  --light-y: 54%;
  --lamp-angle: 0rad;
  --beam-gradient-angle: 3.141592653589793rad;
  --transition-cover: #ffefcd;
  position: fixed;
  inset: 0;
  z-index: 100000;
  overflow: hidden;
  pointer-events: auto;
  contain: strict;
}

.beam-aperture,
.swap-shield,
.route-cover,
.reveal-panel,
.lamp-snapshot {
  position: absolute;
  pointer-events: none;
}

.beam-aperture {
  inset: 0;
  z-index: 4;
  clip-path: polygon(
    var(--beam-start-1-x) var(--beam-start-1-y),
    var(--beam-start-2-x) var(--beam-start-2-y),
    var(--beam-start-3-x) var(--beam-start-3-y)
  );
  background: linear-gradient(
    var(--beam-gradient-angle),
    #fff8e8,
    #ffe0a4 42%,
    var(--transition-cover) 100%
  );
  opacity: 0.08;
  will-change: clip-path, opacity;
  animation: login-beam-fan-open 1100ms both,
    login-beam-brightness 1100ms linear both;
}

.lamp-snapshot {
  left: var(--lamp-x);
  top: var(--lamp-y);
  z-index: 5;
  width: 88px;
  height: 112px;
  transform: translate(-50%, -35%) rotate(var(--lamp-angle));
  transform-origin: 50% 35%;
  animation: login-lamp-release 1100ms ease-out both;
}

.lamp-snapshot > span {
  position: absolute;
}

.lamp-adapter {
  top: 15.4px;
  left: 18.3px;
  width: 51.4px;
  height: 13.3px;
  border-radius: 4px;
  background: linear-gradient(90deg, #080b0f, #343a41 48%, #0d1014);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.1), 0 6px 10px rgba(0, 0, 0, 0.3);
}

.lamp-joint {
  top: 25.9px;
  left: 36.4px;
  width: 15.2px;
  height: 17.1px;
  border-radius: 5px;
  background: linear-gradient(90deg, #0d1116, #5d646b 50%, #11161c);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.1);
}

.lamp-barrel {
  top: 34.4px;
  left: 5px;
  width: 78.1px;
  height: 41.9px;
  border-radius: 18px 18px 24px 24px / 10px 10px 15px 15px;
  background: linear-gradient(90deg, #07090c, #252b31 28%, #50575e 48%, #1a1f25 70%, #07090c);
  box-shadow: inset 0 2px rgba(255, 255, 255, 0.1), 0 14px 24px rgba(0, 0, 0, 0.38);
}

.lamp-heat-ring {
  left: 6.1px;
  z-index: 1;
  width: 75.7px;
  height: 2.4px;
  border-radius: 50%;
  background: linear-gradient(90deg, #0b0e12, #4b5259 46%, #11161b);
  box-shadow: 0 1px rgba(255, 255, 255, 0.06), 0 2px 3px rgba(0, 0, 0, 0.45);
}

.lamp-heat-ring--one {
  top: 39px;
}

.lamp-heat-ring--two {
  top: 47.5px;
}

.lamp-bezel {
  top: 72.3px;
  left: 0;
  z-index: 2;
  width: 88px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(90deg, #07090c, #252a30 46%, #080a0d);
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.09), 0 5px 10px rgba(0, 0, 0, 0.42);
}

.lamp-lens {
  top: 71.1px;
  left: 9.7px;
  z-index: 3;
  width: 68.6px;
  height: 9.5px;
  border-radius: 50%;
  background: radial-gradient(ellipse, #fff9e9 0 18%, #ffc77e 31%, #6a472f 53%, #07090c 72%);
  box-shadow: 0 0 22px rgba(255, 179, 107, 0.56), inset 0 0 8px rgba(0, 0, 0, 0.62);
}

.swap-shield,
.reveal-panel {
  background: var(--transition-cover);
}

.swap-shield {
  inset: 0;
  z-index: 2;
  opacity: 0;
  animation: login-swap-shield 1100ms linear both;
}

.route-cover {
  inset: 0;
  z-index: 1;
  opacity: 0;
  animation: login-curtain-handoff 1100ms linear both;
}

.reveal-panel {
  --edge-softness: clamp(10px, 1.4vmin, 18px);
  z-index: 1;
  opacity: 1;
}

.reveal-panel::after {
  position: absolute;
  content: '';
  pointer-events: none;
}

.reveal-panel--top {
  inset: 0 0 auto;
  height: calc(var(--light-y) + 1px);
  will-change: height, opacity;
  animation: login-dashboard-open-top 1100ms linear both;
}

.reveal-panel--top::after {
  top: 100%;
  right: 0;
  left: 0;
  height: var(--edge-softness);
  background: linear-gradient(180deg, rgba(255, 239, 205, 0.72), transparent);
}

.reveal-panel--bottom {
  inset: auto 0 0;
  height: calc(100% - var(--light-y) + 1px);
  will-change: height, opacity;
  animation: login-dashboard-open-bottom 1100ms linear both;
}

.reveal-panel--bottom::after {
  right: 0;
  bottom: 100%;
  left: 0;
  height: var(--edge-softness);
  background: linear-gradient(0deg, rgba(255, 239, 205, 0.72), transparent);
}

.reveal-panel--left {
  inset: 0 auto 0 0;
  width: calc(var(--light-x) + 1px);
  will-change: width, opacity;
  animation: login-dashboard-open-left 1100ms linear both;
}

.reveal-panel--left::after {
  top: 0;
  bottom: 0;
  left: 100%;
  width: var(--edge-softness);
  background: linear-gradient(90deg, rgba(255, 239, 205, 0.72), transparent);
}

.reveal-panel--right {
  inset: 0 0 0 auto;
  width: calc(100% - var(--light-x) + 1px);
  will-change: width, opacity;
  animation: login-dashboard-open-right 1100ms linear both;
}

.reveal-panel--right::after {
  top: 0;
  right: 100%;
  bottom: 0;
  width: var(--edge-softness);
  background: linear-gradient(270deg, rgba(255, 239, 205, 0.72), transparent);
}

.is-fade .beam-aperture,
.is-fade .lamp-snapshot,
.is-fade .route-cover {
  display: none;
}

.is-fade .swap-shield {
  animation: login-route-fade 1100ms ease both;
}

@keyframes login-beam-fan-open {
  0% {
    clip-path: polygon(
      var(--beam-start-1-x) var(--beam-start-1-y),
      var(--beam-start-2-x) var(--beam-start-2-y),
      var(--beam-start-3-x) var(--beam-start-3-y)
    );
    animation-timing-function: cubic-bezier(0.24, 0.02, 0.14, 1);
  }
  56%,
  100% {
    clip-path: polygon(
      var(--beam-end-1-x) var(--beam-end-1-y),
      var(--beam-end-2-x) var(--beam-end-2-y),
      var(--beam-end-3-x) var(--beam-end-3-y)
    );
  }
}

@keyframes login-beam-brightness {
  0% {
    opacity: 0.08;
  }
  16% {
    opacity: 0.18;
  }
  40% {
    opacity: 0.52;
  }
  56%,
  64% {
    opacity: 1;
  }
  68%,
  100% {
    opacity: 0;
  }
}

@keyframes login-swap-shield {
  0%,
  52% {
    opacity: 0;
  }
  56%,
  64% {
    opacity: 1;
  }
  68%,
  100% {
    opacity: 0;
  }
}

@keyframes login-lamp-release {
  0%,
  10% {
    opacity: 1;
    transform: translate(-50%, -35%) rotate(var(--lamp-angle));
  }
  100% {
    opacity: 0;
    transform: translate(-50%, calc(-35% - 300px)) rotate(var(--lamp-angle));
  }
}

@keyframes login-curtain-handoff {
  0%,
  55% {
    opacity: 0;
  }
  56%,
  100% {
    opacity: 1;
  }
}

@keyframes login-dashboard-open-top {
  0%,
  64% {
    height: calc(var(--light-y) + 1px);
    opacity: 1;
  }
  94%,
  100% {
    height: 0;
    opacity: 0;
  }
}

@keyframes login-dashboard-open-bottom {
  0%,
  64% {
    height: calc(100% - var(--light-y) + 1px);
    opacity: 1;
  }
  94%,
  100% {
    height: 0;
    opacity: 0;
  }
}

@keyframes login-dashboard-open-left {
  0%,
  64% {
    width: calc(var(--light-x) + 1px);
    opacity: 1;
  }
  94%,
  100% {
    width: 0;
    opacity: 0;
  }
}

@keyframes login-dashboard-open-right {
  0%,
  64% {
    width: calc(100% - var(--light-x) + 1px);
    opacity: 1;
  }
  94%,
  100% {
    width: 0;
    opacity: 0;
  }
}

@keyframes login-route-fade {
  0% {
    opacity: 0;
  }
  16% {
    opacity: 0.18;
  }
  40% {
    opacity: 0.52;
  }
  56%,
  64% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

@media (max-width: 760px) {
  .lamp-snapshot {
    transform: translate(-50%, -35%) rotate(var(--lamp-angle)) scale(0.78);
  }
}
</style>
