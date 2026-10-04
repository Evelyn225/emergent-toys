// ===== the Chinatown night market (props.js puts up the stalls): what E does at a stall, and what it says. Open 8pm
// to 2am. STREET FOOD, CHARMS (a little luck) and CURIOS (a mystery box, and the Glyphport snow globe, which changes
// the weather: goods.js)
function marketSpot() {
  if (mode !== 'walk') return null;
  return STALLS.find(o => Math.hypot(rel(o.at[0] - px), rel(o.at[1] - py)) < 0.3) || null;
}
function marketPrompt(o) {
  if (!nightMarketOpen(tod)) return `${o.word}: under a tarp till 8pm`;
  return `E: ${o.word} stall`;
}
function useMarket(o) {
  if (!nightMarketOpen(tod)) return say(pick(['A tarp\'s roped down over it. The market sets up after dark.', 'Nothing yet. Come back after eight.']), 2);
  return openShop(o.word, stockFor('', o.word));
}
