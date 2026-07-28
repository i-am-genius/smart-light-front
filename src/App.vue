<template>
  <router-view />
  <LoginBeamTransition />
  <ToastContainer />
</template>

<script setup lang="ts">
import LoginBeamTransition from './components/auth/LoginBeamTransition.vue'
import ToastContainer from './components/common/ToastContainer.vue'
</script>

<style>
.shake {
  animation: shakeX 0.4s ease both;
}

@keyframes shakeX {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  50% { transform: translateX(-4px); }
  70% { transform: translateX(4px); }
  90% { transform: translateX(-2px); }
}
</style>
