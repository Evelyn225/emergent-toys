// ---- game state
let mode = 'walk'; // walk | drive | taxi | room (any interior) | roof
let px = 0.3, py = 4, a = Math.PI / 2, pitch = 0, look = 0;
let T = 0, tod = 20, weather = 'clear', wTimer = 90, rain = 0, fogAmt = 0, wet = 0;
let day, night, dusk, amb, vis, lampsOn, overcast, litT;
let me = null, room = null, roofH = 0, msgText = '', msgT = 0;
let third = true, chaseOn = false, camYaw = 0; // in a car: third-person chase camera (V toggles)
const K = {}; // keys held, by KeyboardEvent.code
const say = (s, t = 3) => { msgText = s; msgT = t; };

const CLOUD_H = 60; // cloud layer height (600m)
let cloudT = 0;
function env(dt) {
  const lapse = K.KeyT ? 40 : 1; // 20s per game hour; hold T to fast-forward (clouds race along too)
  tod = mod(tod + dt * 0.05 * lapse, 24); cloudT += dt * lapse;
  if ((wTimer -= dt) < 0) { weather = pick(['clear', 'clear', 'rain', 'fog']); wTimer = 60 + Math.random() * 90; }
  rain += clamp((weather === 'rain') - rain, -dt / 6, dt / 6);
  fogAmt += clamp((weather === 'fog') - fogAmt, -dt / 6, dt / 6);
  wet = clamp(wet + (rain > 0.3 ? dt / 10 : -dt / 60), 0, 1); // streets stay wet for a while after rain
  const sunEl = Math.sin((tod - 6) / 12 * Math.PI);
  day = clamp(sunEl * 2.5 + 0.25, 0, 1); night = 1 - day; dusk = clamp(1 - Math.abs(sunEl) * 4, 0, 1);
  overcast = Math.max(rain, fogAmt);
  amb = 0.35 + 0.65 * day * (1 - 0.35 * overcast);
  vis = MAXD * (1 - 0.72 * fogAmt - 0.25 * rain);
  lampsOn = clamp((night - 0.2) * 2 + fogAmt * 0.6 * day, 0, 1);
  litT = 0.62 + 0.33 * day; // fewer lit windows by day
  if (mode === 'room') { amb = room.def.light; vis = 40; }
}

