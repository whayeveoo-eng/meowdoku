// 盘面纯函数工具：坐标换算、邻接、按区域分组、冲突检测、胜负判定。无可变状态。
// 盘面均以扁平数组表示，index = row * N + col。

import { CELL } from '../data/constants.js';

export function indexOf(N, row, col) {
  return row * N + col;
}

export function rowColOf(N, index) {
  return [Math.floor(index / N), index % N];
}

// 国王步邻接（含对角）：两格是否落在彼此的九宫格内（且不是同一格）。
export function isKingAdjacent(N, a, b) {
  if (a === b) return false;
  const ar = Math.floor(a / N);
  const ac = a % N;
  const br = Math.floor(b / N);
  const bc = b % N;
  return Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1;
}

// 放下一只小猫后，必然不能再有猫的格子：整行、整列、九宫格邻居，以及同色区域其它格。
// 传入 region 时一并排除同色区域（每色仅一只猫）。返回 cell 索引数组（可能含重复，调用方用 Set 去重）。
export function eliminatedCells(N, idx, region) {
  const r = Math.floor(idx / N);
  const c = idx % N;
  const out = [];
  for (let cc = 0; cc < N; cc++) if (cc !== c) out.push(r * N + cc); // 同行
  for (let rr = 0; rr < N; rr++) if (rr !== r) out.push(rr * N + c); // 同列
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N) out.push(nr * N + nc); // 九宫格
    }
  }
  if (region) {
    const g = region[idx];
    for (let j = 0; j < region.length; j++) if (j !== idx && region[j] === g) out.push(j); // 同色区域
  }
  return out;
}

// region: 长度 N*N 的数组，值为颜色区域索引 0..N-1。
// 返回 region 索引 → 该区所有 cell 索引（按区域大小升序便于求解剪枝时用）。
export function cellsByRegion(region, N) {
  const map = Array.from({ length: N }, () => []);
  for (let i = 0; i < region.length; i++) map[region[i]].push(i);
  return map;
}

// 找出所有处于冲突中的小猫（同行/同列/同区/相邻），返回 Set<cellIndex>。
export function findConflicts(cells, region, N) {
  const cats = [];
  for (let i = 0; i < cells.length; i++) {
    if (cells[i] === CELL.CAT) cats.push(i);
  }
  const conflict = new Set();

  const groupBy = (keyOf) => {
    const buckets = new Map();
    for (const i of cats) {
      const k = keyOf(i);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(i);
    }
    for (const list of buckets.values()) {
      if (list.length > 1) list.forEach((i) => conflict.add(i));
    }
  };

  groupBy((i) => 'r' + Math.floor(i / N)); // 同行
  groupBy((i) => 'c' + (i % N)); // 同列
  groupBy((i) => 'g' + region[i]); // 同色区域

  // 相邻（国王步）
  for (let a = 0; a < cats.length; a++) {
    for (let b = a + 1; b < cats.length; b++) {
      if (isKingAdjacent(N, cats[a], cats[b])) {
        conflict.add(cats[a]);
        conflict.add(cats[b]);
      }
    }
  }

  return conflict;
}

export function catCount(cells) {
  let n = 0;
  for (const v of cells) if (v === CELL.CAT) n++;
  return n;
}

// 胜利：恰好 N 只小猫且零冲突。
// （N 只 + 同行/列/区无重复 → 每行/列/区恰好 1 只；相邻约束也满足。）
export function isSolved(cells, region, N) {
  return catCount(cells) === N && findConflicts(cells, region, N).size === 0;
}

// 校验一个区域划分是否合法：恰好 N 个区，每区非空且四连通（同色至少一条边相邻）。
export function regionsValid(region, N) {
  const map = cellsByRegion(region, N);
  for (const cells of map) {
    if (cells.length === 0) return false;
    // BFS 连通性（四邻）
    const set = new Set(cells);
    const seen = new Set([cells[0]]);
    const stack = [cells[0]];
    while (stack.length) {
      const cur = stack.pop();
      const r = Math.floor(cur / N);
      const c = cur % N;
      const nbrs = [];
      if (r > 0) nbrs.push(cur - N);
      if (r < N - 1) nbrs.push(cur + N);
      if (c > 0) nbrs.push(cur - 1);
      if (c < N - 1) nbrs.push(cur + 1);
      for (const nb of nbrs) {
        if (set.has(nb) && !seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    if (seen.size !== cells.length) return false;
  }
  return true;
}
