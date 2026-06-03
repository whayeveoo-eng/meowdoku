// 出现动画：小猫落子「弹入」、✕ 标记「弹出现」。按帧推进，渲染层查询每格缩放/透明度。
// 自动排除产生的 ✕ 通过逐帧 diff「当前显示的标记集合」自动获得出现动画（含级联）。

import { CELL } from '../data/constants.js';

const CAT_FRAMES = 16; // 猫弹入时长
const MARK_FRAMES = 11; // ✕ 弹出时长

function easeOutBack(p) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3);
}

export function createAnim() {
  const cat = new Map(); // index -> frame
  const mark = new Map(); // index -> frame
  let prevMarks = new Set();

  function spawnCat(index) {
    cat.set(index, 0);
  }

  // 每帧从 state 求「当前应显示 ✕ 的格」（手动 MARK / 自动排除 / 放错红 ✕），新出现的给出现动画。
  function syncMarks(state) {
    const cur = new Set();
    for (let i = 0; i < state.cells.length; i++) {
      if (state.cells[i] === CELL.MARK || state.cells[i] === CELL.WRONG || state.autoMarks.has(i)) cur.add(i);
    }
    for (const i of cur) {
      if (!prevMarks.has(i)) mark.set(i, 0);
    }
    prevMarks = cur;
  }

  function update() {
    for (const [i, f] of cat) {
      if (f + 1 >= CAT_FRAMES) cat.delete(i);
      else cat.set(i, f + 1);
    }
    for (const [i, f] of mark) {
      if (f + 1 >= MARK_FRAMES) mark.delete(i);
      else mark.set(i, f + 1);
    }
  }

  function reset() {
    cat.clear();
    mark.clear();
    prevMarks = new Set();
  }

  return {
    spawnCat,
    syncMarks,
    update,
    reset,
    // 渲染查询：返回 { scale, alpha }
    catAt(index) {
      if (!cat.has(index)) return { scale: 1, alpha: 1 };
      const p = cat.get(index) / CAT_FRAMES;
      return { scale: easeOutBack(p), alpha: Math.min(1, p * 2) };
    },
    markAt(index) {
      if (!mark.has(index)) return { scale: 1, alpha: 1 };
      const p = mark.get(index) / MARK_FRAMES;
      return { scale: 0.4 + 0.6 * easeOutCubic(p), alpha: easeOutCubic(p) };
    },
  };
}
