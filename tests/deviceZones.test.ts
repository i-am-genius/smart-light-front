import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { DeviceCreatePayload, DeviceItem } from '../src/types/device.ts'
import {
  UNASSIGNED_ZONE_NAME,
  buildDeviceNumberSwapSteps,
  buildDeviceUpdatePayload,
  buildZoneMoveAssignments,
  buildZoneSelectOptions,
  deriveZoneDefinitions,
  findSmallestAvailableDeviceNo,
  normalizeZoneName,
  sortBoundDevices,
  sortDevicesByNumber,
} from '../src/utils/deviceZones.ts'
import {
  ZONE_DEFINITION_STORAGE_KEY,
  ZONE_LAYOUT_STORAGE_KEY,
  loadZoneDefinitions,
  removeStoredZoneLayout,
  saveZoneDefinitions,
} from '../src/utils/deviceZoneStorage.ts'
import {
  migrateDevicesToZone,
  swapDeviceNumbers,
} from '../src/utils/deviceZoneMutations.ts'

const device = (id: number, type: string, zone = '', no = ''): DeviceItem => ({
  id,
  chipId: `chip-${id}`,
  deviceType: type,
  displayName: zone,
  deviceNo: no,
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

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
      deriveZoneDefinitions([{ id: 'a', name: ' A ' }], devices).map(zone => zone.name),
      ['A', 'B'],
    )
  })

  it('normalizes empty zone names to the reserved unassigned zone', () => {
    assert.equal(normalizeZoneName('  A  '), 'A')
    assert.equal(normalizeZoneName(''), UNASSIGNED_ZONE_NAME)
    assert.equal(normalizeZoneName(' - '), UNASSIGNED_ZONE_NAME)
  })

  it('builds unique zone options with unassigned first', () => {
    const options = buildZoneSelectOptions([
      { id: 'a', name: ' A ' },
      { id: 'a-copy', name: 'A' },
      { id: 'b', name: 'B' },
    ])

    assert.deepEqual(options, [
      { label: UNASSIGNED_ZONE_NAME, value: UNASSIGNED_ZONE_NAME },
      { label: 'A', value: 'A' },
      { label: 'B', value: 'B' },
    ])
  })

  it('sorts valid positive device numbers numerically and leaves ties stable', () => {
    const input = [
      device(1, 'lamp', 'A', '10'),
      device(2, 'lamp', 'A', '2'),
      device(3, 'lamp', 'A', ''),
      device(4, 'lamp', 'A', '2'),
    ]

    assert.deepEqual(sortDevicesByNumber(input).map(item => item.id), [2, 4, 1, 3])
    assert.deepEqual(input.map(item => item.id), [1, 2, 3, 4])
  })

  it('fills the smallest missing positive number and can exclude the edited device', () => {
    const devices = [
      device(1, 'lamp', 'A', '1'),
      device(2, 'lamp', 'A', '3'),
      device(3, 'lamp', 'B', '2'),
    ]

    assert.equal(findSmallestAvailableDeviceNo(devices, 'A'), '2')
    assert.equal(findSmallestAvailableDeviceNo(devices, 'A', 1), '1')
  })

  it('renumbers deleted-zone devices into unique unassigned gaps', () => {
    const all = [
      device(1, 'lamp', UNASSIGNED_ZONE_NAME, '1'),
      device(2, 'lamp', 'Deleted', '1'),
      device(3, 'lamp', 'Deleted', '2'),
    ]
    const assignments = buildZoneMoveAssignments(all.slice(1), all, UNASSIGNED_ZONE_NAME)

    assert.deepEqual(assignments.map(item => [item.device.id, item.deviceNo]), [[2, '2'], [3, '3']])
  })

  it('builds an update payload without dropping existing device fields', () => {
    const existing: DeviceItem = {
      ...device(1, 'lamp', 'A', '1'),
      ip: '192.0.2.1',
      brightness: 0,
      temp: 3200,
      autoMode: false,
      recommendedBrightness: 45,
      recommendedTemp: 4100,
      fabric: 'linen',
      mainColorRgb: '1,2,3',
    }
    const expected: DeviceCreatePayload = {
      chipId: 'chip-1',
      ip: '192.0.2.1',
      displayName: 'B',
      deviceType: 'lamp',
      deviceNo: '2',
      brightness: 0,
      temp: 3200,
      autoMode: false,
      recommendedBrightness: 45,
      recommendedTemp: 4100,
      fabric: 'linen',
      mainColorRgb: '1,2,3',
    }

    assert.deepEqual(
      buildDeviceUpdatePayload(existing, { displayName: 'B', deviceNo: '2' }),
      expected,
    )
  })

  it('builds collision-free steps when swapping two occupied lamp numbers', () => {
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
  })
})

