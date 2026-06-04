// 自适应推荐（独立"为你推荐/练习"模式）。详见 docs/design.md FR-M6。
// 三选(巩固/进阶/挑战) + 形状优选 + DDA(磕绊/用提示则推荐降档巩固)。
import { generateLevel } from './generator.js';
import { makeRng, randomSeed } from './rng.js';
import { levelStars } from '../data/constants.js';
import { analyzeStages, shapeScore } from './rhythm.js';

const STRAT = { 1: '单候选', 2: '限定', 3: '相邻锁定', 4: 'Hall子集', 5: 'Hall子集+' };

// 策略级 → 目标 {尺寸 N, 技巧层级 tier}。难度越高:盘更大 + 技巧更高。
function targetForStrat(strat) {
  const s = Math.max(1, Math.min(5, strat));
  const tier = s <= 2 ? s : s === 3 ? 3 : 4;
  const n = Math.max(5, Math.min(10, 4 + s)); // s=1→5 … s=5→9
  return { strat: s, n, tier };
}

// 三选:基于能力前沿 f(=段位+1)给「巩固(f-1) / 进阶(f) / 挑战(f+1)」三个目标。
export function pickThree(report) {
  const f = Math.max(1, Math.min(5, report.next || 1));
  const mk = (key, strat) => {
    const t = targetForStrat(strat);
    return { key, ...t, label: STRAT[t.strat], stars: levelStars(t.n, t.tier) };
  };
  return [mk('巩固', f - 1), mk('进阶', f), mk('挑战', f + 1)];
}

// DDA:据上一关表现推荐哪一档(highlight,玩家仍可自选)。
//   首次/无记录 → 进阶;上关磕绊或用提示 → 巩固;上关利落(clean) → 挑战。
export function recommendKey(lastStruggled) {
  if (lastStruggled == null) return '进阶';
  return lastStruggled ? '巩固' : '挑战';
}

// 现生成一关匹配 (n, tier),并在命中目标层级的候选里**挑形状最好**的。
export function generateMatched(n, tier, { want = 8, maxSeeds = 140 } = {}) {
  const cands = [];
  let closest = null;
  for (let k = 0; k < maxSeeds && cands.length < want; k++) {
    const seed = randomSeed();
    const lv = generateLevel(n, makeRng(seed));
    if (lv.fallback) continue;
    const d = Math.abs(lv.maxLayer - tier);
    if (!closest || d < closest.d) closest = { n, seed, maxLayer: lv.maxLayer, d };
    if (lv.maxLayer === tier) cands.push({ n, seed, maxLayer: tier, region: lv.region });
  }
  if (cands.length) {
    return cands
      .map((c) => ({ ...c, sc: shapeScore(analyzeStages(c.region, n).seq) }))
      .sort((a, b) => b.sc - a.sc)[0];
  }
  return closest || { n, seed: randomSeed(), maxLayer: 0 };
}
