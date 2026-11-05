# Skating overhaul implementation

Implemented locally from the plan supplied on 4 November 2026. Base: `9665098`
(the enlarged skatepark). Each phase has a local branch and commit checkpoint;
the phase-series branch is `codex/skate-phase-8`. The phase branches are pushed
to origin; `codex/multiple-skateparks` includes the complete series and additional
parks, with an integration PR targeting main.

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

## Additional skateparks

`codex/multiple-skateparks` adds two separate public-park sites alongside the
original mixed park. **Big Bowl Skatepark** has an approximately 21 m outer
width, an 11 m floor and 3.5 m walls. **Flow Yard Skatepark** has a wide mini
ramp, low flat bar, six-metre manual pad and ledge. Both are searchable on the
map; their concrete occupies clear corners away from ponds, benches and paths.
Bowl deck drop-in now handles every approach direction. Browser checks cover
all four drop-in directions, map entries, clearance and matching ground/rays;
the existing spot/transition and focused Node checks also pass.

## Playability fixes after hands-on feedback

The initial large-bowl renderer was too expensive and its dense seam pattern
made the surface noisy. Cached scalar face data, allocation-free ray tests,
column clipping and simpler shading reduce the measured bowl-visible frame
medians from 44.1/48.5 ms to 16.0/15.2 ms in the same fixed view.

Board toggling now clears transition/grind/manual state immediately; remounting
away from a bowl cannot restore its old coordinates. The chase distance is now
5.5 m, with bowl wall clearance and a rider-focused look target. Stronger pushes
build to a useful cruising pace (10 m/s push cap). A skate-specific tucked-leg
pose keeps the rider's feet over the board during flips, with more readable
flip timing. Concrete skins avoid ground-depth overlap at ramp feet.

Bowls remain raised because the base terrain renderer does not support a clean
negative-height cutout. Real walkable stairs connect the path to each bowl deck;
the big bowl map destination now leads to the foot of those stairs. Regression
checks cover stairs, board toggles/remounting, ordinary pushing and camera
framing, alongside the existing bowl, ramp, flip and grind tests.

## Pool shapes, stance and ramp pops

The mixed park's practice bowl is now an elongated pool, approximately 15 by
10 metres. Big Bowl is approximately 29 by 22 metres, with an asymmetric outline
of broad lobes and tighter pockets instead of a circular wall. Its walls are
3.2 metres high. Both retain walkable stairs to their raised decks.

The new pools share one analytic surface map between ground height, normals,
riding constraints, coping and a cached triangle mesh. The constraint carries
Cartesian momentum through changing curvature and conserves gravity work as the
rider climbs or descends. Coping airs round into a vertical takeoff; the contact
normal at the lip remains the bank normal within the small re-entry tolerance,
avoiding a false flat-deck landing. Near-plane-clipped triangle rasterisation
replaces per-pixel curved-wall ray scans for these pools.

In a serial ABAB comparison against main a5e00e6 at 177x66, the fixed Big Bowl
view measured main medians of 16.1/15.1 ms and new medians of 13.9/14.0 ms.
These are local observations, not a frame-rate guarantee. Geometry checks compare
normals and mesh vertices against the analytic surface, plus intermediate
triangle heights within six centimetres. Riding tests cover wall rollback,
carves through every quadrant and a coping air that re-enters without bailing.

Rider drawing now anchors the authored shoe geometry to the deck, including the
planted foot while pushing. Board flips and shuvits rotate in the takeoff plane,
retaining both ramp pitch and bank; the rider keeps the takeoff normal too.
Push bursts are now 2.8 m/s, tapering toward a 12 m/s cap. A bail lasts 2.4 s,
with a quick initial tumble, a visible ground hold and recovery; pushing can
shorten it only after 1.4 s. Mini-ramp pushes use the shared push cap rather than
the obsolete lower cap, which could previously subtract speed.

Validation: all skating Node tests and bundle freshness; 13 skating browser
regressions; 11 activity/reported-fix browser regressions; final focused pool,
transition and rider-pose browser checks. Physical gamepad feel still needs a
human playtest.

## Coping and air regression follow-up

Coping capture now resets the previous bowl bank, pitch and airborne rider
normal; grind balance adds only a small roll. A grind's contact state no longer
counts as airborne merely because its wheels are above the heightfield.

Each new flight captures its own orientation, including rolling off a lip or
rail. The first 100 ms retain the takeoff frame. Over the next 320 ms the base
board frame prepares for the predicted landing plane, while flip/shuv rotation,
catch timing and requested body spins remain separate. Without a requested
spin, a small yaw correction follows projected travel (including switch).
This allows a banked pop to return to a wall or land on the flat deck without
holding the takeoff bank indefinitely.

