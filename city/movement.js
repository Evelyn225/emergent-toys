// Moderate loss of tyre grip follows lingering wetness and accumulated, exposed snow.
function roadTraction(x, y) {
  const water = clamp(Math.max(wet, rain * 0.65), 0, 1);
  const cover = snowCover > 0 && snowExposed(worldCoord(x), worldCoord(y)) ? clamp(snowCover, 0, 1) : 0;
  return Math.max(0.55, (1 - water * 0.2) * (1 - cover * 0.4));
}

// Air input accelerates along the camera-relative wish direction without replacing existing momentum.
const HOP_TURN_RATE = 1.4; // radians per second, limiting abrupt mouse reversals
const AIR_ACCEL = 1.4, AIR_WISH_CAP = 0.3; // chained hops
const JUMP_AIR_ACCEL = 8, JUMP_AIR_WISH_CAP = .7; // a deliberate single jump can still round a corner
function airStrafe(forward, side, speed, dt, yaw = a) {
  if (dt <= 0 || !Number.isFinite(speed)) return;
  const input = Math.hypot(forward, side);
  if (!input) return;
  const cx = Math.cos(yaw), cy = Math.sin(yaw);
  const wx = (cx * forward - cy * side) / input, wy = (cy * forward + cx * side) / input;
  const wishSpeed = speed * input, vx = body.mx || 0, vy = body.my || 0;
  const hopping=(body.hop||1)>1.01;
  const add = wishSpeed * (hopping?AIR_WISH_CAP:JUMP_AIR_WISH_CAP) - (vx * wx + vy * wy);
  if (add <= 0) return;
  const acceleration = Math.min(add, (hopping?AIR_ACCEL:JUMP_AIR_ACCEL) * wishSpeed * dt);
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

// A rigid chassis follows the plane through its four tyre contact samples.
function vehicleGroundFrame([hl,hw],x,y,hx,hy,sample=roadGroundHeight) {
  const axle=hl*.62,track=hw*.88;
  const z=(u,v)=>sample(x+hx*u-hy*v,y+hy*u+hx*v);
  const fl=z(axle,track),fr=z(axle,-track),bl=z(-axle,track),br=z(-axle,-track);
  const along=clamp((fl+fr-bl-br)/(4*axle),-.65,.65),across=clamp((fl+bl-fr-br)/(4*track),-.65,.65);
  const norm=v=>{const n=Math.hypot(...v);return v.map(q=>q/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const f=norm([hx,hy,along]),normal=norm([-hx*along+hy*across,-hy*along-hx*across,1]);
  const side=norm(cross(normal,f)),up=cross(f,side);
  return {z:(fl+fr+bl+br)/4,f,side,up,hx,hy,tilted:Math.abs(along)+Math.abs(across)>1e-5};
}
