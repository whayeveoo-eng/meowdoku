// 入口：装配 canvas、渲染循环、输入、DOM 控制与测试钩子。

import { BOARD_PX, CELL, FEATURE_FLAGS } from './data/constants.js';
import { createGame } from './core/game.js';
import { drawBoard } from './render/grid.js';
import { drawConflictCells, drawContents, drawSelectionRing } from './render/cells.js';
import { createEffects } from './render/effects.js';
import { createAnim } from './render/anim.js';
import { createUI } from './render/ui.js';
import { createAudio } from './audio/sound.js';
import { LEVELS, LEVEL_COUNT } from './data/levels.js';
import { emptyAbility, recordItem, scoreAbility } from './core/scoring.js';
import { pickThree, recommendKey, generateMatched } from './core/recommend.js';

const root = document;
const canvas = root.getElementById('md-board');
const ctx = canvas.getContext('2d');
const game = createGame();
const effects = createEffects();
const anim = createAnim();
const audio = createAudio();

// ---- Canvas 自适应：CSS 控制显示尺寸，逻辑坐标固定 0..BOARD_PX ----
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = canvas.clientWidth || canvas.parentElement.clientWidth;
  canvas.width = Math.round(cssSize * dpr);
  canvas.height = Math.round(cssSize * dpr);
  const scale = (cssSize * dpr) / BOARD_PX;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}
window.addEventListener('resize', resizeCanvas);

// ---- 输入：点击/触摸 → 循环三态；键盘 → 移动 + 循环 ----
function pointToCell(clientX, clientY) {
  const N = game.state.N;
  const rect = canvas.getBoundingClientRect();
  const c = Math.floor(((clientX - rect.left) / rect.width) * N);
  const r = Math.floor(((clientY - rect.top) / rect.height) * N);
  if (r < 0 || r >= N || c < 0 || c >= N) return -1;
  return r * N + c;
}

// 指针：轻点 → 三态循环；按住拖动 → 批量打/擦 ✕（滑过的格子）。
let drag = null; // { startCell, x, y, dragging, mode }
const DRAG_PX = 8;

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  const i = pointToCell(e.clientX, e.clientY);
  if (i < 0) return;
  drag = { startCell: i, x: e.clientX, y: e.clientY, dragging: false, mode: null };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const i = pointToCell(e.clientX, e.clientY);
  if (!drag.dragging) {
    const moved = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
    if (moved < DRAG_PX && i === drag.startCell) return; // 还算轻点
    drag.dragging = true;
    drag.mode = game.beginStroke(drag.startCell); // 起点决定涂 / 擦
    if (drag.mode && i >= 0 && i !== drag.startCell) game.paintAt(i);
  } else if (drag.mode && i >= 0) {
    game.paintAt(i);
  }
});

