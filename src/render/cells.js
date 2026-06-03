// 单元格内容：冲突瓷砖底纹、小猫（坐姿奶牛猫剪影）、排除标记 ✕、选中描边。
// 几何统一走 shape.js 的圆角瓷砖。

import { CELL, THEME } from '../data/constants.js';
import { tileRect, roundRectPath } from './shape.js';

// 坐姿奶牛猫（tuxedo）：深色身体 + 白脸/白胸 + 粉鼻 + 粉耳。pal 给定各部位颜色。
export function drawCat(ctx, cx, cy, s, pal) {
  const r = s * 0.19; // 头半径
  const headY = cy - s * 0.15;
  ctx.save();
  ctx.lineJoin = 'round';

  // 尾巴
  ctx.strokeStyle = pal.body;
  ctx.lineWidth = s * 0.1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.2, cy + s * 0.34);
  ctx.quadraticCurveTo(cx + s * 0.46, cy + s * 0.18, cx + s * 0.38, cy - s * 0.02);
  ctx.stroke();

  // 身体
  ctx.fillStyle = pal.body;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.2, s * 0.26, s * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  // 白胸
  ctx.fillStyle = pal.belly;
  ctx.beginPath();
  ctx.ellipse(cx, cy + s * 0.26, s * 0.12, s * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();

  // 耳朵（外深 + 内粉）
  const ear = (sign) => {
    ctx.fillStyle = pal.body;
    ctx.beginPath();
    ctx.moveTo(cx + sign * r * 0.78, headY - r * 0.5);
    ctx.lineTo(cx + sign * r * 1.18, headY - r * 1.45);
    ctx.lineTo(cx + sign * r * 0.12, headY - r * 0.95);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = pal.ear;
    ctx.beginPath();
    ctx.moveTo(cx + sign * r * 0.7, headY - r * 0.62);
    ctx.lineTo(cx + sign * r * 0.98, headY - r * 1.2);
    ctx.lineTo(cx + sign * r * 0.34, headY - r * 0.86);
    ctx.closePath();
    ctx.fill();
  };
  ear(-1);
  ear(1);

  // 头
  ctx.fillStyle = pal.body;
  ctx.beginPath();
  ctx.arc(cx, headY, r, 0, Math.PI * 2);
  ctx.fill();

  // 白脸（覆盖下半张脸）
  ctx.fillStyle = pal.belly;
  ctx.beginPath();
  ctx.ellipse(cx, headY + r * 0.2, r * 0.82, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛（白脸上的深色点）
  ctx.fillStyle = pal.eye;
  ctx.beginPath();
  ctx.arc(cx - r * 0.34, headY + r * 0.02, r * 0.13, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.34, headY + r * 0.02, r * 0.13, 0, Math.PI * 2);
  ctx.fill();

  // 粉鼻
  ctx.fillStyle = pal.nose;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.14, headY + r * 0.34);
  ctx.lineTo(cx + r * 0.14, headY + r * 0.34);
  ctx.lineTo(cx, headY + r * 0.5);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawMark(ctx, cx, cy, tile, color = THEME.mark, weight = 0.06) {
  const s = tile.w * 0.16;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, tile.w * weight);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - s, cy - s);
  ctx.lineTo(cx + s, cy + s);
  ctx.moveTo(cx + s, cy - s);
  ctx.lineTo(cx - s, cy + s);
  ctx.stroke();
  ctx.restore();
}

// 冲突瓷砖底纹（校验放子模式下基本不触发，保留安全网）。
export function drawConflictCells(ctx, state) {
  const N = state.N;
  for (const idx of state.conflicts) {
    const t = tileRect(N, idx);
    roundRectPath(ctx, t.x, t.y, t.w, t.h, t.radius);
    ctx.fillStyle = THEME.conflictCell;
    ctx.fill();
  }
}

const NORMAL_PAL = {
  body: THEME.catFill,
  belly: THEME.catBelly,
  eye: THEME.catEye,
  nose: THEME.catNose,
  ear: THEME.catEar,
};
const CONFLICT_PAL = {
  body: THEME.catConflict,
  belly: '#ffe1da',
  eye: '#7a1d12',
  nose: '#a82b1c',
  ear: '#f2b3aa',
};

// 在格中心套用缩放 + 透明度（用于出现动画），回调里按正常坐标绘制。
function withCellAnim(ctx, cx, cy, a, draw) {
  ctx.save();
  ctx.globalAlpha = a.alpha;
  ctx.translate(cx, cy);
  ctx.scale(a.scale, a.scale);
  ctx.translate(-cx, -cy);
  draw();
  ctx.restore();
}

const ID_ANIM = { scale: 1, alpha: 1 };

export function drawContents(ctx, state, anim) {
  const N = state.N;
  // 小猫（弹入动画）
  for (let i = 0; i < state.cells.length; i++) {
    if (state.cells[i] !== CELL.CAT) continue;
    const t = tileRect(N, i);
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    const pal = state.conflicts.has(i) ? CONFLICT_PAL : NORMAL_PAL;
    withCellAnim(ctx, cx, cy, anim ? anim.catAt(i) : ID_ANIM, () => {
      drawCat(ctx, cx, cy + t.h * 0.02, t.w * 0.96, pal);
    });
  }

  // 排除标记 ✕（弹出现动画）：放错的红 ✕（醒目、略粗）；手动 ✕ 或自动排除的灰 ✕
  for (let i = 0; i < state.cells.length; i++) {
    const v = state.cells[i];
    if (v === CELL.CAT) continue;
    const isWrong = v === CELL.WRONG;
    if (!isWrong && v !== CELL.MARK && !state.autoMarks.has(i)) continue;
    const t = tileRect(N, i);
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    withCellAnim(ctx, cx, cy, anim ? anim.markAt(i) : ID_ANIM, () => {
      if (isWrong) drawMark(ctx, cx, cy, t, THEME.markWrong, 0.085);
      else drawMark(ctx, cx, cy, t);
    });
  }
}

export function drawSelectionRing(ctx, state) {
  if (state.selected < 0) return;
  const t = tileRect(state.N, state.selected);
  const pad = t.w * 0.04;
  roundRectPath(ctx, t.x + pad, t.y + pad, t.w - pad * 2, t.h - pad * 2, t.radius);
  ctx.strokeStyle = THEME.select;
  ctx.lineWidth = Math.max(3, t.w * 0.06);
  ctx.stroke();
}
