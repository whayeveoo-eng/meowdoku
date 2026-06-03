// 入口：装配 canvas、渲染循环、输入、DOM 控制与测试钩子。

import { BOARD_PX, CELL, FEATURE_FLAGS } from './data/constants.js';
import { createGame } from './core/game.js';
import { drawBoard } from './render/grid.js';
import { drawConflictCells, drawContents, drawSelectionRing } from './render/cells.js';
import { createEffects } from './render/effects.js';
import { createUI } from './render/ui.js';

const root = document;
const canvas = root.getElementById('md-board');
const ctx = canvas.getContext('2d');
const game = createGame();
const effects = createEffects();

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

canvas.addEventListener('pointerdown', (e) => {
  const i = pointToCell(e.clientX, e.clientY);
  if (i >= 0) game.cycleCell(i);
});

window.addEventListener('keydown', (e) => {
  if (game.state.status !== 'playing') return;
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

// ---- DOM 控制层 ----
const ui = createUI(root, {
  onNewGame: (n) => startGame(n),
  onRetry: () => startGame(game.state.N, game.state.seed), // 同一关重来
  onUndo: () => game.undo(),
  onClear: () => game.clearBoard(),
  onHint: () => game.hint(),
  onToggleAuto: () => {
    const on = game.setAutoEliminate(!game.state.autoEliminate);
    saveAutoPref(on);
    ui.meow(on ? '自动打叉：开喵' : '自动打叉：关喵');
  },
});

// ---- 事件 → 特效 / 吉祥物 ----
game.on('catPlaced', ({ index }) => effects.pulse(index));
game.on('hintUsed', ({ index }) => effects.pulse(index));
game.on('wrongPlacement', ({ index, hp }) => {
  effects.flashWrong(index);
  ui.meow(hp > 0 ? `喵？这里不对，还剩 ${hp} ❤️` : '喵呜…');
});
game.on('gameWon', (payload) => {
  effects.celebrate();
  ui.meow('喵呜！全部安顿好啦！');
  ui.showWin(payload);
});
game.on('gameLost', (payload) => {
  ui.meow('下次一定喵…');
  ui.showFail(payload);
});

function startGame(n, seed) {
  ui.hideModals();
  game.newGame(n, seed);
  effects.setBoard(game.state.N);
  effects.reset();
  resizeCanvas();
  ui.meow('给每只猫找个位子喵~');
}

// ---- 渲染循环 ----
function frame() {
  ctx.clearRect(0, 0, BOARD_PX, BOARD_PX);
  drawBoard(ctx, game.state);
  drawConflictCells(ctx, game.state);
  drawContents(ctx, game.state);
  drawSelectionRing(ctx, game.state);
  effects.update();
  effects.draw(ctx);
  ui.refresh(game.state, game.stats);
  requestAnimationFrame(frame);
}

// ---- 启动 ----
game.setAutoEliminate(loadAutoPref()); // 应用玩家偏好
resizeCanvas();
startGame();
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
