<template>
  <span class="odometer">
    <template v-if="props.value == null">
      <span class="odometer-placeholder">--</span>
    </template>
    <template v-else>
      <span
        v-for="(col, ci) in columns"
        :key="ci"
        class="odometer-col"
        :class="{ dot: col.dot }"
        :style="{ width: col.dot ? '0.3em' : '0.6em', height: digitHeight + 'px' }"
      >
        <span
          class="odometer-roll"
          :style="{
            transform: `translateY(-${col.offset * digitHeight}px)`,
            transitionDuration: `${0.4 + ci * 0.04}s`,
          }"
        >
          <span v-for="(n, ni) in col.digits" :key="ni" class="odometer-num" :style="{ height: digitHeight + 'px' }">
            {{ n }}
          </span>
        </span>
      </span>
    </template>
    <span v-if="suffix" class="odometer-suffix">{{ suffix }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  value: number | null | undefined
  decimals?: number
  suffix?: string
  digitHeight?: number
}>(), {
  decimals: 1,
  digitHeight: 28,
})

const digitHeight = computed(() => props.digitHeight)
const displayValue = ref(0)
const prevDigits = ref<number[]>([])
const integerWidth = ref(1)

interface Col {
  digits: string[]
  offset: number
  dot: boolean
}

function getIntegerWidth(val: number) {
  return Math.max(1, Math.floor(Math.abs(val)).toString().length)
}

function formatValue(val: number) {
  const fixed = Number(val).toFixed(props.decimals)
  const [intPart, decimalPart] = fixed.split('.')
  const paddedInt = intPart.padStart(integerWidth.value, '0')
  return decimalPart != null ? `${paddedInt}.${decimalPart}` : paddedInt
}

const columns = computed<Col[]>(() => {
  const str = formatValue(displayValue.value)
  const cols: Col[] = []

  let digitIndex = 0

  for (const ch of str) {
    if (ch === '.') {
      cols.push({ digits: ['.'], offset: 0, dot: true })
    } else {
      const target = Number(ch)
      const prev = prevDigits.value[digitIndex] ?? 0
      const offset = target >= prev ? target : target + 10
      const digits: string[] = []
      for (let i = 0; i < 20; i++) {
        digits.push(String(i % 10))
      }
      cols.push({ digits, offset, dot: false })
      digitIndex++
    }
  }

  return cols
})

function rollTo(val: number) {
  integerWidth.value = Math.max(integerWidth.value, getIntegerWidth(val))

  const oldStr = formatValue(displayValue.value)

  prevDigits.value = oldStr
    .split('')
    .filter(ch => ch !== '.')
    .map(Number)

  displayValue.value = Number(val)
}

function rollInFromZero(val: number) {
  integerWidth.value = getIntegerWidth(val)
  displayValue.value = 0

  const zeroStr = formatValue(0)
  prevDigits.value = zeroStr
    .split('')
    .filter(ch => ch !== '.')
    .map(Number)

  nextTick(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rollTo(val)
      })
    })
  })
}

watch(() => props.value, (v, oldV) => {
  if (v == null) return

  if (oldV == null) {
    rollInFromZero(Number(v))
  } else {
    rollTo(Number(v))
  }
})

onMounted(() => {
  if (props.value != null) {
    rollInFromZero(Number(props.value))
  }
})

defineExpose({ rollTo })
</script>

<style scoped>
.odometer {
  display: inline-flex;
  align-items: center;
  vertical-align: middle;
}

.odometer-col {
  overflow: hidden;
  text-align: center;
}

.odometer-roll {
  display: flex;
  flex-direction: column;
  transition: transform 0.5s cubic-bezier(0.22, 0.1, 0.1, 1.0);
}

.odometer-num {
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  user-select: none;
}

.odometer-suffix {
  margin-left: 2px;
  font-weight: 800;
}

.odometer-placeholder {
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
</style>
