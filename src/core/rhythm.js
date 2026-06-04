// 关内节奏分析(运行时可用):最简优先求解→每只猫一个阶段难度(策略编号 S1..S5);形状评分。
// 编号/指标/形状判据见 docs/design.md §5.3。被 recommend.js(练习关形状优选)与本地工具复用。
import { cellsByRegion } from './board.js';

function* combos(a, k, s = 0, acc = []) { if (acc.length === k) { yield acc; return; } for (let i = s; i < a.length; i++) { acc.push(a[i]); yield* combos(a, k, i + 1, acc); acc.pop(); } }

// 返回 { seq, solved }:seq = 每只猫的阶段难度编号(1..5),按解出顺序。
export function analyzeStages(region, N) {
  const byRegion = cellsByRegion(region, N);
  const cat = Array(N * N).fill(false), elim = Array(N * N).fill(false);
  const isC = i => !cat[i] && !elim[i];
  const king = i => { const r = i / N | 0, c = i % N, o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const nr = r + dr, nc = c + dc; if (nr >= 0 && nr < N && nc >= 0 && nc < N) o.push(nr * N + nc); } return o; };
  const place = i => { cat[i] = true; const r = i / N | 0, c = i % N, g = region[i]; const k = j => { if (j !== i && isC(j)) elim[j] = true; }; for (let x = 0; x < N; x++) { k(r * N + x); k(x * N + c); } for (const j of byRegion[g]) k(j); for (const j of king(i)) k(j); };
  const cC = g => byRegion[g].filter(isC), rC = r => { const o = []; for (let c = 0; c < N; c++) if (isC(r * N + c)) o.push(r * N + c); return o; }, kC = c => { const o = []; for (let r = 0; r < N; r++) if (isC(r * N + c)) o.push(r * N + c); return o; };
  const rCat = r => { for (let c = 0; c < N; c++) if (cat[r * N + c]) return 1; return 0; }, cCat = c => { for (let r = 0; r < N; r++) if (cat[r * N + c]) return 1; return 0; };
  function L1() { for (let g = 0; g < N; g++) { if (byRegion[g].some(i => cat[i])) continue; const d = cC(g); if (d.length === 1) return d[0]; } for (let r = 0; r < N; r++) { if (rCat(r)) continue; const d = rC(r); if (d.length === 1) return d[0]; } for (let c = 0; c < N; c++) { if (cCat(c)) continue; const d = kC(c); if (d.length === 1) return d[0]; } return -1; }
  function hall(lo, hi) { let did = 0; const ei = p => { for (let i = 0; i < N * N; i++) if (isC(i) && p(i)) { elim[i] = true; did++; } }; const cs = []; for (let g = 0; g < N; g++) if (!byRegion[g].some(i => cat[i]) && cC(g).length) cs.push(g); const rs = []; for (let r = 0; r < N; r++) if (!rCat(r) && rC(r).length) rs.push(r); const ks = []; for (let c = 0; c < N; c++) if (!cCat(c) && kC(c).length) ks.push(c); const v = (sub, f, e) => { for (let z = lo; z <= Math.min(hi, sub.length - 1); z++) for (const cb of combos(sub, z)) { const u = new Set(); cb.forEach(s => f(s).forEach(x => u.add(x))); if (u.size === z) e(new Set(cb), u); } }; v(cs, g => cC(g).map(i => i / N | 0), (id, R) => ei(i => R.has(i / N | 0) && !id.has(region[i]))); v(cs, g => cC(g).map(i => i % N), (id, K) => ei(i => K.has(i % N) && !id.has(region[i]))); v(rs, r => rC(r).map(i => region[i]), (id, G) => ei(i => G.has(region[i]) && !id.has(i / N | 0))); v(ks, c => kC(c).map(i => region[i]), (id, G) => ei(i => G.has(region[i]) && !id.has(i % N))); return did; }
  function adj() { let did = 0; for (let g = 0; g < N; g++) { const d = cC(g); if (d.length < 2) continue; let it = null; for (const ce of d) { const ns = new Set(king(ce)); it = it ? new Set([...it].filter(x => ns.has(x))) : ns; } for (const j of it) if (isC(j)) { elim[j] = true; did++; } } return did; }

  const seq = []; let stageMax = 0, guard = 0;
  while (cat.filter(Boolean).length < N && guard++ < 500) {
    const i = L1();
    if (i >= 0) { place(i); seq.push(Math.max(1, stageMax)); stageMax = 0; continue; }
    if (hall(1, 1)) { stageMax = Math.max(stageMax, 2); continue; }
    if (adj()) { stageMax = Math.max(stageMax, 3); continue; }
    if (hall(2, 2)) { stageMax = Math.max(stageMax, 4); continue; }
    if (hall(3, 3)) { stageMax = Math.max(stageMax, 5); continue; }
    break;
  }
  return { seq, solved: cat.filter(Boolean).length === N };
}

export function metrics(seq) {
  const peak = Math.max(...seq);
  const peakAt = seq.indexOf(peak) + 1;
  const nHard = seq.filter(s => s >= 3).length;
  let tail = 0; for (let i = seq.length - 1; i >= 0 && seq[i] === 1; i--) tail++;
  let shape;
  if (peak === 1) shape = '教学'; else if (peak === 2) shape = '平缓'; else shape = nHard <= 1 ? '单峰' : '多峰';
  return { peak, peakAt, nHard, tail, shape, peakEarly: peak >= 3 && peakAt === 1, longTail: peak >= 3 && tail >= Math.ceil(seq.length / 2) };
}

// 形状评分(越高越好);教学/平缓关返回 0(形状不重要)。判据见 design.md §5.3。
export function shapeScore(seq) {
  const N = seq.length;
  const m = metrics(seq);
  if (m.peak <= 2) return 0;
  let s = 0;
  if (m.peakAt === 1) s -= 100;
  s += Math.min(m.peakAt - 1, 3) * 4;
  s -= m.tail * 2;
  s -= Math.max(0, m.nHard - 1) * 3;
  if (m.peakAt === N) s -= 4;
  return s;
}
