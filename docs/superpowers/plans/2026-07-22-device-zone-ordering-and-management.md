# Device Zone Ordering and Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the bound-device list, scan-add flow, device editor, and 3D lamp layout one ordered zone model with automatic gap-filling lamp numbers and persistent click-based lamp swaps.

**Architecture:** Add pure zone/number helpers in `src/utils/deviceZones.ts` and storage helpers in `src/utils/deviceZoneStorage.ts`. `SmartLightDashboard.vue` owns ordered zone definitions and server-backed multi-device mutations; child components receive zones as props and emit intent events. The device list sorts a derived copy, while the 3D layout rebuilds real slots by `deviceNo` and treats drag positions as session-only.

**Tech Stack:** Vue 3 Composition API, TypeScript 6, Vite 8, Node 24 built-in test runner, existing `BaseSelect`, existing Axios device API, browser `localStorage`.

## Global Constraints

- All `cam` devices render before other bound devices and do not participate in zones or automatic numbering.
- `lamp` and `camlamp` use zones and the smallest missing positive `deviceNo`.
- Initial zone order follows first appearance; a persisted user order overrides it in both the bound-device list and 3D layout.
- Real lamps rebuild left to right in ascending numeric `deviceNo` on page entry or refresh.
- Dragging a real lamp is session-only; clicking left/right between real lamps persistently swaps their numbers.
- Preserve the existing device-card information-cell appearance and reuse `src/components/common/BaseSelect.vue` for dropdown behavior.
- Do not mutate the dashboard's source `devices` array when applying display ordering.
- Do not add dependencies.

---

## File Structure

- Create `src/utils/deviceZones.ts`: pure zone normalization, derived ordering, smallest-gap numbering, and reassignment helpers.
- Create `src/utils/deviceZoneStorage.ts`: read/write ordered definitions and remove obsolete 3D zone layout records.
- Create `tests/deviceZones.test.ts`: behavior tests for sorting, numbering, and migrations.
- Create `tests/deviceZoneComponents.test.ts`: source/SFC contract tests for prop and event wiring.
- Modify `src/views/SmartLightDashboard.vue`: own zone definitions, coordinate create/edit/delete/swap updates, and pass shared props.
- Modify `src/components/device/DeviceGrid.vue`: render a sorted copy and pass zones downstream.
- Modify `src/components/device/DeviceCard.vue`: pass zones to lamp cards while leaving camera cards independent.
- Modify `src/components/device/DeviceAddModal.vue`: scanned lamp/camlamp zone selection and derived number.
- Modify `src/components/device/LampDeviceCard.vue`: information-cell-styled zone selector and automatic number reassignment.
- Modify `src/components/device/ThreeLightingLayout.vue`: compact zone toolbar, numeric slot rebuild, session-only real-lamp drag, and persistent click-swap intent.
- Modify `docs/superpowers/specs/2026-07-22-device-zone-ordering-and-management-design.md`: clarify that explicit zone order overrides initial first-seen order.

---

### Task 1: Pure Zone and Number Semantics

**Files:**
- Create: `src/utils/deviceZones.ts`
- Create: `tests/deviceZones.test.ts`

**Interfaces:**
- Produces: `ZoneDefinition`, `UNASSIGNED_ZONE_NAME`, `normalizeZoneName`, `deriveZoneDefinitions`, `buildZoneSelectOptions`, `sortDevicesByNumber`, `sortBoundDevices`, `findSmallestAvailableDeviceNo`, `buildZoneMoveAssignments`, and `buildDeviceUpdatePayload`.
- Consumes: `DeviceItem`, `DeviceCreatePayload`, `isCameraDevice`, and `isLampDevice`.

- [ ] **Step 1: Write failing helper tests**

