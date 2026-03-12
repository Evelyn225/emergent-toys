const STORAGE_KEY = 'paperbots-save-v1';

const RANGE_CONFIG = {
  '60m': { key: 'minuteHistory', count: 60 },
  '1D': { key: 'minuteHistory', count: 390 },
  '5D': { key: 'minuteHistory', count: 1950 },
  '30D': { key: 'dailyHistory', count: 30 },
};

const TEMPLATE_LIBRARY = {
  mean_drift: {
    label: 'mean drift',
    code: `let ticker = "AAPL";
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

memory.lastSeenTick = ctx.tick;`,
  },
  breakout_fan: {
    label: 'breakout fan',
    code: `let ticker = "NVDA";
let fast = ema(ticker, 12);
let slow = ema(ticker, 48);
let quote = price(ticker);
let hasShares = position(ticker).shares > 0;

if (fast > slow && quote > fast * 1.003 && cash() >= quote) {
  let order = buy(ticker, 1);
  if (order.ok) {
    memory.stop = quote * 0.97;
  }
} else if (hasShares && (quote < (memory.stop || quote) || fast < slow)) {
  sell(ticker, position(ticker).shares);
}

memory.spread = fast - slow;`,
  },
  trend_pullback: {
    label: 'trend pullback',
    code: `let ticker = "MSFT";
let quote = price(ticker);
let fast = ema(ticker, 18);
let slow = ema(ticker, 72);
let pos = position(ticker);
let shares = pos.shares;
let cooldown = memory.cooldown || 0;

if (ctx.minuteOfDay > 382) {
  if (shares > 0) {
    sell(ticker, shares);
  }
  memory.cooldown = 6;
} else if (cooldown > 0) {
  memory.cooldown = cooldown - 1;
} else if (shares == 0 && fast > slow && quote < fast * 0.996 && cash() >= quote * 2) {
  let order = buy(ticker, 2);
  if (order.ok) {
    memory.entry = quote;
    memory.stop = quote * 0.978;
    memory.cooldown = 4;
  }
} else if (shares > 0) {
  if (quote > (memory.entry || quote) * 1.024) {
    memory.stop = quote * 0.988;
  }
  if (quote < (memory.stop || quote) || fast < slow) {
    let order = sell(ticker, shares);
    if (order.ok) {
      memory.cooldown = 10;
    }
  }
}

memory.bias = fast - slow;`,
  },
  opening_range: {
    label: 'opening range',
    code: `let ticker = "NVDA";
let quote = price(ticker);
let fast = ema(ticker, 12);
let slow = ema(ticker, 36);
let pos = position(ticker);

if (ctx.minuteOfDay == 0) {
  memory.rangeHigh = quote;
  memory.rangeLow = quote;
  memory.stop = 0;
}

let rangeHigh = memory.rangeHigh || quote;
let rangeLow = memory.rangeLow || quote;

if (ctx.minuteOfDay < 24) {
  if (quote > rangeHigh) {
    memory.rangeHigh = quote;
  }
  if (quote < rangeLow) {
    memory.rangeLow = quote;
  }
} else if (ctx.minuteOfDay > 382) {
  if (pos.shares > 0) {
    sell(ticker, pos.shares);
  }
} else if (pos.shares == 0 && fast > slow && quote > rangeHigh * 1.002 && cash() >= quote) {
  let order = buy(ticker, 1);
  if (order.ok) {
    memory.stop = rangeHigh * 0.992;
  }
} else if (pos.shares > 0 && (quote < (memory.stop || quote) || fast < slow || quote < fast * 0.995)) {
  sell(ticker, pos.shares);
}

memory.rangeWidth = (memory.rangeHigh || quote) - (memory.rangeLow || quote);`,
  },
  dip_ladder: {
    label: 'dip ladder',
    code: `let ticker = "AAPL";
let quote = price(ticker);
let fast = ema(ticker, 10);
let slow = ema(ticker, 40);
let pos = position(ticker);
let cooldown = memory.cooldown || 0;

if (ctx.minuteOfDay > 382) {
  if (pos.shares > 0) {
    sell(ticker, pos.shares);
  }
} else if (cooldown > 0) {
  memory.cooldown = cooldown - 1;
} else if (pos.shares == 0 && quote < slow * 0.982 && quote < fast * 0.992 && cash() >= quote * 3) {
  let order = buy(ticker, 3);
  if (order.ok) {
    memory.entry = quote;
    memory.stop = quote * 0.972;
    memory.cooldown = 4;
  }
} else if (pos.shares > 0 && (quote > slow * 0.997 || quote > (memory.entry || quote) * 1.018 || quote < (memory.stop || quote))) {
  let order = sell(ticker, pos.shares);
  if (order.ok) {
    memory.cooldown = 8;
  }
}

memory.distance = quote - slow;`,
  },
  rotation_pair: {
    label: 'rotation pair',
    code: `let first = "MSFT";
let second = "GOOGL";
let firstBias = price(first) / ema(first, 32);
let secondBias = price(second) / ema(second, 32);

if (firstBias < secondBias && cash() >= price(first)) {
  if (position(second).shares > 0) {
    sell(second, position(second).shares);
  }
  buy(first, 1);
} else if (secondBias < firstBias && cash() >= price(second)) {
  if (position(first).shares > 0) {
    sell(first, position(first).shares);
  }
  buy(second, 1);
}

memory.lastRotationTick = ctx.tick;`,
  },
  pair_reversion: {
    label: 'pair reversion',
    code: `let first = "MSFT";
let second = "GOOGL";
let firstRatio = price(first) / ema(first, 48);
let secondRatio = price(second) / ema(second, 48);
let spread = firstRatio - secondRatio;
let firstPos = position(first).shares;
let secondPos = position(second).shares;

if (ctx.minuteOfDay > 382) {
  if (firstPos > 0) {
    sell(first, firstPos);
  }
  if (secondPos > 0) {
    sell(second, secondPos);
  }
} else if (firstPos == 0 && secondPos == 0 && spread < -0.018 && cash() >= price(first) * 2) {
  buy(first, 2);
} else if (firstPos == 0 && secondPos == 0 && spread > 0.018 && cash() >= price(second) * 2) {
  buy(second, 2);
} else if (firstPos > 0 && spread > -0.003) {
  sell(first, firstPos);
} else if (secondPos > 0 && spread < 0.003) {
  sell(second, secondPos);
}

memory.spread = spread;`,
  },
  regime_allocator: {
    label: 'regime allocator',
    code: `let riskOn = "NVDA";
let ballast = "JPM";
let riskFast = ema(riskOn, 16);
let riskSlow = ema(riskOn, 64);
let ballastFast = ema(ballast, 16);
let ballastSlow = ema(ballast, 64);
let riskPos = position(riskOn).shares;
let ballastPos = position(ballast).shares;
let riskQuote = price(riskOn);
let ballastQuote = price(ballast);

if (ctx.minuteOfDay > 382) {
  if (riskPos > 0) {
    sell(riskOn, riskPos);
  }
  if (ballastPos > 0) {
    sell(ballast, ballastPos);
  }
} else if (riskFast > riskSlow && riskQuote > riskFast) {
  if (ballastPos > 0) {
    sell(ballast, ballastPos);
  }
  if (riskPos == 0 && cash() >= riskQuote * 2) {
    buy(riskOn, 2);
  }
} else if (ballastFast > ballastSlow) {
  if (riskPos > 0) {
    sell(riskOn, riskPos);
  }
  if (ballastPos == 0 && cash() >= ballastQuote * 3) {
    buy(ballast, 3);
  }
} else {
  if (riskPos > 0 && riskQuote < riskFast * 0.994) {
    sell(riskOn, riskPos);
  }
  if (ballastPos > 0 && ballastQuote < ballastFast * 0.996) {
    sell(ballast, ballastPos);
  }
}

memory.riskGap = riskFast - riskSlow;`,
  },
};

