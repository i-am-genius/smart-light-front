# 8266 摄像头 ROI 与 HTTP 追踪改造方案

本文档对应固件目录：

`D:\电脑管家迁移文件\xwechat_files\wxid_u1r9i0ddqp4a22_0e0a\msg\file\2026-07\8266-master_20260721\8266-master`

本文只规定后续固件修改方案，不修改上述固件。当前固件已经以 `FW_DEVICE_TYPE="cam"` 注册，已经能通过 HTTP 调用灯端 `POST /lamp/control`。需要补齐的是 ROI 配置、拍照/追踪命令处理、区域到单灯的映射，以及拍照上传流程。

## 1. 新配置契约

ROI 配置只保留区域坐标、目标灯绑定和两组预设。不得再使用以下字段：

- `centerPreset`
- `trackingLostTimeoutSeconds`
- `udpIp`
- `udpPort`
- `dwellSeconds`
- `leaveDelaySeconds`
- `confidenceThreshold`
- `yaw`
- `pitch`
- `roll`

预设统一使用：

- `pan`：水平角度，单位 `°`，范围 `-90..90`
- `tilt`：俯仰角度，单位 `°`，范围 `-45..45`
- `slider`：滑轨位置，单位 `mm`，范围 `0..1200`

后端通过设备 WebSocket 下发完整 ROI 配置：

```json
{
  "type": "cameraRoiConfig",
  "data": {
    "camChipId": "CAM-001",
    "configured": true,
    "rois": [
      {
        "targetIndex": 1,
        "targetChipId": "LAMP-001",
        "areaName": "入口区",
        "x": 0.08,
        "y": 0.30,
        "w": 0.24,
        "h": 0.38
      }
    ],
    "capturePresets": {
      "1": {
        "pan": 0,
        "tilt": 0,
        "slider": 300
      }
    },
    "trackingPresets": {
      "1": {
        "pan": 0,
        "tilt": -10,
        "slider": 300
      }
    }
  }
}
```

固件应在收到配置后校验范围，并写入 LittleFS。启动、重连或后端重新保存配置时，都以最后一次合法配置覆盖内存配置。`capturePresets` 和 `trackingPresets` 的键为字符串形式的目标序号 `"1"`、`"2"`、`"3"`。

后端读取旧配置时按安全规则迁移：`pan = yaw - 90`，`tilt = pitch`；旧 `roll` 是角度，无法安全换算为滑轨毫米值，因此旧配置的 `slider` 固定回落为 `0`。新格式已经提供 `pan/tilt/slider` 时不执行旧字段换算。

## 2. 灯地址同步接口

后端在保存 ROI 后调用摄像头：

```http
POST http://<cam-ip>/lamp-ip
Content-Type: application/json
```

请求体：

```json
{
  "lampIps": [
    "192.168.1.21",
    "192.168.1.22"
  ],
  "targets": [
    {
      "targetIndex": 1,
      "targetChipId": "LAMP-001",
      "lampIp": "192.168.1.21"
    },
    {
      "targetIndex": 2,
      "targetChipId": "LAMP-002",
      "lampIp": "192.168.1.22"
    }
  ]
}
```

响应：

```json
{
  "ok": true
}
```

固件修改要求：

1. `src/server/local_server.cpp` 的 `handleLampIp()` 必须检查请求体、JSON 解析错误、IP 格式和数组长度。
2. 优先保存 `targets`，建立 `targetIndex/targetChipId -> lampIp` 映射。
3. `lampIps` 仅用于兼容当前固件，不能再作为“向所有灯广播”的依据。
4. HTTP 使用灯端默认端口 80，不保存、不读取任何可配置端口。

## 3. 拍照命令

后端通过设备 WebSocket 下发：

```json
{
  "type": "cameraCapture",
  "taskId": "7c2cb85d-5f6a-4ec7-9ae6-cc32af0bf8ba",
  "camChipId": "CAM-001",
  "targetChipId": "LAMP-001",
  "targetIndex": 1,
  "capturePreset": {
    "pan": 0,
    "tilt": 0,
    "slider": 300
  },
  "uploadUrl": "/device/cam/capture-task/7c2cb85d-5f6a-4ec7-9ae6-cc32af0bf8ba/photo",
  "uploadToken": "one-time-token"
}
```

处理顺序：

1. 校验 `camChipId` 是本机。
2. 将 `capturePreset.pan/tilt/slider` 限制到硬件范围。
3. 按现有 Nano 协议分别发送 `p`、`t`、`x`，等待运动完成或超时。
4. 只触发一次 ESP32-CAM 拍照，不使用当前“追踪期间每 3 秒拍照”的逻辑。
5. 将照片以 `multipart/form-data` 上传：

```http
POST http://<backend-host>:<backend-port><uploadUrl>?token=<uploadToken>
Content-Type: multipart/form-data
```

表单字段固定为：

```text
file=<jpeg binary>
```

上传成功后恢复监测状态；失败应有限次数重试，并通过 `camStatus` 上报错误。`uploadToken` 是单任务令牌，不得缓存给其他任务使用。

## 4. 开始 HTTP 追踪

后端通过设备 WebSocket 下发：

