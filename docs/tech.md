# Meowdoku · 技术文档

## 技术选型

- 纯前端，零构建：ES Module + Canvas（棋盘）+ DOM（控制层），`<script type="module">` 直接加载。
- 无第三方依赖。`python3 -m http.server` 本地起、可直接发 GitHub Pages。
- 棋盘走 Canvas（区域上色 + 高亮 + 特效好做），尺寸选择 / 按钮 / HUD / 弹层走 DOM。

## 目录结构

```
Meowdoku/
  index.html              # 布局 + CSS + 入口
  src/
    main.js               # canvas / 循环 / 输入 / DOM / 测试钩子
    core/
      rng.js              # mulberry32 可种子随机 + shuffle
      board.js            # 坐标/邻接/按区域分组/冲突/胜负/区域合法性 纯函数
      solver.js           # 约束求解：countSolutions / findSolution / findAltSolution / logicalSolve(无需猜判定)
      generator.js        # 合法布局 → 区域生长 → 唯一性精修 → 逻辑可解过滤
      game.js             # 状态机：校验放子/三态循环/血量/撤销/清空/提示/胜负失败 + 事件
      events.js           # 极简事件总线
      stats.js            # 用时/步数/冲突修正/提示
    render/
      shape.js            # 圆角瓷砖几何 tileRect / roundRectPath（grid/cells/effects 共用）
      grid.js             # 圆角瓷砖上色（瓷砖间留缝、无格线/边界）
      cells.js            # 冲突底纹 + 奶牛猫 drawCat + ✕ 标记 + 选中描边
      effects.js          # 放对脉冲 / 放错闪红 / 通关爪雨（随 N 适配）
      ui.js               # DOM：尺寸选择/HUD/规则药丸/工具/弹层/吉祥物
    data/
      constants.js        # 尺寸/三态/开关/区域配色/主题
  docs/                   # design / tech / art / test / changelog
  tools/
    smoke.mjs             # node 生成器冒烟测试（唯一解/合法/规则/耗时）
  assets/                 # images / audio / fonts（预留）
```

## 规则的形式化

设棋盘 N×N，`index = row*N + col`。`region[i] ∈ 0..N-1` 为该格颜色区域。
解 = 选 N 格放猫，满足：

- 每行恰好 1 只、每列恰好 1 只、每个区域恰好 1 只；
- 任意两只猫不满足国王步邻接（`|Δrow|≤1 且 |Δcol|≤1`）。

## 数据表示

- `state.region`：长度 N*N，颜色区域索引。
- `state.cells`：长度 N*N，`CELL.EMPTY(0) / MARK(1) / CAT(2) / WRONG(3 放错留下的红 ✕)`。
- `state.solution`：唯一解的猫格 cell 索引数组（长度 N），用于提示。
- `state.conflicts`：`Set<cellIndex>`，每次操作后 `recompute()` 重算。
- `state.autoMarks`：`Set<cellIndex>`，由所有**无冲突**的猫派生的自动排除格（行/列/九宫格/同色区域），`recompute()` 重算；渲染时与手动 ✕ 合并显示，移走猫则自动消失。
- `state.autoEliminate`：自动排除开关（玩家偏好，`setAutoEliminate` 切换，`localStorage` 持久化，newGame 不重置）。
- `state.solutionSet`：`Set<cellIndex>`，唯一解猫格，O(1) 校验放子。
- `state.hp` / `state.maxHp`：当前 / 最大血量（默认 3）。
- `state.status`：`idle | playing | won | lost`。

## 模块职责