const DEFAULT_UI = {
  selectedStock: 'AAPL',
  selectedBotId: null,
  chartRange: '1D',
  mobilePanel: 'market',
  editorCollapsed: false,
};

const refs = {
  body: document.body,
  seedValue: document.getElementById('seed-value'),
  clockValue: document.getElementById('clock-value'),
  empireCashLabel: document.getElementById('empire-cash-label'),
  empireCashValue: document.getElementById('empire-cash-value'),
  empireValue: document.getElementById('empire-value'),
  runIndicator: document.getElementById('run-indicator'),
  runState: document.getElementById('run-state'),
  stockList: document.getElementById('stock-list'),
  selectedStockTitle: document.getElementById('selected-stock-title'),
  selectedStockPill: document.getElementById('selected-stock-pill'),
  stockPriceValue: document.getElementById('stock-price-value'),
  stockChangeValue: document.getElementById('stock-change-value'),
  stockOpenValue: document.getElementById('stock-open-value'),
  stockSectorValue: document.getElementById('stock-sector-value'),
  mainCashValue: document.getElementById('main-cash-value'),
  mainNetworthValue: document.getElementById('main-networth-value'),
  mainHoldingsValue: document.getElementById('main-holdings-value'),
  mainPnlValue: document.getElementById('main-pnl-value'),
  mainHoldingsList: document.getElementById('main-holdings-list'),
  tradeForm: document.getElementById('trade-form'),
  tradeAction: document.getElementById('trade-action'),
  tradeShares: document.getElementById('trade-shares'),
  tradeNote: document.getElementById('trade-note'),
  speedButtons: Array.from(document.querySelectorAll('[data-speed]')),
  rangeButtons: Array.from(document.querySelectorAll('[data-range]')),
  resumeBtn: document.getElementById('resume-btn'),
  pauseBtn: document.getElementById('pause-btn'),
  resetBtn: document.getElementById('reset-btn'),
  reseedBtn: document.getElementById('reseed-btn'),
  commandStatus: document.getElementById('command-status'),
  chartCanvas: document.getElementById('chart-canvas'),
  chartTitle: document.getElementById('chart-title'),
  chartLow: document.getElementById('chart-low'),
  chartHigh: document.getElementById('chart-high'),
  marketCaption: document.getElementById('market-caption'),
  leaderboardList: document.getElementById('leaderboard-list'),
  eventLog: document.getElementById('event-log'),
  createBotForm: document.getElementById('create-bot-form'),
  botCreateName: document.getElementById('bot-create-name'),
  botCreateFunding: document.getElementById('bot-create-funding'),
  createTemplate: document.getElementById('create-template'),
  botRoster: document.getElementById('bot-roster'),
  transferForm: document.getElementById('transfer-form'),
  transferFrom: document.getElementById('transfer-from'),
  transferTo: document.getElementById('transfer-to'),
  transferAmount: document.getElementById('transfer-amount'),
  transferSubmit: document.querySelector('#transfer-form button'),
  transferSummary: document.getElementById('transfer-summary'),
  botScriptPanel: document.getElementById('bot-script-panel'),
  toggleEditorPanelBtn: document.getElementById('toggle-editor-panel-btn'),
  editorBotName: document.getElementById('editor-bot-name'),
  botCashValue: document.getElementById('bot-cash-value'),
  botNetworthValue: document.getElementById('bot-networth-value'),
  botHoldingsValue: document.getElementById('bot-holdings-value'),
  botPnlValue: document.getElementById('bot-pnl-value'),
  botNameInput: document.getElementById('bot-name-input'),
  editorTemplate: document.getElementById('editor-template'),
  loadTemplateBtn: document.getElementById('load-template-btn'),
  botEditor: document.getElementById('bot-editor'),
  renameBtn: document.getElementById('rename-btn'),
  saveScriptBtn: document.getElementById('save-script-btn'),
  toggleBotBtn: document.getElementById('toggle-bot-btn'),
  botRuntimeStatus: document.getElementById('bot-runtime-status'),
  mobileTabs: Array.from(document.querySelectorAll('.mobile-tab')),
};

