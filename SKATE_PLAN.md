# Skating overhaul plan

Goal: skating that feels physical and analog, in the style of modern console skate games. Momentum, weight and
gravity on every slope. Tricks come from stick gestures, not button presses. You ride transitions (mini ramps, then
bowls and vert), and you fall when you get it wrong. This is a plan for a series of PRs, each one playable and tested
on its own. Nothing here copies another game's names, art or levels. It's about the feel of the mechanics.

Code today: `city/skate.js` (riding, tricks, grinds, camera, skater drawing), `city/skatepark.js` (park, grind edges,
ramps, `skateparkGround`, `rampHeight`, `skateRampStep`), `city/skatepark-render.js` (shading, `rayRamp`),
`city/moves.js` (`stepBody`, `POP_V`, `TRICKS`, the first-person board), `city/main.js` (mouse flick, `move`).
Tests: `test/browser/city-skatepark.browser.test.cjs`, plus skate cases in `ascii-city.browser.test.cjs`,
`city-activity-feedback`, `city-reported-fixes`.

## 1. What makes it feel right (the pillars)

1. **Momentum is real.** Speed is a velocity vector. Gravity acts along every slope: you speed up downhill, slow
   uphill, stall and roll back down. Pushing adds a little speed each kick, up to a modest cap. Hills and ramps give
   the rest.
2. **The board is analog.** Steering leans you into a carve whose radius depends on speed. Turning hard at speed
   costs speed. Stopping takes a foot drag or a powerslide.
3. **Tricks come from the right stick.** Pull back to load, flick forward to pop. The direction and shape of the
   flick picks the trick, and its speed sets the pop. Holding a direction on the left stick while you pop pre-winds a
   spin.
4. **The landing is a catch.** Board and rider turn separately in the air. You land clean when the board is level
   with the surface, wheels down, and lined up with where you're going (or the reverse, riding switch). Getting close
   gives a sloppy landing. Getting it wrong is a bail.
5. **Transitions carry you.** On a ramp you're stuck to a curve. Speed turns into height and back, and at the coping
   you go straight up and come back down into the same ramp.
6. **The camera sells speed.** It sits low behind you and lags a little in turns, widens with speed, frames the air,
   and never cuts.
7. **Bails are physical.** The rider tumbles, the board shoots off, and you get up quickly. No timers or menus
   between attempts.

## 2. Where it is now

- **Speed and steering:** speed (`SK.v`) and heading (`SK.dir`) are separate scalars. Pushing with W adds speed up to
  `SK_TOP` or `SK_RUN_TOP`. A and D turn the heading directly, so you steer the way a car turns.
- **Height:** `body.z` and `body.vz` handle height, with gravity in `stepBody`. Ground height comes from
  `walkGround`, a heightfield. There are no surface normals, and nothing beyond the slope in `skateRampStep` speeds
  you up or slows you down.
- **Tricks:** Space loads and pops. The arrow keys, or a right-mouse flick, choose from 7 flip tricks.
- **Spins and landing:** A and D spin you in the air. Landing checks the angle between your yaw and your heading.
  Switch stance is tracked.
- **Grinds:** these are fixed edges (`GRINDS`). You lock onto one coming down within 60° of its direction. You
  balance with A and D, and Space pops you off.
- **Ramps:** the funbox and kicker are sloped heightfield ground. The kicker launches with a one-off velocity.
- **Limits that block the goal:**
  - There's no roll-back, no fakie and no gravity along the slope in general.
  - Nothing can be vertical.
  - The board has no pitch or roll of its own, so you can't land at an angle to a slope.
  - There's no gamepad support.
  - Flicks are only read as which direction you dragged in, not the shape of the gesture.

## 3. Architecture changes

### 3.1 Board state (replaces `SK.v` and `SK.dir` as the source of truth)

```
SKB = {
  p: [x, y, z],            // world position (cells; z in cells like walkGround)
  v: [vx, vy, vz],         // velocity (cells/s)
  yaw, pitch, roll,        // board orientation (radians); the rider's body yaw is separate: riderYaw
  contact: 'ground' | 'air' | 'grind' | 'manual' | 'transition' | 'bail',
  surf: { n: [nx, ny, nz], kind, material, ref },  // the surface under the wheels and what it is
  stance: 1 | -1,          // regular / goofy facing; switch = travelling tail-first
  trick: { flip, shuv, spin, grab, t, catchT },    // what the board and rider are doing in the air
}
```

