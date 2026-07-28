# Camera Capture Independence From Lamp Online State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an online, idle camera to create a capture task for a bound, existing target lamp regardless of whether that lamp is online.

**Architecture:** Remove the target lamp online-state gate at both enforcement points while preserving camera availability and target identity validation. Keep tracking-specific lamp connectivity checks unchanged because tracking communicates with both devices, whereas capture commands are sent only to the camera.

**Tech Stack:** Vue 3, TypeScript, Node test runner, Java 17, Spring Boot 4, JUnit 5, Mockito, Maven

## Global Constraints

- The camera must remain online and idle before a capture task can be created.
- The target lamp must remain bound, exist, be lamp-like, and belong to the current store.
- Lamp online state must continue to affect tracking readiness and status presentation.
- Do not change the camera/lamp device protocol or add endpoints.

---

### Task 1: Frontend Capture Button Guard

**Files:**
- Create: `tests/cameraCaptureAvailability.test.ts`
- Modify: `src/components/device/CameraDeviceCard.vue:526-532,746-766,1181-1188`

**Interfaces:**
- Consumes: `TargetButton`, `getTargetButtonDisabledReason(target)`
- Produces: a capture-button guard based on camera/task/target identity state, with no `targetOnline` property

- [ ] **Step 1: Write the failing regression test**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const source = readFileSync(
  new URL('../src/components/device/CameraDeviceCard.vue', import.meta.url),
  'utf8',
)
const disabledReason = source.match(
  /function getTargetButtonDisabledReason[\s\S]*?\n}/,
)?.[0] ?? ''