let worker = null;
let latestView = null;
let persistedState = null;
let uiPrefs = loadBundle().ui;
let editorDirty = false;
let commandMessage = 'worker idle';
let pendingBotSelection = null;
let cashChipMode = 'total';
let cashChipTimer = null;

init();

function init() {
  populateTemplateSelects();
  bindEvents();
  renderBootState();
  startCashChipRotation();
  const bundle = loadBundle();
  uiPrefs = { ...DEFAULT_UI, ...bundle.ui };
  applyMobilePanel(uiPrefs.mobilePanel, false);
  renderEditorPanelState();
  startWorker(bundle.sim);
}

function startWorker(savedState) {
  worker = new Worker('paperbots-worker.js');
  worker.addEventListener('message', handleWorkerMessage);
  worker.postMessage({ type: 'init', savedState });
}

function handleWorkerMessage(event) {
  const message = event.data || {};
  if (message.type === 'fatal') {
    commandMessage = String(message.message || 'worker error');
    refs.commandStatus.textContent = commandMessage;
    refs.botRuntimeStatus.textContent = commandMessage;
    return;
  }

  if (message.type !== 'snapshot') {
    return;
  }

  persistedState = message.persisted;
  latestView = message.view;
  reconcileUiState();
  commandMessage = latestView.eventLog[0]
    ? `${latestView.eventLog[0].label}: ${latestView.eventLog[0].detail}`
    : latestView.running
      ? 'loop live'
      : 'loop paused';
  saveBundle();
  renderAll();
}

function reconcileUiState() {
  if (!latestView) {
    return;
  }

  const stockTickers = latestView.stocks.map((stock) => stock.ticker);
  if (!stockTickers.includes(uiPrefs.selectedStock)) {
    uiPrefs.selectedStock = stockTickers[0] || 'AAPL';
  }

  const botIds = latestView.bots.map((bot) => bot.id);
  if (pendingBotSelection) {
    const match = latestView.bots.find((bot) => bot.name === pendingBotSelection);
    if (match) {
      uiPrefs.selectedBotId = match.id;
      pendingBotSelection = null;
    }
  }
  if (uiPrefs.selectedBotId && !botIds.includes(uiPrefs.selectedBotId)) {
    uiPrefs.selectedBotId = botIds[0] || null;
    editorDirty = false;
  }
  if (!uiPrefs.selectedBotId && botIds.length) {
    uiPrefs.selectedBotId = botIds[0];
  }

}

