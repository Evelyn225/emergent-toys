# Skate tuning references

Keep physical units separate from game feel. World positions use cells (10 m);
`body.z`, `body.vz`, `GRAV` and `POP_V` use metres and seconds. See
`city/skate-physics.js`, `city/skate.js` and `city/moves.js` for current values.

## Useful primary sources

- [Heinen et al., Maximizing ollie height (2024)](https://link.springer.com/article/10.1007/s12283-023-00448-y)
  has [public model code](https://github.com/mechmotum/ollie-optimization).
  Example inputs in `thesis-files/MultiPhaseOllieOptimization.py` include gravity
  9.81 m/s², an 80 kg rider, 0.83 m deck, 0.444 m wheelbase and 49 mm wheels.
  These describe one model setup, not universal optimal settings. Its shoe/board
  friction coefficient is not wheel rolling resistance. Its instantaneous board
  velocities are not the rider's launch velocity.
- [Nakashima and Chida, Simulation of an ollie (2021)](https://www.jstage.jst.go.jp/article/mej/8/5/8_21-00230/_article)
  compares a model with measured motion. It helps with pop/foot-release ordering;
  it does not supply a complete game's steering, catch or input curves.
- [ASME skateboard rolling-friction study abstract](https://imece.secure-platform.com/a/solicitations/121/sessiongallery/5908/application/56597)
  describes coast-down measurements across boards and surfaces. The accessible
  abstract supplies a measurement method, not numerical coefficients to copy.
- [Fix Your Timestep](https://gafferongames.com/post/fix_your_timestep/) explains
  the accumulator and previous/current render interpolation used here. This is
  an integration reference, not a source of skate force values.

A decompilation reconstructs readable source from a binary; a recompilation
translates compiled logic to another target. Either can expose useful evidence,
but named parameters, units and call sites matter more than the label. The
[Skate 3 recompilation](https://github.com/mchughalex/skate3recomp) has useful
runtime diagnostics; it has not supplied verified force or tuning tables for
this implementation. No proprietary tuning numbers have been inferred from it.

## Current baseline and deliberate choices

| Setting | Current value | Interpretation |
|---|---|---|
| Gravity | 9.8 m/s² | Physical baseline |
| Normal pop | 2.9 m/s | Gameplay launch speed; ideal ballistic rise 0.43 m, flat flight 0.59 s |
| Strong gesture pop | 1.15 × normal | Ideal ballistic rise 0.57 m; not measured board clearance |
| Forward push cap | 12 m/s | Deliberately fast gameplay, requested during playtesting |
| Low-speed push burst | 2.8 m/s | Gameplay acceleration, not a measured kick |
| Concrete/asphalt rolling coefficient | 0.012 / 0.018 | Starting calibration knobs, not source-validated measurements |
| Air drag | 0.004 /m | Starting calibration knob |
| Foot brake | 2.5 m/s² | Starting calibration knob |
| Camera distance / height | 5.5 m / 2 m | Readability and user preference; aspect and collision adjustments apply |
| Clean wheels-down / alignment limits | 25° / 20° | Gameplay forgiveness |

The fixed-step change retains these settings. It advances skating at 120 Hz
and samples rider, board and chase camera at the same interpolation fraction.
Inputs are observed once per rendered frame; steering response advances on
fixed ticks. Other world systems retain their existing clock. The existing
50 ms world-frame cap remains, limiting catch-up to six skate ticks per frame.
Interpolation introduces up to one tick (8.3 ms) of visual delay.

## How to tune with evidence

Measure speed against distance and time on a known flat, with pushing off.
Fit coast-down deceleration to `-dv/dt = mu*g + k*v²` in metres and seconds;
use low speeds to separate rolling resistance from the high-speed drag term.
Repeat per surface. Set the push rhythm and speed cap separately as game feel.

For carving, compare turn radius `v/omega` at several speeds rather than copying
a yaw rate without its speed curve. For pops, record launch speed, apex, flight
time and board clearance separately; a rider's ballistic rise is not the height
of an obstacle the board clears. Tune catch windows with actual touchdown time,
not the rendering frame rate. Use the scripted fixed-rate and mixed-frame tests
before changing integration or damping, and playtest banks, coping and flat
landings before adopting values from a different model.
