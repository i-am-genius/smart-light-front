# 前端动效增强 — 设计规格

> 基于 2026-05-15 brainstorming 会话产出

## 范围总览

| # | 动效 | 范围 | 复杂度 |
|---|------|------|--------|
| 1 | Sidebar 水滴指示器 + 内容切换 | 桌面 + 移动 | 中 |
| 2 | 设备卡片入场 staggered fade-in | 桌面 + 移动 | 低 |
| 3 | 设备卡片删除动画 | 桌面 + 移动 | 低 |
| 4 | 实时概况数字滚动 (odometer) | 桌面 + 移动 | 高 |
| 5 | 设备在线/离线呼吸灯 | 桌面 + 移动 | 低 |
| 6 | 灯效亮度滑块数字反馈 | 桌面 + 移动 | 低 |
| 7 | 夜间模式切换渐变 | 桌面 + 移动 | 中 |
| 8 | Toast 提示 + 表单校验摇晃 | 桌面 + 移动 | 中 |

---

## 1. Sidebar 水滴指示器 + 内容切换

**文件**: `SidebarNav.vue`, `SmartLightDashboard.vue`

### 视觉效果

**桌面端（左侧竖排 sidebar）**:
- 当前选中 tab 左侧有蓝色竖线 (`::before`, 4px 宽)
- 点击新 tab → 当前竖线缩为圆点 (border-radius: 50%, 缩放 4px→8px, 200ms)
- 圆点沿 sidebar 滑到新 tab 位置: 380ms, `cubic-bezier(0.34, 1.56, 0.64, 1.0)` — 起始有加速度，末尾有轻微回弹超调再归位
- 圆点展开为新竖线 (border-radius→0, 4px高度→展开, 200ms)
- 阶段时序: 收缩 150ms → 滑动 380ms → 展开 200ms, 总时长 ~650ms

**Easing 详解**:
- 收缩阶段: `cubic-bezier(0.55, 0, 1, 0.45)` — 快速缩小，像被吸成水滴
- 滑动阶段: `cubic-bezier(0.34, 1.56, 0.64, 1.0)` — 先加速再减速，末尾微超调（回弹感），模拟水滴在表面滑动的物理感
- 展开阶段: `cubic-bezier(0.25, 0.1, 0.25, 1)` — 平滑展开无回弹

**移动端（底部横排 tab）**:
- 当前选中 tab 下方有水平短横线 (`::before`, 60% 宽, 3px 高)
- 切换逻辑同桌面端: 横线→圆点→滑行→横线，但水平滑动

### 内容区淡入

- `SmartLightDashboard.vue` 的 `<section v-show="activeTab === ...">` 改为 `<Transition name="tab-fade">` 包裹
- 交叉淡入淡出 200ms，旧内容 opacity→0，新内容 opacity→1 延迟 100ms

---

## 2. 设备卡片入场 staggered fade-in

**文件**: `DeviceGrid.vue`, `DeviceCard.vue`

- `<TransitionGroup>` 包裹卡片列表
- 每张卡片: translateY(20px) + opacity 0 → translateY(0) + opacity 1, 300ms
- delay: `index * 60ms`，用 JS `transitionDelay` 绑定
- 仅在首次加载时触发（通过 key 变化控制）

---

## 3. 设备卡片删除动画

**文件**: `DeviceGrid.vue`, `DeviceCard.vue`

- `<TransitionGroup name="device-list" move>` 
- leave 动画: scale(1→0.85) + opacity(1→0), 250ms
- move 动画: 其他卡片平滑上移填充空位, 300ms ease

---

## 4. 实时概况数字滚动 (odometer)

**文件**: 新建 `src/components/common/OdometerRoll.vue`

### 实现方案

- 单个数字列的 div 容器，`overflow: hidden`
- 内部数字 0-9 竖排，通过 `transform: translateY(-target * digitHeight)` 滚动到目标值
- 每位数字独立滚动，不同位数可为不同速度制造 cascade 感
- 支持整数和小数点（小数点固定位置不滚动）
- Props: `value: number`, `decimals: number`
- 暴露 `startRoll(targetValue)` 方法

### 集成点

`SmartLightDashboard.vue` 的 `stat-value` 数字用 `<OdometerRoll>` 替换
watch `envInfo.temp/apparentTemp/humidity` 变化时调用 `startRoll`

---

## 5. 设备在线/离线呼吸灯

**文件**: `DeviceCard.vue`

- 在线状态指示点添加 `@keyframes breathe`
- `0%, 100%`: scale(1), opacity(0.9)
- `50%`: scale(1.3), opacity(0.5)
- `animation: breathe 2s ease-in-out infinite`
- 离线状态: 无动画，灰色静态

---

## 6. 灯效亮度滑块数字反馈

**文件**: `LightEffectMiniPanel.vue`

- 亮度百分比数字 (`effect-brightness-header strong`) 在滑块 `:active` 时:
  - transform: scale(1.4)
  - color: #2563eb (亮蓝)
  - transition: 150ms ease
- 松手后恢复: 300ms ease

---

## 7. 夜间模式切换渐变

**文件**: `SmartLightDashboard.vue`

### 方案

- `.app-container` 添加 `transition: background 0.4s ease, color 0.4s ease`
- 夜间模式相关的 `:deep()` 覆盖规则去掉 `!important` 的 filter/backdrop-filter 冲突
- 关键: 夜间模式背景图层 (`::before`) 也加 0.4s transition
- 所有卡片/文本颜色变化走 transition 而非瞬间切换

---

## 8. Toast 提示 + 表单校验摇晃

### Toast

**文件**: 新建 `src/components/common/ToastMessage.vue`

- `<Teleport to="body">` 固定在页面顶部居中 (top: 24px, z-index: 9999)
- 类型: success (绿) / error (红)
- 动画: translateY(-20px)→translateY(0), opacity 0→1, 300ms cubic-bezier
- 自动关闭: 2.5s 后反向动画消失
- 通过 composable `useToast()` 全局调用: `const toast = useToast(); toast.show('保存成功', 'success')`

### 表单校验摇晃 (Shake)

**文件**: `src/composables/useShake.ts`

- `@keyframes shake`: 0%→25%→50%→75%→100%: translateX(0→-4px→4px→-4px→0)
- composable: `useShake(ref)` 返回 `triggerShake()` 
- 在登录/注册/店铺设置的表单校验失败时调用
- 输入框添加 `.shake` class 触发动画，400ms 后自动移除

---

## 实现优先级

| 优先级 | 动效 | 原因 |
|--------|------|------|
| P0 | Sidebar 水滴指示器 | 核心需求 |
| P0 | 夜间模式渐变 | 改动小，效果明显 |
| P1 | Toast + Shake | 新建组件，独立性强 |
| P1 | 设备卡片入场/删除 | 改动集中 |
| P1 | 在线/离线呼吸灯 | 纯 CSS |
| P2 | 灯效滑块反馈 | 纯 CSS |
| P2 | 数字滚动 odometer | 最复杂，最后做 |

---

## 不改动

- 现有动画 (iOS panel, modal, button hover, base-select dropdown, loop effect) 保持不变
- 桌面端和移动端样式断点 (`@media max-width`) 不变
- 夜间模式 `filter:none !important` 策略需要调整但保留夜间模式的防模糊能力
