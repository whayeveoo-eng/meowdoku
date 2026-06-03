// 对局统计：用时、填入步数、错误数、提示数。供 HUD 与未来的成绩面板使用。
// 计时基于 performance.now()，暂停时累计已用时长。

export function createStats() {
  let startedAt = 0;
  let accumulatedMs = 0;
  let running = false;

  const state = {
    moves: 0, // 玩家有效填入次数
    mistakes: 0, // 与正解不符的填入次数（自动检查口径）
    hints: 0, // 使用提示次数
    erases: 0,
  };

  function now() {
    return typeof performance !== 'undefined' ? performance.now() : 0;
  }

  return {
    state,
    reset() {
      state.moves = 0;
      state.mistakes = 0;
      state.hints = 0;
      state.erases = 0;
      accumulatedMs = 0;
      startedAt = now();
      running = true;
    },
    start() {
      if (!running) {
        startedAt = now();
        running = true;
      }
    },
    pause() {
      if (running) {
        accumulatedMs += now() - startedAt;
        running = false;
      }
    },
    stop() {
      this.pause();
    },
    elapsedMs() {
      return running ? accumulatedMs + (now() - startedAt) : accumulatedMs;
    },
    elapsedLabel() {
      const total = Math.floor(this.elapsedMs() / 1000);
      const m = String(Math.floor(total / 60)).padStart(2, '0');
      const s = String(total % 60).padStart(2, '0');
      return `${m}:${s}`;
    },
  };
}
