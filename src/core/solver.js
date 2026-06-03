// 求解 / 唯一性校验。约束：每行、每列、每个颜色区域恰好 1 只小猫，任意两只不相邻（国王步）。
// 纯函数，无浏览器依赖，可被 node 工具直接 import。

import { cellsByRegion } from './board.js';

// 统计满足约束的放置方案数，最多数到 limit（唯一性用 limit=2）。
// region: 长度 N*N 的区域索引数组。返回解的个数（封顶 limit）。
export function countSolutions(region, N, limit = 2) {
  const byRegion = cellsByRegion(region, N);
  // 按区域大小升序求解：先填选择最少的区域，剪枝最强。
  const order = byRegion
    .map((cells, gi) => ({ gi, cells }))
    .sort((a, b) => a.cells.length - b.cells.length);

  const usedRow = new Array(N).fill(false);
  const usedCol = new Array(N).fill(false);
  const placed = []; // 已放置的 cell 索引
  let count = 0;

  function adjacentToPlaced(idx) {
    const r = Math.floor(idx / N);
    const c = idx % N;
    for (const p of placed) {
      const pr = Math.floor(p / N);
      const pc = p % N;
      if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return true;
    }
    return false;
  }

  function rec(k) {
    if (count >= limit) return;
    if (k === order.length) {
      count++;
      return;
    }
    for (const idx of order[k].cells) {
      const r = Math.floor(idx / N);
      const c = idx % N;
      if (usedRow[r] || usedCol[c]) continue;
      if (adjacentToPlaced(idx)) continue;
      usedRow[r] = true;
      usedCol[c] = true;
      placed.push(idx);
      rec(k + 1);
      placed.pop();
      usedRow[r] = false;
      usedCol[c] = false;
      if (count >= limit) return;
    }
  }

  rec(0);
  return count;
}

export function hasUniqueSolution(region, N) {
  return countSolutions(region, N, 2) === 1;
}

// 返回唯一解的小猫 cell 索引数组（找到第一个解即返回；配合唯一性校验使用）。
export function findSolution(region, N) {
  const byRegion = cellsByRegion(region, N);
  const order = byRegion
    .map((cells, gi) => ({ gi, cells }))
    .sort((a, b) => a.cells.length - b.cells.length);
  const usedRow = new Array(N).fill(false);
  const usedCol = new Array(N).fill(false);
  const placed = [];

  function adjacentToPlaced(idx) {
    const r = Math.floor(idx / N);
    const c = idx % N;
    for (const p of placed) {
      if (Math.abs(Math.floor(p / N) - r) <= 1 && Math.abs((p % N) - c) <= 1) return true;
    }
    return false;
  }

  function rec(k) {
    if (k === order.length) return true;
    for (const idx of order[k].cells) {
      const r = Math.floor(idx / N);
      const c = idx % N;
      if (usedRow[r] || usedCol[c] || adjacentToPlaced(idx)) continue;
      usedRow[r] = true;
      usedCol[c] = true;
      placed.push(idx);
      if (rec(k + 1)) return true;
      placed.pop();
      usedRow[r] = false;
      usedCol[c] = false;
    }
    return false;
  }

  return rec(0) ? placed.slice() : null;
}

// 找一个“与 targetSet 不同”的解（用于唯一性精修：找到则说明还不唯一）。
// targetSet: Set<cellIndex>，目标解的小猫格。返回该替代解的 cell 数组，或 null（已唯一）。
export function findAltSolution(region, N, targetSet) {
  const byRegion = cellsByRegion(region, N);
  const order = byRegion
    .map((cells) => cells)
    .sort((a, b) => a.length - b.length);
  const usedRow = new Array(N).fill(false);
  const usedCol = new Array(N).fill(false);
  const placed = [];
  let found = null;

  function adjacentToPlaced(idx) {
    const r = Math.floor(idx / N);
    const c = idx % N;
    for (const p of placed) {
      if (Math.abs(Math.floor(p / N) - r) <= 1 && Math.abs((p % N) - c) <= 1) return true;
    }
    return false;
  }

  function rec(k) {
    if (found) return;
    if (k === order.length) {
      // 完整放置：与目标不同则记为替代解
      if (placed.length === targetSet.size && !placed.every((c) => targetSet.has(c))) {
        found = placed.slice();
      }
      return;
    }
    for (const idx of order[k]) {
      const r = Math.floor(idx / N);
      const c = idx % N;
      if (usedRow[r] || usedCol[c] || adjacentToPlaced(idx)) continue;
      usedRow[r] = true;
      usedCol[c] = true;
      placed.push(idx);
      rec(k + 1);
      placed.pop();
      usedRow[r] = false;
      usedCol[c] = false;
      if (found) return;
    }
  }

  rec(0);
  return found;
}

