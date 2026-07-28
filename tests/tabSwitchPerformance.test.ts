import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const dashboardSource = readFileSync(
  new URL('../src/views/SmartLightDashboard.vue', import.meta.url),
  'utf8',
)
const sidebarSource = readFileSync(
  new URL('../src/components/layout/SidebarNav.vue', import.meta.url),
  'utf8',
)
const threeLayoutSource = readFileSync(
  new URL('../src/components/device/ThreeLightingLayout.vue', import.meta.url),
  'utf8',
)

function extractFunction(source: string, name: string) {
  const start = source.indexOf(`function ${name}(`)
  assert.notEqual(start, -1, `${name} should exist`)
  const bodyStart = source.indexOf('{', start)
  assert.notEqual(bodyStart, -1, `${name} should have a body`)

  let depth = 0
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(start, index + 1)
  }

  assert.fail(`${name} body should close`)
}

describe('dashboard tab switch performance contract', () => {
  it('lazily mounts each tab once and hides it without unmounting', () => {
    assert.match(dashboardSource, /const mountedTabs = ref\(new Set<DashboardTab>/)
    assert.match(
      dashboardSource,
      /mountedTabs\.value = new Set\(mountedTabs\.value\)\.add\(tab\)/,
    )

    for (const tab of ['main', 'flow', 'settings', 'firmware']) {
      assert.match(
        dashboardSource,
        new RegExp(
          `v-if="mountedTabs\\.has\\('${tab}'\\)"[\\s\\S]{0,160}v-show="activeTab === '${tab}'"`,
        ),
      )
    }

    assert.doesNotMatch(dashboardSource, /v-else-if="activeTab ===/)
  })

  it('keeps transition hooks on independently retained tab sections', () => {
    const pageTransitions = dashboardSource.match(/<Transition\s+[\s\S]*?:name="pageTransitionName"/g) ?? []
    assert.equal(pageTransitions.length, 4)
    assert.equal((dashboardSource.match(/@before-enter="beginPageSwitch"/g) ?? []).length, 4)
    assert.equal((dashboardSource.match(/@before-leave="measurePagePushDistance"/g) ?? []).length, 4)
  })

  it('uses a resettable duration guard instead of asymmetric terminal hooks', () => {
    assert.doesNotMatch(dashboardSource, /@(after-enter|enter-cancelled|leave-cancelled)="endPageSwitch"/)
    assert.match(dashboardSource, /const PAGE_SWITCH_CLEANUP_DELAY_MS = 500/)

    const beginHandler = extractFunction(dashboardSource, 'beginPageSwitch')
    const scheduleHandler = extractFunction(dashboardSource, 'schedulePageSwitchCleanup')
    const endHandler = extractFunction(dashboardSource, 'endPageSwitch')
    assert.match(beginHandler, /schedulePageSwitchCleanup\(\)/)
    assert.match(scheduleHandler, /pageSwitchGeneration \+= 1/)
    assert.match(scheduleHandler, /window\.clearTimeout\(pageSwitchCleanupTimer\)/)
    assert.equal((scheduleHandler.match(/requestAnimationFrame\(/g) ?? []).length, 2)
    assert.equal(
      (scheduleHandler.match(/generation !== pageSwitchGeneration/g) ?? []).length,
      3,
    )
    assert.match(scheduleHandler, /window\.setTimeout\([\s\S]*?endPageSwitch\(\)[\s\S]*?PAGE_SWITCH_CLEANUP_DELAY_MS/)
    assert.match(endHandler, /pageSwitchCleanupTimer = null/)
  })

  it('restores a retained Three.js viewport after it becomes visible again', () => {
    assert.match(threeLayoutSource, /nextTick/)
    assert.match(
      threeLayoutSource,
      /if \(isActive && !document\.hidden\) \{[\s\S]{0,180}await nextTick\(\)[\s\S]{0,120}handleResize\(\)[\s\S]{0,120}startRenderLoop\(\)/,
    )

    const resizeHandler = extractFunction(threeLayoutSource, 'handleResize')
    assert.match(resizeHandler, /if \(width <= 0 \|\| height <= 0\) return/)
  })
})

describe('sidebar refraction frame performance contract', () => {
  it('reads refraction source pixels only while rebuilding source canvases', () => {
    assert.match(sidebarSource, /let bgImageCache: ImageData \| null = null/)
    assert.match(sidebarSource, /let dragBgImageCache: ImageData \| null = null/)
    assert.match(sidebarSource, /function getRefractionSourceImage\(mode: RefractionMode\)/)

    const refreshSource = extractFunction(sidebarSource, 'refreshRefractionSources')
    assert.match(refreshSource, /bgCtx\.getImageData\(0, 0, SW, SH\)/)
    assert.match(refreshSource, /dragBgCtx\.getImageData\(0, 0, SW, SH\)/)

    const renderer = extractFunction(sidebarSource, 'renderRefractionAtRect')
    assert.match(renderer, /getRefractionSourceImage\(mode\)/)
    assert.doesNotMatch(renderer, /getImageData\(/)
  })

  it('requests read-optimized contexts for source canvases', () => {
    assert.match(
      sidebarSource,
      /bgCanvas\.getContext\('2d', \{ willReadFrequently: true \}\)/,
    )
    assert.match(
      sidebarSource,
      /dragBgCanvas\.getContext\('2d', \{ willReadFrequently: true \}\)/,
    )
  })
})
