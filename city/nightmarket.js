// ===== the Chinatown night market (props.js puts up the stalls): what E does at a stall, and what it says. Open 8pm
// to 2am. STREET FOOD, CHARMS (a little luck) and CURIOS (a mystery box, and the Glyphport snow globe, which changes
// the weather: goods.js)
function marketSpot() {
  if (mode !== 'walk') return null;
  return STALLS.find(o => Math.hypot(rel(o.at[0] - px), rel(o.at[1] - py)) < 0.3) || null;
}
const GOLDFISH_FEE = 2, FORTUNE_FEE = 5;
function marketPrompt(o) {
  if (!nightMarketOpen(tod)) return `${o.word}: under a tarp till 8pm`;
  if (o.word === 'GOLDFISH') return `E: scoop goldfish (${fmt$(GOLDFISH_FEE)} a net)`;
  if (o.word === 'FORTUNES') return `E: have your fortune told (${fmt$(FORTUNE_FEE)})`;
  return `E: ${o.word} stall`;
}
function useMarket(o) {
  if (!nightMarketOpen(tod)) return say(pick(['A tarp\'s roped down over it. The market sets up after dark.', 'Nothing yet. Come back after eight.']), 2);
  if (o.word === 'GOLDFISH') return pay(GOLDFISH_FEE) ? startGame('goldfish', 'arcade') : say(`"${fmt$(GOLDFISH_FEE)} a net, love."`, 2);
  if (o.word === 'FORTUNES') return pay(FORTUNE_FEE) ? say(tellFortune(), 7) : say(`"The spirits want ${fmt$(FORTUNE_FEE)}. So do I."`, 2);
  return openShop(o.word, stockFor('', o.word));
}
// the fortune teller: she turns a card, looks at you a long moment, and says one thing. It comes true
function tellFortune() {
  const opts = ['stock', 'duck', 'luck', 'sky'];
  if (season() === 'winter' && weather !== 'snow') opts.push('snow');
  switch (pick(opts)) {
    case 'stock': return `She turns the Wheel of Fortune. "Money is moving. ${fortune().split(' Lucky')[0]}"`;
    case 'duck': goldenDuckDue = true; return 'She turns the Star. "On the pier there is water, and in it, gold. Hook it before someone else does."';
    case 'luck': fortuneLuckT = T + 300; return 'She turns the Sun. "Tonight, for a little while, the dice like you. Don\'t waste it." (Luck at the games, for a few minutes.)';
    case 'snow': weather = 'snow'; wTimer = 600; return 'She turns the Hermit, and pulls her shawl tighter. "The cold is coming down. Tonight."';
    default: { weatherDue = T + 20 + Math.random() * 25; return 'She turns the Tower. "The sky will change its mind before the hour is out." She doesn\'t say how.'; }
  }
}
