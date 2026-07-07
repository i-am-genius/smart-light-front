# SidebarNav.vue Canvas 折射层修改记录

## 修改日期

2026-07-05

## 修改文件

`src/components/layout/SidebarNav.vue`

---

## 一、模板变更

### 删除
```html
<!-- 旧的 indicator 细条 -->
<div class="indicator" :class="'phase-' + phase" :style="indicatorStyle" />
```

### 新增 (ul 后面)

```html
<!-- Canvas 折射层 — z-index:5，在 ul 和 pill 之间 -->
<canvas ref="refractionCanvas" class="refraction-canvas" />

<!-- 玻璃胶囊 — z-index:10，可拖拽，替代旧 indicator -->
<div ref="pillRef" class="pill-indicator"
     :class="{ 'pill-dragging': isDragging, 'pill-snapping': isSnapping }"
     :style="pillStyle"
     @pointerdown.prevent="onPillDown" />
```

---

## 二、脚本变更 ( `<script setup>` )

### 删除的变量/函数
| 删除项 | 说明 |
|--------|------|
| `const phase = ref<'idle' \| 'collapse' \| 'slide' \| 'expand'>('idle')` | 旧 phase 状态机 |
| `let phaseTimer` | 旧动画定时器 |
| `function animateIndicator(key)` | 旧的 collapse→slide→expand 阶段动画 |
| `const indicatorStyle = computed(...)` | 旧的细条样式计算 |
| `function getTabRect(key)` | 旧的 tab 矩形（返回 cx/cy/w） |

### 新增的变量
```typescript
const pillRef = ref<HTMLElement | null>(null)          // pill DOM ref
const isDragging = ref(false)                            // 拖拽中
const isSnapping = ref(false)                            // 弹簧吸附中
const dragRect = ref<{x,y,w,h} | null>(null)            // 拖拽实时位置
const refractionCanvas = ref<HTMLCanvasElement | null>(null) // Canvas ref

// Canvas 折射参数
let bgCanvas: HTMLCanvasElement | null = null   // 离屏背景纹理
let bgCtx: CanvasRenderingContext2D | null = null
let SW = 0, SH = 0                              // sidebar 宽高
const REFRACTION_PAD = 10
const MAX_BEND = 16      // 像素位移量
const CHROMA = 0.9       // RGB 色散强度
const EDGE_BAND = 8      // 折射边缘带宽度(px)
```

### 新增的函数

| 函数 | 用途 |
|------|------|
| `getPillRectForKey(key)` | 返回 tab 对应的 pill 矩形 {x, y, w, h}，带负 padding 使 pill 略大于 tab |
| `currentPillRect()` | 返回当前 pill 的实际位置（拖拽中返回 dragRect，否则返回目标 tab 的 pill rect）|
| `onPillDown(e)` | pointerdown：捕获指针、记录偏移、开始拖拽、清理旧折射、渲染新折射 |
| `onPillMove(e)` | pointermove：更新 dragRect、清理旧折射区域、在新位置渲染折射 |
| `onPillUp(e)` | pointerup：释放指针、找最近 tab、触发 spring snap、渲染折射到 snap 位置 |
| `cleanupDrag()` | 移除 pointermove/pointerup 监听 |
| `clamp(v, min, max)` | 数值钳制 |
| `smoothstep(edge0, edge1, x)` | 平滑阶跃 |
| `getRoundedRectSDF(px, py, rx, ry, rw, rh, radius)` | 计算点到圆角矩形边缘的有符号距离 + 法线方向 |
| `sampleChannelBilinear(img, x, y, channel)` | 双线性采样 ImageData 的单个 R/G/B 通道 |
| `initRefractionCanvas()` | 初始化 canvas 尺寸、创建离屏 bgCanvas |
| `rebuildScene()` | 重建离屏背景纹理（渐变 + 噪点）+ 调整可见 canvas 尺寸 + 触发折射渲染 |
| `restoreRefractionRegion(rect)` | `clearRect` 清空指定区域回透明 |
| `renderRefractionAtRect(rect)` | 核心折射渲染：在 pill 边缘 0~8px 带内做像素位移 + RGB 色散 |

### 修改的函数

| 函数 | 改动 |
|------|------|
| `handleTabClick(key)` | 追加：restore 旧位置折射 → render 新位置折射 |
| `watch modelValue` | 追加：同上 |
| `onResize()` | 追加：`nextTick(() => rebuildScene())` |
| `onMounted()` | 追加：`initRefractionCanvas()` |
| `onBeforeUnmount()` | 追加：`cleanupDrag()` |

