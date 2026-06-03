// 棋盘：每格画成一块圆角瓷砖，瓷砖之间留缝露出底色——不画格线、不画区域边界，
// 区域完全靠瓷砖底色区分（仿参考图风格）。

import { REGION_COLORS } from '../data/constants.js';
import { tileRect, roundRectPath } from './shape.js';

export function drawBoard(ctx, state) {
  const N = state.N;
  for (let i = 0; i < N * N; i++) {
    const { x, y, w, h, radius } = tileRect(N, i);
    roundRectPath(ctx, x, y, w, h, radius);
    ctx.fillStyle = REGION_COLORS[state.region[i] % REGION_COLORS.length];
    ctx.fill();
  }
}
