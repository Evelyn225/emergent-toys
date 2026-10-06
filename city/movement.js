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