```ts
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DeviceItem } from '../src/types/device.ts'
import {
  UNASSIGNED_ZONE_NAME,
  buildZoneMoveAssignments,
  deriveZoneDefinitions,
  findSmallestAvailableDeviceNo,
  sortBoundDevices,
} from '../src/utils/deviceZones.ts'

const device = (id: number, type: string, zone = '', no = ''): DeviceItem => ({
  id,
  chipId: `chip-${id}`,
  deviceType: type,
  displayName: zone,
  deviceNo: no,
})

describe('device zone helpers', () => {
  it('puts cameras first and follows explicit zone order with numeric lamp order', () => {
    const input = [
      device(1, 'lamp', 'B', '3'),
      device(2, 'lamp', 'A', '2'),
      device(3, 'cam'),
      device(4, 'lamp', 'B', '1'),
      device(5, 'lamp', 'A', '1'),
    ]
    const zones = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]
    assert.deepEqual(sortBoundDevices(input, zones).map(item => item.id), [3, 5, 2, 4, 1])
    assert.deepEqual(input.map(item => item.id), [1, 2, 3, 4, 5])
  })

  it('derives first-seen zones and appends newly discovered zones to stored order', () => {
    const devices = [device(1, 'lamp', 'B', '1'), device(2, 'lamp', 'A', '1')]
    assert.deepEqual(deriveZoneDefinitions([], devices).map(zone => zone.name), ['B', 'A'])
    assert.deepEqual(
      deriveZoneDefinitions([{ id: 'a', name: 'A' }], devices).map(zone => zone.name),
      ['A', 'B'],
    )
  })

  it('fills the smallest missing positive number', () => {
    const devices = [device(1, 'lamp', 'A', '1'), device(2, 'lamp', 'A', '3')]
    assert.equal(findSmallestAvailableDeviceNo(devices, 'A'), '2')
  })

  it('renumbers deleted-zone devices into unique unassigned gaps', () => {
    const all = [
      device(1, 'lamp', UNASSIGNED_ZONE_NAME, '1'),
      device(2, 'lamp', 'Deleted', '1'),
      device(3, 'lamp', 'Deleted', '2'),
    ]
    const assignments = buildZoneMoveAssignments(all.slice(1), all, UNASSIGNED_ZONE_NAME)
    assert.deepEqual(assignments.map(item => item.deviceNo), ['2', '3'])
  })
})
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `node --test tests/deviceZones.test.ts`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/utils/deviceZones.ts`.

- [ ] **Step 3: Implement the pure helpers**

```ts
export interface ZoneDefinition { id: string; name: string }
export const UNASSIGNED_ZONE_NAME = '\u672a\u5206\u533a'

export function findSmallestAvailableDeviceNo(
  devices: DeviceItem[],
  zoneName: string,
  excludedId?: string | number,
): string {
  const occupied = new Set(
    devices
      .filter(isLampDevice)
      .filter(item => normalizeZoneName(item.displayName) === normalizeZoneName(zoneName))
      .filter(item => excludedId == null || String(item.id) !== String(excludedId))
      .map(item => Number(item.deviceNo))
      .filter(value => Number.isInteger(value) && value > 0),
  )
  let candidate = 1
  while (occupied.has(candidate)) candidate += 1
  return String(candidate)
}

export function buildZoneSelectOptions(zones: ZoneDefinition[]) {
  const names = [UNASSIGNED_ZONE_NAME, ...zones.map(zone => normalizeZoneName(zone.name))]
  return [...new Set(names.filter(Boolean))].map(name => ({ label: name, value: name }))
}

export function sortDevicesByNumber<T extends Pick<DeviceItem, 'deviceNo'>>(devices: T[]): T[] {
  return devices
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftNo = parsePositiveDeviceNo(left.item.deviceNo)
      const rightNo = parsePositiveDeviceNo(right.item.deviceNo)
      return leftNo - rightNo || left.index - right.index
    })
    .map(entry => entry.item)
}
```

Complete `sortBoundDevices` with indexed stable sorting, `deriveZoneDefinitions` with stored-order lookup plus first-seen fallback, `buildZoneMoveAssignments` by repeatedly reserving the smallest available number, and `buildDeviceUpdatePayload` by preserving every field in `DeviceCreatePayload` before applying `displayName` or `deviceNo` overrides.

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run: `node --test tests/deviceZones.test.ts`

Expected: 4 tests pass with no warnings.

- [ ] **Step 5: Commit Task 1**