function endPointer() {
  if (!drag) return;
  if (!drag.dragging) {
    game.cycleCell(drag.startCell); // 轻点 = 三态循环
  } else {
    game.endStroke();
  }
  drag = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

window.addEventListener('keydown', (e) => {
  if (game.state.status !== 'playing') return;
  audio.unlock();
  const N = game.state.N;
  if (e.key === ' ' || e.key === 'Enter') {
    if (game.state.selected >= 0) game.cycleCell(game.state.selected);
    e.preventDefault();
  } else if (e.key.startsWith('Arrow')) {
    let i = game.state.selected;
    if (i < 0) i = Math.floor((N * N) / 2);
    let r = Math.floor(i / N);
    let c = i % N;
    if (e.key === 'ArrowUp') r = (r + N - 1) % N;
    if (e.key === 'ArrowDown') r = (r + 1) % N;
    if (e.key === 'ArrowLeft') c = (c + N - 1) % N;
    if (e.key === 'ArrowRight') c = (c + 1) % N;
    game.select(r * N + c);
    e.preventDefault();
  } else if (e.key === 'z' || e.key === 'Z') {
    game.undo();
  }
});

// ---- 自动排除开关：从 localStorage 读玩家偏好 ----
const AUTO_KEY = 'meowdoku.autoEliminate';
function loadAutoPref() {
  try {
    const v = localStorage.getItem(AUTO_KEY);
    return v === null ? game.state.autoEliminate : v === '1';
  } catch {
    return game.state.autoEliminate;
  }
}
function saveAutoPref(on) {
  try {
    localStorage.setItem(AUTO_KEY, on ? '1' : '0');
  } catch {
    /* 隐私模式等忽略 */
  }
}

// ---- 关卡进度：localStorage ----
const PROG_KEY = 'meowdoku.progress';
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(PROG_KEY));
    if (p && p.unlocked) return { unlocked: p.unlocked, done: p.done || {}, current: p.current || 1 };
  } catch {
    /* ignore */
  }
  return { unlocked: 1, done: {}, current: 1 };
}
function saveProgress() {
  try {
    localStorage.setItem(PROG_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}
const progress = loadProgress();

// ---- 玩家能力(每只猫=一道题,聚合计数持久化)----
const ABILITY_KEY = 'meowdoku.ability';
function loadAbility() {
  try {
    const a = JSON.parse(localStorage.getItem(ABILITY_KEY));
    if (a) { const e = emptyAbility(); for (let d = 1; d <= 5; d++) if (a[d]) e[d] = { clean: a[d].clean | 0, struggle: a[d].struggle | 0, hint: a[d].hint | 0 }; return e; }
  } catch { /* ignore */ }
  return emptyAbility();
}
function saveAbility() { try { localStorage.setItem(ABILITY_KEY, JSON.stringify(ability)); } catch { /* ignore */ } }
const ability = loadAbility();
let practiceMode = false; // 自适应"为你推荐/练习"模式(不计入战役进度)
let lastStruggled = null; // 上一关练习是否磕绊(放错/用提示)→ DDA 推荐降档

// ---- DOM 控制层 ----
const ui = createUI(root, {
  onSelectLevel: (id) => {
    if (id < 1 || id > LEVEL_COUNT || id > progress.unlocked) return;
    ui.closeLevels();
    startLevel(id);
  },
  onNext: () => {
    if (practiceMode) { openPracticePanel(); return; } // 练习:再来一道→重开三选(带 DDA 推荐)
    const next = Math.min(game.state.levelId + 1, LEVEL_COUNT);
    if (next <= progress.unlocked) startLevel(next);
    else ui.openLevels(progress);
  },
  onRestart: () => {
    if (practiceMode) reloadCurrent(); // 重玩本练习关(同 seed)
    else startLevel(game.state.levelId || progress.current);
  },
  onOpenLevels: () => { ui.hideModals(); ui.openLevels(progress); },
  onOpenAbility: () => { ui.hideModals(); ui.openAbility(scoreAbility(ability)); },
  onPractice: () => openPracticePanel(),
  onPickPractice: (target) => startPracticeWith(target),
  onUnlockAll: () => {
    progress.unlocked = LEVEL_COUNT;
    saveProgress();
    ui.openLevels(progress); // 刷新网格
    ui.meow('已解锁全部 100 关喵~ 🔓');
  },
  onUndo: () => game.undo(),
  onClear: () => game.clearBoard(),
  onHint: () => game.hint(),
  onToggleAuto: () => {
    const on = game.setAutoEliminate(!game.state.autoEliminate);
    saveAutoPref(on);
    audio.click();
    ui.meow(on ? '自动打叉：开喵' : '自动打叉：关喵');
  },
  onToggleSound: () => {
    audio.unlock();
    const on = audio.setEnabled(!audio.enabled);
    ui.setSoundOn(on);
    ui.meow(on ? '声音：开喵 🔊' : '声音：静音 🔇');
  },
}, LEVELS);

// ---- 事件 → 特效 / 动画 / 音效 / 吉祥物 ----
game.on('catPlaced', ({ index }) => {
  effects.pulse(index);
  anim.spawnCat(index);
  audio.good();
});
game.on('hintUsed', ({ index }) => {
  effects.pulse(index);
  anim.spawnCat(index);
  audio.good();
});
game.on('wrongPlacement', ({ index, hp }) => {
  effects.flashWrong(index);
  audio.bad();
  ui.meow(hp > 0 ? `喵？这里不对，还剩 ${hp} ❤️` : '喵呜…');
});
game.on('cellChanged', ({ next }) => {
  if (next === CELL.MARK) audio.click(); // 打 ✕（含滑动，内部节流）
});
game.on('stageScored', ({ d, outcome }) => {
  if (d >= 1) { recordItem(ability, d, outcome); saveAbility(); } // 能力计分(d=0 超前不计)
});
game.on('gameWon', (payload) => {
  effects.celebrate();
  audio.win();
  const report = scoreAbility(ability);
  if (practiceMode) {
    lastStruggled = payload.mistakes > 0 || payload.hints > 0; // 磕绊/用提示 → 下次 DDA 推荐巩固
    ui.meow(`练习过关喵！段位：${report.title}`);
    ui.showWin(payload, false, report, { practice: true });
    return;
  }
  // 战役:记录进度、解锁下一关
  const id = payload.levelId;
  if (id >= 1) {
    progress.done[id] = true;
    progress.unlocked = Math.max(progress.unlocked, Math.min(id + 1, LEVEL_COUNT));
    progress.current = id;
    saveProgress();
  }
  const isLast = id >= LEVEL_COUNT;
  ui.meow(isLast ? '全部通关啦喵！🏆' : '喵呜！下一关也交给你~');
  ui.showWin(payload, isLast, report);
});
game.on('gameLost', (payload) => {
  audio.fail();
  ui.meow('下次一定喵…');
  ui.showFail(payload);
});

// 进入棋盘后的统一重置(特效/动画/画布)。
function afterBoardReady() {
  effects.setBoard(game.state.N);
  effects.reset();
  anim.reset();
  anim.syncMarks(game.state); // 以空盘为基线，避免开局误触发动画
  resizeCanvas();
}

// 载入第 id 关(关卡制)。
function startLevel(id) {
  const lv = LEVELS[id - 1];
  if (!lv) return;
  practiceMode = false;
  progress.current = id;
  saveProgress();
  ui.hideModals();
  game.loadLevel(lv);
  afterBoardReady();
  ui.meow(`第 ${id} 关 · 给每只猫找个位子喵~`);
}

// 打开三选面板(巩固/进阶/挑战),DDA 推荐其一高亮。
function openPracticePanel() {
  ui.hideModals();
  ui.openPractice(pickThree(scoreAbility(ability)), recommendKey(lastStruggled));
}

// 选定一档 → 形状优选现生成匹配关并开始。
function startPracticeWith(target) {
  practiceMode = true;
  ui.hideModals();
  const m = generateMatched(target.n, target.tier);
  game.newGame(m.n, m.seed); // levelId=0 → 不计战役进度
  afterBoardReady();
  ui.meow(`${target.key}：${m.n}×${m.n} · 攻克${target.label}`);
}

// 重玩当前(练习关同 seed,战役关同关)。
function reloadCurrent() {
  ui.hideModals();
  game.newGame(game.state.N, game.state.seed);
  afterBoardReady();
}

// ---- 渲染循环 ----
function frame() {
  ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
  anim.syncMarks(game.state); // 检测新出现的 ✕ 起出现动画
  drawBoard(ctx, game.state);
  drawConflictCells(ctx, game.state);
  drawContents(ctx, game.state, anim);
  drawSelectionRing(ctx, game.state);
  anim.update();
  effects.update();
  effects.draw(ctx);
  ui.refresh(game.state, game.stats, practiceMode);
  requestAnimationFrame(frame);
}

// ---- 启动 ----
game.setAutoEliminate(loadAutoPref()); // 应用玩家偏好
ui.setSoundOn(audio.enabled); // 同步声音按钮初始态
resizeCanvas();
startLevel(Math.min(progress.current || 1, progress.unlocked)); // 从上次/已解锁处开始
requestAnimationFrame(frame);

// ---- 测试钩子（沿用项目约定）----
window.__meowdoku = {
  game,
  newGame: (n, seed) => {
    game.newGame(n, seed);
    effects.setBoard(game.state.N);
    effects.reset();
    resizeCanvas();
  },
  startLevel: (id) => startLevel(id),
  levelId: () => game.state.levelId,
  levels: LEVELS,
  progress: () => ({ ...progress }),
  ability: () => scoreAbility(ability),
  abilityRaw: () => ability,
  practiceThree: () => pickThree(scoreAbility(ability)),
  startPracticeKey: (key) => { const t = pickThree(scoreAbility(ability)).find((x) => x.key === key); if (t) startPracticeWith(t); },
  isPractice: () => practiceMode,
  getState: () => game.state,
  getRegion: () => game.state.region.slice(),
  getSolution: () => game.state.solution.slice(),
  getCells: () => game.state.cells.slice(),
  cycle: (r, c) => game.cycleCell(r * game.state.N + c),
  placeCat: (r, c) => game.setCellState(r * game.state.N + c, CELL.CAT),
  attempt: (r, c) => game.attemptCat(r * game.state.N + c),
  catCount: () => game.catCount(),
  conflicts: () => [...game.state.conflicts],
  autoMarks: () => [...game.state.autoMarks],
  hp: () => game.state.hp,
  status: () => game.state.status,
  maxLayer: () => game.state.maxLayer,
  autoEliminate: () => game.state.autoEliminate,
  setAutoEliminate: (on) => game.setAutoEliminate(on),
  isSolved: () => game.isSolved(),
  solveAll: () => {
    // 测试用：套唯一解填满，最后一只触发胜利
    game.clearBoard();
    for (const cell of game.state.solution) game.setCellState(cell, CELL.CAT);
  },
  stats: () => ({ ...game.stats.state, elapsedMs: game.stats.elapsedMs() }),
  flags: FEATURE_FLAGS,
};
