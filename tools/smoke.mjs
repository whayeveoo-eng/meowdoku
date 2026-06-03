// Meowdoku 生成器冒烟测试。直接 import 纯核心模块（无浏览器依赖）。
// 用法：node tools/smoke.mjs [每个尺寸局数=12]
//
// 校验每关：① 区域划分合法（N 个区、各非空、四连通）；② 唯一解；
// ③ 生成时的 solution 满足全部规则（每行/列/区一只、互不相邻）；
// ④ 求得的唯一解 === solution；⑤ 无 fallback（即真的找到了唯一解）。

import { generateLevel } from '../src/core/generator.js';
import { countSolutions, findSolution, logicalSolve } from '../src/core/solver.js';
import { regionsValid, findConflicts, isKingAdjacent } from '../src/core/board.js';
import { makeRng } from '../src/core/rng.js';
import { SIZES, CELL } from '../src/data/constants.js';

const perSize = Number(process.argv[2]) || 12;
let failures = 0;
let total = 0;

function check(cond, msg) {
  if (!cond) {
    failures++;
    console.error('  ✗', msg);
  }
}

// 把 solution（cell 索引数组）转成三态 cells 数组，复用 findConflicts。
function solutionToCells(solution, N) {
  const cells = new Array(N * N).fill(CELL.EMPTY);
  for (const c of solution) cells[c] = CELL.CAT;
  return cells;
}

for (const N of SIZES) {
  const durations = [];
  const attemptsArr = [];
  let fallbacks = 0;

  for (let k = 0; k < perSize; k++) {
    total++;
    const seed = 7000 + N * 131 + k * 17;
    const rng = makeRng(seed);
    const t0 = process.hrtime.bigint();
    const level = generateLevel(N, rng);
    const t1 = process.hrtime.bigint();
    durations.push(Number(t1 - t0) / 1e6);
    attemptsArr.push(level.attempts);
    if (level.fallback) fallbacks++;

    const { region, solution } = level;

    // ① 区域合法
    check(regionsValid(region, N), `N=${N}#${k} 区域划分非法`);
    check(new Set(region).size === N, `N=${N}#${k} 颜色数 != N`);

    // ② 唯一解
    check(countSolutions(region, N, 2) === 1, `N=${N}#${k} 解不唯一`);

    // ③ solution 满足规则
    const cells = solutionToCells(solution, N);
    check(solution.length === N, `N=${N}#${k} solution 猫数 != N`);
    check(findConflicts(cells, region, N).size === 0, `N=${N}#${k} solution 自身有冲突`);
    const rows = new Set(solution.map((i) => Math.floor(i / N)));
    const cols = new Set(solution.map((i) => i % N));
    const regs = new Set(solution.map((i) => region[i]));
    check(rows.size === N && cols.size === N && regs.size === N, `N=${N}#${k} 行/列/区未覆盖全`);
    let adj = false;
    for (let a = 0; a < solution.length; a++)
      for (let b = a + 1; b < solution.length; b++)
        if (isKingAdjacent(N, solution[a], solution[b])) adj = true;
    check(!adj, `N=${N}#${k} solution 有相邻猫`);

    // ④ 求解结果 === solution（集合相等）
    const solved = findSolution(region, N);
    check(solved && new Set(solved).size === N, `N=${N}#${k} 无法求解`);
    if (solved) {
      const a = new Set(solution);
      check(solved.every((c) => a.has(c)), `N=${N}#${k} 求解结果 != solution`);
    }

    // ⑤ 纯逻辑可解（无需猜）：logicalSolve 能完全解出，且 === solution
    const logical = logicalSolve(region, N);
    check(logical && logical.length === N, `N=${N}#${k} 非纯逻辑可解（需要猜）`);
    if (logical) {
      const a = new Set(solution);
      check(logical.every((c) => a.has(c)), `N=${N}#${k} 逻辑解 != solution`);
    }

    // ⑥ 不应 fallback
    check(!level.fallback, `N=${N}#${k} 触发 fallback（未找到逻辑可解关卡）`);
  }

  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  const max = Math.max(...durations);
  const avgAtt = attemptsArr.reduce((a, b) => a + b, 0) / attemptsArr.length;
  console.log(
    `${N}×${N}  生成 avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms  唯一性尝试 avg=${avgAtt.toFixed(1)}${fallbacks ? `  ⚠️fallback=${fallbacks}` : ''}`
  );
}

console.log('');
if (failures === 0) {
  console.log(`✅ 全部通过：${total} 关 × 多项校验`);
  process.exit(0);
} else {
  console.error(`❌ ${failures} 项失败 / ${total} 关`);
  process.exit(1);
}
