# Meowdoku · 喵咪安家 🐾

竖屏手机上的**喵主题逻辑解谜**（猫版 LinkedIn「Queens」）。N×N 棋盘被分成 N 个连通的同色区域，给每只猫安一个家：

- 每行、每列、每种颜色 **恰好 1 只猫**；
- 任意两只猫 **不能挨着**（上下左右斜角都不行）；
- 每关 **唯一解、且能纯逻辑一步步推出来**（无需猜）；
- 每关 **3 ❤️**，放错猫扣 1 滴，归零失败。

> 这不是仓库主线的「小球碰撞观赏游戏」，而是玩家操作的逻辑解谜，复用项目的通用工程约定（独立文件夹、`docs/` 骨架、模块化 `src/`、可种子 RNG、`window.__game` 式测试钩子），但不套用 HP / 伤害 / 节奏交锋。详见 [docs/design.md](docs/design.md)。

## 玩法

- **点击格子循环三态**：空 → ✕（排除标记，辅助推理）→ 🐱（放猫）→ 空。
- **校验放子**：放对位子 → 落子；放错 → **留下红 ✕** 提示、**扣 1 ❤️**、不落子（再点红 ✕ 可清除）。不能随便乱放。
- **自动排除（可开关）**：放下一只正确的猫，自动给它的整行 / 整列 / 九宫格 / 同色区域打 ✕（移走猫则撤回）；已被排除的格点了不放猫、不扣血。工具栏「自动叉」可自行开/关，选择记忆保存。
- **撤销 / 清空 / 提示**：随时纠错；提示直接放一只正确的猫。
- 放满 N 只正确猫 → 「安家成功喵」；血量归零 → 失败（可同关重来）。
- 六档尺寸：5×5 / 6×6 / 7×7 / 8×8 / 9×9 / 10×10（总棋盘大小固定，格子自适应）。

键盘：方向键移动 · 空格循环 · `Z` 撤销。

## 快速体验

```bash
# 从仓库根启动本地服务（手机预览优先用局域网 IP）
python3 -m http.server 8000
# 打开 http://192.168.x.x:8000/Meowdoku/

# 生成器自动测试（每尺寸 40 关，校验唯一解/合法/规则）
cd Meowdoku && node tools/smoke.mjs 40
```

## 目录结构

```
Meowdoku/
  index.html         # 布局 + CSS + 入口
  src/
    main.js          # canvas / 循环 / 输入 / DOM / 测试钩子
    core/            # rng · board · solver · generator · game · events · stats
    render/          # grid · cells · effects · ui
    data/            # constants
  docs/              # design · tech · art · test · changelog
  tools/             # smoke.mjs 生成器冒烟测试
  assets/            # images / audio / fonts（预留）
```

## 文档

- [策划 docs/design.md](docs/design.md)
- [技术 docs/tech.md](docs/tech.md)（含唯一性精修生成算法）
- [美术 docs/art.md](docs/art.md)
- [测试 docs/test.md](docs/test.md)
- [版本 docs/changelog.md](docs/changelog.md)

当前版本：**v0.3.3**（猫版 Queens；无需猜关卡 + 校验放子（放错留红 ✕）+ 3 血量 + 自动排除可开关；美术对齐参考图：圆角糖果瓷砖 + 奶牛猫 + 柔和药丸 UI）。
