# Skating overhaul implementation

Implemented locally from the plan supplied on 4 November 2026. Base: `9665098`
(the enlarged skatepark). Each phase has a local branch and commit checkpoint;
the final branch is `codex/skate-phase-8`. These changes have not been pushed or
opened as PRs.

| Phase | Implementation |
| --- | --- |
| 0 | Fixed-step production-code harness, scripted input and recorded trajectories. |
| 1 | Board velocity, cached primitive lookup, surface normals, slope gravity, burst pushes, carving losses, braking, powerslides, roll-back and fakie. Generic lip/drop exits replace ramp launch impulses. |
| 2 | Shared mouse/gamepad gesture recognizer, radial dead zone, rolling history, pop strength, scoops, nollies, late flips, pre-wind and pause controls. Keyboard arrows and touch remain available. |
| 3 | Independent board rotation, surface-relative catch/landing classification, grabs, manuals, balance display and revert combo links. |
| 4 | Spatially indexed 3D grind polylines, curved/kinked rails, material friction, downhill gravity, transfers, stick variations, kerbs, stoop and elevated-station rails. |
| 5 | Mini-ramp constraint, profile rays, coping tubes and grinds, pumping, return from airs, drop-ins, rock to fakie, axle and 50-50 stalls. |
| 6 | Circular swept bowl with tangent-plane carving and a 3.6 m vert ramp with a 0.6 m extension. |
| 7 | Lower trailing camera, turn lag, speed FOV, smoothed transition framing, contact-plane rider poses, surface/grind sounds, landing thuds and moving rider/board bails. Normal/strong pop: 2.9/3.4 m/s. |
| 8 | Under-el DIY bar/wood ledge with a 3.5 m transfer gap, concrete plaza with ledges and a six-metre manual pad, mapped station stairs and kerb lines in three districts. |

## Validation

- The complete Node suite passed 132 test files during development. Final
  focused checks cover the skating sources, bundle consistency, architecture
  and navigation; the full unrelated suite was not repeated after every phase.
- Physics tests cover flat coasting, braking, push taper, hills, predicted stall
  height, roll-back, tangent momentum through a kink, downhill rails, manuals,
  grabs, reverts and bails.
- A frictionless mini-ramp cycle stays within 2% energy error. Bowl carving stays
  on the wall through all quadrants. A 10 m/s vert approach reaches approximately
  1.5 m above coping and returns to the ramp.
- Each of six gesture paths has 100 deterministic noisy trials and must achieve
  at least 95% recognition. Steering, dead zones, loading deadlines, pause reset
  and pad disconnection are checked separately.
- Browser checks cover the park, grinds, uphill flips, touch controls, the shop
  quarter pipe, mini/bowl/vert rays, camera/FOV, mapped spots, traffic clearance
  and desktop/mobile map interactions. Tests use system Chromium with local
  HTTP because this environment blocks browser file URLs.
- Isolated mutations disabling slope gravity, corrupting gesture selection,
  removing downhill rail gravity and widening the landing threshold all cause
  the corresponding tests to fail. Production files are not changed by those
  mutation probes.
- Local serial ABAB rendering at viewport 1170×800 and a fixed 177×66 grid,
  mini-ramp hidden/enabled: medians **13.7 / 12.8 / 11.6 / 13.6 ms**, respectively.
  Combined enabled/hidden ratio: **1.043**, within the 10% mini-ramp budget.
  This isolates ramp cost in that view; it is not a general FPS guarantee or a
  benchmark against a separate exact-main checkout.
- Day/night bowl and close vert views were inspected. The review caught and
  fixed coplanar floor paint showing through the bowl, clipped vert framing,
  and a ramp placement overlapping an existing ledge. A geometry test now
  guards against feature overlap.

## Compatibility and remaining review

`SK.v`, `SK.dir`, `body.z` and `body.vz` remain the compatibility interface for
existing HUD, sound and body integration. Ground and transition motion use
`SKB`; the old body integrator still handles vertical flight this release.
Existing direct-direction mouse flicks remain a fallback alongside the new
loaded gestures.

The stricter catch and lower normal pop intentionally change some outcomes:
steep uphill flips need a loaded pop, and leaving a ledge retains momentum
instead of snapping down to the ground. The short-rail regression now balances
the longer, lower-friction ride and brakes before reaching the next obstacle.
Skating uses a smaller forward collision probe than walking, so a board is not
stopped before a low rail it can clear. Pedestrian collision defaults are kept.

Automated and visual checks are complete for the covered scenarios. A physical
gamepad has not been used in this environment, so tactile steering/gesture feel
and a human playtest sign-off remain to be done before calling tuning final.
