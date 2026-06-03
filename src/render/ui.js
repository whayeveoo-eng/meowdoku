// DOM 控制层：棋盘尺寸 N 选择、HUD（用时 / 小猫数 / 血量）、工具按钮、胜利/失败弹层、吉祥物。
// 通过回调上抛操作；refresh(state, stats) 同步显示。

import { SIZES, FEATURE_FLAGS } from '../data/constants.js';

export function createUI(root, handlers) {
  const el = (id) => root.querySelector(id);

  // 动态生成尺寸按钮
  const sizeWrap = el('#md-sizes');
  const sizeButtons = [];
  for (const n of SIZES) {
    const b = document.createElement('button');
    b.dataset.size = String(n);
    b.textContent = `${n}×${n}`;
    b.addEventListener('click', () => handlers.onNewGame(n));
    sizeWrap.appendChild(b);
    sizeButtons.push(b);
  }

  const ui = {
    timer: el('#md-timer'),
    cats: el('#md-cats'),
    hp: el('#md-hp'),
    autoBtn: el('#md-auto'),
    mascot: el('#md-mascot'),
    bubble: el('#md-bubble'),
    winModal: el('#md-win'),
    winTime: el('#md-win-time'),
    winStats: el('#md-win-stats'),
    failModal: el('#md-fail'),
    failStats: el('#md-fail-stats'),
    sizeButtons,
  };

  el('#md-auto').addEventListener('click', handlers.onToggleAuto);
  el('#md-undo').addEventListener('click', handlers.onUndo);
  el('#md-clear').addEventListener('click', handlers.onClear);
  el('#md-hint').addEventListener('click', handlers.onHint);
  el('#md-new').addEventListener('click', () => handlers.onNewGame());
  el('#md-win-again').addEventListener('click', () => handlers.onNewGame());
  el('#md-fail-retry').addEventListener('click', () => handlers.onRetry());
  el('#md-fail-new').addEventListener('click', () => handlers.onNewGame());
  if (!FEATURE_FLAGS.hintsEnabled) el('#md-hint').style.display = 'none';

  let bubbleToken = 0;
  function meow(text) {
    ui.bubble.textContent = text;
    ui.bubble.classList.add('show');
    bubbleToken++;
    const token = bubbleToken;
    setTimeout(() => {
      if (token === bubbleToken) ui.bubble.classList.remove('show');
    }, 1600);
  }

  function heartsLabel(hp, maxHp) {
    return '❤️'.repeat(Math.max(0, hp)) + '🤍'.repeat(Math.max(0, maxHp - hp));
  }

  function refresh(state, stats) {
    ui.timer.textContent = stats.elapsedLabel();
    let cats = 0;
    for (const v of state.cells) if (v === 2) cats++;
    ui.cats.textContent = `🐱 ${cats}/${state.N}`;
    ui.hp.textContent = heartsLabel(state.hp, state.maxHp);
    ui.hp.classList.toggle('bad', state.hp <= 1);
    ui.autoBtn.classList.toggle('active', state.autoEliminate);
    ui.autoBtn.classList.toggle('off', !state.autoEliminate);
    ui.sizeButtons.forEach((b) => b.classList.toggle('active', Number(b.dataset.size) === state.N));
  }

  function showWin(payload) {
    const total = Math.floor(payload.elapsedMs / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    ui.winTime.textContent = `${m}:${s}`;
    ui.winStats.textContent = `${payload.N}×${payload.N} · 错误 ${payload.mistakes} · 提示 ${payload.hints}`;
    ui.winModal.classList.add('show');
  }

  function showFail(payload) {
    ui.failStats.textContent = `${payload.N}×${payload.N} · 错了 ${payload.mistakes} 次`;
    ui.failModal.classList.add('show');
  }

  function hideModals() {
    ui.winModal.classList.remove('show');
    ui.failModal.classList.remove('show');
  }

  return { refresh, showWin, showFail, hideModals, meow, ui };
}
