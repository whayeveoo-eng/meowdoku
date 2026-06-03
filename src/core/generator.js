// 关卡生成。
// ① 生成一个合法小猫布局（每行/列一只，相邻行列差≥2 → 互不相邻）。
// ② 从每只小猫为种子，随机生长成 N 个四连通同色区域（每区恰好 1 只猫）。
// ③ 唯一性精修：反复找“与目标不同的替代解”，把该替代解里某个错误格从其区域划给邻区，
//    从而破坏这个替代解；目标解的猫格永不移动，故目标解始终保持合法。收敛到唯一解。
// 纯随机生长 + 拒绝在大 N 上几乎不可能唯一，精修是关键。

import { countSolutions, findAltSolution, logicalSolve } from './solver.js';
import { regionsValid } from './board.js';
import { shuffle } from './rng.js';

// ① 合法布局 = 列的排列 p[r]，相邻行 |p[r]-p[r+1]| >= 2。
function generatePlacement(N, rng) {
  const p = new Array(N).fill(-1);
  const usedCol = new Array(N).fill(false);

  function rec(r) {
    if (r === N) return true;
    const cols = shuffle(
      Array.from({ length: N }, (_, c) => c),
      rng
    );
    for (const c of cols) {
      if (usedCol[c]) continue;
      if (r > 0 && Math.abs(c - p[r - 1]) < 2) continue;
      p[r] = c;
      usedCol[c] = true;
      if (rec(r + 1)) return true;
      usedCol[c] = false;
      p[r] = -1;
    }
    return false;
  }

  return rec(0) ? p : null;
}

function neighbors(idx, N) {
  const r = Math.floor(idx / N);
  const c = idx % N;
  const out = [];
  if (r > 0) out.push(idx - N);
  if (r < N - 1) out.push(idx + N);
  if (c > 0) out.push(idx - 1);
  if (c < N - 1) out.push(idx + 1);
  return out;
}

// ② 多源随机生长，保证四连通 + 每区恰好一只猫。
function growRegions(N, catCells, rng) {
  const total = N * N;
  const region = new Array(total).fill(-1);
  catCells.forEach((cell, gi) => {
    region[cell] = gi;
  });
  let remaining = total - catCells.length;

  while (remaining > 0) {
    const frontier = [];
    for (let i = 0; i < total; i++) {
      if (region[i] !== -1) continue;
      const assignedNbrs = neighbors(i, N).filter((nb) => region[nb] !== -1);
      if (assignedNbrs.length) frontier.push([i, assignedNbrs]);
    }
    if (!frontier.length) break;
    const [cell, assignedNbrs] = frontier[Math.floor(rng() * frontier.length)];
    const pick = assignedNbrs[Math.floor(rng() * assignedNbrs.length)];
    region[cell] = region[pick];
    remaining--;
  }

  return region;
}

// 删去某格后，区域 g 是否仍四连通且非空。
function stillConnectedWithout(region, N, g, removeCell) {
  const cells = [];
  for (let i = 0; i < region.length; i++) {
    if (region[i] === g && i !== removeCell) cells.push(i);
  }
  if (cells.length === 0) return false;
  const set = new Set(cells);
  const seen = new Set([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const cur = stack.pop();
    for (const nb of neighbors(cur, N)) {
      if (set.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        stack.push(nb);
      }
    }
  }
  return seen.size === cells.length;
}

// ③ 唯一性精修。region 原地修改。targetCells = 目标解猫格数组。
// 成功（变唯一）返回 true；卡住返回 false（调用方重试新划分）。
function refineToUnique(region, N, targetCells, rng) {
  const targetSet = new Set(targetCells);
  // region -> 该区目标猫格
  const targetOfRegion = new Array(N).fill(-1);
  for (const cell of targetCells) targetOfRegion[region[cell]] = cell;

  let guard = 0;
  const maxGuard = N * N * 8;
  while (guard++ < maxGuard) {
    const alt = findAltSolution(region, N, targetSet);
    if (!alt) return true; // 已唯一

    // alt 中与目标不同的“错误格”：它们属于某区，但不是该区目标猫格
    const wrongCells = alt.filter((cell) => !targetSet.has(cell));
    let moved = false;
    for (const q of shuffle(wrongCells, rng)) {
      const g = region[q];
      if (q === targetOfRegion[g]) continue; // 安全保护：绝不动目标猫
      // q 的邻居中、属于其它区的候选目标区
      const altRegions = shuffle(
        [...new Set(neighbors(q, N).map((nb) => region[nb]).filter((gg) => gg !== g))],
        rng
      );
      for (const gPrime of altRegions) {
        if (stillConnectedWithout(region, N, g, q)) {
          region[q] = gPrime; // 把 q 划给邻区，破坏这个替代解
          moved = true;
          break;
        }
      }
      if (moved) break;
    }
    if (!moved) return false; // 找不到可移动格，放弃这张划分
  }
  return false;
}

// 生成一关：返回 { region, N, solution, attempts }。
// 默认 requireLogical=true：只接受“纯逻辑可解、无需猜”的关卡（唯一解的更强约束）。
export function generateLevel(N, rng, opts = {}) {
  const placementTries = opts.placementTries || 120;
  const regionTries = opts.regionTries || 24;
  const requireLogical = opts.requireLogical !== false;
  let attempts = 0;
  // 记录“已唯一但需要猜”的候选，作为找不到逻辑可解时的兜底。
  let uniqueFallback = null;

  for (let pt = 0; pt < placementTries; pt++) {
    const p = generatePlacement(N, rng);
    if (!p) continue;
    const catCells = p.map((c, r) => r * N + c);

    for (let rt = 0; rt < regionTries; rt++) {
      attempts++;
      const region = growRegions(N, catCells, rng);
      if (!regionsValid(region, N)) continue;
      if (!refineToUnique(region, N, catCells, rng)) continue;
      if (!regionsValid(region, N) || countSolutions(region, N, 2) !== 1) continue;

      if (!requireLogical) {
        return { region, N, solution: catCells.slice(), attempts };
      }
      // 纯逻辑可解检验：能完全推出即可（推导可靠 → 解唯一且无需猜）。
      const logical = logicalSolve(region, N);
      if (logical && logical.length === N) {
        return { region, N, solution: catCells.slice(), attempts };
      }
      if (!uniqueFallback) uniqueFallback = { region: region.slice(), solution: catCells.slice() };
    }
  }

  // 兜底：用一个“唯一但可能需要猜”的关卡（极少触发），保证总能开局。
  if (uniqueFallback) {
    return { ...uniqueFallback, N, attempts, fallback: true };
  }
  const p = generatePlacement(N, rng) || [];
  const catCells = p.map((c, r) => r * N + c);
  const region = growRegions(N, catCells, rng);
  return { region, N, solution: catCells.slice(), attempts, fallback: true };
}
