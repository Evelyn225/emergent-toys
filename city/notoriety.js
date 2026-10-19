// ===== notoriety: the city remembers. A crime somebody saw (crime.js: addWanted, or a call that came in with no unit
// to send) makes you known, and so does anything that brings out the air force. Known, people look twice at you in the
// street and the police pick you out from further off; very well known, the odd passer-by gets their phone out. It
// fades a day at a time, and faster if you change how you look: a haircut, a different coat, new ink.
// What happened goes in the papers a day behind, written up in the papers' usual tone (newsLines), and it's on the
// telly, on in the bars, and what people talk about.
// Pure: the score, the log and the headlines. goods-ui.js reads the paper, actions.js the telly, news-ui.js the rest.
// Gentle on purpose: a crime is easy to commit by accident (a red light, a fender bender, a bad moment with a pedestrian),
// and the odd slip should barely register. It takes a run of serious ones to get you known.
const NOTO_BY_STARS = [0, 3, 8, 15], NOTO_SLIP = { redlight: 1, crash: 1, urination: 2, graffiti: 2 }; // (a crime: by its stars, slips less)
const NOTO_EVENT = { scramble: 12, blownup: 8, ejected: 6, planecrash: 6 };
const NOTO_FADE = 0.5; // what's left of it each morning
const NOTO_LOOK = { haircut: 0.5, coat: 0.5, tattoo: 0.6 }; // what's left after a change of look (once a day each)
const NOTO_KNOWN = 30, NOTO_INFAMOUS = 65, NOTO_SPOT_R = 2.2, NOTO_CALL = 0.25, NOTO_CALL_GAP = 120; // (seconds between call-ins at most)
const noto = { level: 0, day: dayNum, looked: {}, log: [], lookDay: -9, scanT: 0, callT: -Infinity };
// where (x, y) is, as the papers put it
const placeTitle = (x, y) => { const d = districtName(Math.floor(mod(x, N) / 8), Math.floor(mod(y, N) / 8)); return d === 'belle' ? 'the Belle Époque Quarter' : DISTRICT_TITLE[d] || 'the city'; };
// a count as the papers print one: in words, up to ten
const inWords = n => ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'][n] || String(n);
// something for the papers: a kind (a crime's, or one of NEWS's), where, and anything the line needs; the same thing
// in the same place on the same day counts up instead (so a spree reads as one story)
function newsEvent(kind, x = px, y = py, extra = {}) {
  const where = placeTitle(x, y), same = noto.log.find(e => e.kind === kind && e.day === dayNum && e.where === where);
  if (same) same.n++; else noto.log.unshift({ kind, day: dayNum, where, n: 1, ...extra });
  if (noto.log.length > 40) noto.log.length = 40;
  noto.level = Math.min(100, noto.level + (NOTO_SLIP[kind] ?? (CRIMES[kind] ? NOTO_BY_STARS[Math.min(3, CRIMES[kind].stars)] : NOTO_EVENT[kind] || 0)));
}
// a new look: knocks it down (each kind once a day: a second haircut doesn't fool anybody twice). What it did, for the
// line at the counter: '' if there was nothing to lose
function changeLook(kind) {
  if (noto.looked[kind] === dayNum || noto.level < 1) return '';
  noto.looked[kind] = dayNum; noto.lookDay = dayNum;
  const was = noto.level; noto.level *= NOTO_LOOK[kind];
  return was >= NOTO_KNOWN ? ' Nobody is going to match you to a description now.' : ' One fewer thing anybody might remember about you.';
}
// each morning it fades; the log keeps three days
function stepNotoriety() {
  while (noto.day < dayNum) { noto.day++; noto.level *= NOTO_FADE; if (noto.level < 1) noto.level = 0; }
  if (noto.day > dayNum) noto.day = dayNum; // (a load or the dev panel going back)
  for (let k = noto.log.length - 1; k >= 0; k--) if (noto.log[k].day < dayNum - 2) noto.log.splice(k, 1);
}
// police see you a little further off, and calls come in a little quicker, the better known you are (a quarter at most)
const copSight = () => COP_SIGHT * (1 + noto.level / 400);
const reportDelay = () => REPORT_DELAY * (1 - noto.level / 400);
// out on foot and known: now and then a passer-by close enough knows your face (once a day each), stops and stares;
// infamous, now and then one calls it in (one star, and not again for a while). Returns { who, called } for whoever did, or null. Checked twice a second
const YOU_SPOT = { get x() { return px; }, get y() { return py; } }; // (what a staring passer-by looks at)
function recognise(dt, rnd = Math.random) {
  if ((noto.scanT -= dt) > 0) return null;
  noto.scanT = 0.5;
  if (noto.level < NOTO_KNOWN || mode !== 'walk' || wanted.stars > 0) return null;
  for (const p of people) {
    if (p.hidden || p.down || p.follow || p.help || p.hailing || p.talk > 0 || p.knew === dayNum) continue;
    if (near(p.x, p.y, px, py) > NOTO_SPOT_R || !lineOfSight(p.x, p.y, px, py)) continue;
    if (rnd() > (noto.level - 20) / 400) continue;
    p.knew = dayNum; p.gawk = YOU_SPOT; p.talk = 3 + rnd() * 2;
    const called = noto.level >= NOTO_INFAMOUS && T - noto.callT > NOTO_CALL_GAP && rnd() < NOTO_CALL;
    if (called) { noto.callT = T; reports.push({ t: T + reportDelay(), x: px, y: py, kind: 'spotted' }); }
    return { who: p, called };
  }
  return null;
}