```powershell
git add src/utils/deviceZones.ts tests/deviceZones.test.ts
git commit -m "feat: add shared device zone semantics"
```

---

### Task 2: Zone Definition Persistence

**Files:**
- Create: `src/utils/deviceZoneStorage.ts`
- Modify: `tests/deviceZones.test.ts`
- Modify: `src/components/device/ThreeLightingLayout.vue`

**Interfaces:**
- Consumes: `ZoneDefinition` from Task 1.
- Produces: `ZONE_DEFINITION_STORAGE_KEY`, `ZONE_LAYOUT_STORAGE_KEY`, `loadZoneDefinitions`, `saveZoneDefinitions`, and `removeStoredZoneLayout`.

- [ ] **Step 1: Add failing tests with an in-memory Storage implementation**

```ts
it('round-trips ordered zone definitions and removes one stored layout', () => {
  const storage = createMemoryStorage()
  saveZoneDefinitions([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], storage)
  assert.deepEqual(loadZoneDefinitions(storage).map(zone => zone.name), ['A', 'B'])

  storage.setItem(ZONE_LAYOUT_STORAGE_KEY, JSON.stringify({
    version: 1,
    activeZoneId: 'a',
    zoneLayouts: { a: { slots: [] }, b: { slots: [] } },
  }))
  removeStoredZoneLayout('a', storage)
  const layouts = JSON.parse(storage.getItem(ZONE_LAYOUT_STORAGE_KEY) || '{}')
  assert.equal(layouts.zoneLayouts.a, undefined)
  assert.deepEqual(layouts.zoneLayouts.b, { slots: [] })
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deviceZones.test.ts`

Expected: FAIL because `deviceZoneStorage.ts` exports do not exist.

- [ ] **Step 3: Implement defensive JSON storage helpers**

```ts
export function loadZoneDefinitions(storage: Storage = localStorage): ZoneDefinition[] {
  try {
    const parsed = JSON.parse(storage.getItem(ZONE_DEFINITION_STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isValidZoneDefinition) : []
  } catch {
    return []
  }
}
```

Move the two storage-key constants out of `ThreeLightingLayout.vue` and import them there so existing saved layouts remain compatible.

- [ ] **Step 4: Run and verify GREEN**

Run: `node --test tests/deviceZones.test.ts`

Expected: all helper and persistence tests pass.

- [ ] **Step 5: Commit Task 2**

```powershell
git add src/utils/deviceZoneStorage.ts src/components/device/ThreeLightingLayout.vue tests/deviceZones.test.ts
git commit -m "refactor: centralize device zone storage"
```

---

### Task 3: Shared Zone Ownership and Bound-Device Ordering

**Files:**
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `src/components/device/DeviceGrid.vue`
- Modify: `src/components/device/DeviceCard.vue`
- Modify: `src/components/device/LampDeviceCard.vue`
- Create: `tests/deviceZoneComponents.test.ts`

**Interfaces:**
- Consumes: `deriveZoneDefinitions`, `sortBoundDevices`, `loadZoneDefinitions`, `saveZoneDefinitions`, and `ZoneDefinition`.
- Produces: `zoneDefinitions: Ref<ZoneDefinition[]>`; `zones` props through Dashboard -> DeviceGrid -> DeviceCard -> LampDeviceCard.

- [ ] **Step 1: Write failing component wiring tests**

```ts
it('renders DeviceGrid from a derived sortedDevices copy', () => {
  assert.match(deviceGridSource, /const sortedDevices = computed\(\(\) => sortBoundDevices\(props\.devices, props\.zones\)\)/)
  assert.match(deviceGridSource, /v-for="device in sortedDevices"/)
  assert.match(deviceGridSource, /:all-devices="sortedDevices"/)
})

it('passes the shared zones through the device card chain', () => {
  assert.match(dashboardSource, /<DeviceGrid[\s\S]*?:zones="zoneDefinitions"/)
  assert.match(deviceGridSource, /:zones="zones"/)
  assert.match(deviceCardSource, /<LampDeviceCard[\s\S]*?:zones="zones"/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deviceZoneComponents.test.ts`

