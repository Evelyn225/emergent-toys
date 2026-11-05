# Controller support

The browser polls one standard-mapped Gamepad API controller per animation
frame, including paused menus. Skating consumes that same snapshot. Xbox,
PlayStation and other controllers exposed with the browser's standard mapping
use the same button positions; the displayed names use Xbox labels.

## Playing

- Left stick: analog walking, vehicle steering or aircraft control. Click and
  hold to run/cruise. Right stick: look; click to switch available cameras.
- A: jump or activity action. X: interact. B: crouch/sit or activity back/leave.
- RT: use/fire a held item; LT: aim. In powered vehicles these are analog
  power and brake/reverse. Pedal boats, transit decks, ladders and parachutes
  route through their existing directional controls.
- Y: Actions. It lists the same contextual actions as the touch controls,
  including transport destinations, item use/reload, placement and less common
  actions such as hailing a taxi. It also offers inventory, map and camera.
- D-pad up: inventory; down: Actions; left/right: quick slots. Off the board,
  LB/RB also cycle quick slots. In activities, the D-pad is directional input.
- Start: pause/back. View/Back: map from play.

On the board, A pushes, X mongo-pushes, B brakes, left stick carves and right
stick performs gestures. Pulling the left stick straight back brakes into
fakie. Diagonal carving no longer accidentally engages that brake. Triggers
hold grabs. LB + right stick looks around without feeding the gesture
recognizer; release and centre the stick before starting a new trick. RB
interacts. Y's Actions menu includes using the board to get on/off it.

Menus use their existing DOM buttons and handlers, preserving purchase,
storage and waypoint validation. D-pad/left stick moves focus; A selects; B
backs out. Left/right adjusts sliders and select controls, while right stick
scrolls. The map uses right stick to pan, LB/RB to zoom, X to recenter and Y to
search. A on text inputs opens an on-screen keyboard: A types, X erases,
Y shifts case and B returns. The keyboard also fits narrow screens.

## Feel and lifecycle

Steering/look use a radial dead zone and softer centre response, reaching full
travel at 95% stick radius. Skate steering eases in over approximately 65 ms
and releases/reverses faster. Pre-wind reads the current steering target;
trick gestures are not smoothed. Straight flicks have a 240 ms window, scoops
up to 500 ms, and neutral/cooldown re-arming rejects quick spring rebounds.
Grabs and the camera modifier cannot accidentally become late flips.

Pause settings persist controller dead zone, look speed, steering response,
independent look inversion and vibration. Supported actuators receive short
pop/grind cues and impact-scaled landing/bail cues; unsupported actuators or
denied vibration requests are harmless. Pause/disconnect stops feedback. Keyboard input retains priority for shared
movement axes. Controller release cannot clear physically held keyboard keys.
Context changes quarantine carried buttons; a disconnect or focus loss clears
owned controls and pauses play. Controller-driven exits do not request mouse
capture.

## Reference

Inspected the Skate 3 recompilation and its runtime input/menu code:

- https://github.com/mchughalex/skate3recomp
- https://github.com/mchughalex/rexglue-skate3/blob/skate3-sdk-clean/src/input/xinput/xinput_input_driver.cpp
- https://github.com/mchughalex/rexglue-skate3/blob/skate3-sdk-clean/src/ui/overlay/simple_settings_overlay.cpp
- https://github.com/mchughalex/skate3recomp/blob/main/src/native/skate3_native_diag.h

The useful reference is separating continuous analog input from menu intents,
with held-button suppression and directional repeat. This implementation uses
independently written browser input code, rather than generated game physics.
Camera diagnostics in the recompilation also reinforce the importance of
consistent camera/rider sampling; a fixed physics tick with render interpolation
would be a separate simulation change. No world geometry or planting files are
changed by the controller implementation.

## Validation

Focused Node tests cover curves, frame-rate independent steering, malformed
inputs, rebound suppression and noisy partial-stick gestures at 30/60/120 Hz
(100 paths per trick/rate; at least 95% recognised). The existing skate
simulation, catch, bowl, grind and generated-bundle checks pass, as do the
existing aircraft and boat suites.

Five real-browser controller scenarios cover analog walking/look, jump/use,
mixed keyboard ownership, disconnect, Actions, inventory/quick slots, shopping,
storage, pause settings, map typing, single-poll skating, camera/trick separation,
vehicle throttle, activities, boats, aircraft, transit and parachute routing.
Existing map, transit-item, dashboard, skate camera/input and bowl regressions
also pass. Isolated mutations removing the response curve, steering smoothing
or scoop timing each fail the corresponding tests.

These are scripted Gamepad API checks. A physical controller has not been
available in this environment; tactile preference can be tuned through the
new settings.

After integrating main `aed2e4a` (including the planting/depth work), all 11
Node test files pass: 54 focused controller/skate/bundle cases plus the existing
aircraft and boat cases. All 18 final browser cases pass, including the five
controller flows, aircraft, skating and the merged world-quality regressions.
Desktop and 390 px controller typing screens, controller settings and the
third-person coping view were reviewed.

Serial ABAB measurements at 177x66 with a connected idle controller measured
main medians of 12.6/13.0 ms and this branch at 14.0/13.0 ms in the fixed park
view (about 5% higher on average). These are local observations, not a frame-rate
guarantee. All geometry/rendering changes from the other agent remain intact.