Keep `SK.v`, `SK.dir`, `body.z` and `body.vz` as values derived from `SKB` for one release, so the HUD, scoring,
sound and tests keep working. Then move them over.

### 3.2 The surface function

Replace bare `walkGround` for skating with `skateSurface(x, y, zHint)`, which returns `{ h, n, kind, material, ref }`:

- **Heightfield sources:** streets, kerbs, steps, park features and ramps. The normal comes from a central
  difference over about 0.02 cells, or analytically for ramps.
- **Transitions** (§3.4) report the transition they belong to, so the rider can switch to its own constraint.
- **Results are cached:** for each cell, store which park primitives overlap it, to keep the 9-bucket scans cheap.

### 3.3 Ground integration (every frame, contact = 'ground' or 'manual')

1. **Gravity along the slope:** `g_t = g - (g·n) n`, with `g = [0, 0, -0.98]` cells/s².
2. **Rolling and air drag:** subtract rolling resistance (`μ_r` about 0.012, varying by material: smooth concrete is
   low, asphalt higher, brick and grass high) and air drag `k |v| v`.
3. **Carving:** steering input `s` (−1..1) bends the velocity's horizontal direction at a yaw rate of
   `ω = s · ω_max · f(speed)`. `f` is close to 1 when slow and falls to about 0.45 at top speed, so you carve wider
   when fast. Each radian of hard carving costs a small fraction of speed.
4. **Pushing:** each kick is a fixed burst, about 0.6 m/s at low speed, falling to 0 near the push cap (about 6 m/s).
   Two styles: front-foot pushing (W) and mongo (Shift+W), which looks different but works the same.
5. **Braking:**
   - **Foot drag (S):** a steady deceleration of about 2.5 m/s².
   - **Powerslide (S plus a direction):** turns the board 90° and scrubs off speed quickly, then straightens.
     It can be scored.
   - **Revert:** a powerslide straight after landing. It extends a combo.
6. **Staying on the surface:** project the velocity onto the surface plane. If the surface ahead falls away faster
   than the velocity's curvature allows (you're going over a lip or a drop), switch to `air` and keep the velocity.
   That one rule covers kickers, ledge drops and stairs, so `skateRampStep`'s hand-made launch can go.
7. **Stalls and roll-back:** if speed along the slope drops below 0.05 m/s while you're pointing uphill, the board
   starts rolling backwards. You keep the stance and ride fakie. Flip `SK.dir` and mark the run as fakie for scoring.

### 3.4 Transitions (mini ramp, then bowl, then vert)

A heightfield can't hold vertical walls, so transitions get their own constraint:

- **Shape:** a transition is a 2D profile extruded along an axis: radius `R`, height `H`, a flat bottom, an
  optional vertical extension `E`, and coping at the top. Quarter pipes, mini ramps (two quarters facing each other)
  and spines are all built from these. Bowls come later, as profiles swept round corners (§6, Phase 6).
- **The rider's position on it:** while you're on one, your position is `(s, a)`, where `s` is the arc length up the
  profile and `a` is the distance along the axis. Your velocity is `(ṡ, ȧ)`. Gravity along the curve is
  `-g · sin(θ(s))`, where `θ` is the profile angle. That gives roll-up, stall and roll-back for free.
- **At the coping:** going up past it, `θ` is 90°, so the velocity is vertical plus whatever is along the axis.
  Switch to `air` with that velocity. You fly straight up and come back down onto the same profile, which is a vert
  air.
- **Re-entry:** the landing test (§3.6) uses the profile normal at the touchdown point. Landing with a vertical
  board on the vertical section is valid.
- **Entering:** you roll in from the bottom, or drop in from the deck with tail on coping and lean forward (W while
  stalled on the deck edge).
- **Ramp tricks:** coping grinds and stalls use the grind system with the coping as an edge. Also: rock to fakie,
  axle stall, 50-50 stall.
