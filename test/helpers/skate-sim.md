Skating overhaul: Phase 0 baseline
=================================

`skateSim(script, options)` runs the production `city/skate.js` and
`city/moves.js` in a fresh VM, without a browser. Each script entry holds a
complete keyboard state for `frames` fixed steps (default 1). Omitted keys are
released. Space uses down/up edges, as in `city/main.js`.

```js
const { skateSim } = require('./skate-sim.cjs');
const trajectory = skateSim([
  { frames: 42, keys: { KeyW: 1 } },
  { frames: 20, keys: { KeyA: 1 } },
  { frames: 20, keys: { Space: 1 } },
  { frames: 60 }
]);
```

Options: `dt` (seconds, defaults to 1/60), `speed` (cells/s), `yaw` (radians),
and `ground(x, y)` (height in cells, default flat). The return value includes an
initial snapshot followed by one snapshot per step. Positions are cells;
`z` and `vz` retain the production body's metres and metres/s conventions.

The baseline test records three push intervals, a left carve, and an ollie.
It also checks coasting, braking, arrow-mode kickflips and score banking.
Golden checkpoints describe today's behaviour, including its current high push
cap and charge-dependent pop. Revise them with a physics rationale in Phase 1.

Phase 1 adds `physics` overrides for frictionless invariant tests; the current
golden checkpoints intentionally use the new burst pushing and carving model.
The legacy curve is preserved in commit e823d73.

Phase 2 accepts `sticks: { left: [x, y], right: [x, y] }` and
`buttons: { push, mongo, brake }` in each script entry. These go through the
production Gamepad API adapter, including its radial dead zone and recognizer.
Missing keys, sticks and buttons are released at the next entry.

Scope: the world adapter permits unrestricted horizontal movement; no collision,
audio, city geometry, ramp impulses or grind catches are simulated. Keep the
browser skatepark suite for those integrations. The optional height callback
alone does not add park ramps; slope gravity uses the production surface sampler.

Run `node --test test/city-skate-sim.test.cjs`.
