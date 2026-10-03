// ===== the laundromat: open all night. Put a load in one of the machines along the back wall, wait (the bench is
// there for it), and come back for clean clothes. Change into them while the police are after someone in what you
// had on, and they lose you.
const WASH_FEE = 3, WASH_T = 45;
let wash = null; // { cell: the laundromat (its door's cell), n: which machine, done: when it finishes, told }
const myLaundromat = () => !!wash && mode === 'room' && room.kind === 'laundry' && !!room.cell && room.cell[0] === wash.cell[0] && room.cell[1] === wash.cell[1];
// the machine you're standing at, along the back wall (0.75m each), or -1
const machineHere = () => mode === 'room' && room.kind === 'laundry' && py < 1.9 && px > 1.1 && px < room.W - 1.1 ? Math.floor(px / 0.75) : -1;
function laundryPrompt() {
  const n = machineHere();
  if (n < 0) return '';
  if (myLaundromat() && wash.n === n) return T < wash.done ? `Your wash: ${Math.ceil(wash.done - T)}s to go` : 'E: take out your clean clothes';
  if (wash) return myLaundromat() ? 'Your load is in a machine along from this one' : 'You have a load going at another laundromat';
  return `E: run a wash (${fmt$(WASH_FEE)})`;
}
function useLaundry() { // true if E did something here
  const n = machineHere();
  if (n < 0) return false;
  if (myLaundromat() && wash.n === n) {
    if (T < wash.done) return say(`Still spinning. ${Math.ceil(wash.done - T)}s.`, 2), true;
    wash = null; fx.fresh = 300;
    if (wanted.stars && !wanted.seen) { clearWanted(); say("You change into clean clothes in the back. Whoever they're looking for, they're not dressed like you.", 5); }
    else say('Warm, clean, smells like a meadow. You change into them.', 3);
    return true;
  }
  if (wash) return say(myLaundromat() ? 'Your load is in a machine along from this one.' : "You've got a load going somewhere else. One at a time.", 3), true;
  if (!pay(WASH_FEE)) return say(`It takes quarters. ${fmt$(WASH_FEE)} of them.`), true;
  wash = { cell: room.cell.slice(), n, done: T + WASH_T, told: false };
  say('Clothes in, quarters in. The drum starts turning.', 3);
  return true;
}
function stepLaundry() {
  if (wash && !wash.told && T >= wash.done) { wash.told = true; say(myLaundromat() ? 'Your machine clunks to a stop.' : 'Your laundry will be done by now.', 3); }
}
