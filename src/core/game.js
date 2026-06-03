// 对局状态机：持有区域布局、单元格三态、选格、撤销栈与计数器，对外暴露操作并派发事件。
// 渲染层只读 state，输入层只调方法。

import { generateLevel } from './generator.js';
import { findConflicts, isSolved, catCount, indexOf, eliminatedCells } from './board.js';
import { makeRng, randomSeed } from './rng.js';
import { createEventBus } from './events.js';
import { createStats } from './stats.js';
import { DEFAULT_N, SIZES, CELL, FEATURE_FLAGS, LIVES } from '../data/constants.js';

export function createGame() {
  const bus = createEventBus();
  const stats = createStats();

  const state = {
    status: 'idle', // idle | playing | won | lost
    N: DEFAULT_N,
    seed: 0,
    region: [], // 颜色区域索引 0..N-1，长度 N*N
    cells: [], // 三态：CELL.EMPTY / MARK / CAT
    solution: [], // 唯一解的小猫 cell 索引数组
    solutionSet: new Set(), // 同上，便于 O(1) 校验
    selected: -1,
    conflicts: new Set(),
    autoMarks: new Set(), // 由正确的猫推导出的自动排除格
    autoEliminate: FEATURE_FLAGS.autoEliminate, // 运行时开关，玩家可切换
    hp: LIVES,
    maxHp: LIVES,
  };

  function recompute() {
    // 校验放子模式下猫必为正解，理论上不会有冲突；仍保留检测做安全网。
    state.conflicts = findConflicts(state.cells, state.region, state.N);

    // 自动排除：只信任“无冲突”的猫。它们的行/列/九宫格/同色区域自动打叉。
    const auto = new Set();
    if (state.autoEliminate) {
      const catSet = new Set();
      for (let i = 0; i < state.cells.length; i++) {
        if (state.cells[i] === CELL.CAT) catSet.add(i);
      }
      for (const idx of catSet) {
        if (state.conflicts.has(idx)) continue; // 冲突的猫不参与推导
        for (const e of eliminatedCells(state.N, idx, state.region)) {
          if (!catSet.has(e)) auto.add(e); // 有猫的格不打叉
        }
      }
    }
    state.autoMarks = auto;
  }

  // 切换自动排除开关（玩家偏好，跨关保留）。
  function setAutoEliminate(on) {
    state.autoEliminate = !!on;
    recompute();
    bus.emit('autoEliminateChanged', { on: state.autoEliminate });
    return state.autoEliminate;
  }

  function newGame(n = state.N, seed) {
    const N = SIZES.includes(n) ? n : DEFAULT_N;
    const usedSeed = (seed >>> 0) || randomSeed();
    const rng = makeRng(usedSeed);
    const level = generateLevel(N, rng);

    state.status = 'playing';
    state.N = N;
    state.seed = usedSeed;
    state.region = level.region.slice();
    state.cells = new Array(N * N).fill(CELL.EMPTY);
    state.solution = level.solution.slice();
    state.solutionSet = new Set(level.solution);
    state.selected = -1;
    state.hp = LIVES;
    state.maxHp = LIVES;
    history.length = 0;
    recompute();
    stats.reset();

    bus.emit('gameStarted', { N, seed: usedSeed, fallback: !!level.fallback });
    return state;
  }

  const history = [];
  function pushHistory(index, prev, next) {
    history.push({ index, prev, next });
    if (history.length > 400) history.shift();
  }

  function select(index) {
    if (state.status !== 'playing') return;
    state.selected = index;
    bus.emit('selectChanged', { index });
  }

  // 点击循环：
  //   空格            → ✕ 标记（免费）
  //   ✕ 标记          → 若该格已被自动排除（必非猫）则清回空格；否则“尝试放猫”（校验）
  //   小猫            → 收回（免费）
  // “尝试放猫”：正解格 → 放下；非正解格 → 扣 1 滴血、不落子（血归零则失败）。
  function cycleCell(index) {
    if (state.status !== 'playing') return;
    if (index < 0 || index >= state.cells.length) return;
    stats.start();
    state.selected = index;
    const prev = state.cells[index];

    if (prev === CELL.CAT) {
      state.cells[index] = CELL.EMPTY;
      pushHistory(index, CELL.CAT, CELL.EMPTY);
      recompute();
      bus.emit('cellChanged', { index, prev, next: CELL.EMPTY });
      return;
    }

    // 放错留下的红 ✕：再点一下清掉（不再尝试放猫、不扣血）
    if (prev === CELL.WRONG) {
      state.cells[index] = CELL.EMPTY;
      pushHistory(index, CELL.WRONG, CELL.EMPTY);
      recompute();
      bus.emit('cellChanged', { index, prev, next: CELL.EMPTY });
      return;
    }

    if (prev === CELL.MARK) {
      // 已被自动排除的格不允许尝试放猫（必非猫），只清回空格，避免误扣血
      if (state.autoMarks.has(index)) {
        state.cells[index] = CELL.EMPTY;
        pushHistory(index, CELL.MARK, CELL.EMPTY);
        recompute();
        bus.emit('cellChanged', { index, prev, next: CELL.EMPTY });
        return;
      }
      attemptCat(index);
      return;
    }

    // prev === EMPTY：第一下先打 ✕（免费、可作笔记）
    if (FEATURE_FLAGS.autoMarkAllowed) {
      state.cells[index] = CELL.MARK;
      pushHistory(index, CELL.EMPTY, CELL.MARK);
      recompute();
      bus.emit('cellChanged', { index, prev, next: CELL.MARK });
    } else {
      attemptCat(index);
    }
  }

  // 尝试在 index 放猫（校验唯一解）。
  function attemptCat(index) {
    if (state.status !== 'playing') return;
    const prev = state.cells[index];
    const correct = !FEATURE_FLAGS.validatePlacement || state.solutionSet.has(index);

    if (!correct) {
      stats.state.mistakes++;
      state.hp = Math.max(0, state.hp - 1);
      state.cells[index] = CELL.WRONG; // 留下红 ✕ 提示此处试过且错了（不进撤销栈、不可撤回血量）
      recompute();
      bus.emit('cellChanged', { index, prev, next: CELL.WRONG });
      bus.emit('wrongPlacement', { index, hp: state.hp });
      if (state.hp <= 0) {
        state.status = 'lost';
        stats.stop();
        bus.emit('gameLost', {
          N: state.N,
          seed: state.seed,
          elapsedMs: stats.elapsedMs(),
          mistakes: stats.state.mistakes,
        });
      }
      return;
    }

    state.cells[index] = CELL.CAT;
    pushHistory(index, prev, CELL.CAT);
    stats.state.moves++;
    recompute();
    bus.emit('catPlaced', { index });
    bus.emit('cellChanged', { index, prev, next: CELL.CAT });
    checkWin();
  }

  // 直接设状态（用于撤销 / 提示 / 测试）。
  function setCellState(index, value, record = true) {
    const prev = state.cells[index];
    if (prev === value) return;
    state.cells[index] = value;
    if (record) pushHistory(index, prev, value);
    recompute();
    bus.emit('cellChanged', { index, prev, next: value });
    checkWin();
  }

  // ---- 滑动批量打/擦 ✕ ----
  // beginStroke 按起点格决定模式（空→涂✕ / ✕→擦），整段拖动合并为一次撤销。
  let stroke = null;
  function beginStroke(index) {
    if (state.status !== 'playing') return null;
    if (index < 0 || index >= state.cells.length) return null;
    const v = state.cells[index];
    if (v === CELL.CAT || v === CELL.WRONG) return null; // 猫 / 红✕ 不参与涂抹
    stroke = { mode: v === CELL.MARK ? 'erase' : 'mark', changes: new Map() };
    stats.start();
    paintAt(index);
    return stroke.mode;
  }
  function paintAt(index) {
    if (!stroke || index < 0 || index >= state.cells.length) return;
    const v = state.cells[index];
    if (stroke.mode === 'mark') {
      if (v !== CELL.EMPTY) return; // 只在空格涂 ✕，跳过猫/红✕/已有✕
      if (!stroke.changes.has(index)) stroke.changes.set(index, v);
      state.cells[index] = CELL.MARK;
    } else {
      if (v !== CELL.MARK) return; // 只擦手动 ✕
      if (!stroke.changes.has(index)) stroke.changes.set(index, v);
      state.cells[index] = CELL.EMPTY;
    }
    state.selected = index;
    bus.emit('cellChanged', { index, prev: stroke.changes.get(index), next: state.cells[index] });
  }
  function endStroke() {
    if (!stroke) return 0;
    const changes = [...stroke.changes].map(([index, prev]) => ({ index, prev, next: state.cells[index] }));
    const mode = stroke.mode;
    stroke = null;
    if (changes.length) {
      history.push({ type: 'stroke', changes });
      if (history.length > 400) history.shift();
      recompute();
      bus.emit('strokeEnd', { mode, count: changes.length });
    }
    return changes.length;
  }

  function clearBoard() {
    if (state.status !== 'playing') return;
    state.cells = state.cells.map(() => CELL.EMPTY);
    history.length = 0;
    recompute();
    bus.emit('cleared', {});
  }

  function undo() {
    if (state.status !== 'playing') return;
    const entry = history.pop();
    if (!entry) return;
    if (entry.type === 'stroke') {
      for (const c of entry.changes) state.cells[c.index] = c.prev;
      if (entry.changes.length) state.selected = entry.changes[entry.changes.length - 1].index;
    } else {
      state.cells[entry.index] = entry.prev;
      state.selected = entry.index;
    }
    recompute();
    bus.emit('undone', {});
  }

  // 提示：在“尚无正确小猫”的某个区域放入唯一解的小猫，并清掉该区其它小猫。
  function hint() {
    if (state.status !== 'playing' || !FEATURE_FLAGS.hintsEnabled) return;
    const N = state.N;
    // 找一个解中小猫所在区域，当前该格不是猫
    const target = state.solution.find((cell) => state.cells[cell] !== CELL.CAT);
    if (target === undefined) return;
    const gi = state.region[target];
    // 清掉该区域里其它（错误）小猫
    for (let i = 0; i < state.cells.length; i++) {
      if (state.region[i] === gi && state.cells[i] === CELL.CAT && i !== target) {
        const prev = state.cells[i];
        state.cells[i] = CELL.EMPTY;
        pushHistory(i, prev, CELL.EMPTY);
      }
    }
    const prev = state.cells[target];
    state.cells[target] = CELL.CAT;
    pushHistory(target, prev, CELL.CAT);
    state.selected = target;
    stats.state.hints++;
    recompute();
    bus.emit('hintUsed', { index: target });
    checkWin();
  }

  function checkWin() {
    if (isSolved(state.cells, state.region, state.N)) {
      state.status = 'won';
      stats.stop();
      bus.emit('gameWon', {
        N: state.N,
        seed: state.seed,
        elapsedMs: stats.elapsedMs(),
        mistakes: stats.state.mistakes,
        hints: stats.state.hints,
      });
    }
  }

  return {
    state,
    stats,
    on: bus.on.bind(bus),
    off: bus.off.bind(bus),
    emit: bus.emit.bind(bus),
    newGame,
    select,
    cycleCell,
    attemptCat,
    beginStroke,
    paintAt,
    endStroke,
    setCellState,
    clearBoard,
    undo,
    hint,
    setAutoEliminate,
    catCount: () => catCount(state.cells),
    isSolved: () => isSolved(state.cells, state.region, state.N),
    indexOf: (r, c) => indexOf(state.N, r, c),
  };
}
