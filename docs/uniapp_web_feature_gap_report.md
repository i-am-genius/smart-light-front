# uniapp 与 Web 功能差异核对报告

## 1. 核对范围

本次核对以 `E:\smart-light-front` 作为 Web 前端项目，以 `E:\smart-light-mini` 作为 uniapp 移动端项目。另发现当前工作目录 `E:\smart-light-front - uniapp` 也是一个 Vue/Vite 副本，但 `E:\smart-light-front` 与用户指定目录一致且包含更多模块（如固件、灯效、天气），因此报告以 `E:\smart-light-front` 为 Web 端基准。

已检查范围：

- Web 页面与路由：`src/router/index.ts`、`src/views/LoginView.vue`、`src/views/RegisterView.vue`、`src/views/StoreSetup.vue`、`src/views/SmartLightDashboard.vue`、`src/views/StoreProfileView.vue`、`src/views/FirmwareManageView.vue`。
- Web 组件入口：`src/components/layout/SidebarNav.vue`、`src/components/device/*`、`src/components/flow/*`、`src/components/settings/*`、`src/components/firmware/FirmwareManagePanel.vue`。
- Web API：`src/api/auth.ts`、`src/api/device.ts`、`src/api/ai.ts`、`src/api/duration.ts`、`src/api/lux.ts`、`src/api/analytics.ts`、`src/api/store.ts`、`src/api/lightEffect.ts`、`src/api/weather.ts`、`src/composables/useWebSocket.ts`。
- uniapp 页面与路由：`src/pages.json`、`src/pages/login/login.vue`、`src/pages/device/index.vue`、`src/pages/device-detail/index.vue`、`src/pages/device-add/index.vue`、`src/pages/flow/index.vue`、`src/pages/settings/index.vue`、`src/pages/arm/index.vue`、`src/pages/effect/index.vue`。
- uniapp API：`src/api/auth.ts`、`src/api/device.ts`、`src/api/arm.ts`、`src/api/duration.ts`、`src/api/lux.ts`、`src/api/store.ts`、`src/api/effect.ts`、`src/utils/websocket.ts`。

## 2. Web 端功能概览