The coping belonging to the launch transition cannot steal that same flight.
Other coping catches require a closer, more parallel approach; ascending hops
cannot catch. Separate deliberate approaches and ordinary rail/ledge grinds
still work.

Heightfield normal sampling rejects step discontinuities and impossible steep
faces on generic terrain, while analytic ramps and transitions retain their
true normals. The real bowl stair corners are sampled in a browser regression
to ensure ordinary cruising cannot manufacture extreme vertical velocity. The
reported rare corner launch has not been reproduced exactly.

Validation: 43 Node tests; nine targeted browser cases for grinds, banked pops,
ramps, landing and rendering; three final browser cases for camera, bowl access,
and coping/stair corners. Isolated mutations removing the bank reset, launch
coping protection or landing-frame preparation each fail their regressions.

## Brake-to-fakie and raised-bowl access

Holding S, or pulling the gamepad left stick down, first brakes to a stop and
then builds a gentle backwards roll (4.5 m/s cap). Board heading and stance stay
unchanged, so this is fakie rather than rotating the rider. Releasing back
coasts; W pushes forward again. Gamepad B still brakes to a stop, and steering
while braking retains powerslides. The pause controls and skating help explain
the new action.

The shared `jump` action now checks grind/transition contact before treating
positive height above the heightfield as airborne. This repairs touch/simple
mouse jumps inside a bowl. Re-entry checks wait until within six centimetres
of the profile, rather than snapping a downhill hop back from 25 cm away.
Plain ollies are already caught; only tricks with board rotation need the
flip/shuv catch window. Short downhill pops therefore do not automatically bail.

Raised bowls now have solid outer deck walls with a swept entry check, so a
long frame cannot skip the wall and let heightfield ground lift the rider onto
the deck. Feet must already be within a normal 25 cm step of deck height to
enter there; the existing access stairs and deck drop-ins continue to work.
The curved inner riding surface remains separate from the outside collision.

Validation includes braking/reversing/coasting at several headings, gamepad
back versus brake, returning to forward travel, jumps up/across/down both real
pools through Space and the shared action, outside-wall approaches including a
long displacement, and stair/deck access. Existing grind, powerslide, ramp,
gesture and camera-related simulation checks are retained.


## Controller feel and shared controls

`CONTROLLER_IMPLEMENTATION.md` documents the shared controller layer, mappings,
new settings and validation. Skate steering has a softer radial response and
short attack/release easing, while right-stick gestures remain unfiltered.
Human-speed scoops work across 30/60/120 Hz, diagonal steering does not trigger
backwards braking, and camera/grab input cannot accidentally become a trick.
The same controller now reaches movement, vehicles, menus and activities.

## Fixed simulation clock and coordinated rendering

Skating now advances at 120 Hz through `city/skate-clock.js`. Input is observed
once per rendered frame; controller steering response, movement, body contact
and chase-camera smoothing advance on fixed ticks. Legacy direct simulation
helpers remain available. Other world modes keep their existing clock and the
50 ms frame cap remains, bounding catch-up to six skating ticks per frame.

Rider position, board orientation, airborne trick progress and chase camera
interpolate between the same two snapshots. Board frames use shortest-path
quaternion interpolation through vertical orientations and angle wraps. Drawing
uses temporary sampled state and restores authoritative physics in `finally`.
Pause, dismount, mode changes and teleports reset history. Fractional tick time
survives mixed short and 50 ms frames. Preferred speed, pop strength and camera
distance are unchanged; `SKATE_TUNING.md` separates research references from
playability choices and explains how to calibrate physical values.

Validation: scripted keyboard/controller push, carve and ollie trajectories
match at 30/60/120/144 Hz; mixed short/hitch frames match elapsed fixed time.
Board-axis, shared camera phase and renderer-error restoration checks accompany
a real-loop browser regression covering pause, hitch and teleport behavior.
Existing controller, camera, park geometry, ramp, grind and rollback browser
cases pass. Isolated mutations to timestep, camera phase and retained remainder
each fail the targeted regression.

Local serial ABAB timing against exact main `4ff9292` at 177×66 (1170 px
viewport), mounted stationary skating with live 60 Hz main-loop ticks: median
frame times main/branch were 16.9/15.9 ms, then 14.4/12.7 ms over 60 frames per
run after 20 warm-up frames. This shows no regression in that scene; it is not
an FPS guarantee. Third-person riding and popped poses were inspected visually.