Expected: assertions fail because `sortedDevices` and zone props are absent.

- [ ] **Step 3: Wire shared zones and derived ordering**

```ts
const props = defineProps<{
  devices: DeviceItem[]
  zones: ZoneDefinition[]
  loading: boolean
  deletingId?: number | null
}>()
const sortedDevices = computed(() => sortBoundDevices(props.devices, props.zones))
```

Initialize dashboard zones from storage, merge first-seen device zones after every authoritative list merge, persist only when the normalized list changes, and pass the resulting list through the component chain.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit Task 3**

```powershell
git add src/views/SmartLightDashboard.vue src/components/device/DeviceGrid.vue src/components/device/DeviceCard.vue src/components/device/LampDeviceCard.vue tests/deviceZoneComponents.test.ts
git commit -m "feat: share ordered zones across device views"
```

---

### Task 4: Scan-Add and Device-Card Zone Selection

**Files:**
- Modify: `src/components/device/DeviceAddModal.vue`
- Modify: `src/components/device/LampDeviceCard.vue`
- Modify: `src/components/device/DeviceCard.vue`
- Modify: `src/components/device/DeviceGrid.vue`
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `tests/deviceZoneComponents.test.ts`

**Interfaces:**
- Consumes: `ZoneDefinition[]`, `DeviceItem[]`, `UNASSIGNED_ZONE_NAME`, and `findSmallestAvailableDeviceNo`.
- Produces: scanned lamp/camlamp `BaseSelect` behavior and an information-cell-styled lamp-card zone selector.

- [ ] **Step 1: Add failing scan/editor contract tests**

```ts
it('uses BaseSelect for scanned zone-managed devices and derives the number', () => {
  assert.match(addModalSource, /const isScannedZoneDevice = computed/)
  assert.match(addModalSource, /v-if="isScannedZoneDevice"[\s\S]*?<BaseSelect/)
  assert.match(addModalSource, /findSmallestAvailableDeviceNo\(props\.devices, zoneName\)/)
})

it('keeps the lamp zone selector visually inside the existing information cell', () => {
  assert.match(lampCardSource, /class="device-info-cell editable zone-select-cell"/)
  assert.match(lampCardSource, /<BaseSelect[\s\S]*?class="zone-cell-select"/)
  assert.match(lampCardSource, /\.zone-cell-select\s*:deep\(\.select-trigger\)[\s\S]*?border:\s*0/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deviceZoneComponents.test.ts`

Expected: new assertions fail on the existing text inputs.

- [ ] **Step 3: Implement scanned-device selection**

```ts
const isScannedZoneDevice = computed(() => Boolean(props.initialData) && isLampDevice(form))
const zoneOptions = computed(() => buildZoneSelectOptions(props.zones))

function handleZoneChange(value: string | number) {
  const zoneName = String(value)
  form.displayName = zoneName
  form.deviceNo = findSmallestAvailableDeviceNo(props.devices, zoneName)
}
```

Render `BaseSelect` and a read-only derived number only for scanned `lamp/camlamp`. Preserve the current scanned `cam` and manual-add fields.

- [ ] **Step 4: Implement the lamp-card selector**

