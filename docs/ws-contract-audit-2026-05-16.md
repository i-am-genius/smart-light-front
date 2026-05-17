# 前后端接口与 WebSocket 通信契约一致性审计报告

> 日期: 2026-05-16  
> 审计范围: `E:\smart-light-front` ↔ `E:\smart-light-backend`  
> 审计内容: REST 接口 + WebSocket 消息的字段名、类型、结构一致性

---

## 一、契约对照表

| # | 功能 | 后端消息 type | 后端 payload 关键字段 | 前端读取字段 | 匹配 | 问题 |
|---|------|-------------|---------------------|-------------|------|------|
| 1 | 设备添加同步 | `state` | 完整 DeviceRespVO, `id` 为 String | `updateDeviceByIncoming` → id/chipId 匹配 → 未匹配则 push | ✅ | 无 |
| 2 | 设备删除同步 | `deviceDeleted` | `{"id": <Long>}` **无 chipId** | `String(item.id) !== String(message.data.id)` | ✅ | 无 chipId 回退 |
| 3 | 设备状态更新 | `state` | 完整 DeviceRespVO | `updateDeviceByIncoming` → id/chipId merge | ✅ | 无 |
| 4 | 在线/离线 | `onlineStatus` | `{chipId, ip, online, lastSeen}` **无 id** | `message.data.chipId` 等 4 字段 | ✅ | 只靠 chipId 匹配 |
| 5 | 扫描 announce | `announce` | `{chipId, ip, deviceType, added}` **无 mac** | 读 `mac` 字段 (永远 undefined) | ⚠️ | mac 缺失；chipId 未 normalize |
| 6 | 灯效状态 | `lightEffectState` | 完整 LightEffectStateRespVO (含 amplitude) | `amplitude ?? range` 回退 | ✅ | 无 |
| 7 | 光照 lux | `lux` | 完整 LuxRespVO (字段 luxValue) | `luxValue ?? lux ?? value ?? 0` | ✅ | 无 |
| 8 | AI 面料识别 | `fabricRecognize` | 手动 Map 18 字段 (含 chipId) | 18 字段全部匹配 | ✅ | 无 |
| 9 | 人流检测 | `personDetection` | `{chipId, count, confidence, timestamp, processingTime}` | 6 字段全匹配 | ✅ | 无 |
| 10 | 停留时长 | `durationUpdate` | 完整 DurationRespVO | 仅触发 refresh，不读字段 | ✅ | 无 |

---

## 二、后端各消息精确 JSON Payload

### state
```json
{
  "type": "state",
  "data": {
    "id": "37",           // Long → String (ToStringSerializer)
    "chipId": "LAMP-37461B",
    "deviceType": "lamp",
    "deviceNo": "1",
    "displayName": "新品展示区",
    "ip": "192.168.1.100",
    "brightness": 70,
    "temp": 4000,
    "autoMode": false,
    "recommendedBrightness": 70,
    "recommendedTemp": 4000,
    "fabric": "棉质",
    "mainColorRgb": "255,200,120",
    "firmwareVersion": "1.0.2",
    "firmwareVersionCode": 10002,
    "firmwareChannel": "stable",
    "otaStatus": "idle",
    "otaProgress": 0,
    "createTime": "2026-05-14T12:30:00",
    "updateTime": "2026-05-16T10:00:00",
    "storeId": 1
  }
}
```

### deviceDeleted
```json
{
  "type": "deviceDeleted",
  "data": {
    "id": 12
  }
}
```
:warning: **只有 `id`，无 `chipId`**

### onlineStatus
```json
{
  "type": "onlineStatus",
  "data": {
    "chipId": "LAMP-37461B",
    "ip": "192.168.1.100",
    "online": true,
    "lastSeen": 1715860000000
  }
}
```

### announce
```json
{
  "type": "announce",
  "data": {
    "chipId": "LAMP-ABCD1234",
    "ip": "192.168.1.101",
    "deviceType": "lamp",
    "added": false
  }
}
```
:warning: **无 `mac` 字段**

### lightEffectState
```json
{
  "type": "lightEffectState",
  "data": {
    "effect": "wave",
    "enabled": true,
    "minTemp": 2700,
    "maxTemp": 6500,
    "baseTemp": 4600,
    "range": 1900,
    "amplitude": 1900,
    "speed": 1.0,
    "brightness": 70,
    "phaseIndex": 3.2,
    "phaseGap": 0.8,
    "selectedScope": "all",
    "updateTime": "2026-05-16T10:00:00"
  }
}
```