```json
{
  "type": "cameraStartTracking",
  "camChipId": "CAM-001",
  "targetChipId": "LAMP-002",
  "targetIndex": 2,
  "transport": "http",
  "lampIp": "192.168.1.22",
  "trackingPreset": {
    "pan": 5,
    "tilt": -10,
    "slider": 620
  }
}
```

处理顺序：

1. 校验 `transport == "http"`、目标序号、目标芯片 ID 和 `lampIp`。
2. 以命令中的 `lampIp` 为本次活动灯；同时可用 `/lamp-ip` 保存的映射交叉检查。
3. 先应用 `trackingPreset`，再进入视觉追踪状态。
4. 每次追踪计算后只调用当前活动灯，不得调用 `notifyAllLamps()`。
5. 追踪控制固定调用 `http://<lampIp>/lamp/control`，不拼接端口。

灯端开始/更新追踪请求：

```http
POST http://<lamp-ip>/lamp/control
Content-Type: application/json
```

```json
{
  "tracking": true,
  "pan": -11.1,
  "tilt": -18.1,
  "brightness": 80,
  "temp": 4000,
  "personData": {
    "xCenter": 160,
    "yCenter": 120,
    "width": 60,
    "height": 140,
    "pctX": -0.125,
    "deltaX": -210,
    "rearPosition": 600
  }
}
```

成功响应：

```json
{
  "result": "ok"
}
```

停止活动灯追踪：

```json
{
  "tracking": false
}
```

## 5. 回中命令

后端通过设备 WebSocket 下发：

```json
{
  "type": "cameraReturnCenter",
  "camChipId": "CAM-001",
  "reason": "presence or cloth condition cleared"
}
```

固件收到后应：

1. 向当前活动灯发送 `{"tracking":false}`。
2. 清除活动目标和追踪节流缓存。
3. 执行固件内部固定的 Home 流程。中心位置不再由前端配置；`pan/tilt/slider` 建议固定为 `0/0/0`，如果另一条物理滑轨仍需回到 600 mm，应继续作为固件内部常量处理。
4. 上报 `returning_center`，完成后上报 `monitoring`。

## 6. 状态上报

设备通过现有 `/ws/device` WebSocket 上报，不需要调用受 JWT 保护的管理端 HTTP 接口。

工作状态：

```json
{
  "type": "camStatus",
  "chipId": "CAM-001",
  "workStatus": "tracking",
  "activeTargetIndex": 2,
  "activeTargetChipId": "LAMP-002",
  "message": "HTTP tracking started"
}
```

ROI 检测状态：

```json
{
  "type": "camPresence",
  "chipId": "CAM-001",
  "workStatus": "presence",
  "personCount": 1,
  "confidence": 0.91,
  "detectTime": "2026-07-22T19:00:00",
  "areas": [
    {
      "targetIndex": 2,
      "targetChipId": "LAMP-002",
      "areaName": "新品区",
      "present": true,
      "confidence": 0.91,
      "updateTime": "2026-07-22T19:00:00"
    }
  ]
}
```

低频追踪状态：

```json
{
  "type": "trackingStatus",
  "chipId": "CAM-001",
  "role": "cam",
  "trackingStatus": "tracking",
  "camChipId": "CAM-001",
  "lampChipId": "LAMP-002",
  "targetIndex": 2,
  "confidence": 0.91,
  "sequence": 18,
  "message": "HTTP tracking active"
}
```

`camPresence` 中的 `confidence` 是检测结果，不是用户可配置阈值；固件可按视觉模型自身固定规则判断。

## 7. 固件文件修改清单

- `src/network/ws_client.cpp`
  - 新增 `cameraRoiConfig`、`cameraCapture`、`cameraStartTracking`、`cameraReturnCenter` 分支。
  - 继续兼容 `{type,data}` 和扁平消息两种外层结构。
- `include/app_config.h` 或新增 `include/camera/roi_config.h`
  - 定义 ROI、预设、目标灯映射和活动目标结构。
- `src/server/local_server.cpp`
  - 加固 `/lamp-ip` 解析并保存结构化目标映射。
- `src/network/lamp_notify.cpp`
  - 删除运行路径中的全灯广播，新增按活动 `lampIp` 单灯发送。
- `src/main.cpp`
  - 移除追踪期间固定每 3 秒拍照。
  - 接入拍照任务、追踪预设、回中状态机。
- 新增拍照上传模块，例如 `src/network/camera_upload.cpp`
  - 负责 multipart 上传、任务令牌和有限重试。

## 8. 验收条件

1. 固件源码中不存在追踪 UDP 4211 的使用；UDP 4210 设备发现可以保留。
2. ROI 配置持久化 JSON 中不存在旧字段。
3. 拍照会应用目标区域的 `capturePreset`，且一个任务只拍摄并上传一次。
4. 追踪会应用目标区域的 `trackingPreset`。
5. 追踪帧只发送到活动区域绑定的灯 IP，不广播到其他灯。
6. 所有灯控 HTTP URL 都不含可配置端口，默认使用 80。
7. 断网、无目标映射、无效 JSON、拍照失败和 HTTP 超时都能退出当前动作并上报明确状态。
8. `cameraReturnCenter` 不依赖前端中心预设，能够停止活动灯并回到固件固定 Home 位。
