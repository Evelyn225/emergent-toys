const SAVE_VERSION = 'paperbots-save-v1';
const STARTING_CASH = 100000;
const TRADING_DAY_MINUTES = 390;
const ORDER_FEE = 1.25;
const SLIPPAGE_BPS = 0.0007;
const MAX_MINUTE_HISTORY = TRADING_DAY_MINUTES * 10;
const MAX_DAILY_HISTORY = 180;
const MAX_EVENT_LOG = 72;
const MAX_SCRIPT_OPS = 420;
const SNAPSHOT_INTERVAL_MS = 90;

const SPEEDS = {
  '1x': { ticksPerBatch: 1, delayMs: 700 },
  '8x': { ticksPerBatch: 8, delayMs: 320 },
  '32x': { ticksPerBatch: 32, delayMs: 140 },
  '128x': { ticksPerBatch: 128, delayMs: 56 },
  '512x': { ticksPerBatch: 512, delayMs: 18 },
};

const STOCK_DEFS = [
  { ticker: 'AAPL', name: 'Apple', sector: 'consumer-tech', anchor: 189, volatility: 0.95, drift: 0.00003 },
  { ticker: 'MSFT', name: 'Microsoft', sector: 'enterprise-tech', anchor: 421, volatility: 0.78, drift: 0.00004 },
  { ticker: 'NVDA', name: 'NVIDIA', sector: 'semis', anchor: 764, volatility: 1.45, drift: 0.00005 },
  { ticker: 'AMZN', name: 'Amazon', sector: 'consumer-tech', anchor: 178, volatility: 1.06, drift: 0.00002 },
  { ticker: 'GOOGL', name: 'Alphabet', sector: 'enterprise-tech', anchor: 146, volatility: 0.92, drift: 0.00003 },
  { ticker: 'META', name: 'Meta', sector: 'social', anchor: 492, volatility: 1.12, drift: 0.00003 },
  { ticker: 'TSLA', name: 'Tesla', sector: 'mobility', anchor: 188, volatility: 1.62, drift: -0.00001 },
  { ticker: 'NFLX', name: 'Netflix', sector: 'media', anchor: 612, volatility: 1.08, drift: 0.00003 },
  { ticker: 'JPM', name: 'JPMorgan Chase', sector: 'finance', anchor: 198, volatility: 0.64, drift: 0.00002 },
  { ticker: 'COST', name: 'Costco', sector: 'retail', anchor: 721, volatility: 0.58, drift: 0.00002 },
];

const STOCK_MAP = Object.create(null);
for (const def of STOCK_DEFS) {
  STOCK_MAP[def.ticker] = def;
}

const EVENT_TEMPLATES = {
  market: {
    good: [
      'Macro chatter turns risk-on across the tape',
      'Liquidity pulse lights up the whole board',
      'Index futures leak optimism into the bell',
    ],
    bad: [
      'Rate nerves put the whole tape on edge',
      'Risk desk goes cold and the board buckles',
      'A broad sell program hits the market spine',
    ],
  },
  sector: {
    good: [
      '{sector} catches a clean upgrade cycle',
      'Momentum scanners latch onto {sector}',
      'Fresh demand spills into the {sector} rack',
    ],
    bad: [
      '{sector} gets clipped by a rotation sweep',
      'Supply-chain static rattles {sector}',
      'Funds peel away from {sector} in size',
    ],
  },
  stock: {
    good: [
      '{ticker} attracts rumor-fuel buyers',
      '{ticker} prints a hotter tape than expected',
      '{ticker} glows after a whisper-chain upgrade',
    ],
    bad: [
      '{ticker} stumbles on a sudden sentiment crack',
      '{ticker} catches a sharp downgrade whisper',
      '{ticker} gets leaned on by fast money exits',
    ],
  },
};

let simState = null;
let loopHandle = null;
let lastSnapshotAt = 0;