### 新增 watch
```typescript
watch([isDragging, isSnapping], () => {
  if (!isDragging.value && !isSnapping.value) {
    nextTick(() => {
      const rect = currentPillRect()
      if (rect) { rebuildScene(); }
    })
  }
})
```

---

## 三、CSS 变更

### 删除
```css
.indicator { ... }        /* 旧的细条指示器 */
.phase-idle { ... }       /* 旧的阶段过渡 */
.phase-collapse { ... }
.phase-slide { ... }
.phase-expand { ... }
.sidebar li:hover { transform: translateX(2px); }
.sidebar li:active { transform: translateX(2px) scale(0.98); }
```

### 修改
- `.sidebar`: 添加 `touch-action: none; overflow: hidden;`
- `.sidebar ul`: 添加 `position: relative; z-index: 2;`
- `.sidebar li`: 改为 `border-radius: 999px`（胶囊形），移除旧的 `.active`/`:hover` 背景色，颜色改为 `#475569`
- `.sidebar li.active`: 改为 `color: #1d4ed8; font-weight: 650;`（只变色不加背景，背景由 pill 负责）
- `.sidebar-icon`: opacity 从 0.7 改为 0.65
- `.sidebar-nav-text`: 添加 `position: relative; z-index: 3;`

### 新增
```css
/* Canvas 折射层 */
.refraction-canvas {
  position: absolute; inset: 0; width: 100%; height: 100%;
  z-index: 5; pointer-events: none; border-radius: 14px;
}

/* Glass pill */
.pill-indicator { ... }    /* 玻璃胶囊样式 — 5层 box-shadow */
.pill-dragging { ... }     /* 拖拽放大 + 加深阴影 */
```

### Night mode 新增
```css
:global(.night-mode) .pill-indicator { ... }
:global(.night-mode) .pill-dragging { ... }
```

### Mobile 新增
```css
.pill-indicator { border-radius: 999px; }
```

---

## 四、当前已知问题

### 问题 1：bgCanvas 纹理不反映真实 DOM 内容

`rebuildScene()` 在离屏 bgCanvas 上绘制的是：
- 一个浅色渐变 (`#f8fafc` → `#eef4fb`)
- 300 个随机噪点 (`rgba(148,163,184,0.06)`)

**问题**：折射采样源是固定的渐变+噪点，不包含 tab 文字、图标等真实 UI 内容。当 pill 移动到不同 tab 上方时，折射采样到的纹理永远是一样的噪点，不会因为下方文字不同而变化。

**影响**：折射效果的"色散"只是对噪点纹理做 RGB 偏移，视觉上极为微弱。

### 问题 2：每次 rebuildScene 都重新随机生成噪点

`rebuildScene()` 用 `Math.random()` 生成噪点位置，每次调用都产生不同的纹理。拖拽过程中高频调用，视觉上可能出现噪点"闪烁"。

### 问题 3：没有在 snap 动画期间更新 Canvas

pill 的 CSS transition（spring ease）负责 snap 动画期间的 pill 视觉移动，但 Canvas 折射只在动画开始和结束时渲染，动画中间帧没有更新折射区域位置。pill 边缘可能存在"折射脱节"。

### 问题 4：bgCanvas 与可见 canvas 的纹理耦合

折射采样自 bgCanvas 的 ImageData，但 bgCanvas 内容是预生成的固定纹理（渐变+噪点），与 pill 下方实际经过的 DOM 内容（tab 文字/图标）毫无关联。理想的折射应该采样 pill 覆盖区域的真实像素，但这需要从 DOM 抓取或使用更复杂的截图方案。

---

## 五、数据结构对比

| | 旧 (indicator) | 新 (pill) |
|---|---|---|
| 形状 | 细条 (4px 宽) | 胶囊 (999px border-radius) |
| 定位 | 基于 cx/cy + w | 基于 x/y + w/h |
| 拖拽 | 不支持 | pointer events + spring snap |
| 选中动画 | 4-phase 状态机 | CSS transition + spring cubic-bezier |
| 视觉 | 纯色蓝条 | 5层玻璃 box-shadow + backdrop-filter |
| Canvas | 无 | SDF 像素折射层 |
