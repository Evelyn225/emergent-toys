// Moderate loss of tyre grip follows lingering wetness and accumulated, exposed snow.
function roadTraction(x, y) {
  const water = clamp(Math.max(wet, rain * 0.65), 0, 1);
  const cover = snowCover > 0 && snowExposed(worldCoord(x), worldCoord(y)) ? clamp(snowCover, 0, 1) : 0;
  return Math.max(0.55, (1 - water * 0.2) * (1 - cover * 0.4));
}

// Air input accelerates along the camera-relative wish direction without replacing existing momentum.
const AIR_ACCEL = 8, AIR_WISH_CAP = 0.7;
function airStrafe(forward, side, speed, dt, yaw = a) {
  if (dt <= 0 || !Number.isFinite(speed)) return;
  const input = Math.hypot(forward, side);
  if (!input) return;
  const cx = Math.cos(yaw), cy = Math.sin(yaw);
  const wx = (cx * forward - cy * side) / input, wy = (cy * forward + cx * side) / input;
  const wishSpeed = speed * input, vx = body.mx || 0, vy = body.my || 0;
  const add = wishSpeed * AIR_WISH_CAP - (vx * wx + vy * wy);
  if (add <= 0) return;
  const acceleration = Math.min(add, AIR_ACCEL * wishSpeed * dt);
  body.mx = vx + wx * acceleration; body.my = vy + wy * acceleration;
}
// Hopping (body.hop > 1), your momentum also swings round toward where you're going, rate radians a second, at the
// same speed: a run of hops follows you round a corner in the air instead of jerking round on each landing.
function airSteer(wx, wy, rate, dt) {
  const vx = body.mx || 0, vy = body.my || 0, v = Math.hypot(vx, vy);
  if (dt <= 0 || v < 1e-6 || !(wx || wy)) return;
  const va = Math.atan2(vy, vx), turn = clamp(mod(Math.atan2(wy, wx) - va + Math.PI, Math.PI * 2) - Math.PI, -rate * dt, rate * dt);
  body.mx = Math.cos(va + turn) * v; body.my = Math.sin(va + turn) * v;
}