- **Drawing:**
  - Extend `rayRamp` into `rayProfile`. In local coordinates, intersect the ray with the profile's polyline
    (12 to 16 segments) extruded along the axis, using a 2D segment test.
  - It isn't convex, so test every segment and keep the nearest hit.
  - Faces: the curved face has a normal for each segment (smooth-shaded by interpolating along `s`), plus the deck,
    the sides and the coping tube.
- **Camera:** in a transition, the camera follows the profile normal, pulling back and up so you can see the
  coping.

### 3.5 Input (keyboard and mouse first, gamepad as well)

| Action | Gamepad | Keyboard + mouse |
|---|---|---|
| Steer / lean | Left stick X | A / D |
| Pre-wind a spin (held into the pop) | Left stick X at the pop | A / D held at the pop |
| Push / mongo | A / X face buttons | W / Shift+W |
| Brake, powerslide | B, plus direction | S, plus A or D |
| Pop and flip | Right stick gesture | Right mouse drag gesture (exists), or Space plus arrows (keep for touch) |
| Grabs | Triggers L/R, plus right stick direction | Q / E held in the air, plus mouse direction |
| Manual / nose manual | Right stick held down or up, gently, on the ground | Mouse held back or forward gently with right button |
| Air spin | Left stick in the air (slower than the pre-wind) | A / D in the air (exists) |

- **Gamepad:** use the browser Gamepad API (`navigator.getGamepads()` polled once a frame), with a dead zone of
  0.15 and radial scaling.
- **Gesture recognizer:** a new file, `city/skate-gestures.js`, fed a stream of stick samples (or mouse drag
  deltas, normalised):
  - **Load:** the stick pulled past 0.6 towards the tail (down, for a regular stance).
  - **Pop:** a flick from the load to past 0.6 in some direction within 180 ms. The speed of that move, over about
    120 ms, sets the pop strength (0.7 to 1.15 times `POP_V`).
  - **Trick:** chosen from the flick's direction and whether it curls to one side:
    - straight forward: ollie
    - forward and left: kickflip
    - forward and right: heelflip
    - a back half-circle: shuvit
    - a three-quarter circle: 360 shuvit or 360 flip
  - **Nollie:** load towards the nose instead.
  - **Late flip:** a second flick while in the air.
  - **Rolling buffer:** keep about 400 ms of samples in a rolling buffer, so a gesture can start just before the
    load is recognised.
- **Mouse:** turn mouse movement into a virtual stick (the drag with the right button held already works this way).
  It relaxes back to the centre after about 150 ms. It feeds the same recognizer, so mouse and gamepad play
  identically.
- **Keeping existing controls:** keep the arrow-key and touch controls as a simple mode that maps to the same trick
  table.

### 3.6 Air and the catch

- **Separate rotations:** in the air, integrate the rider's yaw (spin) and the board's flip, shuvit and pitch
  separately.
  - **Flips:** a flip rotates the board around its long axis over the trick's duration, scaled by pop strength.
  - **Catch:** the board is "caught" when the trick's flip completes. Catching early or late leaves residual roll
    or pitch, so you can land half-flipped.
- **Landing test**, at touchdown, against the surface normal `n` and the horizontal velocity `v_h`:
  - **Wheels down:** the board's up vector · `n` > cos 25°.
  - **Lined up:** the angle between the board's long axis and `v_h` is under 20°, or within 20° of 180° (switch).
  - **Caught:** the trick finished with at least 70% of its catch window left before touchdown.
  - Pass all three and it's clean. Each one up to 1.6 times its threshold is sloppy (half points, speed × 0.7, a
    scuff sound). Anything worse is a bail.
- **Steep landings:** on transitions and banks the same test uses the profile normal, so landing nose-down onto a
  slope is valid and keeps the speed, the way it should. Landing flat on flat ground from a big drop costs speed in
  proportion to the vertical impact.
- **Grabs:** a hold on the trigger or Q/E plus a direction picks the grab: mute, indy, melon, stalefish, nose or
  tail. Points scale with how long you hold it. You must let go before touchdown, or it's a bail.

### 3.7 Grinds 2.0

