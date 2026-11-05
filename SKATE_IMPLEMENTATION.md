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

## Ramp energy and powerslide stance fixes

Changing ground normals now bends the existing velocity onto the new plane
without increasing its magnitude. Carving on a bank also preserves speed before
its usual friction loss. Mini-ramp, round-bowl and pool entry use that same
bounded conversion; airborne entry projects away the normal impact velocity.
The downhill cap now bounds total speed, including its vertical component.
Touchdown overwrites the airborne velocity with the landed tangent velocity,
so a subsequent ground tick cannot turn impact speed into forward speed.

Powerslides require brake plus a deliberate steering input (>0.45 after the
controller response curve), and remain engaged down to 0.25 to avoid chatter.
The board eases into/out of the sideways stance. Grounded board orientation,
rider facing and the authored shoe anchor now share that stance; ordinary bank
riding uses the ground normal for the rider too. Dismount and touchdown clear
slide state. Walking, desired flat cruising speed and camera distance remain
unchanged.

Validation covers kinetic + potential energy over a rounded ramp, bounded entry
into all three transition implementations, braking corrections, slide engagement
hysteresis and easing. The real kicker launches without gaining energy or
bailing, and production drawing inputs keep rider stance aligned to the sliding
board. Existing ramp, loaded flip, grind, rollback and fixed-clock browser cases
pass. Removing energy transport or lowering the slide threshold fails the new
regressions.

Local serial ABAB against main `4ff9292`, 177×66 at 1170 px, live stationary
60 Hz skating: main/branch median frame times were 13.4/13.6 ms, then 14.2/13.3 ms
(60 measured frames after 20 warm-up frames). No material regression in this
scene; these are local observations. Day and night powerslide poses were
inspected: both shoes remain over the sideways deck.

## Deliberate air-outs, coping slides and fakie rollbacks

Hold C or controller RT when popping from a transition or crossing its coping
to air out onto the deck. The choice latches at takeoff; releasing the control
or spinning does not switch the flight. A normal coping air keeps upward and
along-coping momentum. A deliberate exit trades part of the upward component
for outward carry without adding speed; an exit pop adds its impulse upward.
RT remains reserved during that exit flight, avoiding an accidental held grab
and automatic landing bail. Q/E and LT still grab; RT can grab in other airs.
C retains sit/crouch behavior off the skateboard. Touch has a held Air out
button. Pause controls, skating help and the controller hint show the mapping;
the HUD identifies RETURN INSIDE versus AIR OUT: DECK.

Ordinary bowl flights have an inside-coping boundary assist, which removes
outward horizontal velocity at that boundary. It prevents a tangent across a
curved rim from accidentally becoming a deck exit; inward motion and height
remain free. Catch preparation samples the first ballistic contact with the
bank on that assisted path, cached at 20 Hz, rather than assuming flat ground.
Completed half/full spins can settle toward the new landing direction after
steering is released. An incomplete sideways spin still needs correction.

A normal return air remains protected from catching its own coping. An
intentional exit can catch it while descending; a crosswise board accepts a
wider travel approach and selects a boardslide. Separate deck approaches also
work. Ascending hops cannot catch. Grind capture still clears the bowl bank.

Bowl contact now follows the nearest forward/switch board heading instead of
forcing a 180 when travel reverses, so a straight rollback comes down fakie;
angled carving still follows the curve. Starting a push from rest uses camera
look to choose travel, preserving whichever parallel board heading is nearest.
W, gamepad A and forward on the left stick push; once moving, camera look does
not redirect momentum. Transition bottoms receive the same timed kick bursts.

Validation includes C/RT equivalence and latched choice, clean deck exits,
spinning return airs around four pockets of a curvy pool, round/oval rollbacks,
camera-facing regular/fakie starts and deliberate coping boardslides. Real-game
browser checks exercise keyboard C, RT plus a right-stick gesture, RT grab
suppression, return boundaries, both coping approaches, controls and a camera-
facing fakie push. Existing coping protection, bowl access and shared controller
browser regressions pass.

## Balance response and complete controller trick mapping

A/D now moves the visible balance mark left/right, rather than the previous
reversed sign. Grind corrections have a direct response plus stronger damped
control, so they can counter an already outward-moving wobble within 300 ms.
Manual A/D correction is now substantial too. Right-stick X and held right-drag
mouse X also balance grinds; fore/aft pressure changes grind variation without
lateral balance input unexpectedly changing its family. Manuals retain stick
or mouse Y pitch control, accept a wider correction range after starting, and
keep a held mouse's fore/aft pressure instead of decaying it away. Releasing a
balance drag no longer triggers the mouse's fallback ollie.

The gesture recognizer previously never emitted DS, WA or WD, leaving varial
heelflips, hardflips and inward heelflips inaccessible through controller/mouse
gestures. It now recognizes: right half-scoop, upper-right flick and release
for DS; left quarter-scoop then upper-right flick for WA; right quarter-scoop
then upper-left flick for WD. Diagonal flicks use direction plus magnitude,
so a partial stick at 45 degrees can kickflip/heelflip. Existing ollie, shuvit,
360 shuvit, 360 flip, nollie and late-flip behavior remains covered. Pause
controls describe the full mapping.

Regression tests cover recovering an outward-drifting grind using A, right
stick and sustained mouse movement; manual gauge direction/correction;
100 noisy paths per newly mapped combination; partial diagonal flicks; and
all nine tricks through the actual shared controller adapter. The existing
browser grind fixtures now counter the meter with A when it is right of centre,
and deliberately push D to lose balance, matching the corrected visible sign.

A stopped push's direction is captured when input is observed, before any
render-only frame can advance the chase camera. This keeps camera-facing starts
consistent at render rates above the 120 Hz simulation tick. Bowl-air camera
framing now follows the rider's height, keeping deliberate exits in view.