Use `BaseSelect` inside the existing `.device-info-cell`; remove trigger border/background through scoped `:deep()` rules. On zone change, exclude the current device ID when calculating the smallest gap. Keep the existing Save action as the server-update boundary.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/components/device/DeviceAddModal.vue src/components/device/LampDeviceCard.vue src/components/device/DeviceCard.vue src/components/device/DeviceGrid.vue src/views/SmartLightDashboard.vue tests/deviceZoneComponents.test.ts
git commit -m "feat: select zones when adding and editing lamps"
```

---

### Task 5: Compact Zone Management and Delete Migration

**Files:**
- Modify: `src/components/device/ThreeLightingLayout.vue`
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `tests/deviceZoneComponents.test.ts`

**Interfaces:**
- `ThreeLightingLayout` emits `zone-add(name: string)`, `zone-delete({ zoneId, zoneName })`, and `zone-move({ zoneId, direction })`.
- Dashboard consumes `buildZoneMoveAssignments`, `buildDeviceUpdatePayload`, `saveZoneDefinitions`, and `removeStoredZoneLayout`.

- [ ] **Step 1: Add failing zone-toolbar tests**

```ts
it('renders the compact zone manager below the scene and emits intent events', () => {
  assert.match(layoutSource, /class="zone-quick-manager"/)
  assert.match(layoutSource, /@click="submitZoneAdd"/)
  assert.match(layoutSource, /@click="requestActiveZoneDelete"/)
  assert.match(layoutSource, /@click="requestZoneMove\(-1\)"/)
  assert.match(layoutSource, /@click="requestZoneMove\(1\)"/)
  assert.match(layoutSource, /\(event: 'zone-add', name: string\)/)
})
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deviceZoneComponents.test.ts`

Expected: toolbar/event assertions fail.

- [ ] **Step 3: Implement the compact toolbar and child validation**

Add the row after `.three-viewport-wrap`, use icon buttons with accessible titles, reject empty/duplicate names, prevent deleting the reserved unpartitioned zone, and disable mutation controls while `zoneManagementPending` is true.

- [ ] **Step 4: Implement dashboard add/reorder/delete handlers**

```ts
async function handleZoneDelete({ zoneId, zoneName }: ZoneMutationTarget) {
  const moving = devices.value.filter(item => isLampDevice(item) && normalizeZoneName(item.displayName) === normalizeZoneName(zoneName))
  const assignments = buildZoneMoveAssignments(moving, devices.value, UNASSIGNED_ZONE_NAME)
  zoneManagementPending.value = true
  try {
    for (const assignment of assignments) {
      await updateDevice(assignment.device.id, buildDeviceUpdatePayload(assignment.device, {
        displayName: UNASSIGNED_ZONE_NAME,
        deviceNo: assignment.deviceNo,
      }))
    }
    zoneDefinitions.value = zoneDefinitions.value.filter(zone => zone.id !== zoneId)
    saveZoneDefinitions(zoneDefinitions.value)
    removeStoredZoneLayout(zoneId)
    await silentRefreshDeviceList()
  } catch (error) {
    await silentRefreshDeviceList()
    toast.show(getErrorMessage(error, '\u5220\u9664\u5206\u533a\u5931\u8d25'), 'error')
  } finally {
    zoneManagementPending.value = false
  }
}
```

Add and move operations update `zoneDefinitions` immutably and persist immediately. Delete persists definition removal only after every required device update succeeds.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts tests/threeLightingWorkbenchUi.test.ts`

Expected: all tests pass.

- [ ] **Step 6: Commit Task 5**

```powershell
git add src/components/device/ThreeLightingLayout.vue src/views/SmartLightDashboard.vue tests/deviceZoneComponents.test.ts tests/threeLightingWorkbenchUi.test.ts
git commit -m "feat: manage store layout zones inline"
```

---

### Task 6: Numeric 3D Layout and Persistent Click Swaps

**Files:**
- Modify: `src/components/device/ThreeLightingLayout.vue`
- Modify: `src/views/SmartLightDashboard.vue`
- Modify: `tests/deviceZones.test.ts`
- Modify: `tests/deviceZoneComponents.test.ts`

**Interfaces:**
- Produces: `buildDeviceNumberSwapSteps(first, second, zoneDevices)` in `src/utils/deviceZones.ts`, returning three `{ device, deviceNo }` updates.
- Layout emits `swap-device-numbers({ firstDeviceId, secondDeviceId })` only for two adjacent real device slots.
- Dashboard performs the returned collision-free three-update swap through a temporary smallest-missing number and then refreshes devices.

- [ ] **Step 1: Add failing numeric-layout and swap tests**

