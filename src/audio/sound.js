// 音频：纯 Web Audio 合成，无音频文件（云端只放游戏，避免二进制资源）。
// 舒缓背景音乐（五声音阶慢速 pad 琶音）+ 点击/正反馈/负反馈/通关/失败音效。
// 浏览器要求用户手势后才能出声：首次交互调 unlock()。开关偏好持久化。

const STORE_KEY = 'meowdoku.audio';

export function createAudio() {
  let ctx = null;
  let master = null; // 总音量
  let bgmGain = null; // 背景音乐音量
  let bgmTimer = null;
  let bgmStep = 0;
  let enabled = loadPref();

  function loadPref() {
    try {
      const v = localStorage.getItem(STORE_KEY);
      return v === null ? true : v === '1';
    } catch {
      return true;
    }
  }
  function savePref(on) {
    try {
      localStorage.setItem(STORE_KEY, on ? '1' : '0');
    } catch {
      /* ignore */
    }
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.0;
    bgmGain.connect(master);
    return ctx;
  }

  // 一个带包络的合成音。
  function blip(freq, t0, dur, { type = 'sine', gain = 0.12, attack = 0.008, glideTo = null, filter = null } = {}) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (filter) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = filter;
      osc.connect(lp);
      node = lp;
    }
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  // ---- 背景音乐：C 大调五声音阶慢速 pad，循环 ----
  const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];
  function bgmTick() {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + 0.05;
    const root = SCALE[(bgmStep * 3) % SCALE.length];
    padNote(root, t, 2.6);
    if (bgmStep % 2 === 0) padNote(SCALE[(bgmStep * 3 + 2) % SCALE.length], t + 0.12, 2.4); // 偶尔叠一个音
    bgmStep++;
  }
  function padNote(freq, t0, dur) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    osc.type = 'sine';
    osc2.type = 'triangle';
    osc.frequency.value = freq;
    osc2.frequency.value = freq * 1.005; // 轻微失谐更柔
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.6); // 慢起
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // 长尾
    osc.connect(lp);
    osc2.connect(lp);
    lp.connect(g);
    g.connect(bgmGain);
    osc.start(t0);
    osc2.start(t0);
    osc.stop(t0 + dur + 0.05);
    osc2.stop(t0 + dur + 0.05);
  }
  function startBgm() {
    if (!ctx || bgmTimer) return;
    bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    bgmGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 1.5);
    bgmTick();
    bgmTimer = setInterval(bgmTick, 1600);
  }
  function stopBgm() {
    if (bgmTimer) {
      clearInterval(bgmTimer);
      bgmTimer = null;
    }
    if (ctx && bgmGain) {
      bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      bgmGain.gain.linearRampToValueAtTime(0.0, ctx.currentTime + 0.4);
    }
  }

  // 首次用户手势后调用：建 ctx、起 BGM。
  function unlock() {
    if (!ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (enabled) startBgm();
  }

  let lastClick = 0;
  return {
    unlock,
    get enabled() {
      return enabled;
    },
    setEnabled(on) {
      enabled = !!on;
      savePref(enabled);
      if (!ctx) {
        if (enabled) unlock();
        return enabled;
      }
      if (enabled) {
        if (ctx.state === 'suspended') ctx.resume();
        startBgm();
      } else {
        stopBgm();
      }
      return enabled;
    },
    // ---- 音效 ----
    click() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      // 拖动批量打叉时节流，避免太密
      if (performance.now() - lastClick < 45) return;
      lastClick = performance.now();
      blip(520, now, 0.07, { type: 'triangle', gain: 0.06 });
    },
    good() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      blip(523.25, now, 0.12, { type: 'sine', gain: 0.12 });
      blip(659.25, now + 0.07, 0.14, { type: 'sine', gain: 0.11 });
    },
    bad() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      blip(200, now, 0.2, { type: 'sawtooth', gain: 0.09, glideTo: 110, filter: 900 });
    },
    win() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        blip(f, now + i * 0.11, 0.22, { type: 'sine', gain: 0.12 })
      );
    },
    fail() {
      if (!enabled || !ctx) return;
      const now = ctx.currentTime;
      [392.0, 311.13, 261.63].forEach((f, i) =>
        blip(f, now + i * 0.14, 0.26, { type: 'triangle', gain: 0.1, filter: 1200 })
      );
    },
  };
}
