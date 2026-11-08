'use strict';
// ---- where a new game starts. Instead of the same corner every time, one of a handful of places, picked at random,
// each with a line to set the scene. Only for a fresh start (no save): a loaded game puts you back where you were.
// Each spot is [label, x, y, heading, line]; worked out when it's needed, since some places only exist once the world
// is laid out.
function spawnPoints() {
  const out = [];
  const add = (label, at, line) => { try { const p = at(); if (p && p.every(Number.isFinite)) out.push([label, ...p, line]); } catch (e) { /* (a place this city doesn't have) */ } };
  add('marina', () => [MARINA.x, MARINA.y0 + .6, Math.PI / 2], 'Gulls, rigging slapping on masts, the smell of diesel and salt. You\'re on the boardwalk at the marina.');
  add('pier', () => [FAIR.cx, FAIR.y0 - .5, Math.PI / 2], 'The pier boards creak underfoot. Up ahead, the Ferris wheel starts its first turn of the day.');
  add('grand hotel', () => [GRAND_HOTEL.doorU, GRAND_HOTEL.by * 8 + 8.4, -Math.PI / 2], 'The doorman at the Grand Hotel gives you a long look. You don\'t look like you\'re staying here.');
  add('night market', () => { const s = STALLS[1]; return [s.at[0], s.at[1] - .9, Math.PI / 2]; }, 'Chinatown. Steam off the stalls, lanterns strung over the street, someone already frying something wonderful.');
  add('gardens', () => { const [gx, gy] = GARDEN_GATES[0]; return [GARDEN.x0 + gx, GARDEN.y0 + gy - .6, Math.PI / 2]; }, 'The gates of the Botanical Gardens. Birdsong, wet leaves, a gardener with a barrow who nods at you.');
  add('lighthouse walk', () => [FOOTBRIDGE.x, FOOTBRIDGE.y0 + .5, Math.PI / 2], 'The start of the Lighthouse Walk. The wind off the water is cold and clean.');
  add('belle', () => districtSpot('belle'), 'A Belle Époque street: ivy, iron balconies, a bakery opening its shutters.');
  add('skatepark', () => { const S = SKATEPARK; return S && [S.bx * 8 + (S.x0 + S.x1) / 2, S.by * 8 + S.y0 + .15, Math.PI / 2]; }, 'The clack of wheels on concrete. A kid lands a kickflip and doesn\'t look round to see if you saw.');
  add('downtown', () => districtSpot('downtown'), 'Downtown. Taxis, towers, everybody in a hurry but you.');
  return out;
}
// put a new game somewhere: one of the spots, on clear ground, or (if none will do) where it always started
// ?spawn=marina (or any spot's name) picks one; ?spawn=random forces the draw. Under test automation, without one of
// those, a new game starts where it always did, so tests that rely on that corner still find it.
function freshSpawn() {
  if (!worldReady) return null;
  const q = new URLSearchParams(location.search), want = q.get('spawn');
  if (q.get('goto') || (!want && navigator.webdriver)) return null; // (?goto= has put you outside a shop already: main.js)
  let spots = spawnPoints();
  if (want && want !== 'random') spots = spots.filter(q => q[0] === want.toLowerCase().replace(/-/g, ' '));
  while (spots.length) {
    const [label, x, y, ang, line] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    const sx = worldCoord(x), sy = worldCoord(y);
    if (!free(sx, sy) || map[idx(Math.floor(sx), Math.floor(sy))] > 0) continue;
    px = sx; py = sy; a = ang; pitch = 0;
    if (typeof devStandBack === 'function') devStandBack(); // (not nose to a wall: dev.js)
    say(line, 7);
    return label;
  }
  return null;
}
// (loaded after main.js, so everything a spot needs is set up; save.js only notes that there was no game to load)
if (freshStartPending) { freshStartPending = false; freshSpawn(); }