function bindEvents() {
  refs.mobileTabs.forEach((button) => {
    button.addEventListener('click', () => applyMobilePanel(button.dataset.panel, true));
  });

  refs.speedButtons.forEach((button) => {
    button.addEventListener('click', () => postToWorker({ type: 'setSpeed', speed: button.dataset.speed }));
  });

  refs.rangeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      uiPrefs.chartRange = button.dataset.range;
      saveBundle();
      updateRangeButtons();
      renderChart();
    });
  });

  refs.resumeBtn.addEventListener('click', () => postToWorker({ type: 'resume' }));
  refs.pauseBtn.addEventListener('click', () => postToWorker({ type: 'pause' }));
  refs.resetBtn.addEventListener('click', () => {
    if (latestView) {
      postToWorker({ type: 'reset', seed: latestView.seed });
    }
  });
  refs.reseedBtn.addEventListener('click', () => postToWorker({ type: 'reset', seed: Date.now() }));

  refs.tradeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!latestView) {
      return;
    }
    postToWorker({
      type: 'manualOrder',
      accountId: latestView.mainAccountId || 'main',
      side: refs.tradeAction.value,
      ticker: uiPrefs.selectedStock,
      shares: Number(refs.tradeShares.value),
    });
  });
  refs.tradeAction.addEventListener('change', updateTradeNote);
  refs.tradeShares.addEventListener('input', updateTradeNote);

  refs.createBotForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const template = TEMPLATE_LIBRARY[refs.createTemplate.value] || TEMPLATE_LIBRARY.mean_drift;
    const name = refs.botCreateName.value.trim();
    pendingBotSelection = name || null;
    postToWorker({
      type: 'createBot',
      name,
      funding: Number(refs.botCreateFunding.value),
      script: template.code,
    });
    refs.botCreateName.value = '';
  });

  refs.transferForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clampTransferAmount();
    const amount = Number(refs.transferAmount.value);
    if (!(amount > 0)) {
      updateTransferSummary();
      return;
    }
    postToWorker({
      type: 'transfer',
      fromId: refs.transferFrom.value,
      toId: refs.transferTo.value,
      amount,
    });
  });
  refs.transferFrom.addEventListener('change', () => {
    clampTransferAmount(true);
    updateTransferSummary();
  });
  refs.transferTo.addEventListener('change', updateTransferSummary);
  refs.transferAmount.addEventListener('input', () => {
    clampTransferAmount();
    updateTransferSummary();
  });

  refs.botEditor.addEventListener('input', () => {
    editorDirty = true;
    refs.botRuntimeStatus.textContent = 'Unsaved script changes waiting in the editor.';
  });

  refs.loadTemplateBtn.addEventListener('click', () => {
    const template = TEMPLATE_LIBRARY[refs.editorTemplate.value];
    if (!template) {
      return;
    }
    refs.botEditor.value = template.code;
    editorDirty = true;
    refs.botRuntimeStatus.textContent = `Loaded template: ${template.label}. Save to apply.`;
  });

  refs.renameBtn.addEventListener('click', renameSelectedBot);
  refs.saveScriptBtn.addEventListener('click', saveSelectedScript);
  refs.toggleBotBtn.addEventListener('click', toggleSelectedBot);
  refs.toggleEditorPanelBtn.addEventListener('click', () => {
    uiPrefs.editorCollapsed = !uiPrefs.editorCollapsed;
    saveBundle();
    renderEditorPanelState();
  });
  window.addEventListener('resize', () => renderChart());
}

function renderBootState() {
  refs.commandStatus.textContent = 'worker booting';
  refs.stockList.innerHTML = '<div class="empty-state">Initializing market rack...</div>';
  refs.mainHoldingsList.innerHTML = '<div class="empty-state">No holdings yet.</div>';
  refs.leaderboardList.innerHTML = '<div class="empty-state">Leaderboard warming up...</div>';
  refs.eventLog.innerHTML = '<div class="empty-state">Waiting for the first market packet...</div>';
  refs.botRoster.innerHTML = '<div class="empty-state">No bots provisioned.</div>';
  refs.transferSummary.textContent = 'Create a bot to unlock cash routing between accounts.';
  refs.botScriptPanel.hidden = true;
  renderSelectedBotSummary(null);
}

function postToWorker(message) {
  if (!worker) {
    return;
  }
  worker.postMessage(message);
}

function loadBundle() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { sim: null, ui: { ...DEFAULT_UI } };
    }
    const parsed = JSON.parse(raw);
    return {
      sim: parsed.sim || null,
      ui: { ...DEFAULT_UI, ...(parsed.ui || {}) },
    };
  } catch (error) {
    return { sim: null, ui: { ...DEFAULT_UI } };
  }
}

function saveBundle() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      sim: persistedState,
      ui: uiPrefs,
    })
  );
}

function populateTemplateSelects() {
  const options = Object.entries(TEMPLATE_LIBRARY)
    .map(([key, entry]) => `<option value="${key}">${entry.label}</option>`)
    .join('');
  refs.createTemplate.innerHTML = options;
  refs.editorTemplate.innerHTML = options;
}

function renderAll() {
  if (!latestView) {
    return;
  }
  refs.botScriptPanel.hidden = latestView.bots.length === 0;
  renderHeader();
  renderWatchlist();
  renderSelectedStock();
  renderMainAccount();
  renderLeaderboard();
  renderEventLog();
  renderBotRoster();
  renderTransferOptions();
  syncEditorToSelection(false);
  renderEditorPanelState();
  updateSpeedButtons();
  updateRangeButtons();
  renderChart();
}

