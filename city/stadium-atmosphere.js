// ===== the atmosphere at the Yards ground (STADIUM_PLAN.md, phase 5): the commentary and the PA on the match's events,
// the score and clock up top, and the sound of the place. The crowd's bed (audio-mix.js) murmurs before kick-off and
// rises with every attack that gets near a goal; over it, synthesised here: the referee's pea whistle (a peep for a
// foul, two for half time, three for full time), an "ooh" at a shot, a groan at a near miss, applause for a save, a
// roar for a home goal (a smaller cheer and a groan for an away one), boos at a card against the home side, and the
// home end clapping and chanting their club's name when they're level or ahead.
let stadiumSeen = 0, stadiumChantT = 0, stadiumSaidT = -9;
const STADIUM_LINES = {
  goal: e => e.og ? `OWN GOAL! ${e.player} turns it in. ${scoreText(e)}` : pick([`GOAL! ${e.player}! ${scoreText(e)}`, `GOAL! ${e.player} buries it! ${scoreText(e)}`, `GOAL! ${e.player} finds the net! ${scoreText(e)}`]),
  shot: e => e.penalty ? `${e.player} steps up...` : e.header ? `${e.player} rises for the header...` : e.freekick ? `${e.player} goes for goal from the free kick...` : pick([`${e.player} shoots...`, `${e.player} lets fly...`, `${e.player} has a go...`]),
  save: e => e.penalty ? `SAVED! ${e.player} guesses right!` : pick([`Saved by ${e.player}.`, `${e.player} gets down well to save.`, `Good stop from ${e.player}.`]),
  miss: e => e.penalty ? `${e.player} puts the penalty wide!` : pick([`${e.player}: wide.`, `Over the bar from ${e.player}.`, `${e.player} can't keep it down.`]),
  woodwork: e => `OFF THE WOODWORK! ${e.player} so close.`,
  block: e => `Blocked by ${e.player}.`,
  penalty: e => `PENALTY to ${stadiumMatch.teams[e.side].name}!`,
  yellow: e => `Yellow card: ${e.player}.`,
  red: e => `RED CARD! ${e.player} is off.`,
  sub: e => `Substitution, ${stadiumMatch.teams[e.side].name}: ${e.on} on for ${e.off}.`,
  offside: e => `Flag's up: ${e.player} offside.`,
  added: e => `The fourth official's board: ${e.mins} minute${e.mins > 1 ? 's' : ''} added on.`,
  penup: e => `${e.player} steps up...`,
  pens: e => `Level at full time, so it's penalties. ${stadiumMatch.teams[e.side].name} to go first.`,
  pen: e => `${e.player}: ${e.scored ? pick(['SCORES!', 'tucks it away!', 'sends the keeper the wrong way!']) : e.saved ? `SAVED by ${e.keeper}!` : pick(['MISSES!', 'over the bar!', 'wide!'])}  ${penText(e.pens)}`,
  shootout: e => `${stadiumMatch.teams[e.side].name} win it on penalties, ${Math.max(...e.pens)}-${Math.min(...e.pens)}!${stadiumMatch.cup === 'Cup final' ? ` The City Cup goes to ${stadiumMatch.teams[e.side].name}!` : ` They're through.`}`,
};
const penText = p => { const m = stadiumMatch; return `(${m.teams[0].short} ${p[0]}-${p[1]} ${m.teams[1].short} on pens)`; };
const scoreText = e => { const m = stadiumMatch; return `${m.teams[0].short} ${e.score[0]}-${e.score[1]} ${m.teams[1].short}`; };
// the line up top: the score and the clock, while you're at the ground
function stadiumScoreLine() {
  const m = stadiumMatch; if (!m) return 'The Yards Ground';
  const [h, a] = m.teams, min = MatchEngine.minute(m), half = m.period === 1 ? 45 : 90;
  const clock = m.kick != null && nowHour() < m.kick ? `kick-off ${String(Math.floor(m.kick % 24)).padStart(2, '0')}:${String(Math.round(m.kick % 1 * 60)).padStart(2, '0')}`
    : m.phase === 'pens' ? `penalties ${m.shoot.goals[0]}-${m.shoot.goals[1]}` : m.phase === 'ft' ? (m.pens ? `full time, ${m.pens[0]}-${m.pens[1]} on pens` : 'full time') : m.phase === 'ht' ? 'half time' : `${Math.min(Math.floor(min), half)}'${min > half ? '+' + Math.ceil(min - half) : ''}`;
  return `${m.cup ? m.cup + ': ' : ''}${h.name} ${h.score}-${a.score} ${a.name}   ${clock}`;
}
// every frame at the ground: what's new in the match, told and heard
function stadiumAtmosphere() {
  const m = stadiumMatch; if (!m || mode !== 'room' || room?.kind !== 'stadium') return;
  if (m.events.length < stadiumSeen || m !== stadiumAtmosphere.m) { stadiumAtmosphere.m = m; stadiumSeen = m.events.length; } // (a new match: start from now)
  if (!m.welcomed && m.t > 0) { m.welcomed = true; say(`Welcome to the Yards Ground${m.cup ? ` for the ${m.cup}` : ''}: ${m.teams[0].name} v ${m.teams[1].name}. And they're under way.`, 5); stadiumSaidT = T; sfxStadium('whistle', m); } // (the real kick-off, at the time on the poster)
  while (stadiumSeen < m.events.length) stadiumEvent(m, m.events[stadiumSeen++]);
  tickStadiumReplay();
  // the home end singing: when they've something to sing about, now and then, not over an attack
  if (m.phase === 'play' && (stadiumChantT -= 1 / 60) <= 0) {
    stadiumChantT = 22 + Math.random() * 25;
    if (m.teams[0].score >= m.teams[1].score && (m.danger || 0) < .3) { sfxStadium('chant', m); if (T - stadiumSaidT > 6) say(`The home end: "${m.teams[0].short === 'YAR' ? 'YARDS! YARDS!' : m.teams[0].name.split(' ')[0].toUpperCase() + '! ' + m.teams[0].name.split(' ')[0].toUpperCase() + '!'}"`, 2.5); }
  }
}
function stadiumEvent(m, e) {
  const home = e.side === 0, big = ['goal', 'red', 'penalty', 'ht', 'ft', 'pens', 'pen', 'shootout'].includes(e.kind);
  if (e.kind === 'ft' && e.pens) return; // (the shootout's line said it)
  if (e.kind === 'goal') queueStadiumReplay(m, e); // (the build-up, again, in a few seconds: stadium.js)
  // the PA and the commentary: the big moments always; the rest when nothing else is up
  let line = null;
  if (e.kind === 'kickoff') { if (e.period === 1) return; line = 'The second half is under way.'; } // (the first half's is the welcome)
  else if (e.kind === 'ht') line = `Half time at the Yards: ${m.teams[0].name} ${e.score[0]}, ${m.teams[1].name} ${e.score[1]}.`;
  else if (e.kind === 'ft') line = `Full time: ${m.teams[0].name} ${e.score[0]}, ${m.teams[1].name} ${e.score[1]}. Thank you for coming, and get home safely.`;
  else if (STADIUM_LINES[e.kind]) line = STADIUM_LINES[e.kind](e);
  if (line && (big || e.kind === 'kickoff' || msgT <= 0 || T - stadiumSaidT > 2.5)) { say(line, big ? 5 : 2.8); stadiumSaidT = T; }
  // and the sound of it
  const s = { kickoff: 'whistle', foul: 'peep', offside: 'peep', ht: 'whistle2', ft: 'whistle3', shot: 'ooh', save: 'applause', miss: 'groan', woodwork: 'groan',
    goal: home ? 'roar' : 'awaygoal', yellow: home ? 'boo' : 'cheer', red: home ? 'boo' : 'roarSmall', penalty: home ? 'roarSmall' : 'boo', sub: 'applause', corner: 'swell',
    pens: 'whistle', pen: e.scored ? (home ? 'roarSmall' : 'awaygoal') : home ? 'groan' : 'cheer', shootout: home ? 'roar' : 'awaygoal' }[e.kind];
  if (s) sfxStadium(s, m);
  if (e.kind === 'foul' || e.kind === 'penalty' || e.kind === 'yellow' || e.kind === 'red') sfxStadium('peep', m);
}
// ---- the sounds. Crowd noise is filtered noise shaped by envelopes (a crowd is mostly breath and vowels); the
// whistle is a pea whistle's trill: a bright tone wobbling fast as the pea rattles
function sfxStadium(kind, m) {
  if (!actx || actx.state !== 'running' || !soundOn) return;
  const at = actx.currentTime, ref = m ? Math.hypot(STADIUM.cx + m.ref.pos[0] - px, STADIUM.cy + m.ref.pos[1] - py) : 40, wk = clamp(1.4 - ref / 70, .35, 1);
  const crowd = (len, rise, freq, q, gain, glide = 1) => { // a swell of voices
    const s = actx.createBufferSource(), f = filt('bandpass', freq, q), f2 = filt('lowpass', freq * 2.4), g = actx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.frequency.setValueAtTime(freq, at); f.frequency.exponentialRampToValueAtTime(freq * glide, at + len);
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + rise); g.gain.setTargetAtTime(gain * .6, at + rise, len * .35); g.gain.exponentialRampToValueAtTime(.0005, at + len);
    shot(s, f, f2, g, sfxBus); s.start(at, Math.random() * 1.5); s.stop(at + len + .1);
  };
  const whistle = (t0, len) => {
    const o = actx.createOscillator(), lfo = actx.createOscillator(), depth = actx.createGain(), g = actx.createGain();
    o.type = 'sine'; o.frequency.value = 2950; lfo.frequency.value = 34; depth.gain.value = 140; lfo.connect(depth); depth.connect(o.frequency);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(.09 * wk, t0 + .02); g.gain.setValueAtTime(.09 * wk, t0 + len - .04); g.gain.linearRampToValueAtTime(0, t0 + len);
    shot(o, g, sfxBus); o.start(t0); lfo.start(t0); o.stop(t0 + len + .02); lfo.stop(t0 + len + .02);
  };
  if (kind === 'peep') whistle(at, .28);
  else if (kind === 'whistle') whistle(at, .9);
  else if (kind === 'whistle2') { whistle(at, .5); whistle(at + .65, .9); }
  else if (kind === 'whistle3') { whistle(at, .45); whistle(at + .6, .45); whistle(at + 1.2, 1.3); }
  else if (kind === 'ooh') crowd(1.4, .35, 520, 1.3, .22, 1.3); // (a rising breath in)
  else if (kind === 'groan') crowd(1.6, .15, 600, 1.1, .2, .6); // (falling away)
  else if (kind === 'swell') crowd(2.2, 1, 700, .8, .12);
  else if (kind === 'roar' || kind === 'roarSmall') { const k = kind === 'roar' ? 1 : .55; crowd(5.5 * k + 1, .25, 900, .6, .42 * k); crowd(4.5 * k + 1, .3, 1800, .9, .18 * k); crowd(6 * k, .5, 300, .7, .25 * k); }
  else if (kind === 'awaygoal') { crowd(2.5, .2, 1100, .9, .12); crowd(2.8, .4, 420, 1, .22, .7); } // (the away end, then the home end's groan)
  else if (kind === 'boo') crowd(2.4, .4, 260, 2.5, .2);
  else if (kind === 'cheer') crowd(1.8, .2, 1000, .8, .16);
  else if (kind === 'applause' || kind === 'chant') { // hands: a patter of tiny bursts, or in time, the chant's rhythm
    const claps = kind === 'chant' ? [0, .42, 1.1, 1.52, 1.94, 2.4, 2.82, 3.5, 3.92, 4.34] : Array.from({ length: 40 }, () => Math.random() * 2.2);
    for (const c of claps) for (let n = 0; n < (kind === 'chant' ? 6 : 1); n++) burst(at + c + Math.random() * .03, .05, [filt('bandpass', 1500 + Math.random() * 900, 1.2)], kind === 'chant' ? .05 : .03, (Math.random() - .5) * 1.2);
    if (kind === 'chant') for (const c of [0, 1.1, 1.94, 3.5]) { // and the voices with them: a vowel, sung, on the beats
      const o = actx.createOscillator(), f = filt('bandpass', 720, 4), f2 = filt('bandpass', 1150, 5), g = actx.createGain(), mix = actx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 165 + Math.random() * 10; g.gain.setValueAtTime(0, at + c); g.gain.linearRampToValueAtTime(.05, at + c + .06); g.gain.exponentialRampToValueAtTime(.001, at + c + .55);
      o.connect(f); o.connect(f2); f.connect(mix); f2.connect(mix); shot(mix, g, sfxBus); o.start(at + c); o.stop(at + c + .6);
    }
  }
}
// for the mixer: how the crowd sounds right now (audio-mix.js): 0 empty, up to 1 for a goalmouth scramble
function stadiumCrowdLevel() {
  const m = stadiumMatch; if (!m) return .2;
  if (m.kick != null && nowHour() < m.kick) return .45; // (filling up, chatting)
  if (m.phase === 'ht') return .4;
  if (m.phase === 'ft') return .3;
  if (m.phase === 'goal') return 1;
  if (m.phase === 'pens') return m.shoot.step === 'run' ? .25 : m.shoot.step === 'after' ? .85 : .5; // (a hush for the run-up)
  return .55 + .45 * (m.danger || 0);
}