Local serial ABAB on actual curvy-pool airs against main `4ff9292`, 177×66 at
1170 px: median main/branch frame times 15.5/17.5 ms, then 19.0/17.4 ms. Results
vary between runs; the mean of the two medians differs by about 1.2%. These are
local observations, not an FPS guarantee. Return/exit poses and route indicators
were inspected, including the revised air framing. Isolated route, rollback,
camera-push, RT-selection and coping-protection mutations fail regressions.

## Fakie push direction and coasting at cruising speed

A new push while already rolling now chooses forward/fakie from actual travel,
so releasing and pressing W again while fakie reinforces tail-first motion.
Previously only a push started from rest could choose fakie; later kicks fell
back to the nose direction. From-rest camera selection is unchanged. Airborne
input and touchdown clear the kick direction so a later ground push chooses
from its new travel rather than retaining a stale takeoff heading.

The authored push/mongo figure now faces the same direction as the kick while
the board keeps its heading and stance. Its planted shoe remains anchored to
the deck. Interpolated drawing snapshots include kick direction, pushing state
and mongo state, so rendering cannot show a different kick from the simulated
one. Dismount clears kick phase and pushing flags immediately.

Holding push coasts at the top of the sustainable flat-speed range, then resumes
only after a clear speed drop. The thresholds are 88% / 84% of the push cap
(currently 10.56 / 10.08 m/s). This reflects the existing tapered kick/drag curve,
which settles below the hard 12 m/s cap, rather than waiting for an unreachable
exact cap. The hard cap, burst strength and camera distance remain unchanged.
Ground and transition-bottom kicks use the same hysteresis.

Validation scripts repeat separate regular/fakie and mongo kicks at several
headings, assert tail-first acceleration without a board turn, and verify idle
coasting and resumed kicks from one held input. A real-browser regression checks
both the drawn figure heading and impulse direction, preserves the planted
push/mongo leg, and catches stale phase across resets. The former test expecting
W to reverse an already moving fakie run now explicitly checks the requested
behavior: stop first to choose a new direction; moving pushes reinforce travel.

The browser push/pose, fixed-clock, shoe-anchor and reverse/bowl cases pass.
Removing the moving-fakie direction choice or the cruise gate fails its isolated
regression. Local serial ABAB against exact main `4ff9292`, 177×66 at 1170 px:
median main/branch frame times were 13.0/13.0 ms, then 13.5/13.4 ms (60 frames
after 20 warm-up frames). Regular/fakie push poses were inspected. These local
observations are not an FPS guarantee.

## Responsive stop/pivot/reverse, free orbit and lip grace

S or left-stick back now brakes at 6 m/s² (previously 2.5). Continued back input
after stopping commits a 240 ms 180-degree board/rider pivot, then starts timed
push kicks in that new direction. Releasing back coasts. Gamepad B remains a
brake-only action; brake plus strong steering powerslides at 11 m/s². The pivot
works on streets and flat transition bottoms. Steep-wall rollbacks without a
back-input pivot remain fakie. This replaces the previous deliberate S action
that kept the heading fixed and built a slow 4.5 m/s tail-first roll.

Kick direction is now checked against live momentum throughout a held push,
including when gravity reverses a hill climb. The previous per-press latch could
remain forward after a rollback. From-rest camera-direction choice and cruise
coasting still apply. Tests model natural fakie independently of S, since S is
now an explicit turn-around action.

Skating mouse look and controller LB + right-stick look can orbit through any
number of full turns. The chase camera keeps a continuous following heading
and a separate unbounded look offset, rather than clamping at +/-2.6 radians.
After looking stops, idle recentering discards complete windings from both the
offset and camera phase together, preserving its physical position and returning
by the short arc. A deliberate pivot clears the orbit offset and the chase
camera follows the new board direction. Air spins still do not turn the camera.

Natural coping takeoffs retain one 120 ms lip-pop opportunity. A Space load or
stick/mouse gesture started on the wall can finish just after takeoff and still
be a normal pop/flip, rather than disappearing or becoming a weaker late flip.
It uses the takeoff normal/current velocity and the same pop strength and spin
pre-wind as a transition pop; air-out uses its upward pop direction. C/RT can
choose an exit during this grace as part of the deliberate pop. The opportunity
is consumed once, expires, and clears on unrelated flight/landing/dismount/bail.
RT is reserved during the grace so an exit flick cannot become an accidental
grab. Existing later airborne flips remain distinct from a new pop.

Validation covers stop time from 8 m/s, stationary pivot before reverse kicks,
keyboard/controller equivalence, transition-flat pivots, release/coasting,
natural fakie, and live kick direction during a held-input hill rollback.
Space and gamepad flick scripts exercise lip grace and expiry. Real browser
checks cover camera follow, three full mouse orbits, multiple controller orbits,
short-arc recentering, both grace inputs, late RT air-out and no double pop.
Existing fixed-clock, bowl access/landing, shoe-anchor, camera and controller
regressions pass. The old reversal browser run is shorter to keep the new,
faster push-away on its clear approach before reaching the next ledge.

Final validation: 84 focused Node checks and five rebuilt-bundle browser cases
pass. Isolated mutations restoring weak brakes, disabling the pivot, retaining
a stale held-push direction or removing lip grace fail their regressions. Camera
mutations restoring the old orbit clamp or removing phase adjustment during
recentering also fail their regressions. Local serial ABAB against exact main
`4ff9292`, 177×66 at 1170 px: median main/branch frame times 13.9/15.3 ms, then
14.8/13.0 ms (60 frames after 20 warm-up frames). There is no consistent increase
in these local observations; they are not an FPS guarantee. Street-content PR
#431 remains separate and preserved.
