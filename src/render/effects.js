// 轻量特效层：放对/放下小猫的爪印脉冲、通关猫爪雨。
// 由事件触发收集，每帧 update + draw（画在内容之上）。CELL 随 N 变化，用 setBoard(N) 配置。

import { BOARD_PX, THEME } from '../data/constants.js';
import { tileRect, roundRectPath } from './shape.js';

export function createEffects() {
  const pulses = []; // { index, t }
  const flashes = []; // 错误闪红 { index, t }
  const paws = []; // { x, y, vy, rot, vr, size, t }
  let winBurst = false;
  let cell = BOARD_PX / 8;
  let N = 8;

  function setBoard(n) {
    N = n;
    cell = BOARD_PX / n;
  }

  function cellCenter(index) {
    const r = Math.floor(index / N);
    const c = index % N;
    return [c * cell + cell / 2, r * cell + cell / 2];
  }

  function pulse(index) {
    pulses.push({ index, t: 0 });
  }

  function flashWrong(index) {
    flashes.push({ index, t: 0 });
  }

  function celebrate() {
    winBurst = true;
    for (let i = 0; i < 40; i++) {
      paws.push({
        x: (i * 53) % BOARD_PX,
        y: -((i * 71) % BOARD_PX) - 40,
        vy: 3 + (i % 5),
        rot: (i % 8) * 0.4,
        vr: 0.03 + (i % 3) * 0.02,
        size: 12 + (i % 4) * 6,
        t: 0,
      });
    }
  }

  function reset() {
    pulses.length = 0;
    flashes.length = 0;
    paws.length = 0;
    winBurst = false;
  }

  function drawPawShape(ctx, r) {
    ctx.beginPath();
    ctx.ellipse(0, r * 0.5, r * 0.8, r * 0.62, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const [dx, dy, rr] of [
      [-0.7, -0.5, 0.32],
      [-0.24, -0.9, 0.34],
      [0.24, -0.9, 0.34],
      [0.7, -0.5, 0.32],
    ]) {
      ctx.beginPath();
      ctx.arc(dx * r, dy * r, rr * r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function update() {
    for (let i = pulses.length - 1; i >= 0; i--) {
      pulses[i].t += 1;
      if (pulses[i].t > 26) pulses.splice(i, 1);
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].t += 1;
      if (flashes[i].t > 30) flashes.splice(i, 1);
    }
    if (winBurst) {
      for (let i = paws.length - 1; i >= 0; i--) {
        const p = paws[i];
        p.t += 1;
        p.y += p.vy;
        p.rot += p.vr;
        if (p.y > BOARD_PX + 60) paws.splice(i, 1);
      }
      if (paws.length === 0) winBurst = false;
    }
  }

  function draw(ctx) {
    // 错误闪红：红圆角瓷砖 + 红色 ✗，快速淡出
    for (const fl of flashes) {
      const t = tileRect(N, fl.index);
      const cx = t.x + t.w / 2;
      const cy = t.y + t.h / 2;
      const k = fl.t / 30;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.55;
      ctx.fillStyle = '#d6432f';
      roundRectPath(ctx, t.x, t.y, t.w, t.h, t.radius);
      ctx.fill();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#a82b1c';
      ctx.lineWidth = Math.max(3, t.w * 0.06);
      ctx.lineCap = 'round';
      const s = t.w * 0.22;
      ctx.beginPath();
      ctx.moveTo(cx - s, cy - s);
      ctx.lineTo(cx + s, cy + s);
      ctx.moveTo(cx + s, cy - s);
      ctx.lineTo(cx - s, cy + s);
      ctx.stroke();
      ctx.restore();
    }
    for (const pl of pulses) {
      const [cx, cy] = cellCenter(pl.index);
      const k = pl.t / 26;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = THEME.paw;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(cx, cy, cell * (0.32 + k * 0.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (paws.length) {
      ctx.fillStyle = THEME.win;
      for (const p of paws) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = 0.85;
        drawPawShape(ctx, p.size);
        ctx.restore();
      }
    }
  }

  return {
    setBoard,
    pulse,
    flashWrong,
    celebrate,
    reset,
    update,
    draw,
    get active() {
      return pulses.length > 0 || flashes.length > 0 || paws.length > 0;
    },
  };
}