### fabricRecognize
```json
{
  "type": "fabricRecognize",
  "data": {
    "chipId": "LAMP-37461B",
    "filename": "cloth.jpg",
    "label": "棉质",
    "confidence": 0.95,
    "mainColorRgb": "255,200,120",
    "recommendedBrightness": 65,
    "recommendedTemp": 4200,
    "clothDetected": true,
    "clothX": 120,
    "clothY": 80,
    "clothW": 300,
    "clothH": 400,
    "originalImagePath": "/uploads/orig_xxx.jpg",
    "annotatedImagePath": "/uploads/anno_xxx.jpg",
    "combinedImagePath": "/uploads/comb_xxx.jpg",
    "originalImageUrl": "https://...",
    "annotatedImageUrl": "https://...",
    "combinedImageUrl": "https://..."
  }
}
```

### personDetection
```json
{
  "type": "personDetection",
  "data": {
    "chipId": "LAMP-37461B",
    "filename": "frame.jpg",
    "count": 3,
    "confidence": 0.88,
    "timestamp": "2026-05-16T10:00:00",
    "processingTime": 0.45
  }
}
```

### durationUpdate
```json
{
  "type": "durationUpdate",
  "data": {
    "id": 5,
    "chipId": "LAMP-37461B",
    "statDate": "2026-05-16",
    "durationValue": 35000,
    "createTime": "2026-05-16T10:00:00",
    "updateTime": "2026-05-16T10:00:00"
  }
}
```

### lux
```json
{
  "type": "lux",
  "data": {
    "id": 128,
    "chipId": "LAMP-37461B",
    "luxValue": 356.5,
    "collectTime": "2026-05-16T10:00:00",
    "createTime": "2026-05-16T10:00:00"
  }
}
```

---

## 三、发现的问题

### P0 — `handleRealtimeUpdate` 严格 `===` 比较 id

**文件**: `SmartLightDashboard.vue` L906

```typescript
const index = devices.value.findIndex(item => item.id === id)
```

`id` 参数是 `number`，但 `item.id` 可能是字符串（来自 `handleCreateDevice` 的 `String(result)`）。`'36' === 36` → `false`。

**修复**:
```typescript
const index = devices.value.findIndex(item => String(item.id) === String(id))
```

### P1 — `deviceDeleted` 不含 `chipId`

**文件**: `WebSocketPushService.java` L72-76

只发 `{"id": 12}`。若 `item.id` 缺失但 `item.chipId` 存在，无法删除。

**修复**: 后端增加 chipId 字段；前端兼容 chipId 删除。

### P1 — `announce` 缺少 `mac` 字段

**文件**: `WebSocketPushService.java` L121-126

后端不发 `mac`，前端 `message.data.mac` 永远是 `undefined`。

### P1 — `announce` chipId 比较未规范化

**文件**: `SmartLightDashboard.vue` L1078

```typescript
devices.value.some(item => item.chipId === chipId)
```

与 `mergeDeviceOnline` 使用的 `normalizeChipId()` 不一致。

**修复**: 统一使用 `normalizeChipId()`。

### P2 — `DeviceItem.id` 类型为 `number`，运行时常为 `string`

**文件**: `src/types/device.ts` L2

类型声明与实际运行时不一致。

---

## 四、模拟关键流程

### 流程 A：客户端 A 添加设备
1. A → `POST /admin/device/create` → 返回新 id=37 (number)
2. 后端 → `pushState(respVO)` 广播给同店铺所有客户端 (type=`state`)
3. payload 为完整 DeviceRespVO，id 为 String `"37"`
4. B 收到 → `updateDeviceByIncoming` → 未匹配到 → **push 新设备**
5. ✅ B 自动同步

### 流程 B：客户端 A 删除设备
1. A → `DELETE /admin/device/delete/37`
2. 后端 → `pushDeviceDeleted(37, storeId)` 广播 (type=`deviceDeleted`)
3. payload: `{"id": 37}`
4. B 收到 → `String(item.id) !== String(37)` → filter 移除
5. ✅ B 自动同步

### 流程 C：设备上报状态
1. ESP → `POST /admin/device/state-report`
2. 后端更新 DeviceDO → `pushState(respVO)` 广播
3. 前端 → `updateDeviceByIncoming` → id/chipId 匹配 → merge
4. ✅ 更新正常

---

## 五、修复清单

| 优先级 | 文件 | 行号 | 问题 | 修复 |
|--------|------|------|------|------|
| P0 | `SmartLightDashboard.vue` | L906 | `item.id === id` 严格比较 | `String(item.id) === String(id)` |
| P1 | `WebSocketPushService.java` | L72-76 | deviceDeleted 无 chipId | 增加 `data.put("chipId", ...)` |
| P1 | `SmartLightDashboard.vue` | L1078 | announce chipId 未 normalize | 使用 `normalizeChipId()` |
| P1 | `WebSocketPushService.java` | L121-126 | announce 无 mac | 增加 mac 字段或前端去读 |
| P2 | `SmartLightDashboard.vue` | L1019 | deviceDeleted 只按 id 删 | 兼容 chipId 回退删除 |