- **Edges everywhere:** extract grindable edges automatically from city geometry: kerbs (the tops of the existing
  kerb pieces), planters, ledges, park features, handrails at steps, bench fronts and coping. Store them as
  polylines (`GRIND_PATHS`), not single segments, so kinked and curved rails work.
- **Locking on:** look for the nearest point on any path within 0.08 cells while you're coming down, or rolling
  level with a ledge's top within 3 cm (a ledge you ollie onto counts too).
  - The board's angle to the edge at lock-on picks the family: 50-50 or 5-0 or nosegrind; crooked or overcrook;
    smith or feeble (truck dropped over the far side); boardslide or lipslide; noseslide or tailslide (one end on
    the edge).
  - The right stick held during the grind changes the variation. Nose or tail pressure gives nosegrind or 5-0.
- **Speed:** keep the velocity along the path. Friction depends on material (steel 0.02, waxed concrete 0.04,
  stone 0.06, wood 0.08), and gravity applies along the path's slope, so you speed up down a handrail.
- **Balance:** a spring-damper wobble, kept upright with the left stick or A/D. The noise grows with time and with
  a less stable family (crooked and smith wobble more). A balance meter is drawn in ASCII.
- **Getting off:** pop with a flick off the rail (a flip-out), run off the end (dropping with your momentum), or
  bail. Popping onto another edge chains the combo.

### 3.8 Manuals

- **Starting one:** gently holding the stick back (or forward, for a nose manual) on the ground tips the board
  onto two wheels.
- **Balance:** a pitch balance like grinds (§3.7), with A/D or the left stick for minor correction and the stick's
  depth for the main control.
- **Combos:** a manual extends a combo across flat ground. Manual pads, ledges and kerbs are where you link them.
- **Losing it:** tip too far back and the tail scrapes, slowing you and ending the manual. Too far forward and you
  bail onto the nose.

### 3.9 Camera

- **Default position:** behind the board, about 2.6 m back and 1.1 m up, looking at a point 1.5 m ahead of the
  rider.
- **Lag:** yaw follows with a spring (time constant about 0.18 s), so carves swing the view slightly. FOV widens
  from the setting up to +12° at top speed.
- **In the air:** the camera stops following yaw while you're in the air, so spins read as spins. It eases back to
  following after landing.
- **Transitions:** pull out to keep the coping and deck in frame (§3.4).
- **Grinds:** sit a little lower and off to the side of the rail.
- **Walls and buildings:** keep the existing `skateClear` raycast, and add smoothing so the camera never pops in or
  out.

### 3.10 Bails

- **What happens:**
  - The rider becomes a short tumble animation that carries the impact velocity, with a few authored poses blended
    by direction and speed.
  - The board becomes a free body with its own velocity, spin and bounces. It comes to rest and you pick it up.
- **Getting back up:** about 1.2 s, or less if you press push to get up sooner. You keep your position, unlike
  respawning at a spot.
- **Sound:** an impact sound scaled by the impact speed.

### 3.11 Numbers (real units first; convert to cells with ÷10)

| Thing | Value |
|---|---|
| Push cap on flat | 6 m/s |
| Top speed (downhill, aero) | 14 m/s |
| Push burst | 0.6 m/s |
| Rolling resistance (smooth concrete) | 0.012 |
| Air drag k | 0.004 /m |
| Ollie pop (normal) | 2.9 m/s up (about 0.45 m) |
| Strong pop | 3.4 m/s (about 0.6 m) |
| Gravity | 9.8 m/s² |
| Flip duration | 0.32 s (kickflip), 0.42 s (360 flip) |
| Air spin rate (pre-wound) | 540°/s for 0.5 s of air time |
| Mini ramp | R 1.8 m, H 1.4 m, no vert, coping 6 cm tube |
| Vert ramp | R 3.0 m, H 3.6 m, E 0.6 m |

These are starting points to tune in Phase 7.

## 4. Phases (each one a PR, playable on its own)

**Phase 0: harness.**
- A deterministic skate simulation for tests: fixed dt, scripted input frames (stick vectors, buttons), and recorded
  trajectories. It gets a `skateSim(script)` helper in a test util.
- Golden trajectories for today's behaviour, so changes are deliberate.
- *Done when:* tests can script "push 3 times, carve left, ollie" and assert on the speed and position curves.