| 模块 | 功能 | 对应页面/组件 | 对应 API | 备注 |
|---|---|---|---|---|
| 认证 | 登录、记住账号、登录后按店铺状态跳转 | `src/views/LoginView.vue`、`src/router/index.ts` | `POST /api/auth/login` | 使用 `localStorage/sessionStorage` 保存 TOKEN、USER_INFO、storeSetup。 |
| 认证 | 注册并自动登录 | `src/views/RegisterView.vue` | `POST /api/auth/register`、`POST /api/auth/login` | uniapp 未发现注册页面。 |
| 店铺 | 首次店铺初始化 | `src/views/StoreSetup.vue` | `POST /api/store/setup` | 路由守卫会强制未配置店铺用户先初始化。 |
| 店铺 | 店铺资料查看与编辑 | `src/views/StoreProfileView.vue` | `GET /api/store/current`、`POST /api/store/setup` | 支持省市、面积、风格保存。 |
| 主导航 | Dashboard 四个 tab：主控、人流、设置、固件管理 | `src/views/SmartLightDashboard.vue`、`src/components/layout/SidebarNav.vue` | 多模块 API | `firmware-manage` 路由重定向到 dashboard 的 firmware tab。 |
| 设备 | 设备列表、在线状态、扫描待添加设备 | `src/views/SmartLightDashboard.vue`、`src/components/device/DeviceGrid.vue` | `GET /admin/device/my-list`、`GET /admin/device/online-list` | 扫描依赖 WebSocket `announce`。 |
| 设备 | 新增设备 | `src/components/device/DeviceAddModal.vue` | `POST /admin/device/create` | 支持扫描结果带入。 |
| 设备 | 设备编辑、删除 | `src/components/device/DeviceCard.vue` | `PUT /admin/device/update/{id}`、`DELETE /admin/device/delete/{id}` | uniapp 未发现删除接口封装。 |
| 设备控制 | 亮度、色温、自动模式、推荐值 | `src/components/device/DeviceCard.vue`、`src/components/device/LightEffectMiniPanel.vue` | `PUT /admin/device/update/{id}` | Web 端还有推荐理由和灯效快捷控制。 |
| 设备发现 | 扫描结果、取消扫描项、倒计时提示 | `src/views/SmartLightDashboard.vue` | WebSocket `/ws?token=...` | 前端不是 UDP，依赖后端 announce。 |
| WebSocket | 状态、在线、删除、lux、announce、人体检测等消息处理 | `src/views/SmartLightDashboard.vue`、`src/composables/useWebSocket.ts` | `/ws?token=...` | Web 端处理消息类型更多，含人体检测/停留刷新。 |
| AI | 面料识别、图片压缩上传、主色、置信度、推荐灯光、标注图 | `src/components/device/DeviceCard.vue` | `POST /admin/ai/fabric-recognize` | 支持 `annotatedImageBase64`、cloth 检测字段。 |
| 人流 | 今日停留摘要、热区图、排行 | `src/components/flow/FlowOverview.vue`、`HeatmapCard.vue` | `GET /admin/duration/summary` | 热区图和排行均存在。 |
| 人流 | 历史查询、最近 N 天查询 | `src/components/settings/DurationQueryPanel.vue` | `GET /admin/duration/summary` | 支持按日期范围查询。 |
| 人流/环境 | 多设备光照趋势 | `src/components/flow/LuxTrendCard.vue` | `GET /admin/lux/multi-trend` | 使用 Chart.js 展示。 |
| 人流/策略 | 温度-人流趋势、策略对比 | `src/components/flow/TempPeopleTrendCard.vue`、`StrategyCompareCard.vue` | `GET /admin/analytics/temp-people-trend`、`GET /admin/analytics/strategy-compare` | uniapp 未发现 analytics API。 |
| 人体检测 | 是否有人、最近检测时间、标注图/检测信息 | `src/components/settings/FlowMonitorPanel.vue`、`src/views/SmartLightDashboard.vue` | WebSocket 消息、`POST /admin/device/flow-upload/{chipId}` | 与摄像头灯节点关联。 |
| 灯效 | 全局灯效状态保存/关闭 | `src/components/device/LightEffectMiniPanel.vue` | `GET/POST /admin/light-effect/state`、`POST /admin/light-effect/close` | uniapp 仅封装单设备 effect。 |
| 灯效 | 单设备流水灯效 | `src/api/device.ts`、`src/components/device/LightEffectMiniPanel.vue` | `POST /admin/device/effect/{chipId}` | uniapp 已有类似接口。 |
| 云台/机械臂 | 上下左右、停止、归位、速度、滑轨位置 | `src/components/settings/ArmControlPanel.vue` | `POST /admin/device/arm/{chipId}` | Web API body 为 `{ action, speed, position? }`。 |
| 店铺平面 | 门店布局、设备拖拽定位、区域热区联动、定位设备 | `src/components/device/StoreLightLayout.vue` | `PUT /admin/device/update/{id}`、`POST /admin/device/locate/{chipId}` | PC 交互重，移动端不宜照搬。 |
| SmartConfig | 获取 WiFi、输入密码、开始/取消配网 | `src/components/settings/SmartConfigPanel.vue` | Android bridge `window.AndroidSmartConfig` | 非普通浏览器能力，需原生插件。 |
| OTA | 设备固件通道、检查更新、下发 OTA、进度展示 | `src/components/device/DeviceCard.vue` | `/admin/device/{chipId}/ota/*` | 设备卡详情内也展示 OTA 状态。 |
| OTA | 固件上传、历史列表、复制下载地址 | `src/components/firmware/FirmwareManagePanel.vue` | `POST /admin/device/ota/firmware/upload`、`GET /admin/device/ota/firmware/list` | 管理型功能，不一定适合小程序完整同步。 |
| 天气/环境 | 当前天气、区域环境信息 | `src/views/SmartLightDashboard.vue` | `GET /admin/weather/current` | 用于 Dashboard 环境参数。 |

## 3. uniapp 端功能概览

