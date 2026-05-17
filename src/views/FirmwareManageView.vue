<template>
  <div class="redirect-view"></div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

onMounted(() => {
  router.replace({
    path: '/smartlightdashboard',
    query: { tab: 'firmware' },
  })
})
</script>

<style scoped>
.redirect-view {
  display: none;
}
</style>
