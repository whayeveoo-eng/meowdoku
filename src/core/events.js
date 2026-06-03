// 极简事件总线。渲染、特效、统计、音效通过监听事件解耦，避免写死在游戏状态机里。
// 事件清单见 docs/tech.md。

export function createEventBus() {
  const handlers = new Map();

  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => this.off(type, fn);
    },
    off(type, fn) {
      const set = handlers.get(type);
      if (set) set.delete(fn);
    },
    emit(type, payload) {
      const set = handlers.get(type);
      if (set) {
        for (const fn of [...set]) fn(payload);
      }
    },
  };
}