| 模块 | 功能 | 对应页面/组件 | 对应 API | 完成度 |
|---|---|---|---|---|
| 认证 | 登录、TOKEN 保存、无 TOKEN 跳转 | `src/pages/login/login.vue`、`src/api/auth.ts`、`src/api/http.ts` | `POST /api/auth/login` | 已完成 |
| 认证 | 注册 | 未发现 | 未发现 | 未发现 |
| 店铺 | 当前店铺信息查看 | `src/pages/settings/index.vue`、`src/api/store.ts` | `GET /api/store/current` | 部分完成 |
| 店铺 | 店铺初始化/编辑 | 未发现 | 未封装 `POST /api/store/setup` | 未发现 |
| 导航 | tabBar：设备、人流、设置 | `src/pages.json` | - | 已完成 |
| 导航 | 灯效控制普通页 | `src/pages/effect/index.vue`、`src/pages.json` | `src/api/effect.ts` | 入口缺失/部分完成 |
| 导航 | 机械臂普通页 | `src/pages/arm/index.vue`、`src/pages/settings/index.vue` | `src/api/arm.ts` | 部分完成 |
| 设备 | 设备列表、在线状态合并、刷新 | `src/pages/device/index.vue` | `GET /admin/device/my-list`、`GET /admin/device/online-list` | 已完成 |
| 设备 | 设备详情 | `src/pages/device-detail/index.vue` | `GET /admin/device/my-list`、`GET /admin/device/online-list` | 部分完成 |
| 设备 | 亮度/色温/自动模式保存 | `src/pages/device-detail/index.vue` | `PUT /admin/device/update/{id}` | 已完成 |
| 设备 | 新增设备、扫描结果带入 | `src/pages/device-add/index.vue`、`src/pages/device/index.vue` | `POST /admin/device/create`、WebSocket `announce` | 部分完成 |
| 设备 | 设备删除 | 未发现 | 未封装 `DELETE /admin/device/delete/{id}` | 未发现 |
| WebSocket | state/onlineStatus/deviceDeleted/lux/announce | `src/utils/websocket.ts`、`src/pages/device/index.vue` | `/ws?token=...` | 部分完成 |
| 人流 | 今日停留时长、热区排行、光照辅助 | `src/pages/flow/index.vue` | `GET /admin/duration/summary`、`GET /admin/lux/get-latest` | 部分完成 |
| 人流 | 历史查询、图表、analytics 趋势 | 未发现 | 未封装 analytics、多 lux 趋势接口 | 未发现 |
| 灯效 | 单设备暖光/冷光/自动/循环灯效 | `src/pages/effect/index.vue`、`src/api/effect.ts` | `POST /admin/device/effect/{chipId}`、`PUT /admin/device/update/{id}` | 部分完成 |
| 灯效 | 全局灯效状态 | 未发现 | 未封装 `/admin/light-effect/*` | 未发现 |
| AI | 面料识别、图片上传、推荐写回 | 未发现 | 未封装 `POST /admin/ai/fabric-recognize` | 未发现 |
| 人体检测 | 顾客/人体检测显示、标注图 | 未发现 | 未封装；WebSocket 未见专门处理 | 未发现 |
| 云台 | 摄像头灯节点选择、上下左右、停止、归位、速度 | `src/pages/arm/index.vue`、`src/api/arm.ts` | `POST /admin/device/arm/{chipId}` | 部分完成 |
| OTA | 固件管理、检查更新、下发 OTA | 未发现 | 未封装 OTA API | 未发现 |
| SmartConfig | 配网入口说明 | `src/pages/settings/index.vue` | 未封装 | 有页面入口但缺接口 |

## 4. 功能差异总表