describe('device zone storage', () => {
  it('round-trips ordered definitions and removes one stored layout', () => {
    const storage = createMemoryStorage()
    saveZoneDefinitions([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], storage)

    assert.deepEqual(loadZoneDefinitions(storage).map(zone => zone.name), ['A', 'B'])
    assert.ok(storage.getItem(ZONE_DEFINITION_STORAGE_KEY))

    storage.setItem(ZONE_LAYOUT_STORAGE_KEY, JSON.stringify({
      version: 1,
      activeZoneId: 'a',
      zoneLayouts: { a: { slots: [] }, b: { slots: [] } },
    }))
    removeStoredZoneLayout('a', storage)

    const layouts = JSON.parse(storage.getItem(ZONE_LAYOUT_STORAGE_KEY) || '{}')
    assert.equal(layouts.activeZoneId, '')
    assert.equal(layouts.zoneLayouts.a, undefined)
    assert.deepEqual(layouts.zoneLayouts.b, { slots: [] })
  })

  it('returns an empty list for malformed or invalid stored definitions', () => {
    const storage = createMemoryStorage()
    storage.setItem(ZONE_DEFINITION_STORAGE_KEY, '{bad json')
    assert.deepEqual(loadZoneDefinitions(storage), [])

    storage.setItem(ZONE_DEFINITION_STORAGE_KEY, JSON.stringify([
      { id: 'valid', name: 'Valid' },
      { id: '', name: 'Missing id' },
      { id: 'missing-name' },
    ]))
    assert.deepEqual(loadZoneDefinitions(storage), [{ id: 'valid', name: 'Valid' }])
  })
})

describe('device zone mutations', () => {
  it('migrates devices sequentially and returns their authoritative local fields', async () => {
    const all = [
      device(1, 'lamp', UNASSIGNED_ZONE_NAME, '1'),
      device(2, 'lamp', 'Deleted', '1'),
      device(3, 'lamp', 'Deleted', '2'),
    ]
    const calls: Array<[number, string, string]> = []

    const updated = await migrateDevicesToZone(
      all.slice(1),
      all,
      UNASSIGNED_ZONE_NAME,
      async (id, payload) => {
        calls.push([id, String(payload.displayName), String(payload.deviceNo)])
        return true
      },
    )

    assert.deepEqual(calls, [
      [2, UNASSIGNED_ZONE_NAME, '2'],
      [3, UNASSIGNED_ZONE_NAME, '3'],
    ])
    assert.deepEqual(updated.map(item => [item.id, item.displayName, item.deviceNo]), calls)
  })

  it('treats a false device update result as a failed migration', async () => {
    const moving = [device(1, 'lamp', 'Deleted', '1')]
    await assert.rejects(
      migrateDevicesToZone(moving, moving, UNASSIGNED_ZONE_NAME, async () => false),
      /Device update returned false/,
    )
  })

  it('performs the collision-free swap steps and returns final device numbers', async () => {
    const zoneDevices = [
      device(1, 'lamp', 'A', '1'),
      device(2, 'lamp', 'A', '2'),
      device(3, 'lamp', 'A', '3'),
    ]
    const calls: Array<[number, string]> = []

    const updated = await swapDeviceNumbers(
      zoneDevices[0],
      zoneDevices[1],
      zoneDevices,
      async (id, payload) => {
        calls.push([id, String(payload.deviceNo)])
        return true
      },
    )

    assert.deepEqual(calls, [[1, '4'], [2, '1'], [1, '2']])
    assert.deepEqual(updated.map(item => [item.id, item.deviceNo]), [[1, '2'], [2, '1']])
  })
})