| 模块 | 职责 |
| --- | --- |
| `main.js` | Canvas 自适应（CSS 显示尺寸 + 逻辑 900 坐标）、rAF 渲染循环、指针/键盘输入、DOM 装配、`window.__meowdoku` 测试钩子 |
| `solver.js` | `countSolutions` 唯一性；`findSolution` 求一解；`findAltSolution` 找替代解供精修；`logicalSolve(region,N)` 人类式推导，全解→无需猜 |
| `generator.js` | `generatePlacement` 合法布局；`growRegions` 多源生长；`refineToUnique` 唯一性精修；`generateLevel({requireLogical})` 串起来 + 逻辑过滤 + 兜底 |
| `game.js` | 唯一可变状态源；`cycleCell` 三态循环；`attemptCat` 校验放子（错误扣血不落子）；血量/胜负失败；撤销栈记录 (index, prev, next) |
| `board.js` | 无状态工具：`isKingAdjacent` / `cellsByRegion` / `findConflicts` / `isSolved` / `regionsValid` / `eliminatedCells(N,idx,region)`(行+列+九宫格+同色区域) |
| `render/*` | 只读 `state` 绘制，不改状态 |

## 关键算法

### 求解 / 唯一性

按区域求解（每区放一只），区域按 cell 数升序优先（最受限先填，剪枝最强）；用 `usedRow/usedCol` + 已放置列表的国王步检测剪枝。`countSolutions` 数到 2 即停做唯一性判定。

### 生成（核心难点：唯一解）

1. **合法布局**：列的排列 `p[r]`，相邻行 `|p[r]-p[r+1]| ≥ 2`（保证不相邻；非相邻行天然不冲突）。
2. **区域生长**：以每只猫为种子，反复把“与已分配区四邻接的未分配格”随机划给某相邻区 → N 个四连通区，每区恰好 1 只猫，大小天然参差。
3. **唯一性精修**（关键）：纯随机划分在大 N 上几乎不唯一。于是反复 `findAltSolution` 找替代解，取其中一个“错误格 q”（属于区 g 但非 g 的目标猫），把 q 划给某邻区 g′——这会破坏该替代解；因目标猫永不移动，目标解始终保持合法。循环至无替代解即唯一。

> 实测对比：纯随机 + 拒绝在 N=10 跑 4800 次仍失败（~1s）；加精修后 N=10 均值约 29ms、零兜底（240 关样本）。

### 无需猜过滤（logicalSolve）

人类式逻辑求解器，只用**可靠推导规则**（不猜、不回溯），迭代到不动点：

- **R1/R2/R3**：某区域 / 行 / 列只剩 1 个候选 → 该格必为猫；放猫即排除其行、列、区域、九宫格邻居。
- **R4 限定法**（仅在 R1–R3 停滞时启用，提升起手率）：某区域候选全在同一行/列 → 排除该行/列其它格；某行/列候选全在同一区域 → 排除该区域其它格。

`generateLevel` 默认 `requireLogical:true`：精修出唯一解后，再要求 `logicalSolve` 能**完全解出**才接受。因推导可靠，完全解出 ⟹ 唯一 ⟹ 无需猜。实测 5–7 `<4ms`、8 `~6ms`、9 `~19ms`、10 `~109ms`（180 关样本，零兜底）。

## 事件管线

```js
emit('gameStarted', { N, seed, fallback });
emit('selectChanged', { index });
emit('cellChanged', { index, prev, next });
emit('catPlaced', { index });
emit('wrongPlacement', { index, hp });   // 放错猫：扣血、不落子
emit('hintUsed', { index });
emit('undone', { index });
emit('cleared', {});
emit('autoEliminateChanged', { on });
emit('gameWon', { N, seed, elapsedMs, mistakes, hints });
emit('gameLost', { N, seed, elapsedMs, mistakes });
```

## 测试钩子

```js
window.__meowdoku = {
  newGame(N, seed),               // 指定 seed 可复现
  getState(), getRegion(), getSolution(), getCells(),
  cycle(r, c), placeCat(r, c), attempt(r, c),   // attempt=校验放子
  catCount(), conflicts(), autoMarks(), hp(), status(), isSolved(),
  solveAll(),                     // 套唯一解填满，触发通关
  stats(), flags,
};
```

## 运行 / 预览

```bash
python3 -m http.server 8000       # 仓库根；手机预览优先局域网 IP
# http://192.168.x.x:8000/Meowdoku/

node tools/smoke.mjs 40            # 生成器冒烟测试（每尺寸 40 关）
```