| 功能模块 | Web 端状态 | uniapp 状态 | 差异说明 | 建议优先级 |
|---|---|---|---|---|
| 登录 | 完整 | 完整 | 均使用 `POST /api/auth/login` 和 Bearer TOKEN。 | - |
| 注册 | 完整 | 未发现 | Web 有注册页和注册 API；uniapp 没有注册入口。 | P1：建议补，适合比赛展示 |
| 店铺初始化 | 完整 | 未发现 | Web 登录后会强制未初始化用户进入店铺初始化；uniapp 只展示当前店铺。 | P0：必须补，影响核心使用 |
| 店铺编辑 | 完整 | 只读 | Web 可编辑店铺名称、区域、面积、风格；uniapp 设置页只读。 | P1：建议补，适合比赛展示 |
| 设备列表 | 完整 | 完整 | uniapp 已覆盖设备名称、状态、亮度、色温、自动模式等基础字段。 | - |
| 设备详情控制 | 完整 | 部分完成 | uniapp 可改亮度/色温/自动模式，但未展示 AI 识别、OTA、流量上传等 Web 详情能力。 | P0：必须补，影响核心使用 |
| 设备新增 | 完整 | 部分完成 | uniapp 支持手动添加/扫描添加，但缺删除、完整编辑、扫描倒计时清理等 Web 细节。 | P0：必须补，影响核心使用 |
| 设备删除 | 完整 | 未发现 | Web 有 `deleteDevice`；uniapp 未封装、无入口。 | P0：必须补，影响核心使用 |
| UDP/局域网发现 | Web 前端通过 WebSocket announce 展示 | uniapp 通过 WebSocket announce 展示 | 两端都不是直接 UDP；uniapp 仅做 10 秒等待窗口，细节少于 Web。 | P2：可后补，增强体验 |
| WebSocket 状态同步 | 完整 | 部分完成 | uniapp 只在设备页主动连接，Flow 页已改为 HTTP；Web 处理更多消息如人体检测/停留刷新。 | P1：建议补，适合比赛展示 |
| AI 面料识别 | 完整 | 未发现 | Web 有图片压缩上传、识别结果、推荐值、标注图；uniapp 无 API/页面。 | P1：建议补，适合比赛展示 |
| AI 推荐写回 | 完整 | 未发现 | Web 可把 fabric/mainColorRgb/recommendedBrightness/recommendedTemp 写回设备。 | P1：建议补，适合比赛展示 |
| 人体/顾客检测 | 部分完整 | 未发现 | Web 有 FlowMonitorPanel 和 WebSocket 检测消息处理；uniapp 未发现相关 UI。 | P1：建议补，适合比赛展示 |
| 人流热区 | 完整 | 部分完成 | uniapp 仅今日总停留、排行、最新光照；无热区图、历史查询、多趋势图。 | P1：建议补，适合比赛展示 |
| 人流历史/按日期查询 | 完整 | 未发现 | Web `DurationQueryPanel` 支持日期范围；uniapp 当前固定当天。 | P1：建议补，适合比赛展示 |
| 光照趋势 | 完整 | 部分完成 | Web 有 `/admin/lux/list`、`/admin/lux/multi-trend` 和图表；uniapp 只有 latest。 | P2：可后补，增强体验 |
| Analytics 策略对比 | 完整 | 未发现 | Web 有 `/admin/analytics/temp-people-trend`、`/admin/analytics/strategy-compare`；uniapp 无封装。 | P2：可后补，增强体验 |
| 灯效控制 | 完整 | 部分完成 | uniapp 有 `pages/effect/index.vue` 和单设备 effect，但设置页里灯效入口当前被注释，且无全局 `/admin/light-effect/*` 状态。 | P1：建议补，适合比赛展示 |
| 灯光场景/批量策略 | 部分完整 | 部分完成 | Web 通过 StoreSettingsPanel/LightEffectMiniPanel 管理场景策略；uniapp 仅单设备灯效。 | P2：可后补，增强体验 |
| 云台/机械臂 | 完整 | 部分完成 | Web API 为 `{ action, speed, position? }`；uniapp `arm.ts` 发送 `{ direction: camera:command:speed }`，与当前 Web API 形状不一致，需确认后端兼容性。 | P0：必须补，影响核心使用 |
| 云台滑轨/位置控制 | 完整 | 未发现 | Web 有 `slider_position`、`slide_left/right/stop`、position mm；uniapp 只有方向/停止/归位/速度。 | P2：可后补，增强体验 |
| 门店平面布局/定位 | 完整 | 未发现 | Web 有平面图、区域、拖拽、设备定位；移动端不适合完整照搬。 | P3：不建议照搬或暂不需要 |
| OTA 设备端更新 | 完整 | 未发现 | Web 设备详情有固件通道、检查更新、下发 OTA、进度展示；uniapp 无。 | P2：可后补，增强体验 |
| OTA 固件管理 | 完整 | 未发现 | Web 可上传固件、查看历史、复制下载地址；移动端完整管理不建议照搬。 | P3：不建议照搬或暂不需要 |
| SmartConfig 配网 | 完整入口，依赖 Android bridge | 只有占位入口 | uniapp 小程序端暂未接入原生 SmartConfig 能力；需评估小程序能力边界。 | P2：可后补，增强体验 |
| 天气/环境 | 完整 | 未发现 | Web 有 `/admin/weather/current`；uniapp 设置/人流页未展示天气环境。 | P2：可后补，增强体验 |

## 5. uniapp 已有但可能不完整的功能

