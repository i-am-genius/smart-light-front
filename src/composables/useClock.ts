import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

const weekMap = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

export function useClock() {
  const now = ref(new Date())
  let timer: number | null = null

  const currentTime = computed(() => {
    const d = now.value
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  })

  const dateInfo = computed(() => {
    const d = now.value
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`
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