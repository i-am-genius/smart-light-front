# Device Zone Ordering and Management Design

## Goal

Make device ordering, zone management, scan-based device creation, device editing, and the 3D lamp layout use one consistent zone and lamp-number model.

## Confirmed Behavior

- Bound devices render all `cam` devices first.
- Remaining devices keep the order in which each zone first appears.
- Lamps within the same zone sort by numeric `deviceNo` ascending.
- A newly assigned lamp number uses the smallest missing positive integer. For example, a zone containing `1` and `3` assigns `2` next.
- `cam` devices do not participate in zones or automatic numbering.
- `lamp` and `camlamp` devices participate in zone selection and automatic numbering.
- Each 3D zone renders real lamps from left to right by numeric `deviceNo` whenever the page is entered or refreshed.
- Dragging a real lamp changes only the current in-memory scene position. The drag result is not restored after a page refresh.
- Clicking the existing left/right controls between two real lamps swaps their `deviceNo` values and persists both device updates.
- Clicking left/right when either side is a manual empty slot only changes the local scene order and does not update device numbers.

## Architecture

`SmartLightDashboard` will own the ordered zone definitions and coordinate device updates. Shared pure helpers will provide:

- device classification and stable bound-device sorting;
- normalized zone names and ordered zone definitions;
- smallest-missing-number calculation;
- zone-to-device filtering;
- deterministic reassignment when devices enter the unpartitioned zone.

The dashboard passes the same zone list to `DeviceAddModal` and `ThreeLightingLayout`. `DeviceGrid` receives devices and applies the shared presentation ordering without mutating the source array. `ThreeLightingLayout` emits zone-management and device-number-swap requests instead of calling device APIs directly.

The existing local-storage keys remain the persistence layer for zone definitions and 3D layout metadata. Device `displayName` and `deviceNo` remain server-backed fields and are updated through the existing device update API.

## Zone Management UI

A compact, single-row toolbar appears below the 3D store layout. It contains:

- a small zone-name input and add icon button;
- a delete icon button for the active zone;
- previous/next arrow buttons that move the active zone within the stored order.

Adding trims and validates the name, rejects duplicates, appends the zone, persists the ordered definitions, and activates the new zone.

Deleting requires confirmation. Every `lamp` or `camlamp` in the deleted zone moves to the application's existing unpartitioned zone. Their numbers are reassigned using the smallest missing positive integers after accounting for devices already in that zone. The deleted zone definition and its stored 3D layout metadata are then removed. The default fallback view remains available when no named zones exist.

Reordering only changes the ordered zone definitions and does not modify devices.

## Device Creation and Editing

For a scanned `lamp` or `camlamp`, the add modal replaces the free-text display-name field with the existing `BaseSelect`. Selecting a zone fills `displayName` and automatically fills `deviceNo` with the smallest missing positive integer for that zone. The number remains visible but is derived from the selection rather than manually entered.

Scanned `cam` devices retain their current fields and do not show zone or automatic-number controls. The manual-add flow is left unchanged unless it is already using the same scanned-device state.

On a lamp device card, the current information-cell visual remains unchanged at rest. Clicking the zone cell opens the reused `BaseSelect` dropdown. Selecting another zone updates the local form and immediately chooses that zone's smallest missing number, excluding the current device from the occupied-number set. Saving uses the existing update flow and duplicate validation.

## Ordering and Layout

Bound-device ordering is a derived copy, never an in-place sort of the dashboard's device array. The stable comparison is:

1. `cam` devices before all other devices;
2. zone group by first appearance in the source device list;
3. numeric `deviceNo` within the same zone;
4. original source index as the fallback.

For each active 3D zone, real lamp devices are sorted numerically before slots are built. Persisted real-device `order` and horizontal position no longer override the initial number order after page entry or refresh. Manual slots remain after real lamps unless the user changes their local order.

The existing click-based left/right action detects the adjacent slot:

- two real lamps: emit a request to swap their server-backed `deviceNo` values;
- otherwise: retain the current local slot swap behavior.

After a successful real-lamp swap, the refreshed device data rebuilds the zone in ascending number order, leaving the two physical devices exchanged in the scene.

## Failure Handling

Multi-device operations update devices sequentially so partial progress is known. If a delete-zone migration or two-device number swap fails, the dashboard reloads the authoritative device list, retains any server-confirmed changes, and shows an error toast. Zone-definition deletion is committed only after all required device migrations succeed.

Invalid or duplicate zone names are rejected without changing storage. A zone selection cannot submit until a valid automatic number has been derived.

## Testing

Pure helper tests cover:

- `cam`-first ordering;
- stable first-seen zone grouping;
- numeric lamp ordering;
- smallest missing positive number selection;
- deterministic unpartitioned-zone renumbering.

Component contract tests cover:

- scan-add zone selection using `BaseSelect` for `lamp` and `camlamp` only;
- the device-card zone cell preserving its information-cell appearance;
- the compact zone toolbar and emitted management events;
- real-device layout construction ignoring persisted order in favor of `deviceNo`;
- click-based real-lamp swapping emitting a number-swap request while manual-slot swaps remain local.

The final verification runs all focused Node tests followed by `npm run build`.
