# 3D 按需渲染与隐藏 Tab 暂停更新设计

## 目标

在不降低视觉效果、不改变 420ms Tab 过渡、不破坏滚动与离场画面的前提下，降低页面静止时的 GPU 占用，并阻止隐藏 Tab 因实时设备数据或图表数据变化继续执行不必要的渲染工作。

## 非目标

- 不修改 Tab 的视觉方向、时长、缓动、毛玻璃、阴影或 3D 材质质量。
- 不降低 Three.js 像素比、抗锯齿、阴影数量、纹理尺寸或灯光质量。
- 不重构为动态组件或 `KeepAlive`，避免重新引入滚动、尺寸恢复和过渡重叠问题。
- 不改变 WebSocket 数据接收、设备状态合并或接口请求行为。

## 方案概述

采用两个相互独立、可分别测试的机制：

1. Three.js 场景使用按需渲染调度器。场景静止后停止 `requestAnimationFrame`；镜头、阻尼、设备、分区、纹理、拖动或尺寸发生变化时自动恢复，并在变化结束后再次停止。
2. Dashboard 为 main、flow、settings 三个 Tab 分别维护活动设备快照。只有对应 Tab 活跃时，快照才跟随实时设备数据更新；隐藏时保留最后一次完整状态，重新进入时一次性同步最新数据。

FlowOverview 同时使用 `active` 门控读取 `flowCache`，从而避免隐藏后触发 Chart.js 的深度监听和图表重建。

## 3D 按需渲染

### 调度器边界

新增独立调度器模块，接受以下依赖：

- `shouldRun(): boolean`：当前 Tab 活跃、页面可见且 Three.js 资源存在时返回 true。
- `update(): boolean`：执行一次 OrbitControls 阻尼更新，并返回镜头是否仍在变化。
- `render(): void`：执行一次 `renderer.render(scene, camera)`。
- 可注入的 `requestFrame` 与 `cancelFrame`，用于单元测试。

调度器暴露：

- `invalidate()`：声明场景已变化，确保至少渲染一帧。
- `stop()`：立即取消等待中的动画帧并清除运行状态。
- `isRunning()`：供测试确认调度器是否已进入空闲。

### 运行规则

每个动画帧先消费一次失效标记，再调用 OrbitControls 的 `update()`：

- 场景被失效或阻尼仍在变化时渲染。
- 阻尼仍在变化、或当前帧执行过程中又收到失效请求时，安排下一帧。
- 没有变化时不再安排下一帧，进入空闲状态。
- Tab 隐藏、文档不可见或组件卸载时立即停止。

### 失效来源

下列事件必须调用 `invalidate()`：

- Three.js 初始化完成。
- OrbitControls 发出 `change`。
- 设备、分区、活动分区或选中状态改变并同步到场景。
- 自定义灯位拖动或布局视觉更新。
- 镜头预设动画的每一步。
- 容器尺寸变化。
- 精品材质纹理加载完成并应用。
- Tab 重新激活或浏览器页面从隐藏恢复。

这保证静态画面停帧，但任何可见变化都不会丢帧或延迟到下一次用户交互。

## 隐藏 Tab 暂停更新

### 活动数组快照

新增 `useActiveArraySnapshot` composable：

```ts
function useActiveArraySnapshot<T extends object>(
  source: () => readonly T[],
  active: () => boolean,
): ShallowRef<T[]>
```

内部使用带条件分支的 `watchEffect`：

- `active()` 为 true 时读取源数组，并为每个元素创建浅拷贝快照。
- `active()` 为 false 时不读取源数组，使 Vue 在下一轮依赖清理后取消对源数据的订阅。
- 隐藏期间保留最后一次快照，不清空、不销毁组件。
- 再次激活时读取最新源数据并一次性替换快照。

Dashboard 创建三个快照：

- `mainDevices`：供 DeviceGrid、ThreeLightingLayout 和主页面设备相关组件使用。
- `flowDevices`：供 FlowOverview 的在线数量与平均亮度统计使用。
- `settingsDevices`：供 FlowMonitorPanel 与 ArmControlPanel 使用。

业务事件处理仍然读取 Dashboard 中的实时 `devices`，快照只作为渲染输入，不改变数据真实性或提交行为。

### Flow 数据门控

FlowOverview 增加必填 `active: boolean`：

- 活跃时读取 `flowCache` 并更新内部图表数据引用。
- 隐藏时不读取 `flowCache`，保留现有 canvas 和最后一次图表数据。
- 重新进入时一次性应用最新缓存。

不会在 Tab 离场时销毁图表，因此 420ms 离场动画中的图表保持完整。Chart.js 组件现有的深度监听只有在内部数据引用真正变化时才触发。

## 视觉与交互保证

- Tab 离场页面仍使用现有 DOM 与 canvas，不会出现空白、闪烁或组件突然消失。
- Three.js 镜头拖动与阻尼保持当前帧率和时长；只在完全静止后停帧。
- 镜头预设的 620ms 动画保持不变。
- 设备状态在当前可见 Tab 中仍实时更新。
- 隐藏 Tab 重新打开时展示最新状态，而不是逐条补播隐藏期间的变化。
- 现有滚动位置恢复、页面高度保护和 420ms 页面推移逻辑不变。

## 测试策略

### 按需渲染调度器

使用可控的帧队列验证：

1. `invalidate()` 只启动一个帧循环。
2. 无阻尼变化时渲染一帧后停止。
3. `update()` 持续返回 true 时继续渲染，返回 false 后停止。
4. 运行中再次 `invalidate()` 不会创建并行 RAF。
5. `shouldRun()` 为 false 或调用 `stop()` 时不再渲染。

### 活动快照

使用 Vue `ref`、`nextTick` 与 `effectScope` 验证：

1. 初始隐藏时源数据变化不会更新快照。
2. 激活时立即同步并生成不同对象引用的快照。
3. 活跃期间源数据更新会同步。
4. 再次隐藏后源数据变化不会更新快照。
5. 重新激活时一次性获得最新状态。

### 集成约束

扩展现有 Tab 性能结构测试，确认：

- Dashboard 的三个重型 Tab 使用各自的活动快照。
- ThreeLightingLayout 仍接收 `activeTab === 'main'`。
- FlowOverview 接收活动状态。
- 原有四个独立 Transition、滚动恢复和 420ms 过渡结构没有改变。

最后运行聚焦测试、完整 Node 测试套件和 `npm run build`。

## 风险与控制

- **遗漏失效来源**：通过搜索所有 Three.js 状态写入点，并以初始化、交互、数据、纹理、尺寸、可见性六类集成约束覆盖。
- **浅快照包含嵌套响应式对象**：设备更新当前以替换顶层设备对象为主；渲染组件需要的嵌套结构由顶层浅拷贝固定引用。若测试发现嵌套对象被原地修改，仅对对应字段做定向克隆，不做全量深拷贝。
- **进入 Tab 时短暂旧数据**：活动状态变化会触发同步快照，Vue 在同一更新周期内完成，不增加人工延时。
- **OrbitControls 阻尼提前停止**：调度器以 `controls.update()` 的返回值作为继续条件，而不是使用固定帧数或定时器。

## 完成标准

- 3D 场景静止时不再存在持续 RAF 渲染循环。
- 所有当前可见的 3D 交互和动画保持现有视觉质量。
- 隐藏 main、flow、settings 后，对应渲染输入不再随实时设备数据更新。
- 重新进入任一 Tab 后立即显示最新数据。
- Tab 切换无重叠、无截断、可正常滚动。
- 聚焦测试、完整测试与生产构建通过；若存在与本任务无关的既有失败，单独记录。
