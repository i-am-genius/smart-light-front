export interface FollowState {
  position: number
  velocity: number
}

export function advanceFollower(state: FollowState, target: number, dt: number): FollowState {
  const error = target - state.position
  const direction = Math.sign(error)
  if (!direction) return { position: target, velocity: 0 }

  const acceleration = direction * Math.min(9200, 240 * Math.pow(Math.abs(error), 0.78))
  const damping = Math.exp(-6 * dt)
  const alignedVelocity = state.velocity * direction < 0 ? 0 : state.velocity
  let velocity = (alignedVelocity + acceleration * dt) * damping
  const maxSpeed = 1500
  velocity = Math.max(-maxSpeed, Math.min(maxSpeed, velocity))

  let position = state.position + velocity * dt
  if (direction > 0) position = Math.min(target, Math.max(state.position, position))
  else position = Math.max(target, Math.min(state.position, position))

  if (position === target) return { position: target, velocity: 0 }
  return { position, velocity }
}

export function clampTrackTarget(pointerX: number, viewportWidth: number): number {
  return Math.max(viewportWidth * 0.22, Math.min(viewportWidth * 0.78, pointerX))
}

export function isStaticLightMode(viewportWidth: number, reducedMotion: boolean): boolean {
  return viewportWidth <= 760 || reducedMotion
}

export function resolveDefaultLampX(formCenterX: number, _cardRight: number, viewportWidth: number): number {
  if (viewportWidth > 760) return formCenterX
  return Math.max(58, Math.min(viewportWidth - 58, formCenterX))
}