| 功能 | 当前情况 | 缺失点 | 建议修复方式 |
|---|---|---|---|
| 设备详情 | `src/pages/device-detail/index.vue` 重新拉取设备列表并按 id 查找，支持亮度/色温/自动模式保存 | 未展示 `fabric`、`mainColorRgb`、AI 推荐原因/标注图、OTA 信息、流量上传开关 | 保留移动端简化结构，增加“AI 推荐”和“固件状态”折叠卡片。 |
| 设备新增/扫描 | `src/pages/device/index.vue` 使用 WebSocket `announce` 收集待添加设备，`src/pages/device-add/index.vue` 保存 | 无删除、完整编辑；扫描结果管理比 Web 简化 | 先补删除与编辑，再优化扫描结果清理/重复提示。 |
| WebSocket | `src/utils/websocket.ts` 是单例；设备页连接并处理 state/onlineStatus/deviceDeleted/lux/announce | 多页面同时使用时可能互相 close；未处理人体检测/OTA/更多状态消息 | 增加订阅者机制或页面级 callback registry，不急于重构业务。 |
| 人流页 | `src/pages/flow/index.vue` 展示今日停留、热区排行、光照辅助 | 无历史查询、按设备查询、多日趋势、图表、WebSocket 实时刷新 | 先加日期筛选和最近 7 天摘要，图表用移动端轻量卡片替代。 |
| 设置页 | `src/pages/settings/index.vue` 展示登录、店铺、夜间模式、设备统计、入口 | 店铺只读；配网只是 showToast；灯效入口在模板中被注释但方法存在 | 补店铺编辑或“进入店铺设置”；清理无效/注释入口。 |
| 灯效页 | `src/pages/effect/index.vue` 已注册普通页，`src/api/effect.ts` 封装单设备 effect | tabBar 不含灯效；设置页灯效入口被注释，设备页存在入口；无全局灯效状态 API | 明确入口策略：建议从设置页和设备页都保留入口，并补全局状态读取。 |
| 机械臂页 | `src/pages/arm/index.vue` 有摄像头灯选择、方向、速度、归位 | API body 与 Web `armControl` 不一致；无滑轨/位置控制；无当前角度/状态 | 先确认后端是否兼容 `{ direction }`，不兼容则改为 Web 同款 `{ action, speed, position? }`。 |
| API 类型 | uniapp `DeviceItem` 只包含基础字段 | 缺 Web `types/device.ts` 中 OTA、firmware、flowUpload、检测状态等字段 | 按移动端需要扩展字段，避免一次照搬所有后台字段。 |
| 店铺 API | `GET /api/store/current` 已有 | 缺 `POST /api/store/setup` | 用于店铺初始化和编辑。 |
| Auth API | 只有登录 | 缺 `registerApi` | 若小程序允许注册，迁移 Web `RegisterReq` 并做移动端简化表单。 |

## 6. Web 有但 uniapp 缺失的功能

