// DOM 控制层（关卡制）：关卡头(第N关·尺寸·难度星) + 选关弹层(100格) + HUD + 工具 + 胜/负弹层 + 吉祥物 + 声音。
// 通过回调上抛操作；refresh(state, stats) 同步显示。createUI(root, handlers, levels)。

import { FEATURE_FLAGS, levelStars } from '../data/constants.js';
import { STRATEGY_NAMES } from '../core/scoring.js';

export function createUI(root, handlers, levels) {
  const el = (id) => root.querySelector(id);
  const starStr = (s) => '★'.repeat(s) + '☆'.repeat(5 - s);

  const ui = {
    timer: el('#md-timer'),
    cats: el('#md-cats'),
    hp: el('#md-hp'),
    levelInfo: el('#md-level-info'),
    mascot: el('#md-mascot'),
    bubble: el('#md-bubble'),
    soundBtn: el('#md-sound'),
    winModal: el('#md-win'),
    winTitle: el('#md-win-title'),
    winTime: el('#md-win-time'),
    winStats: el('#md-win-stats'),
    winRank: el('#md-win-rank'),
    nextBtn: el('#md-next'),
    abilityModal: el('#md-ability'),
    abilityBody: el('#md-ability-body'),
    practiceModal: el('#md-practice'),
    practiceBody: el('#md-practice-body'),
    failModal: el('#md-fail'),
    failStats: el('#md-fail-stats'),
    levelsModal: el('#md-levels'),
    levelGrid: el('#md-levelgrid'),
    levelsCount: el('#md-levels-count'),
  };

  // 选关网格：100 个按钮，建一次。每个显示「关号 + N×N 行列 + 难度星」。
  ui.levelButtons = [];
  for (const lv of levels) {
    const b = document.createElement('button');
    b.className = 'md-lvl';
    b.dataset.level = String(lv.id);
    const st = levelStars(lv.n, lv.maxLayer);
    b.innerHTML =
      `<span class="md-lvl-no">${lv.id}</span>` +
      `<span class="md-lvl-sz">${lv.n}×${lv.n}</span>` +
      `<span class="md-lvl-st" data-stars="${st}">${'★'.repeat(st)}</span>`;
    b.addEventListener('click', () => handlers.onSelectLevel(lv.id));
    ui.levelGrid.appendChild(b);
    ui.levelButtons.push(b);
  }

  el('#md-levels-btn').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-levels-close').addEventListener('click', () => ui.levelsModal.classList.remove('show'));
  el('#md-unlock-all').addEventListener('click', () => handlers.onUnlockAll());
  el('#md-fail-levels').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-win-levels').addEventListener('click', () => handlers.onOpenLevels());
  el('#md-next').addEventListener('click', () => handlers.onNext());
  el('#md-ability-btn').addEventListener('click', () => handlers.onOpenAbility());
  el('#md-ability-close').addEventListener('click', () => ui.abilityModal.classList.remove('show'));
  el('#md-practice-btn').addEventListener('click', () => handlers.onPractice());
  el('#md-practice-close').addEventListener('click', () => ui.practiceModal.classList.remove('show'));

  el('#md-sound').addEventListener('click', handlers.onToggleSound);
  el('#md-auto').addEventListener('click', handlers.onToggleAuto);
  el('#md-undo').addEventListener('click', handlers.onUndo);
  el('#md-clear').addEventListener('click', handlers.onClear);
  el('#md-hint').addEventListener('click', handlers.onHint);
  el('#md-restart').addEventListener('click', handlers.onRestart);
  el('#md-fail-retry').addEventListener('click', handlers.onRestart);
  if (!FEATURE_FLAGS.hintsEnabled) el('#md-hint').style.display = 'none';

  let bubbleToken = 0;
  function meow(text) {
    ui.bubble.textContent = text;
    ui.bubble.classList.add('show');
    bubbleToken++;
    const token = bubbleToken;
    setTimeout(() => { if (token === bubbleToken) ui.bubble.classList.remove('show'); }, 1600);
  }

  function heartsLabel(hp, maxHp) {
    return '❤️'.repeat(Math.max(0, hp)) + '🤍'.repeat(Math.max(0, maxHp - hp));
  }

  function refresh(state, stats, practice) {
    ui.timer.textContent = stats.elapsedLabel();
    let cats = 0;
    for (const v of state.cells) if (v === 2) cats++;
    ui.cats.textContent = `🐱 ${cats}/${state.N}`;
    ui.hp.textContent = heartsLabel(state.hp, state.maxHp);
    ui.hp.classList.toggle('bad', state.hp <= 1);
    const stars = levelStars(state.N, state.maxLayer);
    const starsHtml = `<span class="md-stars" data-stars="${stars}">${starStr(stars)}</span>`;
    ui.levelInfo.innerHTML = practice
      ? `🎯 <b>练习</b> · ${state.N}×${state.N} · ${starsHtml}`
      : `第 <b>${state.levelId}</b> 关 · ${state.N}×${state.N} · ${starsHtml}`;
  }

  function setSoundOn(on) {
    ui.soundBtn.textContent = on ? '🔊' : '🔇';
    ui.soundBtn.classList.toggle('off', !on);
  }

  // 选关弹层：刷新每个关卡按钮状态（已通关✓ / 已解锁数字 / 未解锁🔒），并打开。
  function openLevels(progress) {
    let done = 0;
    for (const b of ui.levelButtons) {
      const id = Number(b.dataset.level);
      const isDone = !!progress.done[id];
      const unlocked = id <= progress.unlocked;
      if (isDone) done++;
      b.classList.toggle('done', isDone);
      b.classList.toggle('locked', !unlocked);
      b.classList.toggle('current', id === progress.current);
      b.disabled = !unlocked;
    }
    ui.levelsCount.textContent = `已通关 ${done} / ${levels.length}`;
    ui.levelsModal.classList.add('show');
  }
  function closeLevels() { ui.levelsModal.classList.remove('show'); }

  function showWin(payload, isLast, ability, opts = {}) {
    const total = Math.floor(payload.elapsedMs / 1000);
    const m = String(Math.floor(total / 60)).padStart(2, '0');
    const s = String(total % 60).padStart(2, '0');
    const practice = !!opts.practice;
    ui.winTitle.textContent = practice ? '练习过关喵！🎯' : isLast ? '全部通关喵！🏆' : '安家成功喵！';
    ui.winTime.textContent = `${m}:${s}`;
    ui.winStats.textContent = practice
      ? `练习 · 错误 ${payload.mistakes} · 提示 ${payload.hints}`
      : `第 ${payload.levelId} 关 · 错误 ${payload.mistakes} · 提示 ${payload.hints}`;
    ui.winRank.textContent = ability ? `当前段位：${ability.title}${ability.rank < 5 ? ` · 下一步攻克 ${STRATEGY_NAMES[ability.next]}` : ' · 已封顶 🏆'}` : '';
    ui.nextBtn.textContent = practice ? '再来一道 🎯' : isLast ? '回看关卡 🐾' : '下一关 ▶';
    el('#md-win-levels').textContent = practice ? '退出练习' : '选关';
    ui.winModal.classList.add('show');
  }

  // 能力档案弹层:段位 + 每策略掌握度条。
  function openAbility(report) {
    let html = `<div class="md-rank">段位：${report.title}　<span style="font-size:13px;color:#9a8a90">综合分 ${report.score}</span></div>`;
    for (let d = 1; d <= 5; d++) {
      const mv = report.mastery[d];
      const n = report.samples[d];
      const pct = mv == null ? 0 : Math.round(mv * 100);
      const right = n < 3 ? (n === 0 ? '未遇到' : `样本 ${n}·待评`) : `${pct}% · ${n}题`;
      const color = mv == null ? '#d8cfc7' : pct >= 70 ? '#a8d488' : pct >= 40 ? '#f6c177' : '#ec9389';
      html +=
        `<div class="md-abrow"><span class="md-abname">S${d} ${STRATEGY_NAMES[d]}</span>` +
        `<span class="md-abbar"><span class="md-abfill" style="width:${pct}%;background:${color}"></span></span>` +
        `<span class="md-abpct">${right}</span></div>`;
    }
    html += `<div style="font-size:12px;color:#9a8a90;margin-top:8px;line-height:1.5">段位 = 从 S1 起连续"掌握度≥70% 且做过≥3 题"的最高策略。想升段去挑战更难的关（高难关才有 S4/S5 题）。</div>`;
    ui.abilityBody.innerHTML = html;
    ui.abilityModal.classList.add('show');
  }
  function showFail(payload) {
    ui.failStats.textContent = `第 ${payload.levelId} 关 · 错了 ${payload.mistakes} 次`;
    ui.failModal.classList.add('show');
  }
  function hideModals() {
    ui.winModal.classList.remove('show');
    ui.failModal.classList.remove('show');
    ui.abilityModal.classList.remove('show');
    ui.levelsModal.classList.remove('show');
    ui.practiceModal.classList.remove('show');
  }

  // 练习三选面板:巩固 / 进阶 / 挑战;DDA 推荐的一档高亮"推荐"。
  function openPractice(targets, recKey) {
    ui.practiceBody.innerHTML = '';
    for (const t of targets) {
      const b = document.createElement('button');
      b.className = 'md-pick' + (t.key === recKey ? ' rec' : '');
      b.innerHTML =
        `<span class="md-pick-l">${t.key}${t.key === recKey ? '<span class="md-rec-tag">推荐</span>' : ''}</span>` +
        `<span class="md-pick-r">${t.n}×${t.n} · ${'★'.repeat(t.stars)}<br>攻克${t.label}</span>`;
      b.addEventListener('click', () => { ui.practiceModal.classList.remove('show'); handlers.onPickPractice(t); });
      ui.practiceBody.appendChild(b);
    }
    ui.practiceModal.classList.add('show');
  }

  return { refresh, showWin, showFail, hideModals, openLevels, closeLevels, openAbility, openPractice, meow, setSoundOn, ui };
}
