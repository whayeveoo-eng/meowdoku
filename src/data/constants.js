// Meowdoku · 全局常量与功能开关
// 玩法 = 猫版 LinkedIn「Queens」：N×N 棋盘分成 N 个连通同色区域，
// 每行/每列/每个颜色区域恰好放 1 只小猫，任意两只小猫不能相邻（含对角，即九宫格内唯一），
// 区域布局保证唯一解。

// 支持的棋盘边长。N<5 无可行解，故从 5 起；上限 10。
export const SIZES = [5, 6, 7, 8, 9, 10];
export const DEFAULT_N = 8;

// 棋盘总尺寸固定（逻辑像素，正方形），单元格随 N 动态适配：CELL = BOARD_PX / N。
export const BOARD_PX = 900;

// 单元格状态：空 / 手动排除 ✕ / 小猫 / 放错留下的红 ✕（提示玩家此处试过且错了）。
export const CELL = { EMPTY: 0, MARK: 1, CAT: 2, WRONG: 3 };

// 每关血量。标记猫错误（放到非正解格）扣 1 滴，归零失败。
export const LIVES = 3;

// 技巧难度:按"纯逻辑解出所需最高层级"映射(见 solver.rateLevel / docs/solving.md)。
//   L1 单候选 / L2 限定 → 简单;L3 相邻锁定 → 中等;L4 Hall 子集 n≥2 → 困难。
export function difficultyOf(maxLayer) {
  if (maxLayer >= 4 || maxLayer <= 0) return { key: 'hard', label: '困难', stars: 3 };
  if (maxLayer === 3) return { key: 'medium', label: '中等', stars: 2 };
  return { key: 'easy', label: '简单', stars: 1 };
}

// 关卡综合难度(1..5 ★):尺寸 N 与技巧层级 maxLayer 各占一半。
// 用于关卡制的难度展示与心流曲线评估。见 docs/design.md「难度评估标准」。
export function levelStars(n, maxLayer) {
  const ml = Math.max(1, maxLayer || 1);
  const raw = ((n - 5) / 5) * 0.5 + ((ml - 1) / 3) * 0.5; // 0..1
  return Math.max(1, Math.min(5, 1 + Math.round(raw * 4)));
}

export const FEATURE_FLAGS = {
  validatePlacement: true, // 放猫前校验是否为唯一解的正确格；错误则扣血、不落子
  hintsEnabled: true, // 提示放一只正确小猫
  autoMarkAllowed: true, // 允许手动“排除标记”(X)
  autoEliminate: true, // 放下正确的小猫后，自动给其行/列/九宫格打叉
};

// 区域配色：最多 10 个鲜亮柔和、互相可区分的颜色（每色一区一猫）。
// 参照参考图的活泼糖果色：珊瑚 / 蜜桃 / 芥末金 / 奶黄 / 嫩绿 / 薄荷 / 天蓝 / 薰衣草 / 樱粉 / 焦糖。
// 索引 0..9 对应颜色区域；同色单元格构成一个连通区。
export const REGION_COLORS = [
  '#ec9389', // 0 珊瑚
  '#f2b98a', // 1 蜜桃
  '#e3a92f', // 2 芥末金
  '#f2dd92', // 3 奶黄
  '#a8d488', // 4 嫩绿
  '#74cbb6', // 5 薄荷
  '#54b8d6', // 6 天蓝
  '#bfa2dc', // 7 薰衣草
  '#e896c0', // 8 樱粉
  '#bf9069', // 9 焦糖
];

// 主题色 + 圆角瓷砖参数（瓷砖之间留缝、不画格线/区域边界，靠底色区分；仿参考图）。
export const THEME = {
  pageBg: '#f6f0e8', // 暖奶油底
  tileGap: 0.07, // 瓷砖间缝隙 = cell * 该比例（缝更窄、瓷砖更大）
  tileRadius: 0.18, // 瓷砖圆角 = (cell-gap) * 该比例（略收小，方中带圆）
  catFill: '#3b3733', // 小猫剪影主色
  catBelly: '#fcf5ea', // 白肚 / 白脸
  catEye: '#3b3733', // 猫眼（落在白脸上）
  catNose: '#e98aa0', // 粉鼻
  catEar: '#eaa9b6', // 粉耳
  catConflict: '#d6432f', // 冲突小猫
  conflictCell: 'rgba(214,67,47,0.20)', // 冲突瓷砖底纹
  mark: 'rgba(70,58,52,0.34)', // 手动排除标记 ✕（暖灰）
  markWrong: '#d6432f', // 放错留下的红 ✕
  select: '#7a5f7d', // 选中描边（柔和深紫）
  paw: '#ec9389', // 猫爪 / 强调色（珊瑚）
  win: '#e9a23b',
};