| Web 功能 | Web 位置 | uniapp 是否需要同步 | 推荐同步方式 | 优先级 |
|---|---|---|---|---|
| 注册 | `src/views/RegisterView.vue`、`src/api/auth.ts` | 需要 | 移动端简化版 | P1 |
| 店铺初始化 | `src/views/StoreSetup.vue` | 需要 | 移动端简化版，登录后按 `storeConfigured` 跳转 | P0 |
| 店铺编辑 | `src/views/StoreProfileView.vue` | 需要 | 移动端简化版 | P1 |
| 设备删除 | `src/components/device/DeviceCard.vue`、`src/api/device.ts` | 需要 | 完整同步接口和确认弹窗 | P0 |
| AI 面料识别 | `src/components/device/DeviceCard.vue`、`src/api/ai.ts` | 需要 | 移动端简化版，使用小程序图片选择/上传能力 | P1 |
| 主色/面料/置信度展示 | `src/components/device/DeviceCard.vue` | 需要 | 在设备详情增加 AI 结果卡片 | P1 |
| 识别结果写回设备 | `src/components/device/DeviceCard.vue` | 需要 | 调 `updateDevice` 写回推荐字段 | P1 |
| 人体/顾客检测 | `src/components/settings/FlowMonitorPanel.vue`、`src/views/SmartLightDashboard.vue` | 需要 | 移动端简化版：状态卡 + 最近检测图 | P1 |
| 停留时长历史查询 | `src/components/settings/DurationQueryPanel.vue` | 需要 | 移动端简化版：日期 picker + 列表 | P1 |
| 光照多设备趋势 | `src/api/lux.ts`、`src/components/flow/LuxTrendCard.vue` | 可同步 | 简化为最近值列表或轻量趋势，不引入 Chart.js | P2 |
| analytics 策略对比 | `src/api/analytics.ts`、`src/components/flow/*` | 可同步 | 移动端简化版指标卡 | P2 |
| 全局灯效状态 | `src/api/lightEffect.ts` | 可同步 | 完整同步 API，页面简化 | P1 |
| 云台滑轨位置 | `src/components/settings/ArmControlPanel.vue` | 可同步 | 只加滑轨位置 slider 和停止按钮 | P2 |
| 门店平面布局拖拽 | `src/components/device/StoreLightLayout.vue` | 不建议完整同步 | 暂不建议同步；可只做“设备位置查看” | P3 |
| 自动标定/射灯跟随 | 未发现明确页面；Arm/布局中未见完整标定 API | 需人工确认 | 若后端存在再做入口 | P3 |
| OTA 设备更新 | `src/components/device/DeviceCard.vue` | 可同步 | 移动端简化版：检查更新/下发/状态 | P2 |
| OTA 固件上传管理 | `src/components/firmware/FirmwareManagePanel.vue` | 不建议完整同步 | 只加查看列表或跳转 Web 管理端 | P3 |
| SmartConfig | `src/components/settings/SmartConfigPanel.vue` | 视能力同步 | 小程序端需确认插件/平台能力，先保留说明 | P2 |
| 天气环境 | `src/api/weather.ts` | 可同步 | 设置或人流页增加只读环境卡 | P2 |

## 7. API 差异清单

| API 模块 | Web API | uniapp API | 差异 | 是否需要补 |
|---|---|---|---|---|
| auth | `POST /api/auth/login`、`POST /api/auth/register` | 仅 `POST /api/auth/login` | uniapp 缺注册封装 | 是 |
| device 基础 | list、my-list、online-list、create、update、delete | list、my-list、online-list、create、update | uniapp 缺 `DELETE /admin/device/delete/{id}` | 是 |
| device 定位 | `POST /admin/device/locate/{chipId}` | 未发现 | uniapp 无门店布局/定位功能 | 可后补 |
| device flow-upload | `POST /admin/device/flow-upload/{chipId}` | 未发现 | uniapp 无摄像头流上传开关 | 建议补 |
| ai | `POST /admin/ai/fabric-recognize` | 未发现 | uniapp 无 AI 识别 API | 是 |
| duration/flow | `GET /admin/duration/summary` with params | 手动 query 拼接同路径 | 路径一致；uniapp 缺历史查询 UI | 已有基础，需扩展 |
| lux | `/admin/lux/list`、`/admin/lux/get-latest`、`/admin/lux/multi-trend` | 仅 `/admin/lux/get-latest?chipId=` | uniapp 缺列表和多设备趋势 | 可后补 |
| analytics | `/admin/analytics/temp-people-trend`、`/admin/analytics/strategy-compare` | 未发现 | uniapp 无策略对比/温度人流趋势 | 可后补 |
| store | `GET /api/store/current`、`POST /api/store/setup` | 仅 `GET /api/store/current` | uniapp 缺初始化/编辑保存 | 是 |
| websocket | `/ws?token=...`，处理状态、在线、删除、lux、announce、人体/检测等 | `/ws?token=...`，处理 state/onlineStatus/deviceDeleted/lux/announce | uniapp 消息类型少，且工具为单例 close 模式 | 建议补 |
| arm/servo | `POST /admin/device/arm/{chipId}` body `{ action, speed, position? }` | `POST /admin/device/arm/{chipId}` body `{ direction: "camera:cmd:speed" }` | 路径一致但 body 格式不一致；需确认后端兼容 | 是 |
| light effect | `/admin/light-effect/state`、`/admin/light-effect/close`、`/admin/device/effect/{chipId}` | 仅 `/admin/device/effect/{chipId}` | uniapp 缺全局灯效状态 | 建议补 |
| ota | firmware-channel、ota/check、ota/update、firmware/upload、firmware/list | 未发现 | uniapp 无 OTA | 可后补 |
| smartconfig | Android bridge，无后端 API | 未封装 | 两端都依赖原生能力；小程序需确认可行性 | 需人工确认 |
| weather | `GET /admin/weather/current` | 未发现 | uniapp 无天气环境数据 | 可后补 |