function renderHeader() {
  refs.seedValue.textContent = String(latestView.seed);
  refs.clockValue.textContent = `day ${latestView.day} / ${latestView.clockLabel}`;
  renderCashChip();
  refs.empireValue.textContent = formatMoney(latestView.empireNetWorth);
  refs.runState.textContent = latestView.running ? `live @ ${latestView.speed}` : 'paused';
  refs.runIndicator.classList.toggle('live', latestView.running);
  refs.commandStatus.textContent = commandMessage;
  refs.pauseBtn.disabled = !latestView.running;
  refs.resumeBtn.disabled = latestView.running;
}

function renderWatchlist() {
  const rows = latestView.stocks
    .slice()
    .sort((left, right) => right.changePct - left.changePct)
    .map((stock) => {
      const tone = stock.changePct > 0 ? 'good' : stock.changePct < 0 ? 'bad' : 'neutral';
      return `
        <button class="watch-row ${stock.ticker === uiPrefs.selectedStock ? 'active' : ''}" data-stock="${stock.ticker}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div>
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${stock.ticker}</div>
              <div style="font-size:11px;color:var(--muted);">${escapeHtml(stock.name)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${formatMoney(stock.price)}</div>
              <div class="pill ${tone}" style="margin-left:auto;">${formatPct(stock.changePct)}</div>
            </div>
          </div>
        </button>
      `;
    })
    .join('');
  refs.stockList.innerHTML = rows;
  refs.stockList.querySelectorAll('[data-stock]').forEach((node) => {
    node.addEventListener('click', () => {
      uiPrefs.selectedStock = node.dataset.stock;
      saveBundle();
      renderWatchlist();
      renderSelectedStock();
      renderChart();
    });
  });
}

function renderSelectedStock() {
  const stock = getSelectedStock();
  if (!stock) {
    return;
  }

  const tone = stock.changePct > 0 ? 'good' : stock.changePct < 0 ? 'bad' : 'neutral';

  refs.selectedStockTitle.textContent = `${stock.ticker} / ${stock.name}`;
  refs.selectedStockPill.className = `pill ${tone}`;
  refs.selectedStockPill.textContent = tone === 'good' ? 'lift' : tone === 'bad' ? 'drag' : 'flat';
  refs.stockPriceValue.textContent = formatMoney(stock.price);
  refs.stockChangeValue.textContent = formatPct(stock.changePct);
  refs.stockOpenValue.textContent = formatMoney(stock.open);
  refs.stockSectorValue.textContent = stock.sector;
  updateTradeNote();
}

function renderMainAccount() {
  const account = latestView.accounts.find((entry) => entry.id === 'main');
  if (!account) {
    return;
  }
  refs.mainCashValue.textContent = formatMoney(account.cash);
  refs.mainNetworthValue.textContent = formatMoney(account.netWorth);
  refs.mainHoldingsValue.textContent = formatMoney(account.holdingsValue);
  refs.mainPnlValue.textContent = formatMoney(account.realizedPnL + account.unrealizedPnL);

  if (!account.holdings.length) {
    refs.mainHoldingsList.innerHTML = '<div class="empty-state">No live holdings in the main account.</div>';
    return;
  }

  refs.mainHoldingsList.innerHTML = account.holdings
    .map(
      (holding) => `
        <div class="holding-row">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${holding.ticker}</div>
              <div style="font-size:11px;color:var(--muted);">${holding.shares} shares @ ${formatMoney(holding.avgCost)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${formatMoney(holding.marketValue)}</div>
              <div class="${holding.unrealizedPnL >= 0 ? 'pill good' : 'pill bad'}" style="margin-left:auto;">${formatMoney(holding.unrealizedPnL)}</div>
            </div>
          </div>
        </div>
      `
    )
    .join('');
}

