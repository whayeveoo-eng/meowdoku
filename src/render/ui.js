// DOM 控制层（关卡制）：关卡头(第N关·尺寸·难度星) + 选关弹层(100格) + HUD + 工具 + 胜/负弹层 + 吉祥物 + 声音。
// 通过回调上抛操作；refresh(state, stats) 同步显示。createUI(root, handlers, levels)。

import { FEATURE_FLAGS, levelStars } from '../data/constants.js';

export function createUI(root, handlers, levels) {
  const el = (id) => root.querySelector(id);
  const starStr = (s) => '★'.repeat(s) + '☆'.repeat(5 - s);

  const ui = {
    timer: el('#md-timer'),
    cats: el('#md-cats'),
    hp: el('#md-hp'),
    levelInfo: el('#md-level-info'),
    mascot: el('#md-mascot'),
    bubble: el('#md-bubble'),
    soundBtn: el('#md-sound'),
    winModal: el('#md-win'),
    winTitle: el('#md-win-title'),
    winTime: el('#md-win-time'),
    winStats: el('#md-win-stats'),
    nextBtn: el('#md-next'),
    failModal: el('#md-fail'),
    failStats: el('#md-fail-stats'),
    levelsModal: el('#md-levels'),
    levelGrid: el('#md-levelgrid'),
    levelsCount: el('#md-levels-count'),
  };

  // 选关网格：100 个按钮，建一次。
  ui.levelButtons = [];
  for (const lv of levels) {
    const b = document.createElement('button');
    b.className = 'md-lvl';
    b.dataset.level = String(lv.id);
    b.dataset.stars = String(levelStars(lv.n, lv.maxLayer));
    b.addEventListener('click', () => handlers.onSelectLevel(lv.id));
    ui.levelGrid.appendChild(b);
    ui.levelButtons.push(b);
  }

  el('#md-levels-btn').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-levels-close').addEventListener('click', () => ui.levelsModal.classList.remove('show'));
  el('#md-fail-levels').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-win-levels').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-next').addEventListener('click', () => handlers.onNext());

  el('#md-sound').addEventListener('click', handlers.onToggleSound);
  el('#md-auto').addEventListener('click', handlers.onToggleAuto);
  el('#md-undo').addEventListener('click', handlers.onUndo);
  el('#md-clear').addEventListener('click', handlers.onClear);
  el('#md-hint').addEventListener('click', handlers.onHint);
  el('#md-restart').addEventListener('click', handlers.onRestart);
  el('#md-fail-retry').addEventListener('click', handlers.onRestart);
  if (!FEATURE_FLAGS.hintsEnabled) el('#md-hint').style.display = 'none';

  let bubbleToken = 0;
  function meow(text) {
    ui.bubble.textContent = text;
    ui.bubble.classList.add('show');
    bubbleToken++;
    const token = bubbleToken;
    setTimeout(() => { if (token === bubbleToken) ui.bubble.classList.remove('show'); }, 1600);
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
    const stars = levelStars(state.N, state.maxLayer);
    ui.levelInfo.innerHTML = `第 <b>${state.levelId}</b> 关 · ${state.N}×${state.N} · <span class="md-stars" data-stars="${stars}">${starStr(stars)}</span>`;
  }

  function setSoundOn(on) {
    ui.soundBtn.textContent = on ? '🔊' : '🔇';
    ui.soundBtn.classList.toggle('off', !on);
  }

  // 选关弹层：刷新每个关卡按钮状态（已通关✓ / 已解锁数字 / 未解锁🔒），并打开。
  function openLevels(progress) {
    let done = 0;
    for (const b of ui.levelButtons) {
      const id = Number(b.dataset.level);
      const isDone = !!progress.done[id];
      const unlocked = id <= progress.unlocked;
      if (isDone) done++;
      b.classList.toggle('done', isDone);
      b.classList.toggle('locked', !unlocked);
      b.classList.toggle('current', id === progress.current);
      b.textContent = !unlocked ? '🔒' : isDone ? '✓' : String(id);
      b.disabled = !unlocked;
    }
    ui.levelsCount.textContent = `已通关 ${done} / ${levels.length}`;
    ui.levelsModal.classList.add('show');
  }
  function closeLevels() { ui.levelsModal.classList.remove('show'); }

  function showWin(payload, isLast) {
    const total = Math.floor(payload.elapsedMs / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    ui.winTitle.textContent = isLast ? '全部通关喵！🏆' : '安家成功喵！';
    ui.winTime.textContent = `${m}:${s}`;
    ui.winStats.textContent = `第 ${payload.levelId} 关 · 错误 ${payload.mistakes} · 提示 ${payload.hints}`;
    ui.nextBtn.textContent = isLast ? '回看关卡 🐾' : '下一关 ▶';
    ui.winModal.classList.add('show');
  }
  function showFail(payload) {
    ui.failStats.textContent = `第 ${payload.levelId} 关 · 错了 ${payload.mistakes} 次`;
    ui.failModal.classList.add('show');
  }
  function hideModals() {
    ui.winModal.classList.remove('show');
    ui.failModal.classList.remove('show');
  }

  return { refresh, showWin, showFail, hideModals, openLevels, closeLevels, meow, setSoundOn, ui };
}