// ---- the papers. One line a story, as the papers would print it: flat, factual, unimpressed
const NEWS = {
  steal: (w, n) => n > 1 ? `${inWords(n)} cars stolen in ${w} in one day. Police say they are aware of the pattern.` : `Car stolen in ${w}. The owner says they had only just washed it.`,
  hit: (w, n) => n > 1 ? `${inWords(n)} pedestrians struck by the same car in ${w}. All have since got up. Police would still like a word.` : `Pedestrian struck by a car in ${w}. The driver did not stop. The pedestrian has since got up.`,
  hitcop: w => `Police officer knocked down by a car in ${w}. The department describes this as unhelpful.`,
  crash: w => `Reckless driving reported in ${w}. Residents say they were not surprised.`,
  redlight: w => `Driver runs a red light in ${w} in full view of a police officer. The officer describes this as a choice.`,
  pickpocket: (w, n) => `${n > 1 ? 'Several pickpocketings' : 'Pickpocketing'} reported in ${w}. Residents are reminded to keep their wallets in their pockets, and their hands on them.`,
  shoplift: w => `A shop in ${w} reports the theft of low-value goods. The owner says it is the principle of the thing.`,
  burglary: w => `Break-in at a business in ${w}. The owner says nothing of value was taken, then checked again.`,
  alarm: w => `Burglar alarm at a business in ${w}. Police attended. The alarm was correct.`,
  bankjob: w => `Bank robbed in ${w}. The bank reminds customers that deposits are insured, and asks them not to think about it further.`,
  heist: () => 'An item is missing from the city museum. The museum says the gift shop remains open.',
  boattheft: () => 'Boat reported missing from the marina. It was last seen floating.',
  graffiti: (w, n) => `New graffiti in ${w}${n > 1 ? ', in several places' : ''}. The council has added it to a list.`,
  urination: w => `Public urination reported in ${w}. Police attended. Police had seen worse.`,
  ram: w => `Police car rammed in ${w}. The other car is described as also damaged.`,
  planetheft: () => 'An aircraft was taken from the city airport without permission. The airport would like it back.',
  scramble: () => 'The air force confirms two interceptors flew over the city. A spokesperson would not say why, beyond "an aircraft."',
  blownup: w => `Stolen aircraft comes apart in the air over ${w}. The pilot survived, which the air force describes as noted.`,
  ejected: w => `The pilot of a stolen aircraft parachuted into ${w} and has not come forward. The air force has recovered most of the aircraft.`,
  planecrash: w => `Stolen aircraft comes down in ${w}. Nobody has claimed it.`,
  escape: w => `Police call off a pursuit in ${w} after losing sight of the suspect. The search is described as ongoing, in a general sense.`,
  arrest: (w, n, e) => `Arrest in ${w} following ${e.crime || 'an incident'}. Officers describe the suspect as cooperative, eventually.`,
  bigfish: (w, n, e) => `A ${e.kg ? e.kg + 'kg ' : 'large '}${e.fish || 'fish'} was landed in ${w} by a member of the public. The fish was not available for comment.`,
  bout: (w, n, e) => `An unknown fighter beat ${e.who} at the gym in ${w}. The promoter did not catch the name. The purse was paid in cash.`,
};
// the stories that run, biggest first: what happened yesterday (and so far today, on the telly), with a word from the
// police about the suspect when you're well known
function newsLines(today = false) {
  const from = dayNum - 1, to = today ? dayNum : dayNum - 1;
  const big = e => (CRIMES[e.kind] ? CRIMES[e.kind].stars : NOTO_EVENT[e.kind] ? 3 : 1) * 10 + Math.min(e.n, 5);
  const lines = noto.log.filter(e => e.day >= from && e.day <= to && NEWS[e.kind]).sort((p, q) => big(q) - big(p)).map(e => NEWS[e.kind](e.where, e.n, e));
  if (lines.length && noto.level >= 40) lines.push(noto.lookDay >= dayNum - 1
    ? 'Police say the suspect may since have changed their appearance, and that this does not help.'
    : 'Police have issued a description of a suspect: medium build, seen recently. The public is asked not to approach anyone matching it, which is most people.');
  return lines;
}
// what people say about it (talk.js): the top story, and, if you're known, that you look like somebody
function newsGossip() {
  const out = [], top = newsLines(true)[0];
  if (top) { const s = top.split('. ')[0].replace(/\.$/, '') + '.'; out.push(`Did you see the paper? "${s}"`, `${s} That's this city for you.`); }
  if (noto.level >= NOTO_KNOWN) out.push('Hang on. Have I seen you somewhere? No. Never mind.', 'You look like somebody. I can\'t think who.');
  if (noto.level >= NOTO_INFAMOUS) out.push('You look a lot like that description in the paper. So does my cousin, to be fair.');
  return out;
}
