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

// 人类式约束传播求解器（分层 L1–L4，只用“可靠”推导，不猜、不回溯）。详见 docs/solving.md。
// 层级按人类直觉代价从低到高排:
//   L1 单候选：某区域/行/列只剩 1 候选 → 落猫（落子传播排除其行/列/区域/九宫格）
//   L2 限定/指向 n=1：某色候选全在 1 行/列 → 该行/列其它色候选排除；某行/列候选全属 1 色 → 该色别处候选排除
//   L3 相邻锁定（直觉、常用）：与某色全部候选都相邻的格 → 必非猫，排除
//   L4 Hall 子集 n≥2（抽象、罕见）：n 个 subject 的候选特征并集恰好 = n → 其余 subject 在这些特征上的候选排除（4 个二部视角）
// 用作生成过滤 + 难度评级。实测:相邻锁定很常用(基础)，Hall n≥2 才是真正的难点。

const SUBSET_CAP = 3; // Hall 子集枚举的最大 n（n≤3 足以覆盖绝大多数；控制开销）

function kingNeighbors(idx, N) {
  const r = Math.floor(idx / N);
  const c = idx % N;
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc);
    }
  }
  return out;
}

function* combinations(arr, k, start = 0, acc = []) {
  if (acc.length === k) {
    yield acc;
    return;
  }
  for (let i = start; i < arr.length; i++) {
    acc.push(arr[i]);
    yield* combinations(arr, k, i + 1, acc);
    acc.pop();
  }
}

