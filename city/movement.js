// Moderate loss of tyre grip follows lingering wetness and accumulated, exposed snow.
function roadTraction(x, y) {
  const water = clamp(Math.max(wet, rain * 0.65), 0, 1);
  const cover = snowCover > 0 && snowExposed(mod(x, N), mod(y, N)) ? clamp(snowCover, 0, 1) : 0;
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
