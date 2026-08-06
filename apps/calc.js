function openCalculator() {
  if (!mkWin({ id:'calc', title:'Calculator', icon:'🔢', w:240, h:300, x:200, y:120, menubar:true, statusbar:false })) return;
  const body = document.getElementById('wb-calc');
  const mb   = document.getElementById('mb-calc');
  body.style.cssText = 'padding:0;overflow:hidden;';

  let calcMode = 'dec'; // dec | hex | bin
  let calcExpr = '';
  let calcDisplay = '0';
  let calcOp = null;
  let calcPrev = null;
  let calcNewNum = true;

  const wrap = document.createElement('div');
  wrap.className = 'calc-body';
  body.appendChild(wrap);

  const display = document.createElement('div');
  display.className = 'calc-display';
  display.textContent = '0';
  wrap.appendChild(display);

  const subDisplay = document.createElement('div');
  subDisplay.style.cssText = 'font-size:10px;color:#555;text-align:right;min-height:14px;';
  wrap.appendChild(subDisplay);

  const modeRow = document.createElement('div');
  modeRow.className = 'calc-mode-row';
  ['dec','hex','bin'].forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'calc-mode-btn' + (m === calcMode ? ' active' : '');
    btn.textContent = m.toUpperCase();
    btn.setAttribute('data-mode', m);
    btn.addEventListener('click', () => {
      calcMode = m;
      modeRow.querySelectorAll('.calc-mode-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-mode') === m));
      updateDisplay();
      renderGrid();
    });
    modeRow.appendChild(btn);
  });
  wrap.appendChild(modeRow);

  const grid = document.createElement('div');
  grid.className = 'calc-grid';
  wrap.appendChild(grid);

  function getDisplayValue() {
    const n = parseFloat(calcDisplay);
    if (isNaN(n)) return calcDisplay;
    if (calcMode === 'hex') return '0x' + Math.trunc(n).toString(16).toUpperCase();
    if (calcMode === 'bin') return '0b' + Math.trunc(n).toString(2);
    return calcDisplay;
  }

  function updateDisplay() {
    display.textContent = getDisplayValue();
    if (calcOp && calcPrev !== null) {
      subDisplay.textContent = calcPrev + ' ' + calcOp;
    } else {
      subDisplay.textContent = '';
    }
  }

  function pressDigit(d) {
    if (calcNewNum) { calcDisplay = String(d); calcNewNum = false; }
    else { if (calcDisplay === '0' && d !== '.') calcDisplay = String(d); else calcDisplay += String(d); }
    updateDisplay();
  }

  function pressOp(op) {
    const cur = parseFloat(calcDisplay);
    if (calcOp && !calcNewNum && calcPrev !== null) {
      calcPrev = doCalc(calcPrev, cur, calcOp);
      calcDisplay = String(calcPrev);
    } else {
      calcPrev = cur;
    }
    calcOp = op;
    calcNewNum = true;
    updateDisplay();
  }

  function doCalc(a, b, op) {
    switch(op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? NaN : a / b;
      case '%': return a % b;
    }
    return b;
  }

  function pressEquals() {
    const cur = parseFloat(calcDisplay);
    if (calcOp && calcPrev !== null) {
      const result = doCalc(calcPrev, cur, calcOp);
      calcDisplay = isNaN(result) ? 'Error' : String(result);
      calcOp = null; calcPrev = null; calcNewNum = true;
      updateDisplay();
    }
  }

  function pressClear() {
    calcDisplay = '0'; calcOp = null; calcPrev = null; calcNewNum = true;
    updateDisplay();
  }

  function pressCE() {
    calcDisplay = '0'; calcNewNum = true; updateDisplay();
  }

  function pressBS() {
    if (calcNewNum || calcDisplay.length <= 1 || calcDisplay === 'Error') {
      calcDisplay = '0'; calcNewNum = true;
    } else {
      calcDisplay = calcDisplay.slice(0, -1) || '0';
    }
    updateDisplay();
  }

  function pressPlusMinus() {
    const n = parseFloat(calcDisplay);
    if (!isNaN(n) && n !== 0) { calcDisplay = String(-n); updateDisplay(); }
  }

  function renderGrid() {
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'repeat(4, 1fr)';
    grid.style.gridTemplateRows = 'repeat(5, 1fr)';

    const buttons = [
      ['CE','C','BS','/'],
      ['7','8','9','*'],
      ['4','5','6','-'],
      ['1','2','3','+'],
      ['+/-','0','.','='],
    ];

    if (calcMode === 'hex') {
      // Replace digits row 1 with hex letters
      buttons.unshift(['A','B','C','D']);
      buttons[1] = ['E','F','CE','C'];
      grid.style.gridTemplateRows = 'repeat(6, 1fr)';
    }

    buttons.forEach(row => {
      row.forEach(label => {
        const btn = document.createElement('button');
        const isOp  = ['+','-','*','/','%'].includes(label);
        const isEq  = label === '=';
        const isCl  = label === 'C' || label === 'CE';
        btn.className = 'calc-btn' + (isOp ? ' op' : '') + (isEq ? ' equals' : '') + (isCl ? ' clear' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => {
          if (/^[0-9A-F]$/.test(label)) pressDigit(label);
          else if (label === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
          else if (isOp) pressOp(label);
          else if (isEq) pressEquals();
          else if (label === 'C') pressClear();
          else if (label === 'CE') pressCE();
          else if (label === 'BS') pressBS();
          else if (label === '+/-') pressPlusMinus();
        });
        grid.appendChild(btn);
      });
    });
    updateDisplay();
  }

  // Keyboard support
  const calcKeyHandler = e => {
    if (!wins['calc']) { document.removeEventListener('keydown', calcKeyHandler); return; }
    const focused = document.activeElement;
    if (focused && (focused.tagName === 'INPUT' || focused.tagName === 'TEXTAREA') && focused.closest('#win-calc') === null) return;
    const map = {
      '0':'0','1':'1','2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
      '+':'+','-':'-','*':'*','/':'/',
      'Enter':'=','=':'=',
      'Backspace':'BS','Delete':'C','Escape':'C','.':'.',
    };
    if (map[e.key]) {
      e.preventDefault();
      const lbl = map[e.key];
      if (/^[0-9]$/.test(lbl)) pressDigit(lbl);
      else if (['+','-','*','/'].includes(lbl)) pressOp(lbl);
      else if (lbl === '=') pressEquals();
      else if (lbl === 'C') pressClear();
      else if (lbl === 'BS') pressBS();
      else if (lbl === '.') { if (!calcDisplay.includes('.')) pressDigit('.'); }
    }
  };
  document.addEventListener('keydown', calcKeyHandler);

  // Menu bar
  mb.innerHTML = '';
  const editSpan = document.createElement('span');
  editSpan.className = 'menu-item'; editSpan.textContent = 'Edit';
  editSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(editSpan, [
      { label: 'Copy', action: () => navigator.clipboard?.writeText(display.textContent) },
      { label: 'Paste', action: () => navigator.clipboard?.readText().then(t => {
        const n = parseFloat(t);
        if (!isNaN(n)) { calcDisplay = String(n); calcNewNum = false; updateDisplay(); }
      })},
    ]);
  });
  mb.appendChild(editSpan);
  const viewSpan = document.createElement('span');
  viewSpan.className = 'menu-item'; viewSpan.textContent = 'View';
  viewSpan.addEventListener('click', e => {
    e.stopPropagation();
    showDropdown(viewSpan, [
      { label: (calcMode==='dec'?'* ':'  ')+'Decimal',  action: () => { calcMode='dec'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='dec')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='hex'?'* ':'  ')+'Hexadecimal', action: () => { calcMode='hex'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='hex')); updateDisplay(); renderGrid(); }},
      { label: (calcMode==='bin'?'* ':'  ')+'Binary',   action: () => { calcMode='bin'; modeRow.querySelectorAll('.calc-mode-btn').forEach(b=>b.classList.toggle('active',b.getAttribute('data-mode')==='bin')); updateDisplay(); renderGrid(); }},
    ]);
  });
  mb.appendChild(viewSpan);

  renderGrid();
}

// ─────────────────────────────────────────────────────────────────
// RUN DIALOG
// ─────────────────────────────────────────────────────────────────
