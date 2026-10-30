// ===== the gym: an hour with the trainer at the front desk (the first session each day builds your health up a
// little: workout() in needs.js), and the ring in the corner, where the next fighter on the card is waiting
// (GAMES.boxing in minigames.js). You go in with the health you've got and come out with what's left of it, never
// less than RING_FLOOR (the ref stops it first); win and the purse is yours, and the next one on the card is tougher.
const GYM_RING = { x: 12, y: 4.6, h: 2.1, top: 0.5 }; // its centre, half a side, how high the canvas is
const RING_MIN_HEALTH = 40, RING_FLOOR = 5;
const nextBoxer = () => BOXERS[Math.min(boxRank, BOXERS.length - 1)];
const nearRing = () => !!room && room.kind === 'gym' && Math.max(Math.abs(px - GYM_RING.x), Math.abs(py - GYM_RING.y)) < GYM_RING.h + 0.9;
// what E does here, and what the prompt says: the ring first (it's the big thing), then the desk
function gymPrompt() {
  if (!room || room.kind !== 'gym') return '';
  if (nearRing()) {
    const f = nextBoxer();
    if (needs.health < RING_MIN_HEALTH) return '"Not in that state," the trainer calls over. "Eat something. Rest up."';
    return `E: fight ${f.name}${boxRank >= BOXERS.length ? ', a rematch' : ''} (purse ${fmt$(f.purse)})`;
  }
  if (nearKeeper()) {
    if (trainedOut()) return '"You\'re in the best shape of your life. Go and use it: the ring\'s over there."';
    if (needs.trained === dayNum) return '"Good work today. Same time tomorrow."';
    return `"Want to get in shape?"   E: an hour with the trainer (${fmt$(GYM_FEE)})`;
  }
  return '';
}
function gymAct() {
  if (!room || room.kind !== 'gym') return false;
  if (nearRing()) { startBout(); return true; }
  if (nearKeeper()) { trainSession(); return true; }
  return false;
}
function trainSession() {
  if (trainedOut()) return say('"Nothing left to build. Go and use it."', 3);
  if (needs.trained === dayNum) return say('"You\'ve done your work today. Eat, sleep, come back tomorrow."', 3);
  if (!pay(GYM_FEE)) return say(`"It's ${fmt$(GYM_FEE)} a session." You can't cover it.`, 3);
  say('"Right. Rope first, then the pads. Let\'s go."', 2);
  sleep = { t: 0, workout: true }; // (a fade, like a night's sleep: stepSleep hands it to stepWorkout)
}
// an hour goes by in a fade to black
function stepWorkout(dt) {
  sleep.t += dt;
  fade = sleep.t < 1 ? sleep.t : sleep.t < 2.2 ? 1 : clamp(1 - (sleep.t - 2.2) / 1.2, 0, 1);
  if (sleep.t >= 1 && !sleep.done) {
    sleep.done = true; sleep.gain = workout();
    if ((tod += 1) >= 24) { tod -= 24; dayNum++; }
  }
  if (sleep.t > 2.2 && !sleep.said) {
    sleep.said = true;
    say(sleep.gain ? `An hour of rope, pads and the heavy bag. You ache all over, in a good way. Health up to ${maxHealth()}.` : 'An hour of rope, pads and the heavy bag.', 5);
  }
  if (sleep.t > 3.4) { sleep = null; fade = 0; }
}
function startBout() {
  if (needs.health < RING_MIN_HEALTH) return say('"Not in that state," the trainer says, and stands in the way. "Eat something. Rest up."', 3);
  startGame('boxing', 'bout', '', { foe: Math.min(boxRank, BOXERS.length - 1), hp: needs.health, max: maxHealth() });
}
// the final bell (or the towel): what it cost you, and what it paid
function finishBout(g, quit) {
  if (quit) g.towel();
  const res = g.result || { win: false, how: 'towel' }, champ = g.foe === BOXERS.length - 1;
  needs.health = clamp(g.hp, RING_FLOOR, maxHealth());
  if (res.win) {
    earn(g.purse); newsEvent('bout', ...crimePos(), { who: g.name }); // (it makes the papers)
    if (g.foe >= boxRank) boxRank = Math.min(BOXERS.length, g.foe + 1);
    const how = { KO: 'by knockout', TKO: 'on a stoppage', decision: 'on points' }[res.how] || '';
    const next = champ ? ' You\'re the champion of Glyphport.' : ` Next on the card: ${nextBoxer().name}.`;
    return say(`You beat ${g.name} ${how}. The purse is yours: ${fmt$(g.purse)}.${next}`, 6);
  }
  say({ towel: 'You throw in the towel. No purse.', KO: `${g.name} puts you down for the count. No purse.`, TKO: 'The ref waves it off. No purse.',
        decision: `The judges give it to ${g.name}. No purse.` }[res.how] || 'No purse.', 5);
}