describe('camera capture availability', () => {
  it('does not depend on the target lamp online state', () => {
    assert.doesNotMatch(source, /targetOnline/)
    assert.doesNotMatch(disabledReason, /目标灯离线/)
  })

  it('keeps camera and target identity guards', () => {
    assert.match(disabledReason, /!props\.device\.online/)
    assert.match(disabledReason, /isCamBusy\.value/)
    assert.match(disabledReason, /!target\.targetChipId/)
    assert.match(disabledReason, /target\.targetMissing/)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test --experimental-strip-types tests/cameraCaptureAvailability.test.ts`

Expected: FAIL because `targetOnline` and `目标灯离线` still occur in the component.

- [ ] **Step 3: Remove only the lamp online-state capture gate**

Remove `targetOnline?: boolean` from `TargetButton`, remove both `targetOnline` assignments in `targetButtons`, and remove this branch:

```ts
if (target.targetOnline === false) return '目标灯离线'
```

Do not change `trackingReady`, `getPresenceStatusText`, or tracking controls.

- [ ] **Step 4: Run the frontend regression test**

Run: `node --test --experimental-strip-types tests/cameraCaptureAvailability.test.ts`

Expected: 2 tests PASS.

### Task 2: Backend Capture Task Guard

**Files:**
- Create: `E:/smart-light-backend/src/test/java/com/genius/smartlight/service/device/impl/DeviceCamServiceImplTest.java`
- Modify: `E:/smart-light-backend/src/main/java/com/genius/smartlight/service/device/impl/DeviceCamServiceImpl.java:240-249`

**Interfaces:**
- Consumes: `DeviceCamServiceImpl.createCaptureTask(DeviceCamCaptureTaskReqVO)`
- Produces: `DeviceCamCaptureTaskRespVO` for an offline but valid target lamp while still requiring the camera session to be online

- [ ] **Step 1: Write the failing service test**

```java
package com.genius.smartlight.service.device.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.genius.smartlight.dal.dataobject.DeviceDO;
import com.genius.smartlight.dal.mysql.DeviceMapper;
import com.genius.smartlight.dal.mysql.DurationRecordMapper;
import com.genius.smartlight.service.ai.AiService;
import com.genius.smartlight.service.personflow.PersonFlowRecordService;
import com.genius.smartlight.service.store.CurrentStoreService;
import com.genius.smartlight.vo.device.DeviceCamCaptureTaskReqVO;
import com.genius.smartlight.vo.device.DeviceCamCaptureTaskRespVO;
import com.genius.smartlight.websocket.DeviceSessionManager;
import com.genius.smartlight.websocket.WebSocketPushService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DeviceCamServiceImplTest {

    private DeviceSessionManager deviceSessionManager;
    private DeviceCamServiceImpl service;

    @BeforeEach
    void setUp() {
        DeviceMapper deviceMapper = mock(DeviceMapper.class);
        CurrentStoreService currentStoreService = mock(CurrentStoreService.class);
        WebSocketPushService webSocketPushService = mock(WebSocketPushService.class);
        deviceSessionManager = mock(DeviceSessionManager.class);

        service = new DeviceCamServiceImpl(
                deviceMapper,
                currentStoreService,
                webSocketPushService,
                deviceSessionManager,
                mock(PersonFlowRecordService.class),
                mock(DurationRecordMapper.class),
                mock(AiService.class),
                new ObjectMapper()
        );

        DeviceDO cam = device("CAM-001", "cam");
        DeviceDO lamp = device("LAMP-001", "lamp");
        when(deviceMapper.selectOne(any(LambdaQueryWrapper.class))).thenReturn(cam, lamp);
        when(currentStoreService.getCurrentStoreId()).thenReturn(1L);
        when(deviceSessionManager.isOnline("CAM-001")).thenReturn(true);
        when(deviceSessionManager.isOnline("LAMP-001")).thenReturn(false);
        when(deviceSessionManager.sendToDevice(eq("CAM-001"), any(String.class))).thenReturn(true);
    }

    @AfterEach
    void tearDown() {
        service.shutdownCaptureTimeoutExecutor();
    }

    @Test
    void createCaptureTask_allowsOfflineTargetLamp() {
        DeviceCamCaptureTaskReqVO request = new DeviceCamCaptureTaskReqVO();
        request.setCamChipId("CAM-001");
        request.setTargetChipId("LAMP-001");
        request.setTargetIndex(1);

        DeviceCamCaptureTaskRespVO result = service.createCaptureTask(request);

        assertThat(result.getCamChipId()).isEqualTo("CAM-001");
        assertThat(result.getTargetChipId()).isEqualTo("LAMP-001");
        assertThat(result.getStatus()).isEqualTo("created");
        verify(deviceSessionManager).isOnline("CAM-001");
        verify(deviceSessionManager, never()).isOnline("LAMP-001");
        verify(deviceSessionManager).sendToDevice(eq("CAM-001"), any(String.class));
    }

    private DeviceDO device(String chipId, String deviceType) {
        DeviceDO device = new DeviceDO();
        device.setChipId(chipId);
        device.setDeviceType(deviceType);
        device.setStoreId(1L);
        return device;
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run from `E:/smart-light-backend`: `./mvnw.cmd -Dtest=DeviceCamServiceImplTest test`

Expected: FAIL with `目标灯离线，无法拍摄` or a verification failure showing the lamp online state was queried.

- [ ] **Step 3: Remove the backend lamp session gate**

Keep target resolution and validation:

```java
String targetChipId = resolveTargetChipId(cam.getChipId(), reqVO.getTargetIndex(), reqVO.getTargetChipId());
DeviceDO target = requireLampLikeForCurrentStore(targetChipId);
```

Delete only:

```java
if (!deviceSessionManager.isOnline(target.getChipId())) {
    throw new ServiceException("目标灯离线，无法拍摄");
}
```

- [ ] **Step 4: Run the focused backend test**

Run: `./mvnw.cmd -Dtest=DeviceCamServiceImplTest test`

Expected: PASS.

### Task 3: Cross-Repository Verification

**Files:**
- Verify only; no new files

**Interfaces:**
- Consumes: completed frontend and backend behavior
- Produces: build evidence that both applications compile with the changed contract

- [ ] **Step 1: Run frontend tests and build**

Run: `node --test --experimental-strip-types tests/cameraCaptureAvailability.test.ts tests/cameraRoi.test.ts`

Expected: all tests PASS.

Run: `npm run build`

Expected: `vue-tsc` and Vite complete successfully.

- [ ] **Step 2: Run backend verification**

Run from `E:/smart-light-backend`: `./mvnw.cmd test`

Expected: all Maven tests PASS.

- [ ] **Step 3: Review scoped diffs**

Confirm the frontend diff changes only the capture availability model/guard and its test, and the backend diff changes only the capture-task online check and its test. Confirm unrelated dirty worktree changes remain untouched.
