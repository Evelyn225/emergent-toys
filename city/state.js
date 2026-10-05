// ---- game state
let mode = 'walk'; // walk | drive | taxi | room (any interior) | roof
let px = 0.3, py = 4, a = Math.PI / 2, pitch = 0, look = 0, lookT = 0;
let dayNum = 4; // days since a Monday: you arrive on a Friday evening (events.js)
let T = 0, tod = 20, weather = 'clear', wTimer = 90, rain = 0, fogAmt = 0, wet = 0, storm = 0, snow = 0, snowCover = 0; // snow: falling now (0..1); snowCover: lying on the ground
let day, night, dusk, amb, vis, lampsOn, overcast, litT;
let me = null, room = null, roofH = 0, msgText = '', msgT = 0;
let third = true, chaseOn = false, camYaw = 0; // in a car: third-person chase camera (V toggles)
const K = {}; // keys held, by KeyboardEvent.code
const body = { z: 0, vz: 0, crouch: 0, seat: null, trick: null }; // jumping, crouching, sitting (see moves.js)
let fade = 0, sleep = null; // screen fade to black (0..1); the hotel sleep in progress
let paused = false;
// settings, kept in localStorage (the pause menu edits them; pause.js applies them)
const SETTINGS_KEY = 'asciiCity.settings';
const settings = { master: 0.8, music: 0.8, ambience: 0.8, effects: 0.8, sensitivity: 1, invertY: false, fov: 90, detail: 'medium', help: true };
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {};
    if (!saved.v && saved.fov === 63) delete saved.fov; // the old default: move up to the new one
    Object.assign(settings, saved, { v: 2 });
  } catch (e) { /* private window etc: defaults */ }
}
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* not saved, still applied */ } }
loadSettings();
const say = (s, t = 3) => { msgText = s; msgT = t; };

// ---- money: you start with $100; taxis, the subway, the el and street food cost, favours pay
let money = 100;
const SUBWAY_FARE = 2.9;
const taxiFare = cells => 3 + cells * 0.25; // $3 flag fall, $0.25 per 10m
const fmt$ = v => '$' + v.toFixed(2);
let onMoney = null; // the audio hooks in here for the till sound
function pay(amount) { // false (and nothing spent) if you can't cover it
  if (money + 1e-9 < amount) return false;
  money = Math.round((money - amount) * 100) / 100; if (onMoney) onMoney(-amount);
  return true;
}
// the hotel: a night's stay, from 6pm (check-in closes at 5am)
const ROOM_RATE = word => word === 'MOTEL' ? 20 : 40;
const checkInOpen = t => t >= 18 || t < 5;
function earn(amount) { money = Math.round((money + amount) * 100) / 100; if (onMoney) onMoney(amount); }

// thunderstorms: lightning every few seconds. bolt = the latest strike {t: when, az: which way, d: how far (cells),
// seed: its zigzag}; flash() is how bright it is lighting the city right now (a double flicker, then a fade)
let bolt = null;
function flash() {
  if (!bolt) return 0;
  const s = T - bolt.t, near = clamp(1.3 - bolt.d / 80, 0.35, 1);
  const f = s < 0 ? 0 : s < 0.07 ? 1 : s < 0.13 ? 0.15 : s < 0.2 ? 0.75 : Math.exp(-(s - 0.2) * 7) * 0.6;
  return f * near;
}
const WEATHER_NEXT = { clear: 'rain', rain: 'storm', storm: 'fog', fog: 'snow', snow: 'clear' }; // the Y key's (the snow globe's) cycle
// the seasons: a week of days each, spring first; seasonShift moves the whole year on (the orrery, the dev tools)
const SEASONS = ['spring', 'summer', 'autumn', 'winter'], SEASON_DAYS = 7;
let seasonShift = 0, weatherDue = 0; // weatherDue: when a promised change in the sky arrives (the fortune teller)
const seasonIdx = () => mod(Math.floor(dayNum / SEASON_DAYS) + seasonShift, 4), season = () => SEASONS[seasonIdx()];
const setSeason = k => { seasonShift = mod(seasonShift + k - seasonIdx(), 4); };
// what the sky does, by season: winter snows (and never rains), summer's mostly fine with the odd storm, autumn's foggy
const SEASON_WEATHER = { spring: ['clear', 'clear', 'rain', 'rain', 'fog'], summer: ['clear', 'clear', 'clear', 'storm', 'rain'],
  autumn: ['clear', 'rain', 'fog', 'fog', 'storm'], winter: ['clear', 'snow', 'snow', 'fog', 'clear'] };

const CLOUD_H = 60; // cloud layer height (600m)
let cloudT = 0;
function env(dt) {
  const lapse = hurrying() ? 40 : 1; // 20s per game hour; hold Q with the pocket watch in hand to fast-forward (clouds race along too)
  const t0 = tod;
  tod = mod(tod + dt * 0.05 * lapse, 24); cloudT += dt * lapse;
  if (tod < t0 - 12) dayNum++; // midnight (a real wrap round, not a tiny step back)
  if ((wTimer -= dt) < 0) { weather = pick(SEASON_WEATHER[season()]); wTimer = 60 + Math.random() * 90; }
  if (weatherDue && T > weatherDue) { weatherDue = 0; weather = pick(SEASON_WEATHER[season()].filter(w => w !== weather)); wTimer = 90 + Math.random() * 90; } // (it changes, as promised)
  rain += clamp((weather === 'rain' || weather === 'storm') - rain, -dt / 6, dt / 6);
  storm += clamp((weather === 'storm') - storm, -dt / 8, dt / 8);
  if (storm > 0.6 && Math.random() < dt / 6) bolt = { t: T, az: Math.random() * Math.PI * 2, d: 12 + Math.random() * 70, seed: Math.random() * 1e4 | 0 };
  fogAmt += clamp((weather === 'fog') - fogAmt, -dt / 6, dt / 6);
  snow += clamp((weather === 'snow') - snow, -dt / 8, dt / 8);
  const winter = season() === 'winter'; // (it settles while it falls; melts slowly in winter, quickly once it's spring)
  snowCover = clamp(snowCover + (snow > 0.3 ? dt / 45 * snow : -dt / (winter ? 400 : 60) * (1 + rain * 3)), 0, 1);
  wet = clamp(wet + (rain > 0.3 ? dt / 10 : -dt / 60), 0, 1); // streets stay wet for a while after rain
  const sunEl = Math.sin((tod - 6) / 12 * Math.PI);
  day = clamp(sunEl * 2.5 + 0.25, 0, 1); night = 1 - day; dusk = clamp(1 - Math.abs(sunEl) * 4, 0, 1);
  overcast = Math.max(rain, fogAmt, snow * 0.8);
  amb = 0.35 + 0.65 * day * (1 - 0.35 * overcast) * (1 - 0.3 * storm) + flash() * 0.9;
  vis = MAXD * (1 - 0.72 * fogAmt - 0.25 * rain - 0.3 * snow);
  lampsOn = clamp((night - 0.2) * 2 + fogAmt * 0.6 * day, 0, 1);
  litT = 0.62 + 0.33 * day; // fewer lit windows by day
  if (mode === 'room') { amb = (room.light ?? room.def.light) + flash() * 0.1; vis = 40; } // (a shop broken into at night is dark) // a flicker through the windows
}