// 人类式逻辑求解器：只用“严格推导”规则（不猜、不回溯）尝试解出整盘。
// 用作生成过滤——能被它完全解出的关卡，玩家就能从初始盘面一步步推出来。
// 规则均“可靠”（只确定必然为猫 / 必然非猫的格）：
//   R1 某区域只剩 1 个候选 → 该格是猫
//   R2 某行只剩 1 个候选 → 该格是猫
//   R3 某列只剩 1 个候选 → 该格是猫
//   R4 限定法（仅在 R1–R3 停滞时启用）：
//      - 某区域候选都在同一行/列 → 该行/列其它格排除
//      - 某行/列候选都在同一区域 → 该区域其它（非此行/列）格排除
// 放下一只猫会排除它的行、列、区域、九宫格邻居。
// 返回解出的猫格数组（已全解）或 null（停滞，说明需要猜）。
export function logicalSolve(region, N) {
  const total = N * N;
  const cat = new Array(total).fill(false);
  const elim = new Array(total).fill(false);
  const byRegion = cellsByRegion(region, N);
  let placed = 0;
  const isCand = (i) => !cat[i] && !elim[i];

  function placeCat(i) {
    if (cat[i]) return;
    cat[i] = true;
    placed++;
    const r = Math.floor(i / N);
    const c = i % N;
    const g = region[i];
    for (let cc = 0; cc < N; cc++) if (cc !== c) elim[r * N + cc] = true;
    for (let rr = 0; rr < N; rr++) if (rr !== r) elim[rr * N + c] = true;
    for (const j of byRegion[g]) if (j !== i) elim[j] = true;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < N && nc >= 0 && nc < N) {
          const j = nr * N + nc;
          if (j !== i) elim[j] = true;
        }
      }
    }
  }

  let changed = true;
  let safety = 0;
  while (changed && placed < N && safety++ < total * total) {
    changed = false;

    // R1 区域
    for (let g = 0; g < N; g++) {
      const cells = byRegion[g];
      if (cells.some((i) => cat[i])) continue;
      const cands = cells.filter(isCand);
      if (cands.length === 1) {
        placeCat(cands[0]);
        changed = true;
      } else if (cands.length === 0) {
        return null;
      }
    }
    // R2 行
    for (let r = 0; r < N; r++) {
      let has = false;
      const cands = [];
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        if (cat[i]) { has = true; break; }
        if (isCand(i)) cands.push(i);
      }
      if (has) continue;
      if (cands.length === 1) { placeCat(cands[0]); changed = true; }
      else if (cands.length === 0) return null;
    }
    // R3 列
    for (let c = 0; c < N; c++) {
      let has = false;
      const cands = [];
      for (let r = 0; r < N; r++) {
        const i = r * N + c;
        if (cat[i]) { has = true; break; }
        if (isCand(i)) cands.push(i);
      }
      if (has) continue;
      if (cands.length === 1) { placeCat(cands[0]); changed = true; }
      else if (cands.length === 0) return null;
    }

    if (changed || placed >= N) continue;

    // R4 限定法（仅在基础规则停滞时）
    for (let g = 0; g < N; g++) {
      const cells = byRegion[g];
      if (cells.some((i) => cat[i])) continue;
      const cands = cells.filter(isCand);
      if (cands.length < 2) continue;
      const rows = new Set(cands.map((i) => Math.floor(i / N)));
      const cols = new Set(cands.map((i) => i % N));
      if (rows.size === 1) {
        const r = [...rows][0];
        for (let c = 0; c < N; c++) {
          const i = r * N + c;
          if (isCand(i) && region[i] !== g) { elim[i] = true; changed = true; }
        }
      }
      if (cols.size === 1) {
        const c = [...cols][0];
        for (let r = 0; r < N; r++) {
          const i = r * N + c;
          if (isCand(i) && region[i] !== g) { elim[i] = true; changed = true; }
        }
      }
    }
    for (let r = 0; r < N; r++) {
      let has = false;
      const cands = [];
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        if (cat[i]) { has = true; break; }
        if (isCand(i)) cands.push(i);
      }
      if (has || cands.length < 2) continue;
      const regs = new Set(cands.map((i) => region[i]));
      if (regs.size === 1) {
        const g = [...regs][0];
        for (const i of byRegion[g]) {
          if (isCand(i) && Math.floor(i / N) !== r) { elim[i] = true; changed = true; }
        }
      }
    }
    for (let c = 0; c < N; c++) {
      let has = false;
      const cands = [];
      for (let r = 0; r < N; r++) {
        const i = r * N + c;
        if (cat[i]) { has = true; break; }
        if (isCand(i)) cands.push(i);
      }
      if (has || cands.length < 2) continue;
      const regs = new Set(cands.map((i) => region[i]));
      if (regs.size === 1) {
        const g = [...regs][0];
        for (const i of byRegion[g]) {
          if (isCand(i) && i % N !== c) { elim[i] = true; changed = true; }
        }
      }
    }
  }

  if (placed === N) {
    const out = [];
    for (let i = 0; i < total; i++) if (cat[i]) out.push(i);
    return out;
  }
  return null;
}
