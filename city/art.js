// ---- ascii sprites
const pad = a => { const w = Math.max(...a.map(l => l.length)); return a.map(l => l.padEnd(w)); };
const MIR = { '/': '\\', '\\': '/', '(': ')', ')': '(', '[': ']', ']': '[' };
const mirror = a => a.map(l => [...l].reverse().map(c => MIR[c] || c).join(''));
const ART = {
  carSide: pad(['    _________', ' __/##|###|##\\___', '|]   __     __  O|', "'--(@@)---(@@)--'"]),
  carFront: pad(['  _______', ' /#######\\', '|O|=====|O|', "'(@)---(@)'"]),
  carBack: pad(['  _______', ' /#######\\', '|]|_____|[|', "'(@)---(@)'"]),
  walkA: pad([' _ ', '(_)', '/|\\', ' | ', '/ \\']),
  walkB: pad([' _ ', '(_)', '/|\\', ' | ', ' | ']),
  signal: pad(['.-.', '(O)', "'-'", ' |', ' |', ' |', ' |', '_|_']),
  tree: pad(['   ,@@%,', ' ,@%@@@%@,', '@@%@@%@@@%@', '%@@@%@@%@@@', " '@%@@@%@'", "   '\\|/'", '    |', '    |']),
  bench: pad([' _____', '|_____|', "'     '"]),
  antenna: pad([' *', ' |', '-+-', ' |', ' |', '-+-', ' |', ' |']),
  tank: pad(['  ___', ".'   '.", '|=====|', '|=====|', "'.___.'", ' /| |\\', '/ | | \\']),
  counter: pad([' .------------------------.', ' |  [$]            .---.  |', ' |                 |===|  |', ' |________________________|']),
  keeper: pad(['  ___', ' (o o)', '  \\-/', ' /|#|\\', '/ |#| \\', '  |_|', '  / \\', ' /   \\']),
  sitter: pad(['  ___', ' (o o)', '  \\-/', ' /|#|\\', " '---'"]),
  sitterBack: pad(['  ___', ' (   )', '  | |', ' /|#|\\', " '---'"]), // seen from behind
  stool: pad([' ___', '(___)', '  |', '  |', ' _|_']),
  barTop: pad([' __________________________________', '|  o   o    [$]    o    o     o   o |', '|==================================|', '|                                  |', '|__________________________________|']),
  table: pad([' _________', '|_________|', '    | |', '   _|_|_']),
  jukebox: pad([' .-----.', '/ ((o)) \\', '|=======|', '|:::::::|', '|=======|', "'-------'"]),
  cart: pad([' _____', '|@@@@@|', '|_____|', ' o   o']),
  seats: pad(['[_][_][_][_][_][_][_][_][_][_]', ' |  |  |  |  |  |  |  |  |  |']),
  desk: pad([' ______________', '| [=]   BELL o |', '|______________|', '|              |', '|______________|']),
  plant: pad(['  \\|/', ' -@@@-', '  /|\\', ' [___]']),
  pole: pad(['|', '|', '|', '|', '|', '|']),
  longSeat: pad([' ____________', '|____________|', "'            '"]),
  train: pad([' ____________________________________________________',
              '|  ____   ____  |    |  ____   ____  |    |  ____   _|',
              '| |####| |####| |    | |####| |####| |    | |####| |#|',
              '| |####| |####| |    | |####| |####| |    | |####| |#|',
              '|               |    |               |    |          |',
              '|===============|====|===============|====|==========|',
              "'-(O)-----(O)---'----'-(O)-----(O)---'----'-(O)------'"]),
};
Object.assign(ART, {
  spire: pad(['   +', '   ^', '  /|\\', '  |+|', ' /|||\\', ' |||||', '/|||||\\']),
  fence: pad(['|==|==|==|==|', '|  |  |  |  |']),
  treadmill: pad(['  ____', ' |[::]|', ' |    |', '/______\\']),
  rack: pad(['|=O====O=|', '|=O====O=|', '|=O====O=|', '|_________|']),
  barberChair: pad(['  ___', ' |   |', ' |___|', '  /|\\', ' /_|_\\']),
  barberPole: pad(['(=)', '|/|', '|/|', '|/|', '|/|', '(=)']),
  bankCounter: pad(['.________.________.________.', '|  |  |  |  |  |  |  |  |  |', '|__|__|__|__|__|__|__|__|__|', '|                          |', '|__________________________|']),
  stage: pad(['.______________.', '|______________|']),
  speaker: pad(['.---.', '|(O)|', '|(o)|', "'---'"]),
  singer: pad([' _  o', '(_)/', '/|', ' |', '/ \\']),
  cage: pad(['.----.', '|####|', '|#oo#|', "'----'"]),
  dog: pad(['  /^ ^\\', ' / 0 0 \\', ' V\\ Y /V', '  / - \\', ' |    \\', ' || (__V']),
  bouquet: pad([' *@*@*', '  \\|/', '  [_]']),
  containers: [1, 2, 3].map(n => pad(Array(n).fill('[|||||||||]'))),
  chain: pad(['|xxxxxxxx|xxxxxxxx|', '|xxxxxxxx|xxxxxxxx|', '|        |        |']),
  // emergency vehicles; '*' in the light bar flashes
  ambSide: pad(['  [*=*]______', ' |  +  |  |##\\', ' |]____|__|__O|', " '-(@@)----(@@)'"]),
  ambFront: pad([' [*=*]', '/#####\\', '|O|_+_|O|', "'(@)-(@)'"]),
  ambBack: pad(['  [*=*]', ' |  +  |', '|]|___|[|', "'(@)-(@)'"]),
  fireSide: pad([' _[*=*]========-', '|##|[]::[]::[]|', '|O_|__________|]', "'(@@)-(@@)-(@@)'"]),
  fireFront: pad([' _[*=*]_', '/#######\\', '|O|===|O|', "'(@)-(@)'"]),
  fireBack: pad([' _[*=*]_', '|=======|', '|]|___|[|', "'(@)-(@)'"]),
  policeSide: pad(['    _[*=*]_', ' __/##|##\\___', '|] POLICE   O|', "'--(@@)--(@@)-'"]),
  policeFront: pad(['  [*=*]', ' /#####\\', '|O|===|O|', "'(@)-(@)'"]),
  policeBack: pad(['  [*=*]', ' /#####\\', '|]|___|[|', "'(@)-(@)'"]),
  // elevated train car
  elSide: pad([' ________________________', '|[##] [##] [##] [##] [##]|', '|========================|', "'-(O)(O)------------(O)(O)'"]),
  elEnd: pad([' _______', '|[##|##]|', '|  o o  |', "'(O)-(O)'"]),
});
ART.carSideL = mirror(ART.carSide);
ART.taxiSide = pad(['   _[TAXI]__', ...ART.carSide.slice(1)]);
ART.taxiSideL = mirror(ART.taxiSide).map(l => l.replace('[IXAT]', '[TAXI]'));
ART.taxiFront = pad(['  _[TAXI]_', ...ART.carFront.slice(1)]);
ART.taxiBack = pad(['  _[TAXI]_', ...ART.carBack.slice(1)]);
ART.ambSideL = mirror(ART.ambSide); ART.fireSideL = mirror(ART.fireSide);
ART.policeSideL = mirror(ART.policeSide).map(l => l.replace('ECILOP', 'POLICE'));
// per body: [back, front, side facing right, side facing left], see citySprites
const VEHICLE_ART = {
  car: [ART.carBack, ART.carFront, ART.carSide, ART.carSideL], taxi: [ART.taxiBack, ART.taxiFront, ART.taxiSide, ART.taxiSideL],
  amb: [ART.ambBack, ART.ambFront, ART.ambSide, ART.ambSideL], fire: [ART.fireBack, ART.fireFront, ART.fireSide, ART.fireSideL],
  police: [ART.policeBack, ART.policeFront, ART.policeSide, ART.policeSideL],
};
// arcade cabinets: 4 frames of flickering screen
ART.cab = [0, 1, 2, 3].map(f => { const s = k => [0, 1, 2].map(j => '*@#+o~%'[hash(f, k * 3 + j, 61) * 7 | 0]).join('');
  return pad([' _____', '|.---.|', `||${s(0)}||`, `||${s(1)}||`, "|'---'|", '| o o |', '|_____|']); });
const billboard = t => pad(['+' + '-'.repeat(t.length + 2) + '+', '| ' + t + ' |', '+' + '-'.repeat(t.length + 2) + '+',
                            '  |' + ' '.repeat(t.length - 2) + '|', '  |' + ' '.repeat(t.length - 2) + '|']);
const ADS = ['DRINK COLA', 'NEO PHONES', 'EAT AT JOES', 'MEGA BANK', 'FLY AIR 9', 'BUY GOLD', 'SLEEP MORE', 'ROBO TAXI', 'SHOES 50% OFF', 'VOTE NOBODY'];