**Phase 1: velocity and slope gravity.**
- Add `SKB` and `skateSurface` with normals, the ground integration in §3.3, roll-back, fakie and powerslides.
- Remove the hand-made speed changes from `skateRampStep`. Lip launches come from leaving the surface.
- *Done when:*
  - The funbox and kicker behave as now or better.
  - Rolling up the funbox slowly, you stall and roll back to fakie.
  - City hills speed you up.
  - The existing skate tests pass, or are updated with reasons.

**Phase 2: input.**
- The gamepad, the gesture recognizer, a virtual stick from the mouse, and the controls table (§3.5).
- Keep the arrow keys and touch as a simple mode.
- *Done when:* each trick is recognised from scripted stick paths in tests (100 per trick, with noise, at least 95%
  correct). A pause-menu "Controls" page shows the mapping.

**Phase 3: air, catch, landing, manuals.**
- Separate board and rider rotation, the catch, the landing test (§3.6), grabs, manuals (§3.8), reverts.
- *Done when:*
  - Scripted early, late and on-time catches land as bail, sloppy and clean.
  - A manual across a 6 m pad links two tricks into one combo.

**Phase 4: grinds 2.0.**
- `GRIND_PATHS` from city geometry, grind families, gravity along the path, transfers.
- *Done when:*
  - Kerbs and handrails in at least three districts are grindable.
  - A kinked rail grinds through its kink.
  - Grinding down a handrail speeds you up.

**Phase 5: mini ramp.**
- Transition profiles, the constraint, `rayProfile` drawing, coping grinds and stalls, drop-ins.
- Place one mini ramp in the skatepark (there's room at the park's south end).
- *Done when:*
  - Pumping back and forth keeps you going.
  - An air at the coping comes back down into the ramp.
  - Rock to fakie and a 50-50 stall on the coping work.
  - Frame time at the ramp stays within 10% of the park without it.

**Phase 6: bowl and vert.**
- Profiles swept round corners (quarter-circle extrusion pieces) to make a small bowl, and a vert ramp with
  extension.
- *Done when:* carving round the bowl's corner keeps you on the wall, and vert airs reach about 1.5 m above the
  coping.

**Phase 7: camera, sound, tuning.**
- The camera in §3.9, wheel sound by surface, a grind pitch for each material, and landing thuds by impact.
- Tune against the numbers table.
- *Done when:* a playtest checklist is signed off (smooth carving, readable spins, no camera pops).

**Phase 8: spots.**
- Stairs with handrails and gaps, kerb lines, plazas with ledges, and a DIY spot under the el.
- Mark them on the map.

## 5. Tests to keep honest

- **Physics invariants:**
  - On a frictionless profile, energy is conserved within 2% over a pump cycle.
  - On a flat with no input, speed only falls.
  - Stall and roll-back happen at the height `v²/2g` predicts.
- **Input:** recognition rates for tricks from noisy scripted gestures (Phase 2). No false pops from steering.
- **Landing:** a grid of board orientations at touchdown is classified clean, sloppy or bail as specified.
- **Grinds:** you lock onto each path type, the family comes from the approach angle, and you leave from the end
  with your momentum.
- **Performance:** frame time in the skatepark and on a transition, ABAB against main.
- **Regression:** the existing skatepark, ramp, grind and combo tests.

## 6. Risks and how to handle them

- **Readability in ASCII:** board flips and grabs are small at character resolution. Draw the board larger in third
  person while it's flipping, and put the trick name and catch timing on the HUD as text.
- **Keyboard limits:** analog steering and gestures are weaker on keys. The mouse virtual stick is the main
  keyboard-and-mouse path. Keep the arrow-key mode for accessibility.
- **Transition cost:** keep the profile rays cheap (one 2D polyline intersection), cull by bucket, and reuse the
  `rayBoxColumn` bounds.
- **Breaking existing play:** keep the derived `SK` and `body` fields until Phase 3 is done. Each phase lands behind
  its tests.
- **Overlapping work:** another agent worked on the skatepark and grinds. Check `git log -- city/skate*.js` before
  each phase and rebase onto it.
