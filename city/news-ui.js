// ===== being known, and the news (notoriety.js), out in the world: a passer-by who knows your face, and the TV that's
// always on over the bar and in the motel office. The paper is goods-ui.js (HEADLINES), your own telly actions.js
function stepNewsUI(dt) {
  stepNotoriety();
  const seen = recognise(dt);
  if (seen) say(seen.called ? 'A passer-by looks at you, then at their phone, then at you again. They start dialling.'
    : pick(['Someone stops and looks at you a beat too long, then walks on.', 'A passer-by gives you a second look. Then a third.', '"Aren\'t you...?" They decide you aren\'t.']), 3);
  // walk into a bar (or the motel office) and the news is on: the top story, once a visit, when nothing else is being said
  if (mode === 'room' && room && (room.kind === 'bar' || room.kind === 'motel') && !room.newsShown) {
    room.newsAt ??= T + 2;
    if (T >= room.newsAt && msgT <= 0.5) {
      room.newsShown = true;
      const top = newsLines(true)[0];
      if (top) say(`${room.kind === 'bar' ? 'The TV over the bar' : 'The TV in the corner'}: ${top}`, 6);
    }
  }
}
// switching your own telly on: the local news, if there's any worth hearing
const tellyNews = () => { const l = newsLines(true); return l.length ? ` The local news is on. ${pick(l)}` : ''; };
