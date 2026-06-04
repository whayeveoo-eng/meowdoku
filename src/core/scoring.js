// 玩家能力打分模型(Item-Response 风格)。详见 docs/design.md「能力打分」FR-M。
// 题目 = 一只猫(一个阶段),难度 = 解锁它所需策略层级 S1..S5(forceLayerOf)。
// 作答:clean 独立解出 / struggle 放错后解出 / hint 用提示。
// 持久化用聚合计数,主输出 = 每难度掌握度 + 段位(非单一总分,因 S1 题太多会灌高总分)。

const CREDIT = { clean: 1, struggle: 0.5, hint: 0 };
const TITLES = { 0: '未评级', 1: '新手', 2: '入门', 3: '进阶', 4: '高手', 5: '大师' };

export function emptyAbility() {
  const a = {};
  for (let d = 1; d <= 5; d++) a[d] = { clean: 0, struggle: 0, hint: 0 };
  return a;
}

// 记录一道题(d=1..5,outcome=clean/struggle/hint)。d<=0(超前/凭感觉)不计入。
export function recordItem(ability, d, outcome) {
  if (!(d >= 1 && d <= 5)) return ability;
  if (!ability[d]) ability[d] = { clean: 0, struggle: 0, hint: 0 };
  ability[d][outcome] = (ability[d][outcome] || 0) + 1;
  return ability;
}

export function scoreAbility(ability, { masterThreshold = 0.7, minSamples = 3 } = {}) {
  const mastery = {}, samples = {};
  for (let d = 1; d <= 5; d++) {
    const a = ability[d] || { clean: 0, struggle: 0, hint: 0 };
    const n = a.clean + a.struggle + a.hint;
    samples[d] = n;
    mastery[d] = n ? (a.clean * CREDIT.clean + a.struggle * CREDIT.struggle) / n : null;
  }
  // 段位 = 从 S1 起连续"达标(掌握度≥阈值且样本足)"的最高层级
  let rank = 0;
  for (let d = 1; d <= 5; d++) {
    if (mastery[d] != null && samples[d] >= minSamples && mastery[d] >= masterThreshold) rank = d;
    else break;
  }
  const next = Math.min(rank + 1, 5); // 下一个待突破层级
  // 综合分(次要):按难度值加权
  let got = 0, max = 0;
  for (let d = 1; d <= 5; d++) {
    const a = ability[d] || {};
    const n = (a.clean || 0) + (a.struggle || 0) + (a.hint || 0);
    got += d * ((a.clean || 0) + 0.5 * (a.struggle || 0));
    max += d * n;
  }
  const score = max ? Math.round((100 * got) / max) : 0;
  return { mastery, samples, rank, title: TITLES[rank], next, score };
}

export const STRATEGY_NAMES = { 1: '单候选', 2: '限定', 3: '相邻锁定', 4: 'Hall子集', 5: 'Hall子集+' };