self.onmessage = (event) => {
  try {
    handleMessage(event.data || {});
  } catch (error) {
    self.postMessage({
      type: 'fatal',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

function handleMessage(message) {
  switch (message.type) {
    case 'init':
      simState = message.savedState ? restoreState(message.savedState) : createNewState(message.seed);
      if (simState.running) {
        scheduleLoop();
      }
      postSnapshot('init', true);
      break;
    case 'resume':
      ensureState();
      simState.running = true;
      scheduleLoop();
      postSnapshot('resume', true);
      break;
    case 'pause':
      ensureState();
      pauseSimulation();
      postSnapshot('pause', true);
      break;
    case 'setSpeed':
      ensureState();
      if (SPEEDS[message.speed]) {
        simState.speed = message.speed;
        if (simState.running) {
          scheduleLoop();
        }
        postSnapshot('speed', true);
      }
      break;
    case 'reset':
      simState = createNewState(message.seed);
      clearLoop();
      if (simState.running) {
        scheduleLoop();
      }
      postSnapshot('reset', true);
      break;
    case 'createBot':
      ensureState();
      pauseSimulation();
      createBot(message);
      postSnapshot('create-bot', true);
      break;
    case 'saveBotScript':
      ensureState();
      saveBotScript(message);
      postSnapshot('save-script', true);
      break;
    case 'toggleBot':
      ensureState();
      toggleBot(message.botId, message.enabled);
      postSnapshot('toggle-bot', true);
      break;
    case 'renameBot':
      ensureState();
      renameBot(message.botId, message.name);
      postSnapshot('rename-bot', true);
      break;
    case 'transfer':
      ensureState();
      pauseSimulation();
      transferCash(message.fromId, message.toId, Number(message.amount));
      postSnapshot('transfer', true);
      break;
    case 'manualOrder':
      ensureState();
      pauseSimulation();
      applyOrder({
        accountId: message.accountId,
        ticker: message.ticker,
        side: message.side,
        shares: message.shares,
        actor: 'manual',
        label: 'manual override',
      });
      postSnapshot('manual-order', true);
      break;
    default:
      break;
  }
}

function ensureState() {
  if (!simState) {
    simState = createNewState();
  }
}

function createNewState(seedInput) {
  const seed = normalizeSeed(seedInput ?? Date.now());
  const stocks = Object.create(null);
  const sectorStates = Object.create(null);
  for (const def of STOCK_DEFS) {
    stocks[def.ticker] = {
      ticker: def.ticker,
      name: def.name,
      sector: def.sector,
      anchor: def.anchor,
      volatility: def.volatility,
      drift: def.drift,
      price: roundPrice(def.anchor),
      open: roundPrice(def.anchor),
      prevClose: roundPrice(def.anchor),
      momentum: 0,
      lastChange: 0,
      minuteHistory: [roundPrice(def.anchor)],
      dailyHistory: [roundPrice(def.anchor)],
    };
    if (!sectorStates[def.sector]) {
      sectorStates[def.sector] = { drift: 0 };
    }
  }

  const state = {
    version: SAVE_VERSION,
    seed,
    rngState: seed >>> 0,
    tick: 0,
    day: 1,
    minuteOfDay: 0,
    running: true,
    speed: '1x',
    marketBias: 0,
    marketPulse: 0,
    newsCounter: 0,
    sectorStates,
    stocks,
    activeEvents: [],
    eventLog: [],
    mainAccount: createAccount('main', 'main account', 'manual', STARTING_CASH),
    bots: [],
    indicators: Object.create(null),
  };

  pushEventLog(
    state,
    'paperbots boot',
    `seed ${seed} loaded with ${formatMoney(STARTING_CASH)} in the main account`,
    'neutral'
  );

  return state;
}

function restoreState(saved) {
  const base = createNewState(saved.seed);
  const state = {
    ...base,
    seed: normalizeSeed(saved.seed ?? base.seed),
    rngState: normalizeSeed(saved.rngState ?? saved.seed ?? base.seed),
    tick: toInt(saved.tick, 0),
    day: toInt(saved.day, 1),
    minuteOfDay: toInt(saved.minuteOfDay, 0),
    running: typeof saved.running === 'boolean' ? saved.running : true,
    speed: SPEEDS[saved.speed] ? saved.speed : '1x',
    marketBias: toNumber(saved.marketBias, 0),
    marketPulse: toNumber(saved.marketPulse, 0),
    newsCounter: toInt(saved.newsCounter, 0),
    sectorStates: restoreSectorStates(saved.sectorStates, base.sectorStates),
    stocks: restoreStocks(saved.stocks, base.stocks),
    activeEvents: restoreActiveEvents(saved.activeEvents),
    eventLog: restoreEventLog(saved.eventLog),
    mainAccount: restoreAccount(saved.mainAccount, base.mainAccount, false),
    bots: Array.isArray(saved.bots)
      ? saved.bots.map((bot, index) => restoreAccount(bot, createBotShell(`bot-${index + 1}`, `bot ${index + 1}`), true))
      : [],
    indicators: Object.create(null),
  };

  for (const bot of state.bots) {
    compileBotScript(state, bot, false);
  }

  if (!state.bots.length) {
    state.running = true;
    if (!accountHasHoldings(state.mainAccount) && state.mainAccount.cash <= 0) {
      state.mainAccount.cash = STARTING_CASH;
      pushEventLog(
        state,
        'manual account reseeded',
        `main account restored to ${formatMoney(STARTING_CASH)} for a new empty run`,
        'good'
      );
    }
  }

  return state;
}

function restoreSectorStates(raw, fallback) {
  const states = Object.create(null);
  for (const key of Object.keys(fallback)) {
    states[key] = {
      drift: toNumber(raw && raw[key] && raw[key].drift, fallback[key].drift),
    };
  }
  return states;
}

function restoreStocks(rawStocks, fallback) {
  const stocks = Object.create(null);
  for (const def of STOCK_DEFS) {
    const raw = rawStocks && rawStocks[def.ticker];
    const minuteHistory = Array.isArray(raw && raw.minuteHistory)
      ? raw.minuteHistory.slice(-MAX_MINUTE_HISTORY).map((value) => roundPrice(toNumber(value, def.anchor)))
      : fallback[def.ticker].minuteHistory.slice();
    const dailyHistory = Array.isArray(raw && raw.dailyHistory)
      ? raw.dailyHistory.slice(-MAX_DAILY_HISTORY).map((value) => roundPrice(toNumber(value, def.anchor)))
      : fallback[def.ticker].dailyHistory.slice();
    const price = roundPrice(toNumber(raw && raw.price, minuteHistory[minuteHistory.length - 1] || def.anchor));

    stocks[def.ticker] = {
      ticker: def.ticker,
      name: def.name,
      sector: def.sector,
      anchor: def.anchor,
      volatility: def.volatility,
      drift: def.drift,
      price,
      open: roundPrice(toNumber(raw && raw.open, price)),
      prevClose: roundPrice(toNumber(raw && raw.prevClose, price)),
      momentum: clamp(toNumber(raw && raw.momentum, 0), -0.08, 0.08),
      lastChange: clamp(toNumber(raw && raw.lastChange, 0), -0.2, 0.2),
      minuteHistory: minuteHistory.length ? minuteHistory : [price],
      dailyHistory: dailyHistory.length ? dailyHistory : [price],
    };
  }
  return stocks;
}

function restoreActiveEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) {
    return [];
  }
  return rawEvents
    .map((entry, index) => ({
      id: toInt(entry.id, index + 1),
      scope: entry.scope === 'market' || entry.scope === 'sector' || entry.scope === 'stock' ? entry.scope : 'market',
      target: typeof entry.target === 'string' ? entry.target : '',
      tone: entry.tone === 'good' ? 'good' : 'bad',
      headline: typeof entry.headline === 'string' ? entry.headline : 'stray market packet',
      detail: typeof entry.detail === 'string' ? entry.detail : '',
      ticksLeft: Math.max(1, toInt(entry.ticksLeft, 1)),
      perTickImpact: clamp(toNumber(entry.perTickImpact, 0), -0.01, 0.01),
    }))
    .slice(0, 8);
}

function restoreEventLog(rawLog) {
  if (!Array.isArray(rawLog)) {
    return [];
  }
  return rawLog
    .map((entry, index) => ({
      id: toInt(entry.id, index + 1),
      tick: toInt(entry.tick, 0),
      label: typeof entry.label === 'string' ? entry.label : 'system',
      detail: typeof entry.detail === 'string' ? entry.detail : '',
      tone: normalizeTone(entry.tone),
    }))
    .slice(0, MAX_EVENT_LOG);
}

function createAccount(id, name, type, cash) {
  return {
    id,
    name,
    type,
    cash: roundMoney(cash),
    holdings: Object.create(null),
    realizedPnL: 0,
    tradeCount: 0,
    createdTick: 0,
    lastTrade: null,
  };
}

function accountHasHoldings(account) {
  return Object.keys(account.holdings).some((ticker) => account.holdings[ticker] && account.holdings[ticker].shares > 0);
}

function createBotShell(id, name) {
  return {
    ...createAccount(id, name, 'bot', 0),
    scriptSource: '',
    enabled: false,
    compileError: '',
    runtimeError: '',
    memory: Object.create(null),
    lastOrderResult: null,
  };
}

function restoreAccount(raw, fallback, isBot) {
  const account = {
    ...fallback,
    id: typeof raw?.id === 'string' ? raw.id : fallback.id,
    name: typeof raw?.name === 'string' ? raw.name : fallback.name,
    type: isBot ? 'bot' : 'manual',
    cash: roundMoney(toNumber(raw?.cash, fallback.cash)),
    holdings: restoreHoldings(raw?.holdings),
    realizedPnL: roundMoney(toNumber(raw?.realizedPnL, fallback.realizedPnL)),
    tradeCount: toInt(raw?.tradeCount, fallback.tradeCount),
    createdTick: toInt(raw?.createdTick, fallback.createdTick),
    lastTrade: restoreLastTrade(raw?.lastTrade),
  };

  if (isBot) {
    account.scriptSource = typeof raw?.scriptSource === 'string' ? raw.scriptSource : defaultBotScript(account.name);
    account.enabled = Boolean(raw?.enabled);
    account.compileError = typeof raw?.compileError === 'string' ? raw.compileError : '';
    account.runtimeError = typeof raw?.runtimeError === 'string' ? raw.runtimeError : '';
    account.memory = clonePlainObject(raw?.memory);
    account.lastOrderResult = restoreOrderResult(raw?.lastOrderResult);
  }

  return account;
}

function restoreHoldings(rawHoldings) {
  const holdings = Object.create(null);
  if (!rawHoldings || typeof rawHoldings !== 'object') {
    return holdings;
  }
  for (const ticker of Object.keys(rawHoldings)) {
    if (!STOCK_MAP[ticker]) {
      continue;
    }
    const entry = rawHoldings[ticker] || {};
    const shares = Math.max(0, toInt(entry.shares, 0));
    if (!shares) {
      continue;
    }
    holdings[ticker] = {
      shares,
      avgCost: roundPrice(toNumber(entry.avgCost, STOCK_MAP[ticker].anchor)),
    };
  }
  return holdings;
}

function restoreLastTrade(rawTrade) {
  if (!rawTrade || typeof rawTrade !== 'object') {
    return null;
  }
  return {
    tick: toInt(rawTrade.tick, 0),
    side: rawTrade.side === 'sell' ? 'sell' : 'buy',
    ticker: typeof rawTrade.ticker === 'string' ? rawTrade.ticker : '',
    shares: Math.max(0, toInt(rawTrade.shares, 0)),
    price: roundPrice(toNumber(rawTrade.price, 0)),
  };
}

function restoreOrderResult(rawResult) {
  if (!rawResult || typeof rawResult !== 'object') {
    return null;
  }
  return {
    ok: Boolean(rawResult.ok),
    shares: Math.max(0, toInt(rawResult.shares, 0)),
    price: roundPrice(toNumber(rawResult.price, 0)),
    reason: typeof rawResult.reason === 'string' ? rawResult.reason : '',
  };
}

function pauseSimulation() {
  simState.running = false;
  clearLoop();
}

function clearLoop() {
  if (loopHandle !== null) {
    clearTimeout(loopHandle);
    loopHandle = null;
  }
}

function scheduleLoop() {
  clearLoop();
  if (!simState || !simState.running) {
    return;
  }
  const cfg = SPEEDS[simState.speed] || SPEEDS['1x'];
  loopHandle = setTimeout(runLoopBatch, cfg.delayMs);
}

function runLoopBatch() {
  loopHandle = null;
  if (!simState || !simState.running) {
    return;
  }

  const cfg = SPEEDS[simState.speed] || SPEEDS['1x'];
  for (let index = 0; index < cfg.ticksPerBatch; index += 1) {
    stepSimulationTick(simState);
  }

  postSnapshot('tick');
  scheduleLoop();
}

function stepSimulationTick(state) {
  maybeGenerateEvent(state);
  updateMacroState(state);
  const eventEffects = collectEventEffects(state);

  for (const def of STOCK_DEFS) {
    const stock = state.stocks[def.ticker];
    const sectorDrift = state.sectorStates[stock.sector].drift;
    const sessionPulse = Math.sin((state.minuteOfDay / TRADING_DAY_MINUTES) * Math.PI) * 0.00012;
    const noise = (rand(state) - rand(state)) * stock.volatility * 0.0022;
    const meanReversion = ((stock.anchor - stock.price) / stock.anchor) * 0.00118;
    const drift = stock.drift;
    const momentum = stock.momentum * 0.22;
    const macro = state.marketBias * 0.00042 + state.marketPulse * 0.00021;
    const sector = sectorDrift * 0.00052;
    const eventImpact =
      eventEffects.market +
      (eventEffects.sector[stock.sector] || 0) +
      (eventEffects.stock[stock.ticker] || 0);

    const change = clamp(drift + macro + sector + sessionPulse + noise + meanReversion + momentum + eventImpact, -0.09, 0.09);
    stock.price = roundPrice(Math.max(1, stock.price * (1 + change)));
    stock.lastChange = change;
    stock.momentum = clamp(stock.momentum * 0.84 + change * 0.16, -0.06, 0.06);
    stock.minuteHistory.push(stock.price);
    if (stock.minuteHistory.length > MAX_MINUTE_HISTORY) {
      stock.minuteHistory.shift();
    }
    updateIndicatorsForStock(state, stock.ticker, stock.price);
  }

  for (const bot of state.bots) {
    if (!bot.enabled || bot.compileError || !bot._ast) {
      continue;
    }
    runBotScript(state, bot);
  }

  decayEvents(state);

  state.tick += 1;
  state.minuteOfDay += 1;
  if (state.minuteOfDay >= TRADING_DAY_MINUTES) {
    rollToNextDay(state);
  }
}

function updateMacroState(state) {
  state.marketBias = clamp(state.marketBias * 0.975 + randRange(state, -0.006, 0.006), -0.06, 0.06);
  state.marketPulse = clamp(state.marketPulse * 0.92 + randRange(state, -0.004, 0.004), -0.04, 0.04);
  for (const sector of Object.keys(state.sectorStates)) {
    state.sectorStates[sector].drift = clamp(
      state.sectorStates[sector].drift * 0.94 + randRange(state, -0.01, 0.01),
      -0.08,
      0.08
    );
  }
}

function maybeGenerateEvent(state) {
  if (state.activeEvents.length >= 4 || rand(state) > 0.0035) {
    return;
  }

  const scopeRoll = rand(state);
  const tone = rand(state) > 0.48 ? 'good' : 'bad';
  let scope = 'market';
  let target = '';
  let magnitude = 0;
  let duration = 0;

  if (scopeRoll < 0.22) {
    scope = 'market';
    magnitude = randRange(state, 0.00025, 0.0012);
    duration = toInt(randRange(state, 18, 70), 24);
  } else if (scopeRoll < 0.58) {
    scope = 'sector';
    target = pickRandom(state, Object.keys(state.sectorStates));
    magnitude = randRange(state, 0.00045, 0.00165);
    duration = toInt(randRange(state, 16, 58), 24);
  } else {
    scope = 'stock';
    target = pickRandom(state, STOCK_DEFS).ticker;
    magnitude = randRange(state, 0.0008, 0.0027);
    duration = toInt(randRange(state, 8, 40), 16);
  }

  const event = {
    id: ++state.newsCounter,
    scope,
    target,
    tone,
    headline: buildHeadline(state, scope, target, tone),
    detail: buildEventDetail(scope, target, tone, duration),
    ticksLeft: duration,
    perTickImpact: (tone === 'good' ? 1 : -1) * magnitude,
  };

  state.activeEvents.push(event);
  pushEventLog(state, event.headline, event.detail, tone === 'good' ? 'good' : 'bad');
}

function buildHeadline(state, scope, target, tone) {
  const templates = EVENT_TEMPLATES[scope][tone];
  const template = templates[Math.floor(rand(state) * templates.length)];
  if (scope === 'market') {
    return template;
  }
  if (scope === 'sector') {
    return template.replace('{sector}', prettifySector(target));
  }
  return template.replace('{ticker}', target);
}

function buildEventDetail(scope, target, tone, duration) {
  const mood = tone === 'good' ? 'buy-side pressure' : 'liquidation pressure';
  if (scope === 'market') {
    return `${mood} projected for roughly ${duration} ticks`;
  }
  if (scope === 'sector') {
    return `${prettifySector(target)} sees ${mood} for roughly ${duration} ticks`;
  }
  return `${target} catches ${mood} for roughly ${duration} ticks`;
}

function collectEventEffects(state) {
  const effects = {
    market: 0,
    sector: Object.create(null),
    stock: Object.create(null),
  };

  for (const event of state.activeEvents) {
    if (event.scope === 'market') {
      effects.market += event.perTickImpact;
    } else if (event.scope === 'sector') {
      effects.sector[event.target] = (effects.sector[event.target] || 0) + event.perTickImpact;
    } else if (event.scope === 'stock') {
      effects.stock[event.target] = (effects.stock[event.target] || 0) + event.perTickImpact;
    }
  }

  return effects;
}

function decayEvents(state) {
  const active = [];
  for (const event of state.activeEvents) {
    if (event.ticksLeft > 1) {
      active.push({ ...event, ticksLeft: event.ticksLeft - 1 });
    }
  }
  state.activeEvents = active;
}

function rollToNextDay(state) {
  for (const def of STOCK_DEFS) {
    const stock = state.stocks[def.ticker];
    stock.prevClose = stock.price;
    stock.open = stock.price;
    stock.dailyHistory.push(stock.price);
    if (stock.dailyHistory.length > MAX_DAILY_HISTORY) {
      stock.dailyHistory.shift();
    }
  }

  state.day += 1;
  state.minuteOfDay = 0;

  if (state.day % 5 === 0) {
    pushEventLog(state, 'archive pulse', `session archive rolled into day ${state.day}`, 'neutral');
  }
}

function createBot({ name, funding, script }) {
  const cleanName = String(name || '').trim().slice(0, 24);
  const initialFunding = roundMoney(Number(funding));
  if (!cleanName) {
    throw new Error('bot name is required');
  }
  if (initialFunding <= 0) {
    throw new Error('initial funding must be greater than zero');
  }
  if (simState.mainAccount.cash < initialFunding) {
    throw new Error('not enough cash in the main account');
  }

  const bot = createBotShell(`bot-${simState.tick}-${simState.newsCounter + simState.bots.length + 1}`, cleanName);
  bot.cash = initialFunding;
  bot.scriptSource = typeof script === 'string' && script.trim() ? script : defaultBotScript(cleanName);
  bot.createdTick = simState.tick;
  compileBotScript(simState, bot, true);
  bot.enabled = !bot.compileError;

  simState.mainAccount.cash = roundMoney(simState.mainAccount.cash - initialFunding);
  simState.bots.push(bot);
  pushEventLog(simState, 'new bot provisioned', `${cleanName} funded with ${formatMoney(initialFunding)}`, 'good');
}

function saveBotScript({ botId, script }) {
  const bot = getBotById(simState, botId);
  if (!bot) {
    throw new Error('bot not found');
  }
  bot.scriptSource = typeof script === 'string' ? script : '';
  compileBotScript(simState, bot, true);
}

function compileBotScript(state, bot, announce) {
  bot.runtimeError = '';
  bot.lastOrderResult = null;

  try {
    bot._ast = compileScript(bot.scriptSource);
    bot.compileError = '';
    if (announce) {
      pushEventLog(state, 'script compiled', `${bot.name} accepted the new strategy body`, 'neutral');
    }
  } catch (error) {
    bot._ast = null;
    bot.compileError = error instanceof Error ? error.message : String(error);
    bot.enabled = false;
    if (announce) {
      pushEventLog(state, 'script fault', `${bot.name}: ${bot.compileError}`, 'bad');
    }
  }
}

function toggleBot(botId, enabled) {
  const bot = getBotById(simState, botId);
  if (!bot) {
    throw new Error('bot not found');
  }
  if (enabled && bot.compileError) {
    throw new Error('cannot enable a bot with a compile error');
  }
  bot.enabled = Boolean(enabled);
  if (bot.enabled) {
    bot.runtimeError = '';
  }
  pushEventLog(simState, bot.enabled ? 'bot online' : 'bot paused', `${bot.name} ${bot.enabled ? 'entered' : 'left'} the loop`, bot.enabled ? 'good' : 'neutral');
}

function renameBot(botId, name) {
  const bot = getBotById(simState, botId);
  if (!bot) {
    throw new Error('bot not found');
  }
  const cleanName = String(name || '').trim().slice(0, 24);
  if (!cleanName) {
    throw new Error('bot name is required');
  }
  bot.name = cleanName;
}

function transferCash(fromId, toId, amount) {
  const from = getAccountById(simState, fromId);
  const to = getAccountById(simState, toId);
  if (!from || !to) {
    throw new Error('invalid transfer account');
  }
  if (from.id === to.id) {
    throw new Error('cannot transfer to the same account');
  }
  const value = roundMoney(Number(amount));
  if (value <= 0) {
    throw new Error('transfer amount must be greater than zero');
  }
  if (from.cash < value) {
    throw new Error('insufficient settled cash');
  }
  from.cash = roundMoney(from.cash - value);
  to.cash = roundMoney(to.cash + value);
  pushEventLog(simState, 'cash rerouted', `${from.name} -> ${to.name} moved ${formatMoney(value)}`, 'neutral');
}

function applyOrder({ accountId, ticker, side, shares, actor, label }) {
  const account = getAccountById(simState, accountId);
  const stock = simState.stocks[ticker];
  const wholeShares = Math.max(0, Math.floor(Number(shares)));

  if (!account || !stock) {
    throw new Error('invalid order target');
  }
  if (wholeShares <= 0) {
    return { ok: false, shares: 0, price: stock.price, reason: 'shares must be whole and greater than zero' };
  }

  const executionPrice = roundPrice(stock.price * (side === 'buy' ? 1 + SLIPPAGE_BPS : 1 - SLIPPAGE_BPS));

  if (side === 'buy') {
    const cost = roundMoney(executionPrice * wholeShares + ORDER_FEE);
    if (account.cash < cost) {
      return { ok: false, shares: wholeShares, price: executionPrice, reason: 'not enough cash' };
    }

    const holding = account.holdings[ticker] || { shares: 0, avgCost: 0 };
    const previousCostBasis = holding.shares * holding.avgCost;
    const nextShares = holding.shares + wholeShares;
    const nextCostBasis = previousCostBasis + executionPrice * wholeShares + ORDER_FEE;

    holding.shares = nextShares;
    holding.avgCost = roundPrice(nextCostBasis / nextShares);
    account.holdings[ticker] = holding;
    account.cash = roundMoney(account.cash - cost);
  } else {
    const holding = account.holdings[ticker];
    if (!holding || holding.shares < wholeShares) {
      return { ok: false, shares: wholeShares, price: executionPrice, reason: 'not enough shares' };
    }

    const proceeds = roundMoney(executionPrice * wholeShares - ORDER_FEE);
    const costBasis = holding.avgCost * wholeShares;
    account.cash = roundMoney(account.cash + proceeds);
    account.realizedPnL = roundMoney(account.realizedPnL + (proceeds - costBasis));
    holding.shares -= wholeShares;
    if (holding.shares <= 0) {
      delete account.holdings[ticker];
    } else {
      account.holdings[ticker] = holding;
    }
  }

  account.tradeCount += 1;
  account.lastTrade = {
    tick: simState.tick,
    side,
    ticker,
    shares: wholeShares,
    price: executionPrice,
  };

  pushEventLog(
    simState,
    actor === 'manual' ? 'manual order filled' : 'bot order filled',
    `${label}: ${account.name} ${side} ${wholeShares} ${ticker} @ ${formatMoney(executionPrice)}`,
    side === 'buy' ? 'good' : 'neutral'
  );

  return { ok: true, shares: wholeShares, price: executionPrice, reason: '' };
}

function runBotScript(state, bot) {
  const runtime = createRuntime(state, bot);
  try {
    executeProgram(bot._ast, runtime);
  } catch (error) {
    bot.runtimeError = error instanceof Error ? error.message : String(error);
    bot.enabled = false;
    pushEventLog(state, 'bot halted', `${bot.name}: ${bot.runtimeError}`, 'bad');
  }
}

function createRuntime(state, bot) {
  const accountSnapshot = freezePlainObject(buildAccountSnapshot(state, bot));
  const recentEvent = state.eventLog[0]
    ? freezePlainObject({
        label: state.eventLog[0].label,
        detail: state.eventLog[0].detail,
        tone: state.eventLog[0].tone,
      })
    : null;

  const ctx = freezePlainObject({
    tick: state.tick,
    day: state.day,
    minuteOfDay: state.minuteOfDay,
    speed: state.speed,
    account: accountSnapshot,
    recentEvent,
  });

  const helpers = {
    buy: (ticker, shares) => {
      const result = applyOrder({
        accountId: bot.id,
        ticker: String(ticker).toUpperCase(),
        side: 'buy',
        shares,
        actor: 'bot',
        label: bot.name,
      });
      bot.lastOrderResult = result;
      return freezePlainObject({ ...result });
    },
    sell: (ticker, shares) => {
      const result = applyOrder({
        accountId: bot.id,
        ticker: String(ticker).toUpperCase(),
        side: 'sell',
        shares,
        actor: 'bot',
        label: bot.name,
      });
      bot.lastOrderResult = result;
      return freezePlainObject({ ...result });
    },
    price: (ticker) => {
      const stock = state.stocks[String(ticker).toUpperCase()];
      if (!stock) {
        throw new Error(`unknown ticker ${ticker}`);
      }
      return stock.price;
    },
    cash: () => bot.cash,
    position: (ticker) => {
      const symbol = String(ticker).toUpperCase();
      if (!state.stocks[symbol]) {
        throw new Error(`unknown ticker ${ticker}`);
      }
      const holding = bot.holdings[symbol];
      const shares = holding ? holding.shares : 0;
      const avgCost = holding ? holding.avgCost : 0;
      const marketValue = shares * state.stocks[symbol].price;
      return freezePlainObject({
        shares,
        avgCost,
        marketValue: roundMoney(marketValue),
        unrealizedPnL: roundMoney(marketValue - avgCost * shares),
      });
    },
    sma: (ticker, window) => getIndicatorValue(state, String(ticker).toUpperCase(), 'sma', normalizeWindow(window)),
    ema: (ticker, window) => getIndicatorValue(state, String(ticker).toUpperCase(), 'ema', normalizeWindow(window)),
  };

  return {
    ctx,
    memory: bot.memory,
    helpers,
    ops: 0,
    env: Object.create(null),
  };
}

function buildAccountSnapshot(state, account) {
  const holdings = Object.create(null);
  for (const ticker of Object.keys(account.holdings)) {
    const entry = account.holdings[ticker];
    const price = state.stocks[ticker].price;
    holdings[ticker] = freezePlainObject({
      shares: entry.shares,
      avgCost: entry.avgCost,
      marketValue: roundMoney(price * entry.shares),
      unrealizedPnL: roundMoney(price * entry.shares - entry.avgCost * entry.shares),
    });
  }
  return {
    id: account.id,
    name: account.name,
    cash: account.cash,
    realizedPnL: account.realizedPnL,
    holdings: freezePlainObject(holdings),
    netWorth: roundMoney(account.cash + calculateHoldingsValue(state, account)),
  };
}

function getIndicatorValue(state, ticker, kind, window) {
  if (!state.stocks[ticker]) {
    throw new Error(`unknown ticker ${ticker}`);
  }
  if (!state.indicators[ticker]) {
    state.indicators[ticker] = { sma: Object.create(null), ema: Object.create(null) };
  }

  const bucket = state.indicators[ticker][kind];
  if (!bucket[window]) {
    bucket[window] = initializeIndicator(state.stocks[ticker].minuteHistory, kind, window);
  }

  return roundPrice(bucket[window].value);
}

function initializeIndicator(history, kind, window) {
  const slice = history.slice(-window);
  if (kind === 'sma') {
    const values = slice.length ? slice.slice() : [history[history.length - 1] || 0];
    const sum = values.reduce((acc, value) => acc + value, 0);
    return {
      queue: values,
      sum,
      value: sum / values.length,
    };
  }

  let value = history[0] || 0;
  const alpha = 2 / (window + 1);
  for (let index = 1; index < history.length; index += 1) {
    value = history[index] * alpha + value * (1 - alpha);
  }
  return { alpha, value };
}

function updateIndicatorsForStock(state, ticker, price) {
  const indicatorSet = state.indicators[ticker];
  if (!indicatorSet) {
    return;
  }

  for (const key of Object.keys(indicatorSet.sma)) {
    const indicator = indicatorSet.sma[key];
    indicator.queue.push(price);
    indicator.sum += price;
    const max = Number(key);
    while (indicator.queue.length > max) {
      indicator.sum -= indicator.queue.shift();
    }
    indicator.value = indicator.sum / indicator.queue.length;
  }

  for (const key of Object.keys(indicatorSet.ema)) {
    const indicator = indicatorSet.ema[key];
    indicator.value = price * indicator.alpha + indicator.value * (1 - indicator.alpha);
  }
}

function getBotById(state, botId) {
  return state.bots.find((bot) => bot.id === botId) || null;
}

function getAccountById(state, accountId) {
  if (accountId === 'main') {
    return state.mainAccount;
  }
  return getBotById(state, accountId);
}

function listAccounts(state) {
  return [state.mainAccount, ...state.bots];
}

function calculateHoldingsValue(state, account) {
  let total = 0;
  for (const ticker of Object.keys(account.holdings)) {
    total += state.stocks[ticker].price * account.holdings[ticker].shares;
  }
  return roundMoney(total);
}

function buildView(state) {
  const stocks = STOCK_DEFS.map((def) => {
    const stock = state.stocks[def.ticker];
    return {
      ticker: stock.ticker,
      name: stock.name,
      sector: prettifySector(stock.sector),
      price: stock.price,
      prevClose: stock.prevClose,
      open: stock.open,
      changePct: stock.prevClose ? ((stock.price - stock.prevClose) / stock.prevClose) * 100 : 0,
      lastChange: stock.lastChange,
      minuteHistory: stock.minuteHistory.slice(-TRADING_DAY_MINUTES * 5),
      dailyHistory: stock.dailyHistory.slice(-60),
    };
  });

  const accounts = listAccounts(state).map((account) => {
    const holdings = Object.keys(account.holdings)
      .map((ticker) => {
        const holding = account.holdings[ticker];
        const marketValue = roundMoney(state.stocks[ticker].price * holding.shares);
        const costBasis = roundMoney(holding.avgCost * holding.shares);
        return {
          ticker,
          shares: holding.shares,
          avgCost: holding.avgCost,
          currentPrice: state.stocks[ticker].price,
          marketValue,
          unrealizedPnL: roundMoney(marketValue - costBasis),
        };
      })
      .sort((left, right) => right.marketValue - left.marketValue);

    const holdingsValue = calculateHoldingsValue(state, account);
    const netWorth = roundMoney(account.cash + holdingsValue);
    const unrealizedPnL = roundMoney(
      holdings.reduce((sum, holding) => sum + holding.unrealizedPnL, 0)
    );

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      cash: account.cash,
      holdingsValue,
      netWorth,
      realizedPnL: account.realizedPnL,
      unrealizedPnL,
      tradeCount: account.tradeCount,
      lastTrade: account.lastTrade,
      holdings,
      enabled: account.type === 'bot' ? account.enabled : true,
      compileError: account.type === 'bot' ? account.compileError : '',
      runtimeError: account.type === 'bot' ? account.runtimeError : '',
      scriptSource: account.type === 'bot' ? account.scriptSource : '',
      lastOrderResult: account.type === 'bot' ? account.lastOrderResult : null,
    };
  });

  const leaderboard = accounts
    .map((account) => ({
      id: account.id,
      name: account.name,
      type: account.type,
      enabled: account.enabled,
      netWorth: account.netWorth,
      realizedPnL: account.realizedPnL,
      unrealizedPnL: account.unrealizedPnL,
      totalPnL: roundMoney(account.realizedPnL + account.unrealizedPnL),
      tradeCount: account.tradeCount,
      compileError: account.compileError,
      runtimeError: account.runtimeError,
    }))
    .sort((left, right) => right.netWorth - left.netWorth);

  const empireNetWorth = roundMoney(accounts.reduce((sum, account) => sum + account.netWorth, 0));
  const empireCash = roundMoney(accounts.reduce((sum, account) => sum + account.cash, 0));

  return {
    seed: state.seed,
    tick: state.tick,
    day: state.day,
    minuteOfDay: state.minuteOfDay,
    clockLabel: formatClock(state.minuteOfDay),
    running: state.running,
    speed: state.speed,
    stocks,
    accounts,
    bots: accounts.filter((account) => account.type === 'bot'),
    leaderboard,
    empireCash,
    empireNetWorth,
    mainAccountId: 'main',
    eventLog: state.eventLog.slice(0, 18).map((entry) => ({
      ...entry,
      clockLabel: formatClock(entry.tick % TRADING_DAY_MINUTES),
      day: Math.floor(entry.tick / TRADING_DAY_MINUTES) + 1,
    })),
  };
}

function exportState(state) {
  return {
    version: SAVE_VERSION,
    seed: state.seed,
    rngState: state.rngState,
    tick: state.tick,
    day: state.day,
    minuteOfDay: state.minuteOfDay,
    running: state.running,
    speed: state.speed,
    marketBias: state.marketBias,
    marketPulse: state.marketPulse,
    newsCounter: state.newsCounter,
    sectorStates: clonePlainObject(state.sectorStates),
    stocks: serializeStocks(state.stocks),
    activeEvents: state.activeEvents.map((event) => ({ ...event })),
    eventLog: state.eventLog.map((entry) => ({ ...entry })),
    mainAccount: serializeAccount(state.mainAccount),
    bots: state.bots.map((bot) => serializeAccount(bot)),
  };
}

function serializeStocks(stocks) {
  const serialized = Object.create(null);
  for (const def of STOCK_DEFS) {
    const stock = stocks[def.ticker];
    serialized[def.ticker] = {
      price: stock.price,
      open: stock.open,
      prevClose: stock.prevClose,
      momentum: stock.momentum,
      lastChange: stock.lastChange,
      minuteHistory: stock.minuteHistory.slice(-MAX_MINUTE_HISTORY),
      dailyHistory: stock.dailyHistory.slice(-MAX_DAILY_HISTORY),
    };
  }
  return serialized;
}

function serializeAccount(account) {
  const base = {
    id: account.id,
    name: account.name,
    type: account.type,
    cash: account.cash,
    holdings: clonePlainObject(account.holdings),
    realizedPnL: account.realizedPnL,
    tradeCount: account.tradeCount,
    createdTick: account.createdTick,
    lastTrade: account.lastTrade ? { ...account.lastTrade } : null,
  };
  if (account.type === 'bot') {
    base.scriptSource = account.scriptSource;
    base.enabled = account.enabled;
    base.compileError = account.compileError;
    base.runtimeError = account.runtimeError;
    base.memory = clonePlainObject(account.memory);
    base.lastOrderResult = account.lastOrderResult ? { ...account.lastOrderResult } : null;
  }
  return base;
}

function postSnapshot(reason, force) {
  if (!simState) {
    return;
  }

  const now = Date.now();
  if (!force && now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) {
    return;
  }
  lastSnapshotAt = now;

  self.postMessage({
    type: 'snapshot',
    reason,
    persisted: exportState(simState),
    view: buildView(simState),
  });
}

function pushEventLog(state, label, detail, tone) {
  state.eventLog.unshift({
    id: ++state.newsCounter,
    tick: state.tick,
    label,
    detail,
    tone: normalizeTone(tone),
  });
  if (state.eventLog.length > MAX_EVENT_LOG) {
    state.eventLog.length = MAX_EVENT_LOG;
  }
}

function normalizeTone(tone) {
  if (tone === 'good' || tone === 'bad' || tone === 'neutral') {
    return tone;
  }
  return 'neutral';
}

function normalizeSeed(input) {
  if (typeof input === 'number' && Number.isFinite(input)) {
    return input >>> 0;
  }
  const text = String(input ?? '');
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rand(state) {
  let t = (state.rngState += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randRange(state, min, max) {
  return min + (max - min) * rand(state);
}

function pickRandom(state, list) {
  return list[Math.floor(rand(state) * list.length)];
}

function prettifySector(sector) {
  return sector.replace(/-/g, ' ');
}

function formatClock(minuteOfDay) {
  const totalMinutes = 9 * 60 + 30 + minuteOfDay;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  const absolute = Math.abs(value);
  return `${sign}$${absolute.toFixed(2)}`;
}

function roundMoney(value) {
  return Math.round(value * 100) / 100;
}

function roundPrice(value) {
  return Math.round(value * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function normalizeWindow(value) {
  const parsed = Math.trunc(Number(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function clonePlainObject(value) {
  if (!value || typeof value !== 'object') {
    return Object.create(null);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  const clone = Object.create(null);
  for (const key of Object.keys(value)) {
    clone[key] = cloneValue(value[key]);
  }
  return clone;
}

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  if (value && typeof value === 'object') {
    const clone = Object.create(null);
    for (const key of Object.keys(value)) {
      clone[key] = cloneValue(value[key]);
    }
    return clone;
  }
  return value;
}

function freezePlainObject(value) {
  if (!value || typeof value !== 'object') {
    return value;
  }
  for (const key of Object.keys(value)) {
    if (value[key] && typeof value[key] === 'object') {
      freezePlainObject(value[key]);
    }
  }
  return Object.freeze(value);
}

function defaultBotScript() {
  return `let ticker = "AAPL";
let quote = price(ticker);
let trend = sma(ticker, 24);
let cooldown = memory.cooldown || 0;

if (cooldown > 0) {
  memory.cooldown = cooldown - 1;
} else if (quote < trend * 0.985 && cash() >= quote * 2) {
  let order = buy(ticker, 2);
  if (order.ok) {
    memory.lastBuy = quote;
    memory.cooldown = 8;
  }
} else if (position(ticker).shares > 0 && quote > (memory.lastBuy || quote) * 1.035) {
  let order = sell(ticker, 2);
  if (order.ok) {
    memory.cooldown = 10;
  }
}

memory.lastSeenTick = ctx.tick;`;
}

function compileScript(source) {
  const parser = new Parser(tokenize(source));
  return parser.parseProgram();
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.index = 0;
  }

  parseProgram() {
    const body = [];
    while (!this.is('eof')) {
      body.push(this.parseStatement());
    }
    return { type: 'Program', body };
  }

  parseStatement() {
    if (this.matchValue('let')) {
      const name = this.expect('identifier').value;
      this.expect('=');
      const value = this.parseExpression();
      this.consumeOptional(';');
      return { type: 'LetStatement', name, value };
    }

    if (this.matchValue('if')) {
      return this.parseIfStatement();
    }

    const expression = this.parseExpression();
    if (this.match('=')) {
      if (!isAssignableExpression(expression)) {
        throw this.errorAtCurrent('invalid assignment target');
      }
      const value = this.parseExpression();
      this.consumeOptional(';');
      return { type: 'AssignmentStatement', target: expression, value };
    }

    this.consumeOptional(';');
    return { type: 'ExpressionStatement', expression };
  }

  parseIfStatement() {
    this.expect('(');
    const test = this.parseExpression();
    this.expect(')');
    const consequent = this.parseBlock();
    let alternate = null;
    if (this.matchValue('else')) {
      alternate = this.matchValue('if') ? this.parseIfStatement() : this.parseBlock();
    }
    return { type: 'IfStatement', test, consequent, alternate };
  }

  parseBlock() {
    this.expect('{');
    const body = [];
    while (!this.is('}') && !this.is('eof')) {
      body.push(this.parseStatement());
    }
    this.expect('}');
    return { type: 'BlockStatement', body };
  }

  parseExpression() {
    return this.parseLogicalOr();
  }

  parseLogicalOr() {
    let expression = this.parseLogicalAnd();
    while (this.match('||')) {
      expression = { type: 'BinaryExpression', operator: '||', left: expression, right: this.parseLogicalAnd() };
    }
    return expression;
  }

  parseLogicalAnd() {
    let expression = this.parseEquality();
    while (this.match('&&')) {
      expression = { type: 'BinaryExpression', operator: '&&', left: expression, right: this.parseEquality() };
    }
    return expression;
  }

  parseEquality() {
    let expression = this.parseComparison();
    while (this.is('==') || this.is('!=')) {
      const operator = this.consume().type;
      expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseComparison() };
    }
    return expression;
  }

  parseComparison() {
    let expression = this.parseTerm();
    while (this.is('<') || this.is('<=') || this.is('>') || this.is('>=')) {
      const operator = this.consume().type;
      expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseTerm() };
    }
    return expression;
  }

  parseTerm() {
    let expression = this.parseFactor();
    while (this.is('+') || this.is('-')) {
      const operator = this.consume().type;
      expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseFactor() };
    }
    return expression;
  }

  parseFactor() {
    let expression = this.parseUnary();
    while (this.is('*') || this.is('/') || this.is('%')) {
      const operator = this.consume().type;
      expression = { type: 'BinaryExpression', operator, left: expression, right: this.parseUnary() };
    }
    return expression;
  }

  parseUnary() {
    if (this.match('!') || this.match('-')) {
      const operator = this.previous().type;
      return { type: 'UnaryExpression', operator, argument: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  parsePostfix() {
    let expression = this.parsePrimary();
    while (true) {
      if (this.match('(')) {
        const args = [];
        if (!this.is(')')) {
          do {
            args.push(this.parseExpression());
          } while (this.match(','));
        }
        this.expect(')');
        expression = { type: 'CallExpression', callee: expression, arguments: args };
        continue;
      }
      if (this.match('.')) {
        const property = this.expect('identifier').value;
        expression = { type: 'MemberExpression', object: expression, property };
        continue;
      }
      return expression;
    }
  }

  parsePrimary() {
    const token = this.consume();
    if (token.type === 'number') {
      return { type: 'Literal', value: token.value };
    }
    if (token.type === 'string') {
      return { type: 'Literal', value: token.value };
    }
    if (token.type === 'identifier') {
      if (token.value === 'true') {
        return { type: 'Literal', value: true };
      }
      if (token.value === 'false') {
        return { type: 'Literal', value: false };
      }
      if (token.value === 'null') {
        return { type: 'Literal', value: null };
      }
      return { type: 'Identifier', name: token.value };
    }
    if (token.type === '(') {
      const expression = this.parseExpression();
      this.expect(')');
      return expression;
    }
    throw this.error(token, `unexpected token ${token.type}`);
  }

  consumeOptional(type) {
    if (this.is(type)) {
      this.consume();
      return true;
    }
    return false;
  }

  expect(type) {
    if (!this.is(type)) {
      throw this.errorAtCurrent(`expected ${type}`);
    }
    return this.consume();
  }

  match(type) {
    if (!this.is(type)) {
      return false;
    }
    this.consume();
    return true;
  }

  matchValue(value) {
    if (this.peek().type === 'identifier' && this.peek().value === value) {
      this.consume();
      return true;
    }
    return false;
  }

  is(type) {
    return this.peek().type === type;
  }

  consume() {
    return this.tokens[this.index++];
  }

  peek() {
    return this.tokens[this.index];
  }

  previous() {
    return this.tokens[this.index - 1];
  }

  errorAtCurrent(message) {
    return this.error(this.peek(), message);
  }

  error(token, message) {
    return new Error(`${message} at ${token.line}:${token.column}`);
  }
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let line = 1;
  let column = 1;

  while (index < source.length) {
    const char = source[index];

    if (char === ' ' || char === '\t' || char === '\r') {
      index += 1;
      column += 1;
      continue;
    }

    if (char === '\n') {
      index += 1;
      line += 1;
      column = 1;
      continue;
    }

    if (char === '/' && source[index + 1] === '/') {
      while (index < source.length && source[index] !== '\n') {
        index += 1;
        column += 1;
      }
      continue;
    }

    if (char === '/' && source[index + 1] === '*') {
      index += 2;
      column += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        if (source[index] === '\n') {
          line += 1;
          column = 1;
          index += 1;
        } else {
          index += 1;
          column += 1;
        }
      }
      index += 2;
      column += 2;
      continue;
    }

    const twoChar = source.slice(index, index + 2);
    if (['&&', '||', '==', '!=', '<=', '>='].includes(twoChar)) {
      tokens.push({ type: twoChar, line, column });
      index += 2;
      column += 2;
      continue;
    }

    if ('+-*/%=<>(){};,.!'.includes(char)) {
      tokens.push({ type: char, line, column });
      index += 1;
      column += 1;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const startLine = line;
      const startColumn = column;
      index += 1;
      column += 1;
      let value = '';
      while (index < source.length && source[index] !== quote) {
        if (source[index] === '\\') {
          const escaped = source[index + 1];
          if (escaped === 'n') {
            value += '\n';
          } else if (escaped === 't') {
            value += '\t';
          } else {
            value += escaped;
          }
          index += 2;
          column += 2;
          continue;
        }
        value += source[index];
        index += 1;
        column += 1;
      }
      if (source[index] !== quote) {
        throw new Error(`unterminated string at ${startLine}:${startColumn}`);
      }
      index += 1;
      column += 1;
      tokens.push({ type: 'string', value, line: startLine, column: startColumn });
      continue;
    }

    if (isDigit(char) || (char === '.' && isDigit(source[index + 1]))) {
      const start = index;
      const startColumn = column;
      while (index < source.length && /[0-9.]/.test(source[index])) {
        index += 1;
        column += 1;
      }
      tokens.push({
        type: 'number',
        value: Number(source.slice(start, index)),
        line,
        column: startColumn,
      });
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = index;
      const startColumn = column;
      while (index < source.length && isIdentifierPart(source[index])) {
        index += 1;
        column += 1;
      }
      tokens.push({
        type: 'identifier',
        value: source.slice(start, index),
        line,
        column: startColumn,
      });
      continue;
    }

    throw new Error(`unexpected character "${char}" at ${line}:${column}`);
  }

  tokens.push({ type: 'eof', line, column });
  return tokens;
}

function isDigit(char) {
  return char >= '0' && char <= '9';
}

function isIdentifierStart(char) {
  return /[A-Za-z_$]/.test(char);
}

function isIdentifierPart(char) {
  return /[A-Za-z0-9_$]/.test(char);
}

function isAssignableExpression(expression) {
  return expression.type === 'Identifier' || expression.type === 'MemberExpression';
}

function executeProgram(program, runtime) {
  executeBlock(program.body, runtime, runtime.env);
}

function executeBlock(statements, runtime, env) {
  const blockEnv = Object.create(env);
  for (const statement of statements) {
    runtime.ops += 1;
    if (runtime.ops > MAX_SCRIPT_OPS) {
      throw new Error('script exceeded per-tick budget');
    }
    executeStatement(statement, runtime, blockEnv);
  }
}

function executeStatement(statement, runtime, env) {
  switch (statement.type) {
    case 'LetStatement':
      env[statement.name] = evaluateExpression(statement.value, runtime, env);
      break;
    case 'AssignmentStatement':
      assignValue(statement.target, evaluateExpression(statement.value, runtime, env), runtime, env);
      break;
    case 'ExpressionStatement':
      evaluateExpression(statement.expression, runtime, env);
      break;
    case 'IfStatement':
      if (truthy(evaluateExpression(statement.test, runtime, env))) {
        executeBlock(statement.consequent.body, runtime, env);
      } else if (statement.alternate) {
        if (statement.alternate.type === 'IfStatement') {
          executeStatement(statement.alternate, runtime, env);
        } else {
          executeBlock(statement.alternate.body, runtime, env);
        }
      }
      break;
    default:
      throw new Error(`unsupported statement ${statement.type}`);
  }
}

function evaluateExpression(expression, runtime, env) {
  runtime.ops += 1;
  if (runtime.ops > MAX_SCRIPT_OPS) {
    throw new Error('script exceeded per-tick budget');
  }

  switch (expression.type) {
    case 'Literal':
      return expression.value;
    case 'Identifier':
      return resolveIdentifier(expression.name, runtime, env);
    case 'UnaryExpression': {
      const argument = evaluateExpression(expression.argument, runtime, env);
      if (expression.operator === '!') {
        return !truthy(argument);
      }
      if (expression.operator === '-') {
        return -Number(argument || 0);
      }
      throw new Error(`unsupported unary operator ${expression.operator}`);
    }
    case 'BinaryExpression':
      return evaluateBinaryExpression(expression, runtime, env);
    case 'CallExpression':
      return evaluateCallExpression(expression, runtime, env);
    case 'MemberExpression': {
      const object = evaluateExpression(expression.object, runtime, env);
      return safeGet(object, expression.property);
    }
    default:
      throw new Error(`unsupported expression ${expression.type}`);
  }
}

function evaluateBinaryExpression(expression, runtime, env) {
  if (expression.operator === '&&') {
    const left = evaluateExpression(expression.left, runtime, env);
    return truthy(left) ? evaluateExpression(expression.right, runtime, env) : left;
  }
  if (expression.operator === '||') {
    const left = evaluateExpression(expression.left, runtime, env);
    return truthy(left) ? left : evaluateExpression(expression.right, runtime, env);
  }

  const left = evaluateExpression(expression.left, runtime, env);
  const right = evaluateExpression(expression.right, runtime, env);

  switch (expression.operator) {
    case '+':
      return left + right;
    case '-':
      return Number(left || 0) - Number(right || 0);
    case '*':
      return Number(left || 0) * Number(right || 0);
    case '/':
      return Number(right || 0) === 0 ? 0 : Number(left || 0) / Number(right || 0);
    case '%':
      return Number(right || 0) === 0 ? 0 : Number(left || 0) % Number(right || 0);
    case '<':
      return left < right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '>=':
      return left >= right;
    case '==':
      return left === right;
    case '!=':
      return left !== right;
    default:
      throw new Error(`unsupported operator ${expression.operator}`);
  }
}

function evaluateCallExpression(expression, runtime, env) {
  if (expression.callee.type !== 'Identifier') {
    throw new Error('only direct helper calls are supported');
  }
  const helper = runtime.helpers[expression.callee.name];
  if (!helper) {
    throw new Error(`unknown helper ${expression.callee.name}`);
  }
  const args = expression.arguments.map((arg) => evaluateExpression(arg, runtime, env));
  return helper(...args);
}

function resolveIdentifier(name, runtime, env) {
  if (name === 'ctx') {
    return runtime.ctx;
  }
  if (name === 'memory') {
    return runtime.memory;
  }
  if (hasLocal(env, name)) {
    return getLocal(env, name);
  }
  throw new Error(`undefined variable ${name}`);
}

function assignValue(target, value, runtime, env) {
  if (target.type === 'Identifier') {
    if (target.name === 'ctx' || target.name === 'memory' || runtime.helpers[target.name]) {
      throw new Error(`cannot assign to ${target.name}`);
    }
    if (!hasLocal(env, target.name)) {
      throw new Error(`undefined variable ${target.name}`);
    }
    setLocal(env, target.name, value);
    return;
  }

  const root = getRootIdentifier(target);
  if (root !== 'memory') {
    throw new Error('only memory properties can be assigned');
  }

  const container = resolveMemoryContainer(target.object, runtime, env, true);
  safeSet(container, target.property, cloneForMemory(value));
}

function getRootIdentifier(expression) {
  if (expression.type === 'Identifier') {
    return expression.name;
  }
  if (expression.type === 'MemberExpression') {
    return getRootIdentifier(expression.object);
  }
  return '';
}

function resolveMemoryContainer(expression, runtime, env, createMissing) {
  if (expression.type === 'Identifier') {
    if (expression.name !== 'memory') {
      throw new Error('memory assignment must start from memory');
    }
    return runtime.memory;
  }

  if (expression.type !== 'MemberExpression') {
    throw new Error('invalid memory path');
  }

  const parent = resolveMemoryContainer(expression.object, runtime, env, createMissing);
  let next = safeGet(parent, expression.property);
  if (next == null && createMissing) {
    next = Object.create(null);
    safeSet(parent, expression.property, next);
  }
  if (!next || typeof next !== 'object') {
    throw new Error('memory path segment is not an object');
  }
  return next;
}

function cloneForMemory(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => cloneForMemory(entry));
  }
  if (value && typeof value === 'object') {
    const clone = Object.create(null);
    for (const key of Object.keys(value)) {
      clone[key] = cloneForMemory(value[key]);
    }
    return clone;
  }
  return value;
}

function safeGet(object, property) {
  if (!object || typeof object !== 'object') {
    return undefined;
  }
  if (property === '__proto__' || property === 'prototype' || property === 'constructor') {
    throw new Error('forbidden property access');
  }
  return Object.prototype.hasOwnProperty.call(object, property) ? object[property] : undefined;
}

function safeSet(object, property, value) {
  if (property === '__proto__' || property === 'prototype' || property === 'constructor') {
    throw new Error('forbidden property write');
  }
  object[property] = value;
}

function hasLocal(env, name) {
  let cursor = env;
  while (cursor) {
    if (Object.prototype.hasOwnProperty.call(cursor, name)) {
      return true;
    }
    cursor = Object.getPrototypeOf(cursor);
  }
  return false;
}

function getLocal(env, name) {
  let cursor = env;
  while (cursor) {
    if (Object.prototype.hasOwnProperty.call(cursor, name)) {
      return cursor[name];
    }
    cursor = Object.getPrototypeOf(cursor);
  }
  return undefined;
}

function setLocal(env, name, value) {
  let cursor = env;
  while (cursor) {
    if (Object.prototype.hasOwnProperty.call(cursor, name)) {
      cursor[name] = value;
      return;
    }
    cursor = Object.getPrototypeOf(cursor);
  }
  throw new Error(`undefined variable ${name}`);
}

function truthy(value) {
  return Boolean(value);
}