```ts
it('sorts zone lamps numerically and ignores persisted real-slot geometry on rebuild', () => {
  assert.match(layoutSource, /sortDevicesByNumber\(/)
  assert.match(layoutSource, /const fallbackX = getDefaultSlotX\(index, Math\.max\(zoneLampDevices\.length, 1\)\)/)
  assert.doesNotMatch(realSlotBuilderSource, /existing\?\.order \?\? index/)
  assert.doesNotMatch(realSlotBuilderSource, /existing\?\.lampX \?\? fallbackX/)
})

it('emits a number swap for adjacent real slots and keeps manual swaps local', () => {
  assert.match(moveFunctionSource, /isRealDeviceSlot\(current\) && isRealDeviceSlot\(target\)/)
  assert.match(moveFunctionSource, /emit\('swap-device-numbers'/)
  assert.match(moveFunctionSource, /applySlotOrderLayout\(\)/)
})
```

Add this pure helper test for zone numbers `1,2,3`:

```ts
const zoneDevices = [
  device(1, 'lamp', 'A', '1'),
  device(2, 'lamp', 'A', '2'),
  device(3, 'lamp', 'A', '3'),
]
assert.deepEqual(
  buildDeviceNumberSwapSteps(zoneDevices[0], zoneDevices[1], zoneDevices)
    .map(step => [step.device.id, step.deviceNo]),
  [[1, '4'], [2, '1'], [1, '2']],
)
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts`

Expected: numeric rebuild and swap assertions fail.

- [ ] **Step 3: Rebuild real slots from sorted device numbers**

Sort `getLampDevicesForZone()` numerically. For real device slots, always derive `order`, `lampX`, and `targetX` from the current numeric index. Continue restoring manual-slot geometry. Saved real drag coordinates may remain in storage but must not be consumed during rebuild.

- [ ] **Step 4: Emit persistent swaps only for two real slots**

```ts
if (isRealDeviceSlot(current) && isRealDeviceSlot(target)) {
  emit('swap-device-numbers', {
    firstDeviceId: current.deviceId ?? current.sourceDeviceId,
    secondDeviceId: target.deviceId ?? target.sourceDeviceId,
  })
  return
}
```

Keep the existing array swap and `applySlotOrderLayout()` path when either slot is manual.

- [ ] **Step 5: Implement the collision-free dashboard swap**

Resolve both devices by `String(id)`, verify that they share a normalized zone and both have positive numbers, call `buildDeviceNumberSwapSteps`, then perform:

```ts
for (const step of buildDeviceNumberSwapSteps(first, second, zoneDevices)) {
  await updateDevice(step.device.id, buildDeviceUpdatePayload(step.device, { deviceNo: step.deviceNo }))
}
await silentRefreshDeviceList()
```

On any failure, reload authoritative devices and show a toast. Disable additional click swaps while one is running.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts tests/threeLightingWorkbenchUi.test.ts tests/threeLightingLayoutScene.test.ts`

Expected: all tests pass.

- [ ] **Step 7: Commit Task 6**

```powershell
git add src/utils/deviceZones.ts src/components/device/ThreeLightingLayout.vue src/views/SmartLightDashboard.vue tests/deviceZones.test.ts tests/deviceZoneComponents.test.ts
git commit -m "feat: keep 3d lamps aligned with device numbers"
```

---

### Task 7: Full Verification and Documentation Consistency

**Files:**
- Modify: `docs/superpowers/specs/2026-07-22-device-zone-ordering-and-management-design.md`
- Modify: `docs/superpowers/plans/2026-07-22-device-zone-ordering-and-management.md`

**Interfaces:**
- Consumes all prior tasks; produces a build-clean, documented feature.

- [ ] **Step 1: Run all Node tests**

Run: `node --test tests/*.test.ts tests/*.test.mjs`

Expected: every test passes with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: `vue-tsc -b` and `vite build` both exit 0.

- [ ] **Step 3: Inspect the final scoped diff**

Run: `git diff --check; git diff --stat HEAD`

Expected: no whitespace errors; only the planned source, test, and documentation files appear in the task's commits. Existing unrelated worktree changes remain untouched.

- [ ] **Step 4: Commit documentation clarification**

```powershell
git add docs/superpowers/specs/2026-07-22-device-zone-ordering-and-management-design.md docs/superpowers/plans/2026-07-22-device-zone-ordering-and-management.md
git commit -m "docs: finalize device zone implementation plan"
```