// 运行 L1..maxLayer 的约束传播到不动点。返回 { placed, cat }。
function propagate(region, N, maxLayer, seedCats = []) {
  const total = N * N;
  const cat = new Array(total).fill(false);
  const elim = new Array(total).fill(false);
  const byRegion = cellsByRegion(region, N);
  let placed = 0;
  const isCand = (i) => !cat[i] && !elim[i];

  function place(i) {
    if (cat[i]) return;
    cat[i] = true;
    placed++;
    const r = Math.floor(i / N);
    const c = i % N;
    const g = region[i];
    const kill = (j) => { if (j !== i && isCand(j)) elim[j] = true; };
    for (let x = 0; x < N; x++) { kill(r * N + x); kill(x * N + c); }
    for (const j of byRegion[g]) kill(j);
    for (const j of kingNeighbors(i, N)) kill(j);
  }
  const colCands = (g) => byRegion[g].filter(isCand);
  const rowCands = (r) => { const o = []; for (let c = 0; c < N; c++) if (isCand(r * N + c)) o.push(r * N + c); return o; };
  const colCells = (c) => { const o = []; for (let r = 0; r < N; r++) if (isCand(r * N + c)) o.push(r * N + c); return o; };
  const rowHasCat = (r) => { for (let c = 0; c < N; c++) if (cat[r * N + c]) return true; return false; };
  const colHasCat = (c) => { for (let r = 0; r < N; r++) if (cat[r * N + c]) return true; return false; };

  // L1：单候选落子。返回是否落子；遇矛盾返回 'dead'。
  function runSingles() {
    let did = false;
    for (let g = 0; g < N; g++) {
      if (byRegion[g].some((i) => cat[i])) continue;
      const cd = colCands(g);
      if (cd.length === 1) { place(cd[0]); did = true; } else if (cd.length === 0) return 'dead';
    }
    for (let r = 0; r < N; r++) {
      if (rowHasCat(r)) continue;
      const cd = rowCands(r);
      if (cd.length === 1) { place(cd[0]); did = true; } else if (cd.length === 0) return 'dead';
    }
    for (let c = 0; c < N; c++) {
      if (colHasCat(c)) continue;
      const cd = colCells(c);
      if (cd.length === 1) { place(cd[0]); did = true; } else if (cd.length === 0) return 'dead';
    }
    return did;
  }

  // Hall 子集（sizeLo..sizeHi）。size=1 即限定/指向；size≥2 即子集。返回是否排除了候选。
  function runHall(sizeLo, sizeHi) {
    let did = false;
    const elimIf = (pred) => { for (let i = 0; i < total; i++) if (isCand(i) && pred(i)) { elim[i] = true; did = true; } };
    const colors = []; for (let g = 0; g < N; g++) if (!byRegion[g].some((i) => cat[i]) && colCands(g).length) colors.push(g);
    const rows = []; for (let r = 0; r < N; r++) if (!rowHasCat(r) && rowCands(r).length) rows.push(r);
    const cols = []; for (let c = 0; c < N; c++) if (!colHasCat(c) && colCells(c).length) cols.push(c);

    const view = (subjects, featOf, eliminate) => {
      for (let size = sizeLo; size <= Math.min(sizeHi, subjects.length - 1); size++) {
        for (const cb of combinations(subjects, size)) {
          const u = new Set();
          for (const s of cb) for (const f of featOf(s)) u.add(f);
          if (u.size === size) eliminate(new Set(cb), u);
        }
      }
    };
    // V1 颜色×行
    view(colors, (g) => colCands(g).map((i) => Math.floor(i / N)), (ids, rs) => elimIf((i) => rs.has(Math.floor(i / N)) && !ids.has(region[i])));
    // V2 颜色×列
    view(colors, (g) => colCands(g).map((i) => i % N), (ids, cs) => elimIf((i) => cs.has(i % N) && !ids.has(region[i])));
    // V3 行×颜色
    view(rows, (r) => rowCands(r).map((i) => region[i]), (ids, gs) => elimIf((i) => gs.has(region[i]) && !ids.has(Math.floor(i / N))));
    // V4 列×颜色
    view(cols, (c) => colCells(c).map((i) => region[i]), (ids, gs) => elimIf((i) => gs.has(region[i]) && !ids.has(i % N)));
    return did;
  }

  // L4：相邻锁定。返回是否排除了候选。
  function runAdjacency() {
    let did = false;
    for (let g = 0; g < N; g++) {
      const cd = colCands(g);
      if (cd.length < 2) continue;
      let inter = null;
      for (const cell of cd) {
        const ns = new Set(kingNeighbors(cell, N));
        inter = inter ? new Set([...inter].filter((x) => ns.has(x))) : ns;
      }
      for (const j of inter) if (isCand(j)) { elim[j] = true; did = true; }
    }
    return did;
  }

  for (const s of seedCats) place(s); // 预置已知猫(玩家当前局面),从此状态继续推

  // 层级(按人类直觉的代价排序):
  //   L1 单候选 → L2 限定/指向(n=1) → L3 相邻锁定(直觉、常用) → L4 Hall 子集 n≥2(抽象、罕见)
  let guard = 0;
  while (placed < N && guard++ < total * total) {
    const s = runSingles();
    if (s === 'dead') break;
    if (s) continue;
    if (maxLayer >= 2 && runHall(1, 1)) continue; // 限定/指向
    if (maxLayer >= 3 && runAdjacency()) continue; // 相邻锁定
    if (maxLayer >= 4 && runHall(2, SUBSET_CAP)) continue; // Hall 子集 n≥2
    break; // 无任何进展 → 停滞
  }
  return { placed, cat };
}

// 纯逻辑（L1–L4）能否完全解出。返回猫格数组或 null（停滞→需要假设）。
export function logicalSolve(region, N) {
  const { placed, cat } = propagate(region, N, 4);
  if (placed !== N) return null;
  const out = [];
  for (let i = 0; i < cat.length; i++) if (cat[i]) out.push(i);
  return out;
}

// 难度评级 = 解出该关所需的最高层级（1..4）；0 = 即便 L4 也解不出（需假设，生成器拒绝）。
export function rateLevel(region, N) {
  for (let L = 1; L <= 4; L++) {
    if (propagate(region, N, L).placed === N) return L;
  }
  return 0;
}

// 给定玩家当前已放的猫 placedCats,目标格 cell 在此局面下"被强制确定"所需的最低策略层级(1..4)。
// 返回 0 = 即便 L4 也未被强制(玩家在它还没被逼出来时就放了,属"超前/凭感觉")。
// 用作能力打分:玩家放对一只猫 = 答对一道难度为该层级的"题"。
export function forceLayerOf(region, N, placedCats, cell) {
  for (let L = 1; L <= 4; L++) {
    if (propagate(region, N, L, placedCats).cat[cell]) return L;
  }
  return 0;
}
