'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCity } = require('./helpers/load-city.cjs');
const { ev } = loadCity();
const j = expression => JSON.parse(ev(`JSON.stringify(${expression})`));

function reset(watch, setup = '') {
  ev(`mode='walk'; paused=false; freecam=null; T=100; tod=12; dayNum=4; seasonShift=0;
    inv.length=0; inv.push({id:'pocketwatch',uses:0}); held=0; K.KeyQ=${watch};
    cloudT=0; weather='clear'; wTimer=1000; weatherDue=0;
    rain=storm=fogAmt=snow=0; snowCover=.8; wet=.8; bolt=null; ${setup}`);
}
function advance() { ev('T+=.05; env(.05)'); }
function close(actual, expected) { assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`); }

test('the watch melts snow and dries pavement forty times faster, respecting season and rain', () => {
  for (const setup of ['', 'setSeason(3)', "weather='rain';rain=1"]) {
    reset(false, setup); advance(); const normal = j('[snowCover,wet,T]');
    reset(true, setup); advance(); const fast = j('[snowCover,wet,T]');
    close(.8 - fast[0], (.8 - normal[0]) * 40);
    close(fast[1] - .8, (normal[1] - .8) * 40);
    close(fast[2], normal[2]);
  }
});

test('snow accumulation and weather transitions follow the same accelerated clock', () => {
  reset(false, "setSeason(3); weather='snow';snow=1;snowCover=.2"); advance();
  const normalSnow = ev('snowCover');
  reset(true, "setSeason(3); weather='snow';snow=1;snowCover=.2"); advance();
  close(ev('snowCover') - .2, (normalSnow - .2) * 40);
  for (const [weather, field] of [['rain','rain'],['storm','storm'],['fog','fogAmt'],['snow','snow']]) {
    reset(false, `weather='${weather}'`); advance(); const normal = ev(field);
    reset(true, `weather='${weather}'`); advance(); close(ev(field), normal * 40);
    close(ev('1000-wTimer'), 2);
    close(ev('cloudT'), 2);
    close(ev('tod'), 12.1);
  }
});

test('forecast waits speed up without changing the clock used by traffic and player physics', () => {
  reset(false, 'weatherDue=T+10');
  ev('for(let i=0;i<12;i++){T+=.025;env(.025)}');
  const normal = j('[weatherDue,weather,T]');
  reset(true, 'weatherDue=T+10');
  ev('for(let i=0;i<12;i++){T+=.025;env(.025)}');
  const fast = j('[weatherDue,weather,T]');
  assert.equal(normal[0], 110);
  assert.equal(normal[1], 'clear');
  assert.equal(fast[0], 0);
  assert.notEqual(fast[1], 'clear');
  close(fast[2], normal[2]);
});

test('releasing or putting away the watch restores normal rates, and zero-time frames stay frozen', () => {
  reset(false); advance(); const normal = j('[snowCover,wet,wTimer,cloudT]');
  for (const setup of ['K.KeyQ=0', 'held=-1', 'paused=true']) {
    reset(true, setup); advance(); assert.deepEqual(j('[snowCover,wet,wTimer,cloudT]'), normal);
  }
  reset(true, 'weatherDue=T+10');
  const before = j('[snowCover,wet,wTimer,weatherDue,cloudT,tod,dayNum]');
  ev('env(0)');
  assert.deepEqual(j('[snowCover,wet,wTimer,weatherDue,cloudT,tod,dayNum]'), before);
  reset(true, 'snowCover=.01;wet=.01'); ev('env(1)');
  assert.deepEqual(j('[snowCover,wet]'), [0,0]);
  reset(true, "weather='snow';snow=1;snowCover=.99"); ev('env(1)');
  assert.equal(ev('snowCover'), 1);
});

test('fast-forwarding a storm keeps lightning emission at real-time rates', () => {
  reset(true, "weather='storm';storm=rain=1");
  const result = j(`(() => {
    const random=Math.random;
    try {
      Math.random=()=>.1;env(.05);const quiet=bolt===null;
      Math.random=()=>.001;env(.05);
      return {quiet,stillStrikes:bolt!==null};
    } finally {Math.random=random;}
  })()`);
  assert.deepEqual(result, { quiet: true, stillStrikes: true });
});