## 8. 推荐的 uniapp 后续开发顺序

### 第一阶段：先补齐移动端核心闭环

1. 补店铺初始化/编辑：迁移 `POST /api/store/setup`，登录后根据 `storeConfigured` 引导到移动端店铺设置页。
2. 补设备删除和完整编辑：迁移 `DELETE /admin/device/delete/{id}`，在设备详情页加删除确认。
3. 校准机械臂 API：将 `src/api/arm.ts` 与 Web `armControl(chipId, action, speed, position?)` 对齐，或明确后端同时支持 `{ direction }`。
4. 清理灯效入口：`pages/effect/index` 已存在，建议正式开放设置页入口，并修复全局灯效状态缺口。
5. 加强设备扫描闭环：保留 WebSocket announce，增加取消扫描项、扫描结束状态和错误提示。

### 第二阶段：补比赛展示功能

1. 移动端 AI 面料识别：新增图片选择/上传、识别结果卡片、推荐亮度/色温、一键应用。
2. 人体/顾客检测状态：显示摄像头灯节点是否有人、最近检测时间、标注图或检测摘要。
3. 人流历史查询：在 Flow 页增加日期选择、按设备筛选、最近 7 天摘要。
4. 光照/策略数据简化展示：迁移 `/admin/lux/multi-trend` 和 `/admin/analytics/*`，用卡片/列表代替复杂 Chart.js。
5. 灯光场景：完善暖光/冷光/展示/节能/自动模式入口，支持多设备批量应用。

### 第三阶段：补高级功能

1. OTA 设备更新：先做设备详情里的版本、通道、检查更新、下发 OTA 和状态展示。
2. OTA 固件管理：不建议完整搬到小程序，可做只读列表或跳转 Web 后台。
3. SmartConfig：评估微信小程序是否具备所需配网能力；不可行时保留“App 版接入”说明。
4. 门店平面布局：移动端只做设备位置查看和热区摘要，不做 PC 端拖拽布局。
5. 云台高级功能：补滑轨位置、滑轨停止、当前角度/状态显示；标定相关需先确认后端 API。

## 9. 不建议同步或不建议照搬的 Web 功能

- `StoreLightLayout.vue` 的 PC 平面图拖拽、区域 resize、设备拖拽定位不建议完整照搬到小程序。原因是手机屏幕小、触控精度低、交互复杂；更适合做只读布局或热区摘要。
- `FirmwareManagePanel.vue` 的固件上传、历史表格、复制下载链接不建议完整照搬。原因是小程序文件上传固件和大表格管理体验差，且固件管理属于后台管理职责；可只同步设备端 OTA 检查/下发。
- Chart.js 的复杂趋势图不建议直接迁移。uniapp 小程序端没有现成 Chart.js DOM 环境，建议使用卡片、排行、轻量趋势列表，后续确需图表再评估小程序图表库。
- Web SmartConfig 依赖 `window.AndroidSmartConfig` bridge，不适合直接搬到微信小程序。小程序配网需重新评估平台能力或使用专用插件/蓝牙配网方案。
- Web 的完整 SidebarNav/大屏 Dashboard 不建议照搬。uniapp 当前 tabBar + 卡片式页面更适合手机端。

## 10. 结论

uniapp 当前已经完成移动端基础控制闭环：登录、设备列表、设备详情控制、手动/扫描添加、人流热区基础页、设置页、机械臂基础控制和单设备灯效页。按本次核对的功能项粗略统计，Web 端主要功能约 24 项，uniapp 已完成或部分同步约 13 项，其中完整同步约 5 项，部分同步约 8 项。

最大缺口集中在四类：

1. 店铺初始化/编辑与注册等账号店铺闭环。
2. AI 面料识别、人体检测、推荐灯光写回等智慧展示能力。
3. 人流历史、光照趋势、策略对比等数据分析能力。
4. OTA、SmartConfig、机械臂高级控制等高级运维能力。

最值得下一步优先补的是：店铺初始化/编辑、设备删除/完整编辑、机械臂 API 对齐。完成这三项后，移动端基础可用性会明显提升；随后再补 AI 识别和人流历史，比赛展示效果更强。
