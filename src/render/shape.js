// 渲染共享几何：圆角瓷砖矩形 + 圆角路径。瓷砖之间留缝（露出底色），仿参考图。

import { BOARD_PX, THEME } from '../data/constants.js';

// 返回某格的圆角瓷砖矩形（已内缩缝隙）。
export function tileRect(N, index) {
  const cell = BOARD_PX / N;
  const gap = cell * THEME.tileGap;
  const r = Math.floor(index / N);
  const c = index % N;
  return {
    x: c * cell + gap / 2,
    y: r * cell + gap / 2,
    w: cell - gap,
    h: cell - gap,
    cell,
    radius: (cell - gap) * THEME.tileRadius,
  };
}

export function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
