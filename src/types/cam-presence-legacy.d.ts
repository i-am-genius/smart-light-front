import './device'

declare module './device' {
  interface CamPresenceState {
    /**
     * @deprecated Legacy Camera presence payload compatibility only.
     * ROI configuration no longer participates in tracking decisions;
     * Lamp ToF proximity is the source of truth for presence-by-target.
     */
    configured?: boolean
  }
}
