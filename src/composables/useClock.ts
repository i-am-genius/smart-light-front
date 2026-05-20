import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { pad2 } from '../utils/format'

const weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function useClock() {
  const now = ref(new Date())
  let timer: number | null = null

  const currentTime = computed(() => {
    const d = now.value
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
  })

  const dateInfo = computed(() => {
    const d = now.value
    return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`
  })

  const weekInfo = computed(() => weekMap[now.value.getDay()])

  onMounted(() => {
    timer = window.setInterval(() => {
      now.value = new Date()
    }, 1000)
  })

  onBeforeUnmount(() => {
    if (timer) window.clearInterval(timer)
  })

  return {
    now,
    currentTime,
    dateInfo,
    weekInfo,
  }
}