function renderLeaderboard() {
  refs.leaderboardList.innerHTML = latestView.leaderboard
    .map((entry, index) => {
      const tone = entry.totalPnL > 0 ? 'good' : entry.totalPnL < 0 ? 'bad' : 'neutral';
      const status = entry.type === 'manual'
        ? 'manual'
        : entry.compileError
          ? 'compile fault'
          : entry.runtimeError
            ? 'runtime halt'
            : entry.enabled
              ? 'bot live'
              : 'bot paused';
      return `
        <div class="leader-row">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-family:'W95Bold',monospace;font-size:14px;">#${index + 1} ${escapeHtml(entry.name)}</div>
              <div style="font-size:11px;color:var(--muted);">${status} / ${entry.tradeCount} trades</div>
            </div>
            <div style="text-align:right;">
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${formatMoney(entry.netWorth)}</div>
              <div class="pill ${tone}" style="margin-left:auto;">${formatMoney(entry.totalPnL)}</div>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

function renderEventLog() {
  if (!latestView.eventLog.length) {
    refs.eventLog.innerHTML = '<div class="empty-state">No market packets yet.</div>';
    return;
  }

  refs.eventLog.innerHTML = latestView.eventLog
    .map((entry) => `
      <div class="event-row">
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
          <div style="font-family:'W95Bold',monospace;font-size:13px;">${escapeHtml(entry.label)}</div>
          <div class="pill ${entry.tone}">d${entry.day} / ${entry.clockLabel}</div>
        </div>
        <div style="margin-top:8px;font-size:11px;color:var(--muted);line-height:1.6;">${escapeHtml(entry.detail)}</div>
      </div>
    `)
    .join('');
}

function renderBotRoster() {
  if (!latestView.bots.length) {
    refs.botRoster.innerHTML = '<div class="empty-state">No bots provisioned. Spawn one from the funding rail above.</div>';
    return;
  }

  refs.botRoster.innerHTML = latestView.bots
    .map((bot) => {
      const tone = bot.compileError || bot.runtimeError ? 'bad' : bot.enabled ? 'good' : 'neutral';
      const status = bot.compileError
        ? 'compile fault'
        : bot.runtimeError
          ? 'runtime halt'
          : bot.enabled
            ? 'live'
            : 'paused';
      return `
        <button class="roster-item ${bot.id === uiPrefs.selectedBotId ? 'active' : ''}" data-bot="${bot.id}">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;">
            <div>
              <div style="font-family:'W95Bold',monospace;font-size:14px;">${escapeHtml(bot.name)}</div>
              <div style="font-size:11px;color:var(--muted);">${status} / ${bot.tradeCount} trades</div>
            </div>
            <div class="pill ${tone}">${status}</div>
          </div>
          <div class="roster-stats">
            <div class="mini-kpi"><span>cash</span><strong>${formatMoney(bot.cash)}</strong></div>
            <div class="mini-kpi"><span>net</span><strong>${formatMoney(bot.netWorth)}</strong></div>
          </div>
        </button>
      `;
    })
    .join('');

  refs.botRoster.querySelectorAll('[data-bot]').forEach((node) => {
    node.addEventListener('click', () => {
      uiPrefs.selectedBotId = node.dataset.bot;
      editorDirty = false;
      saveBundle();
      renderBotRoster();
      syncEditorToSelection(true);
    });
  });
}

function renderTransferOptions() {
  const options = latestView.accounts
    .map((account) => `<option value="${account.id}">${escapeHtml(formatTransferAccountLabel(account))}</option>`)
    .join('');
  const currentFrom = refs.transferFrom.value;
  const currentTo = refs.transferTo.value;
  const disabled = latestView.accounts.length < 2;
  refs.transferFrom.innerHTML = options;
  refs.transferTo.innerHTML = options;
  refs.transferFrom.value = latestView.accounts.some((account) => account.id === currentFrom) ? currentFrom : 'main';
  refs.transferTo.value = latestView.accounts.some((account) => account.id === currentTo) ? currentTo : (latestView.bots[0]?.id || 'main');
  refs.transferFrom.disabled = disabled;
  refs.transferTo.disabled = disabled;
  refs.transferAmount.disabled = disabled;
  refs.transferSubmit.disabled = disabled;
  clampTransferAmount(true);
  updateTransferSummary();
}

function syncEditorToSelection(force) {
  const bot = getSelectedBot();
  const hasBot = Boolean(bot);
  renderSelectedBotSummary(bot);
  refs.botEditor.disabled = !hasBot;
  refs.botNameInput.disabled = !hasBot;
  refs.editorTemplate.disabled = !hasBot;
  refs.loadTemplateBtn.disabled = !hasBot;
  refs.renameBtn.disabled = !hasBot;
  refs.saveScriptBtn.disabled = !hasBot;
  refs.toggleBotBtn.disabled = !hasBot;

  if (!bot) {
    refs.editorBotName.textContent = 'no bot selected';
    if (force || !editorDirty) {
      refs.botEditor.value = '';
    }
    refs.botNameInput.value = '';
    refs.botRuntimeStatus.textContent = 'Select a bot to edit, rename, or toggle its strategy loop.';
    refs.toggleBotBtn.textContent = 'enable';
    refs.toggleBotBtn.classList.remove('toggle-live');
    return;
  }

  refs.editorBotName.textContent = bot.name;
  if (force || !editorDirty) {
    refs.botEditor.value = bot.scriptSource || '';
  }
  if (force || document.activeElement !== refs.botNameInput) {
    refs.botNameInput.value = bot.name;
  }
  refs.toggleBotBtn.textContent = bot.enabled ? 'pause bot' : 'enable bot';
  refs.toggleBotBtn.classList.toggle('toggle-live', bot.enabled);

  if (bot.compileError) {
    refs.botRuntimeStatus.textContent = `Compile error: ${bot.compileError}`;
  } else if (bot.runtimeError) {
    refs.botRuntimeStatus.textContent = `Runtime error: ${bot.runtimeError}`;
  } else if (editorDirty) {
    refs.botRuntimeStatus.textContent = 'Unsaved script changes waiting in the editor.';
  } else {
    refs.botRuntimeStatus.textContent = `${bot.enabled ? 'Bot live.' : 'Bot paused.'}${describeLastTrade(bot.lastTrade)}`;
  }
}

function renameSelectedBot() {
  const bot = getSelectedBot();
  if (!bot) {
    return;
  }
  const name = refs.botNameInput.value.trim();
  if (!name || name === bot.name) {
    return;
  }
  postToWorker({ type: 'renameBot', botId: bot.id, name });
}

function saveSelectedScript() {
  const bot = getSelectedBot();
  if (!bot) {
    return;
  }
  renameSelectedBot();
  editorDirty = false;
  postToWorker({ type: 'saveBotScript', botId: bot.id, script: refs.botEditor.value });
}

function toggleSelectedBot() {
  const bot = getSelectedBot();
  if (!bot) {
    return;
  }
  postToWorker({ type: 'toggleBot', botId: bot.id, enabled: !bot.enabled });
}

function updateSpeedButtons() {
  refs.speedButtons.forEach((button) => {
    button.classList.toggle('active', latestView && latestView.speed === button.dataset.speed);
  });
}

function updateRangeButtons() {
  refs.rangeButtons.forEach((button) => {
    button.classList.toggle('active', uiPrefs.chartRange === button.dataset.range);
  });
}

function applyMobilePanel(panel, persist) {
  uiPrefs.mobilePanel = panel;
  refs.body.dataset.panel = panel;
  refs.mobileTabs.forEach((button) => {
    button.classList.toggle('active', button.dataset.panel === panel);
  });
  if (panel === 'hub') {
    requestAnimationFrame(() => requestAnimationFrame(() => renderChart()));
  }
  if (persist) {
    saveBundle();
  }
}

function renderEditorPanelState() {
  refs.botScriptPanel.classList.toggle('collapsed', Boolean(uiPrefs.editorCollapsed));
  refs.toggleEditorPanelBtn.textContent = uiPrefs.editorCollapsed ? 'expand script' : 'collapse script';
}

function startCashChipRotation() {
  if (cashChipTimer) {
    clearInterval(cashChipTimer);
  }
  cashChipTimer = setInterval(() => {
    cashChipMode = cashChipMode === 'total' ? 'player' : 'total';
    if (latestView) {
      renderCashChip();
    }
  }, 3600);
}

function renderCashChip() {
  if (!latestView) {
    return;
  }
  const totalCash = typeof latestView.empireCash === 'number'
    ? latestView.empireCash
    : latestView.accounts.reduce((sum, account) => sum + account.cash, 0);
  const mainAccount = latestView.accounts.find((account) => account.id === (latestView.mainAccountId || 'main'));
  const playerCash = mainAccount ? mainAccount.cash : totalCash;

  refs.empireCashLabel.textContent = cashChipMode === 'total' ? 'total cash' : 'player cash';
  refs.empireCashValue.textContent = formatMoney(cashChipMode === 'total' ? totalCash : playerCash);
}

function renderChart() {
  const stock = getSelectedStock();
  if (!stock) {
    return;
  }

  const config = RANGE_CONFIG[uiPrefs.chartRange] || RANGE_CONFIG['1D'];
  const series = stock[config.key].slice(-config.count);
  if (config.key === 'dailyHistory' && stock.price !== series[series.length - 1]) {
    series.push(stock.price);
  }
  const canvas = refs.chartCanvas;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height || series.length < 2) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);

  const min = Math.min(...series);
  const max = Math.max(...series);
  const pad = (max - min) * 0.18 || max * 0.06 || 1;
  const low = min - pad;
  const high = max + pad;
  const innerW = rect.width - 28;
  const innerH = rect.height - 24;
  const xStep = innerW / Math.max(1, series.length - 1);
  const positive = series[series.length - 1] >= series[0];
  const lineColor = positive ? '#87ffe7' : '#ff8d73';

  ctx.strokeStyle = 'rgba(135, 255, 231, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = 12 + (innerH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(rect.width - 14, y);
    ctx.stroke();
  }

  ctx.beginPath();
  series.forEach((value, index) => {
    const x = 14 + index * xStep;
    const y = 12 + innerH - ((value - low) / (high - low)) * innerH;
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  const gradient = ctx.createLinearGradient(0, 12, 0, rect.height);
  gradient.addColorStop(0, positive ? 'rgba(135,255,231,0.34)' : 'rgba(255,141,115,0.34)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  const lastX = 14 + (series.length - 1) * xStep;
  const lastY = 12 + innerH - ((series[series.length - 1] - low) / (high - low)) * innerH;

  ctx.lineTo(14 + (series.length - 1) * xStep, rect.height - 12);
  ctx.lineTo(14, rect.height - 12);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = positive ? 'rgba(135, 255, 231, 0.28)' : 'rgba(255, 141, 115, 0.28)';
  ctx.lineWidth = 1;
  ctx.moveTo(lastX, 12);
  ctx.lineTo(lastX, rect.height - 12);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = lineColor;
  ctx.shadowBlur = 16;
  ctx.shadowColor = lineColor;
  ctx.arc(lastX, lastY, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  refs.chartTitle.textContent = `${stock.ticker} / ${stock.name}`;
  refs.chartLow.textContent = `low: ${formatMoney(min)}`;
  refs.chartHigh.textContent = `high: ${formatMoney(max)}`;

  const winner = latestView.stocks.slice().sort((left, right) => right.changePct - left.changePct)[0];
  const avgChange = latestView.stocks.reduce((sum, entry) => sum + entry.changePct, 0) / latestView.stocks.length;
  refs.marketCaption.textContent = `avg tape ${formatPct(avgChange)} / leader ${winner.ticker} ${formatPct(winner.changePct)}`;
}

function getSelectedStock() {
  return latestView?.stocks.find((stock) => stock.ticker === uiPrefs.selectedStock) || null;
}

function getSelectedBot() {
  return latestView?.bots.find((bot) => bot.id === uiPrefs.selectedBotId) || null;
}

function getAccountById(accountId) {
  return latestView?.accounts.find((account) => account.id === accountId) || null;
}

function renderSelectedBotSummary(bot) {
  refs.botCashValue.textContent = bot ? formatMoney(bot.cash) : '$0.00';
  refs.botNetworthValue.textContent = bot ? formatMoney(bot.netWorth) : '$0.00';
  refs.botHoldingsValue.textContent = bot ? formatMoney(bot.holdingsValue) : '$0.00';
  refs.botPnlValue.textContent = bot ? formatMoney(bot.realizedPnL + bot.unrealizedPnL) : '$0.00';
}

function updateTradeNote() {
  const stock = getSelectedStock();
  const shares = Math.max(1, Math.floor(Number(refs.tradeShares.value) || 1));
  const side = refs.tradeAction.value || 'buy';
  if (!stock) {
    refs.tradeNote.textContent = 'Orders fill on the current tick and pause the loop.';
    return;
  }
  refs.tradeNote.textContent = `${side} ${shares} ${stock.ticker} around ${formatMoney(stock.price * shares)}. Orders fill on the current tick and pause the loop.`;
}

function updateTransferSummary() {
  if (!latestView || refs.transferFrom.disabled || refs.transferTo.disabled) {
    refs.transferSummary.textContent = 'Create a bot to unlock cash routing between accounts.';
    return;
  }
  const from = getAccountById(refs.transferFrom.value);
  const to = getAccountById(refs.transferTo.value);
  const amount = Math.max(0, Number(refs.transferAmount.value) || 0);
  if (!from || !to) {
    refs.transferSummary.textContent = 'Select a source and destination account.';
    return;
  }
  refs.transferSummary.textContent = `${formatTransferAccountName(from)} cash ${formatMoney(from.cash)} -> ${formatTransferAccountName(to)} cash ${formatMoney(to.cash)}. Pending move ${formatMoney(amount)} / max ${formatMoney(from.cash)}.`;
}

function describeLastTrade(lastTrade) {
  if (!lastTrade) {
    return ' No trades logged yet.';
  }
  return ` Last trade ${lastTrade.side} ${lastTrade.shares} ${lastTrade.ticker} @ ${formatMoney(lastTrade.price)}.`;
}

function formatTransferAccountName(account) {
  if (!account) {
    return 'account';
  }
  return account.id === 'main' ? 'personal account' : account.name;
}

function formatTransferAccountLabel(account) {
  return `${formatTransferAccountName(account)} (${formatMoney(account.cash)})`;
}

function clampTransferAmount(resetWhenEmpty) {
  const from = getAccountById(refs.transferFrom.value);
  const max = from ? Math.max(0, roundToCents(from.cash)) : 0;
  refs.transferAmount.max = max > 0 ? String(max) : '0';

  const rawValue = refs.transferAmount.value;
  if (!rawValue) {
    if (resetWhenEmpty && max > 0) {
      refs.transferAmount.value = formatTransferAmount(max);
    }
    return;
  }

  let nextValue = Number(rawValue);
  if (!Number.isFinite(nextValue)) {
    refs.transferAmount.value = resetWhenEmpty && max > 0 ? formatTransferAmount(max) : '';
    return;
  }

  nextValue = roundToCents(Math.max(0, nextValue));
  if (max <= 0) {
    refs.transferAmount.value = '';
    return;
  }
  if (nextValue > max) {
    refs.transferAmount.value = formatTransferAmount(max);
    return;
  }
  if (nextValue <= 0) {
    refs.transferAmount.value = '';
  }
}

function formatTransferAmount(value) {
  return roundToCents(value).toFixed(2);
}

function roundToCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMoney(value) {
  const sign = value < 0 ? '-' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

function formatPct(value) {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
