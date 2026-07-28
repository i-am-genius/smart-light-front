# Camera Capture Independence From Lamp Online State

## Goal

Allow an online, idle camera to create a capture task even when the target lamp is offline. Lamp connectivity must not determine whether photography is available.

## Scope

The change covers both layers that currently enforce the unwanted dependency:

- Frontend: the area capture button in `CameraDeviceCard.vue`.
- Backend: capture-task creation in `DeviceCamServiceImpl.createCaptureTask`.

The target lamp must still be bound and exist in the current store because its chip ID identifies the capture target and receives the recognition result. Only its online-state requirement is removed.

## Behavior

A capture task is allowed when:

- The camera is online.
- The camera is not busy and no capture task is already being created.
- The camera has a chip ID.
- The selected target lamp is bound and exists.

The target lamp may be online or offline. The capture task continues to be sent only to the camera, and the existing target lamp chip ID remains in the payload for target association and result routing.

## Implementation

### Frontend

Remove target lamp online state from the capture button model and disabled-reason logic. Keep lamp online state in presence/tracking presentation because tracking readiness still legitimately depends on the lamp's sensor state.

### Backend

Keep resolving and validating the target lamp, but remove the session-online rejection for that target. Retain the camera session-online check before task creation.

## Verification

- Add a frontend regression test proving the capture-button guard does not inspect target lamp online state while retaining camera, busy, binding, and existence checks.
- Add or extend backend coverage for capture-task creation with an offline target lamp, if the backend test harness supports focused service testing.
- Run the frontend regression test and production build.
- Run the relevant backend test or Maven verification command.

## Non-Goals

- Changing tracking readiness or lamp status display.
- Allowing capture without a bound/existing target lamp.
- Allowing capture while the camera is offline or busy.
