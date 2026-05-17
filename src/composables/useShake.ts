import { ref } from 'vue'

export function useShake() {
  const shaking = ref(false)

  function trigger() {
    if (shaking.value) return
    shaking.value = true
    setTimeout(() => {
      shaking.value = false
    }, 400)
  }

  return { shaking, trigger }
}
