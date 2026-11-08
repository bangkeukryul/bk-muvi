/* mv-tl.js — BK뮤비 타임라인 화면
 *  ① 채우기 (BK쇼츠 「음악 맞추기」 모양): 커서 · ±1초/0.1초 · ✂️ 여기서 끝 · ➡️ 앞 장면 여기까지 · ⬜ 빈칸 · 🎵 톡톡 넘기기 · 제자리/따라감 · 사진 줄
 *  ⑤ 다듬기 (BK에딧 편집 모양): 가운데 커서 · 장면/노래/자막/효과 줄 · 넣기 · 분할 · 자르기 · 삭제 · 자막 · 오디오 · 효과 · 더 보기
 *  공통: ↩ 되돌리기 / ↪ 다시 · 🖼 썸네일 · 🏁 엔딩 카드
 */
(function (g) {
  'use strict';
  const MV = g.MV, esc = MV.esc, fmt = MV.fmt, fmt0 = MV.fmt0, clamp = MV.clamp, $ = id => document.getElementById(id);
  const U = () => MV.UI, P = () => MV.UI.p, S = () => MV.UI.S;
  const T = { keep: 'stay', pps: { fill: 16, edit: 44 }, tapMode: false, tapJ: 0, fsel: null, esel: null, prog: false, cutA: null, undo: [], redo: [] };
  const chip = (a, v, on, l) => U().chip(a, v, on, l);

  /* ═════════ ↩ 되돌리기 ═════════ */
  const KEYS = ['scenes', 'lines', 'efx', 'stk', 'sfx', 'thumb', 'endc', 'song', 'fx'];
  function snapOf(p) { const o = {}; KEYS.forEach(k => { o[k] = JSON.stringify(p[k] === undefined ? null : p[k]); }); return o; }
  function rmScene(p, i) { const c = p.scenes[i]; if (i > 0) p.scenes[i - 1].e = c.e; else p.scenes[1].s = 0; p.scenes.splice(i, 1);
    p.scenes.forEach(o => { if (o.reuse == null) return; if (o.reuse === i) o.reuse = null; else if (o.reuse > i) o.reuse--; });
    if (p.cpNext > i) p.cpNext--; if (c.file && !p.scenes.some(o => o.file === c.file)) MV.delFile(c.file); }
  function pinSig(p) { return (p.scenes || []).filter(o => o.pin).map(o => `${o.id}:${o.s}:${o.e}:${o.file}`).join('|'); }
  function snap() { T.undo.push(snapOf(P())); if (T.undo.length > 40) T.undo.shift(); T.redo = []; }
  function restore(o) { const p = P(); KEYS.forEach(k => { p[k] = JSON.parse(o[k]); }); }
  function undo() { if (!T.undo.length) return U().toast('되돌릴 것이 없어요'); T.redo.push(snapOf(P())); restore(T.undo.pop()); changed(); U().toast('↩ 되돌렸어요'); }
  function redo() { if (!T.redo.length) return; T.undo.push(snapOf(P())); restore(T.redo.pop()); changed(); }
  function changed(keepSheet) { const s = S(); s.player.refresh(); if (!s.player.playing()) s.player.seek(s.player.time()); U().save(); refreshView(); if (!keepSheet && T.sheetFn) reSheet(); }
  function now() { return +S().player.time().toFixed(2); }
  function dur() { return (P().song && P().song.dur) || 0; }

  /* ═════════ 장면 경계 옮기기 (BK쇼츠 「제자리 · 따라감」) ═════════ */
  function setBoundary(j, t, mode) {
    const p = P(), sc = p.scenes, a = sc[j - 1], b = sc[j]; if (!a || !b) return false;
    const D = dur(); t = +t.toFixed(2);
    if (mode === 'follow') {
      t = clamp(t, a.s + .3, D - .3 * (sc.length - j)); const d = t - b.s;
      for (let k = j; k < sc.length; k++) { sc[k].s = +(sc[k].s + d).toFixed(2); sc[k].e = +(sc[k].e + d).toFixed(2); }
      a.e = t; sc[sc.length - 1].e = D;
      for (let k = sc.length - 1; k > j; k--) if (sc[k].s > D - .3) { sc[k].s = +(D - .3 * (sc.length - k)).toFixed(2); sc[k - 1].e = sc[k].s; }
    } else { t = clamp(t, a.s + .3, b.e - .3); a.e = t; b.s = t; }
    return true;
  }
  function sceneIdx(t) { return MV.sceneAt(P(), t); }

  /* ═════════ 타임라인 (가운데 고정 커서 · 밀면 움직여요) ═════════ */
  const COL = ['#7c3aed', '#db2777', '#2563eb', '#0d9488', '#ea580c', '#4f46e5'];
  function rows(mode) {
    const p = P(), pps = T.pps[mode], D = dur(), sc = p.scenes || [], selS = mode === 'fill' ? T.fsel : (T.esel && T.esel.k === 'sc' ? T.esel.i : -1);
    const H = mode === 'fill' ? 70 : 54;
    let h = `<div class="tlrow" style="height:${H}px">${sc.map((s, i) => { const w = Math.max(4, (s.e - s.s) * pps - 2), long = s.kind === 'video' && (s.e - s.s) > 8.3 && !(s.speed && s.speed < 1);
      return `<div class="tb${i === selS ? ' sel' : ''}" data-tl="sc:${i}" style="left:${s.s * pps}px;width:${w}px;${s.thumb ? `background-image:url(${s.thumb})` : `background-color:${s.file ? COL[i % COL.length] : '#334155'}`}"><span class="tn">${i + 1}${s.pin ? ' 🔒' : ''}</span><span class="tdur">${(s.e - s.s).toFixed(1)}초${long ? ' ⚠️' : ''}</span></div>`; }).join('')}`;
    if (p.thumb && p.thumb.on) h += `<div class="tb card" data-tl="th:0" style="left:0;width:${Math.max(18, p.thumb.dur * pps - 2)}px">🖼 썸네일</div>`;
    if (p.endc && p.endc.on) h += `<div class="tb card end" data-tl="en:0" style="left:${(D - p.endc.dur) * pps}px;width:${Math.max(18, p.endc.dur * pps - 2)}px">🏁 엔딩</div>`;
    h += '</div>';
    if (mode === 'edit') {
      const sel = T.esel || {}, CL = MV.capLines(p);
      h += `<div class="tlrow thin"><div class="tb mu${sel.k === 'mu' ? ' sel' : ''}" data-tl="mu:0" style="left:0;width:${D * pps}px">🎵 ${esc(p.song.name || '노래')}</div></div>`;
      h += `<div class="tlrow thin">${CL.map(c => `<div class="tb ly${sel.k === 'ly' && sel.i === c.i ? ' sel' : ''}" data-tl="ly:${c.i}" style="left:${c.s * pps}px;width:${Math.max(6, (c.e - c.s) * pps - 2)}px">${esc(c.t)}</div>`).join('')}</div>`;
      const F = g.BKFX || {};
      h += `<div class="tlrow thin">${(p.efx || []).map((e, i) => `<div class="tb fx${sel.k === 'efx' && sel.i === i ? ' sel' : ''}" data-tl="efx:${i}" style="left:${e.start * pps}px;width:${Math.max(10, e.dur * pps - 2)}px">${((F.EFX || {})[e.k] || '✨').split(' ')[0]}</div>`).join('')}${(p.stk || []).map((e, i) => `<div class="tb st${sel.k === 'stk' && sel.i === i ? ' sel' : ''}" data-tl="stk:${i}" style="left:${e.start * pps}px;width:${Math.max(10, e.dur * pps - 2)}px">${e.e || '🔤'}</div>`).join('')}${(p.sfx || []).map((e, i) => `<div class="tb sf${sel.k === 'sfx' && sel.i === i ? ' sel' : ''}" data-tl="sfx:${i}" style="left:${e.at * pps}px;width:16px">🔔</div>`).join('')}</div>`;
    }
    const ticks = []; const step = pps >= 30 ? 2 : 10; for (let s = 0; s <= D; s += step) ticks.push(`<span style="left:${s * pps}px">${fmt0(s)}</span>`);
    return `<div class="tlticks">${ticks.join('')}</div>` + h;
  }
  function tlHTML(mode) {
    return `<div class="tlv ${mode}"><div class="tlx" id="tlx_${mode}"><div class="tlin" id="tlin_${mode}"><div class="tlc" id="tlc_${mode}">${rows(mode)}</div></div></div><div class="tlph"></div>
      <div class="tlzoom"><button type="button" data-a="tlZoom" data-v="${mode}:-1">−</button><button type="button" data-a="tlZoom" data-v="${mode}:1">＋</button></div></div>`;
  }
  function tlFit(mode) {
    const x = $('tlx_' + mode), inn = $('tlin_' + mode), c = $('tlc_' + mode); if (!x || !inn) return;
    const half = Math.round(x.clientWidth / 2), W = dur() * T.pps[mode];
    inn.style.width = (W + half * 2) + 'px'; c.style.left = half + 'px'; c.style.width = W + 'px';
    tlScroll(mode, S().player.time());
    if (!x.dataset.on) { x.dataset.on = 1; let raf = 0;
      x.addEventListener('scroll', () => { if (T.prog) { T.prog = false; return; } if (S().player.playing()) return; if (raf) return; raf = requestAnimationFrame(() => { raf = 0; S().player.seek(x.scrollLeft / T.pps[mode]); }); }, { passive: true }); }
  }
  function tlScroll(mode, t) { const x = $('tlx_' + mode); if (!x) return; const v = Math.round(t * T.pps[mode]); if (Math.abs(x.scrollLeft - v) > 1) { T.prog = true; x.scrollLeft = v; } }
  function tlRender(mode) { const c = $('tlc_' + mode); if (c) { c.innerHTML = rows(mode); tlFit(mode); } }

  /* ═════════ ① 채우기 ═════════ */
  function fillPart() {
    const p = P(), L = !!p.locked, sc = p.scenes || [], t = S().player ? S().player.time() : 0, i = T.fsel != null ? clamp(T.fsel, 0, sc.length - 1) : sceneIdx(t), c = sc[i] || {};
    const dis = L ? ' disabled' : '', pn = c.pin ? ' disabled' : '', lyr = c.s != null ? MV.sceneLines(p, c) : [];
    if (T.tapMode) return `<div class="tapScene"><div class="muted">🎵 노래를 들으며 <b>다음 장면으로 바뀔 순간</b>마다 톡 · 지금 장면 <b>${T.tapJ}</b> → ${T.tapJ + 1}</div>
      <button class="tapbtn" data-a="fTap">👆 다음 장면!</button>
      <div class="row" style="margin-top:8px"><button class="btn" data-a="fTapUndo">↩ 다시 (방금 것 취소)</button><button class="btn ghost" data-a="fTapStop">■ 그만</button></div></div>${tlHTML('fill')}`;
    return `${L ? '<div class="note red">🔒 잠겨 있어요 — 장면 길이를 바꾸려면 ③ 잠금에서 풀어 주세요</div>' : ''}
      <div class="nud">${[[-1, '◀◀ 1초'], [-.1, '◀ 0.1초'], [.1, '0.1초 ▶'], [1, '1초 ▶▶']].map(a => `<button type="button" data-a="fNud" data-v="${a[0]}">${a[1]}</button>`).join('')}</div>
      <div class="cutRow">
        <button type="button" data-a="fCut"${dis}>✂️ 여기서 끝</button><button type="button" data-a="fPrev"${dis}>➡️ 앞 장면 여기까지</button><button type="button" data-a="fNextHere"${dis}>⬅️ 뒤 장면 여기부터</button><button type="button" data-a="fBlank"${dis}>⬜ 빈칸 넣기</button>
        <button type="button" class="hot" data-a="fSplit"${dis || pn}>🔪 분할</button><button type="button" class="del" data-a="fScDel" data-v="${i}"${dis || pn}>❌ 삭제</button><button type="button" class="mv" data-a="fMove" data-v="-1"${dis || pn || !i ? ' disabled' : ''}>◀ ${i + 1}번<br>앞으로</button><button type="button" class="mv" data-a="fMove" data-v="1"${dis || pn || i >= sc.length - 1 ? ' disabled' : ''}>${i + 1}번 ▶<br>뒤로</button></div>
      <div class="row tlSub"><button class="btn sm ghost" data-a="tlUndo"${T.undo.length ? '' : ' disabled'}>↩ 되돌리기</button><button class="btn sm ghost" data-a="tlRedo"${T.redo.length ? '' : ' disabled'}>↪</button><button class="btn sm ghost" data-a="tlZoom" data-v="fill:0">🔍 ${T.pps.fill > 20 ? '작게' : '크게'}</button><span class="muted" id="fStat">${fmt(t)} · ${i + 1}번 ${fmt0(c.s)}~${fmt0(c.e)}</span></div>
      ${tlHTML('fill')}
      <div class="fsc">
        <div class="hd"><b>장면 ${i + 1}</b>${c.pin ? ' <span class="cpd pin">🔒 고정</span>' : ''} <span class="muted">${fmt(c.s)} ~ ${fmt(c.e)} · ${(c.e - c.s).toFixed(1)}초</span>${c.kind === 'video' && (c.e - c.s) > 8.3 ? ' <span class="cpd">⚠️ 8초 넘음 → 영상이 다시 반복돼요</span>' : ''}</div>
        <div class="ly">🎤 ${lyr.length ? esc(lyr.join(' / ')) : '<span class="muted">(반주)</span>'}</div>
        <div class="row three"><button class="btn sm main" data-a="fPrevSc">◀ 이전 장면</button><button class="btn sm main" data-a="fPlay">▶ 이 장면만</button><button class="btn sm main" data-a="fNext">다음 장면 ▶</button></div>
        <div class="row"><button class="btn sm" data-a="fLyTap">👆 가사 톡</button></div>
        <div class="row"><button class="btn sm ${c.pin ? 'pinOn' : 'pinBtn'}" data-a="fPin" data-v="${i}"${dis}>${c.pin ? '🔓 고정 풀기' : '🔒 고정'}</button><button class="btn sm" data-a="scPut" data-v="${i}"${dis || pn}>📂 ${c.file ? '바꾸기' : '넣기'}</button>${c.file ? `<button class="btn sm ghost" data-a="scDel" data-v="${i}"${dis || pn}>🗑 빼기</button>` : ''}</div>
        <div class="row"><button class="btn sm hotSm" data-a="fTapGo"${dis}>🎵 톡톡 넘기기</button><button class="btn sm ghost keepSm" data-a="fKeep">${T.keep === 'follow' ? '🚃 뒤 장면 따라감' : '📍 뒤 장면 제자리'}</button><button class="btn sm ghost" data-a="scCopy" data-v="${i}">🔄 장면 다시 요청</button></div>
        <p class="muted" style="margin:2px 0 0;font-size:.78rem">🔒 고정 = 다 맞춘 장면을 잠가서 그림 · 시간이 안 바뀌게 (자막 톡은 돼요) · 🗑 빼기 = 그림만 빼고 칸은 남겨요 · 🔪 분할 = 커서에서 장면을 둘로 나눠요 · ❌ 삭제 = 이 장면 칸을 없애요 · 🔄 다시 요청 = ChatGPT에 다시 그려 달라는 글 복사</p>
        <div class="muted tapNow" style="margin-top:4px"></div>
      </div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-a="fSnap"${dis}>🧲 가사 줄에 맞춰 장면 넘기기</button><button class="btn sm" data-a="thSheet">🖼 썸네일</button><button class="btn sm" data-a="enSheet">🏁 엔딩</button></div>
      <details class="grp"><summary>⏱ 쓰는 법</summary><ol style="padding-left:18px;font-size:.85rem;margin:6px 0">
        <li>▶ 로 노래를 듣다가 장면을 바꾸고 싶은 곳에서 ⏸ → ◀ 0.1초 ▶ 로 커서를 딱 맞춰요.</li>
        <li><b>✂️ 여기서 끝</b> — 커서가 있는 장면을 여기까지로, 다음 장면이 여기서 시작해요.</li>
        <li><b>➡️ 앞 장면 여기까지</b> — 장면이 너무 일찍 바뀌었을 때, 앞 장면을 커서까지 늘려요.</li>
        <li><b>🔪 분할</b> — 커서 자리에서 장면을 둘로 나눠요 (두 칸 다 같은 그림 · 뒤 칸에 📂 바꾸기로 다른 그림).</li>
        <li><b>⬅️ 뒤 장면 여기부터</b> — 장면이 너무 늦게 바뀔 때, 뒤 장면이 커서부터 시작해요 (옆 장면만 바뀌어요).</li>
        <li><b>◀ 앞으로 · 뒤로 ▶</b> — 고른 장면의 그림을 옆 칸과 바꿔요. 시간 칸은 그대로라 자막이 흐트러지지 않아요.</li>
        <li><b>🔒 고정</b> — 다 맞춘 장면은 고정! 풀기 전까지 그림 · 시작 · 끝 시간이 안 바뀌어요.</li>
        <li><b>🎵 톡톡 넘기기</b> — 노래를 들으며 「다음 장면!」 순간마다 톡. 처음부터 끝까지 한 번에.</li>
        <li><b>📍 제자리</b>: 바로 옆 장면만 바뀌어요 · <b>🚃 따라감</b>: 뒤 장면 전부가 함께 밀려요.</li>
        <li><b>▶ 이 장면만</b> — 그 장면만 나오고 멈춰요. <b>다음 장면 ▶</b> 은 노래가 이어서 나와요.</li></ol></details>`;
  }
  function fillAct(a, v, el) {
    const p = P(), s = S(), t = now();
    switch (a) {
      case 'fNud': return s.player.seek(clamp(t + +v, 0, dur()));
      case 'fKeep': T.keep = T.keep === 'stay' ? 'follow' : 'stay'; return refreshView();
      case 'fCut': { if (p.locked) return; const i = sceneIdx(t), c = p.scenes[i]; if (!p.scenes[i + 1]) return U().toast('마지막 장면은 노래 끝까지예요'); if (t - c.s < .3) return U().toast('커서를 장면 안쪽으로 옮겨 주세요'); snap(); setBoundary(i + 1, t, T.keep); T.fsel = i; changed(); return U().toast(`✂️ 장면 ${i + 1} 여기서 끝`); }
      case 'fPrev': { if (p.locked) return; const i = sceneIdx(t); if (i < 1) return U().toast('첫 장면이에요'); snap(); setBoundary(i, t, T.keep); T.fsel = i - 1; changed(); return U().toast(`➡️ 장면 ${i} 을(를) 여기까지 늘렸어요`); }
      case 'fNextHere': { if (p.locked) return; const i = sceneIdx(t), c = p.scenes[i]; if (!p.scenes[i + 1]) return U().toast('마지막 장면이에요 (뒤 장면이 없어요)'); if (t - c.s < .3) return U().toast('커서를 장면 안쪽으로 옮겨 주세요'); snap(); setBoundary(i + 1, t, 'stay'); T.fsel = i + 1; changed(); return U().toast(`⬅️ 장면 ${i + 2}이(가) 여기부터 시작해요`); }
      case 'fMove': { if (p.locked) return; const i = T.fsel != null ? clamp(T.fsel, 0, p.scenes.length - 1) : sceneIdx(t), j = i + +v, A = p.scenes[i], B = p.scenes[j]; if (!B) return U().toast(+v < 0 ? '맨 앞 장면이에요' : '맨 뒤 장면이에요');
        if (A.pin || B.pin) return U().toast(`🔒 ${A.pin ? i + 1 : j + 1}번이 고정돼 있어요 · 풀고 옮겨 주세요`, 3500);
        snap(); const ta = [A.s, A.e], tb = [B.s, B.e]; p.scenes[i] = B; p.scenes[j] = A; B.s = ta[0]; B.e = ta[1]; A.s = tb[0]; A.e = tb[1];
        p.scenes.forEach((o, k) => { if (o.reuse == null) return; if (o.reuse === i) o.reuse = j; else if (o.reuse === j) o.reuse = i; if (o.reuse === k) o.reuse = null; });
        T.fsel = j; changed(); s.player.seek(A.s + .05); return U().toast(`↔ ${i + 1}번 그림을 ${j + 1}번 자리로 옮겼어요`); }
      case 'fSplit': { if (p.locked) return; const i = sceneIdx(t), c = p.scenes[i]; if (c.pin) return U().toast(`🔒 ${i + 1}번이 고정돼 있어요`);
        if (t - c.s < .3 || c.e - t < .3) return U().toast('커서를 장면 안쪽으로 옮겨 주세요 (끝에서 0.3초 넘게)'); snap();
        const n = Object.assign({}, c, { id: 'p' + Date.now().toString(36), s: t, e: c.e, off: +((c.off || 0) + (t - c.s) * (c.speed || 1)).toFixed(2), pin: false, auto: c.auto }); c.e = t;
        p.scenes.forEach(o => { if (o.reuse != null && o.reuse > i) o.reuse++; }); if (p.cpNext > i) p.cpNext++;
        p.scenes.splice(i + 1, 0, n); T.fsel = i + 1; changed(); return U().toast(`🔪 장면 ${i + 1}을(를) 둘로 나눴어요 · 뒤 칸은 ${i + 2}번`); }
      case 'fPrevSc': { const k = (T.fsel != null ? T.fsel : sceneIdx(t)) - 1; if (k < 0) return U().toast('첫 장면이에요'); const c = p.scenes[k]; T.fsel = k; refreshView(); return s.player.play(c.s, c.e - .02); }
      case 'fPin': { const i = +v, c = p.scenes[i]; if (!c) return; snap(); c.pin = !c.pin; changed(); return U().toast(c.pin ? `🔒 장면 ${i + 1} 고정 · 풀기 전까지 그림 · 시간이 안 바뀌어요` : `🔓 장면 ${i + 1} 고정을 풀었어요`); }
      case 'fBlank': return U().sheet('⬜ 빈칸 넣기', `<p class="muted">지금 위치(${fmt(t)})에 빈칸을 넣어요. 나중에 그림을 넣거나 검은 화면으로 둬요.</p><div class="chips">${[1, 2, 3, 4, 6, 8].map(n => chip('fBlankGo', n, false, n + '초')).join('')}</div>`);
      case 'fBlankGo': { U().sheetClose(); snap(); const i = sceneIdx(t), c = p.scenes[i], len = +v, oe = c.e; if (t - c.s < .2) return;
        const bl = { id: 'b' + Date.now().toString(36), s: t, e: +(t + len).toFixed(2), file: null, kind: null, thumb: '', prompt: '', name: '' }; c.e = t;
        const ins = [bl]; if (bl.e < oe - .3) ins.push(Object.assign({}, c, { id: 'r' + Date.now().toString(36), s: bl.e, e: oe, off: +((c.off || 0) + (bl.e - c.s) * (c.speed || 1)).toFixed(2) }));
        p.scenes.splice(i + 1, 0, ...ins); const j = i + 1 + ins.length;
        if (bl.e > oe && p.scenes[j]) setBoundary(j, bl.e, T.keep);
        T.fsel = i + 1; changed(); return U().toast(`⬜ ${len}초 빈칸을 넣었어요`); }
      case 'fTapGo': if (p.locked) return; snap(); T.tapMode = true; T.tapJ = sceneIdx(t) + 1; T.tapStack = []; refreshView(); return s.player.play();
      case 'fTap': { if (!s.player.playing()) return s.player.play(); const j = T.tapJ; if (!p.scenes[j]) { U().toast('🎉 마지막 장면까지 맞췄어요'); T.tapMode = false; return refreshView(); }
        const g0 = pinSig(p); T.tapStack.push(JSON.stringify(p.scenes)); setBoundary(j, Math.max(0, t - .12), 'follow');
        if (pinSig(p) !== g0) { p.scenes = JSON.parse(T.tapStack.pop()); T.tapMode = false; s.player.pause(); changed(); return U().toast('🔒 고정한 장면이 있어서 톡톡 넘기기를 멈췄어요 · 그 앞까지만 맞췄어요', 4000); } T.tapJ++; s.player.refresh(); U().save(); tlRender('fill'); const st = document.querySelector('.tapScene .muted b'); if (st) st.textContent = T.tapJ;
        if (el) { el.style.filter = 'brightness(1.4)'; setTimeout(() => el.style.filter = '', 120); } return; }
      case 'fTapUndo': { if (!T.tapStack || !T.tapStack.length) return; p.scenes = JSON.parse(T.tapStack.pop()); T.tapJ = Math.max(1, T.tapJ - 1); s.player.refresh(); U().save(); const prev = p.scenes[T.tapJ - 1]; tlRender('fill'); return s.player.play(Math.max(0, prev.s - .3)); }
      case 'fTapStop': T.tapMode = false; s.player.pause(); return changed();
      case 'fPlay': { const i = T.fsel != null ? T.fsel : sceneIdx(t), c = p.scenes[i]; T.fsel = i; return s.player.play(c.s, c.e - .02); }
      case 'fNext': { const i = Math.min(p.scenes.length - 1, (T.fsel != null ? T.fsel : sceneIdx(t)) + 1), c = p.scenes[i]; T.fsel = i; refreshView(); return s.player.play(c.s, c.e - .02); }
      case 'fLyTap': { if (!s.player.playing()) { const i = T.fsel != null ? T.fsel : sceneIdx(t), c = p.scenes[i]; return s.player.play(Math.max(0, c.s - .2), c.e + .25); } return U().act('tap', null, el); }
      case 'fSnap': { const CL = MV.capLines(p); if (!CL.length) return U().toast('먼저 ③ 음악에서 가사 시간을 맞춰 주세요', 3500); snap(); let n = 0;
        for (let j = 1; j < p.scenes.length; j++) { const b = p.scenes[j].s; let best = null; for (const c of CL) if (Math.abs(c.s - b) < 1.6 && (best == null || Math.abs(c.s - b) < Math.abs(best - b))) best = c.s; if (best != null && Math.abs(best - b) > .05) { if (setBoundary(j, best, 'stay')) n++; } }
        changed(); return U().toast(n ? `🧲 ${n}곳을 가사 줄 시작에 붙였어요` : '붙일 곳이 없어요 (1.6초 안쪽)'); }
    }
    return null;
  }

  /* ═════════ 🖼 썸네일 · 🏁 엔딩 ═════════ */
  function thumbSheet() {
    const p = P(), th = p.thumb, sc = (p.scenes || []).map((s, i) => [s, i]).filter(a => a[0].file);
    return `<div class="row"><span class="lbl">썸네일</span><div class="chips">${chip('thOn', 1, th.on, '켜기')}${chip('thOn', 0, !th.on, '끄기')}</div></div>
      <div class="row"><span class="lbl">보이는 길이</span><div class="chips">${[2, 2.5, 3, 4].map(n => chip('thDur', n, th.dur === n, n + '초')).join('')}</div></div>
      <div class="field"><label>🖼 썸네일 사진 <span class="muted">(또렷하게 · 흐리게 하지 않아요)</span></label>
        <div class="thPick">${p.look && p.look.heroThumb ? `<button type="button" class="${th.src === 'hero' ? 'on' : ''}" data-a="thSrc" data-v="hero"><img src="${p.look.heroThumb}" alt=""><i>🧑 주인공</i></button>` : ''}${sc.map(([s, i]) => `<button type="button" class="${th.src === 'scene' && th.k === i ? 'on' : ''}" data-a="thSrc" data-v="scene:${i}"><img src="${s.thumb}" alt=""><i>${i + 1}</i></button>`).join('')}</div>
        <button class="btn sm" data-a="thFile">📂 다른 사진 넣기</button>${th.src === 'file' ? ' <span class="cpd ok">📂 내 사진</span>' : ''}</div>
      <div class="field"><label>큰 제목</label><input type="text" data-tcard="title" value="${esc(th.title || '')}" placeholder="${esc(p.title || '예: 할수있어')}"></div>
      <div class="field"><label>작은 글</label><input type="text" data-tcard="sub" value="${esc(th.sub || '')}" placeholder="예: 삼성생명 서문지점 · 노래 방극률"></div>
      <div class="row"><span class="lbl">글씨 위치</span><div class="chips">${[['top', '⬆ 위'], ['middle', '⏺ 가운데'], ['bottom', '⬇ 아래']].map(a => chip('thPos', a[0], (th.pos || 'bottom') === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">글씨 색</span><div class="chips">${[['#ffffff', '⚪'], ['#ffe14d', '🟡'], ['#f9a8d4', '🩷'], ['#7dd3fc', '🔵'], ['#86efac', '🟢']].map(a => chip('thCol', a[0], (th.color || '#ffffff') === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">글꼴</span><div class="chips">${[['blackhan', '검은고딕'], ['jua', '주아'], ['dohyeon', '도현'], ['noto', '본고딕'], ['gowunbatang', '명조'], ['nanumpen', '손글씨']].map(a => chip('thFont', a[0], (th.font || 'blackhan') === a[0], a[1])).join('')}</div></div>
      <button class="btn pink big" data-a="thSave">⬇ 썸네일 그림으로 저장 (유튜브 표지용)</button>
      <p class="muted">영상 맨 앞에 ${th.dur}초 보여 주고, 노래는 처음부터 같이 흘러요.</p>`;
  }
  function endSheet() {
    const e = P().endc;
    return `<div class="row"><span class="lbl">엔딩</span><div class="chips">${chip('enOn', 1, e.on, '켜기')}${chip('enOn', 0, !e.on, '끄기')}</div></div>
      <div class="row"><span class="lbl">길이</span><div class="chips">${[3, 5, 8].map(n => chip('enDur', n, e.dur === n, n + '초')).join('')}</div></div>
      <div class="row"><span class="lbl">BK 아이콘</span><div class="chips">${chip('enLogo', 1, e.logo !== false, '보이기')}${chip('enLogo', 0, e.logo === false, '숨기기')}</div></div>
      <div class="field"><label>만든 사람</label><input type="text" data-ecard="by" value="${esc(e.by || '')}" placeholder="BK AGENT"></div>
      <div class="field"><label>감사 글</label><input type="text" data-ecard="msg" value="${esc(e.msg || '')}" placeholder="들어 주셔서 감사합니다"></div>
      <p class="muted">노래 마지막 ${e.dur}초 위에 나와요.</p>`;
  }
  function openSheet(title, fn) { T.sheetFn = fn; T.sheetTitle = title; U().sheet(title, fn()); }
  function reSheet() { const o = $('sheet'), hd = o && o.querySelector('.sheetHd b'); if (T.sheetFn && o && !o.classList.contains('hide') && hd && hd.textContent === T.sheetTitle) U().sheet(T.sheetTitle, T.sheetFn()); else T.sheetFn = null; }
  async function cardAct(a, v) {
    const p = P(), th = p.thumb, en = p.endc;
    switch (a) {
      case 'thSheet': return openSheet('🖼 썸네일', thumbSheet);
      case 'enSheet': return openSheet('🏁 엔딩', endSheet);
      case 'thOn': snap(); th.on = v === '1'; return changed();
      case 'thDur': snap(); th.dur = +v; return changed();
      case 'thSrc': { if (v === 'hero') th.src = 'hero'; else { th.src = 'scene'; th.k = +v.split(':')[1]; } await MV.loadCards(p); return changed(); }
      case 'thFile': { const [f] = await U().pickFiles('image/*'); if (!f) return; if (th.file) MV.delFile(th.file); th.file = await MV.putFile(f, f.name); th.src = 'file'; await MV.loadCards(p); return changed(); }
      case 'thPos': th.pos = v; return changed();
      case 'thCol': th.color = v; return changed();
      case 'thFont': th.font = v; try { await document.fonts.load(`900 40px ${g.BKFX.fam(v)}`, th.title || p.title || '가'); } catch (e) { /* 기본 */ } return changed();
      case 'thSave': { U().toast('🖼 만드는 중…'); const [W, H] = p.ratio === '9:16' ? [1080, 1920] : [1280, 720], b = await MV.thumbImage(p, W, H); const u = URL.createObjectURL(b), x = document.createElement('a'); x.href = u; x.download = (p.title || 'BK뮤비') + '_썸네일.jpg'; document.body.appendChild(x); x.click(); x.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return U().toast('⬇ 썸네일을 휴대폰에 저장했어요', 3500); }
      case 'enOn': snap(); en.on = v === '1'; return changed();
      case 'enDur': snap(); en.dur = +v; return changed();
      case 'enLogo': en.logo = v === '1'; return changed();
    }
    return null;
  }

  /* ═════════ ⑤ 다듬기 (BK에딧 편집 모양) ═════════ */
  function selDesc() {
    const p = P(), s = T.esel; if (!s) { const i = sceneIdx(now()); return `🎞 장면 ${i + 1} (커서 자리)`; }
    if (s.k === 'sc') { const c = p.scenes[s.i]; if (!c) { T.esel = null; return selDesc(); } return `🎞 장면 ${s.i + 1} · ${(c.e - c.s).toFixed(1)}초`; }
    if (s.k === 'ly') return `💬 ${esc(((p.lines || [])[s.i] || {}).t || '')}`;
    if (s.k === 'mu') return '🎵 노래';
    if (s.k === 'th') return '🖼 썸네일'; if (s.k === 'en') return '🏁 엔딩';
    return { efx: '✨ 화면 효과', stk: '😀 스티커', sfx: '🔔 효과음' }[s.k] || '';
  }
  function editPart() {
    return `<div class="edBox">
      <div class="edBar"><span class="edT"><b id="edNow">${fmt(now())}</b> / ${fmt0(dur())}</span><button type="button" class="edPlay" data-a="pp" id="edPP">▶</button><button type="button" class="edU" data-a="tlUndo"${T.undo.length ? '' : ' disabled'}>↩</button><button type="button" class="edU" data-a="tlRedo"${T.redo.length ? '' : ' disabled'}>↪</button></div>
      ${tlHTML('edit')}
      <div class="edSel" id="edSel">고른 것: ${selDesc()}</div>
      <div class="edTools">${[['edAdd', '➕', '넣기'], ['edSplit', '✂️', '분할'], ['edTrim', '📐', '자르기'], ['edDel', '🗑', '삭제', 'red'], ['edCap', '💬', '자막'], ['edAudio', '🎵', '오디오'], ['edFx', '✨', '효과'], ['edMore', '⚙️', '더 보기']].map(b => `<button type="button" data-a="${b[0]}" class="${b[3] || ''}"><span>${b[1]}</span>${b[2]}</button>`).join('')}</div>
    </div>`;
  }
  function selScene() { const s = T.esel; return s && s.k === 'sc' ? s.i : sceneIdx(now()); }
  function trimSheet() {
    const p = P(), i = selScene(), c = p.scenes[i];
    return `<p><b>🎞 장면 ${i + 1}</b> · ${fmt(c.s)} ~ ${fmt(c.e)} (${(c.e - c.s).toFixed(1)}초)</p>
      ${i > 0 ? `<div class="row"><span class="lbl">앞 자르기</span>${[-.5, -.1, .1, .5].map(d => `<button class="btn sm" data-a="trB" data-v="${i}:${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}<button class="btn sm main" data-a="trCur" data-v="${i}">커서까지</button></div>` : ''}
      ${p.scenes[i + 1] ? `<div class="row"><span class="lbl">뒤 자르기</span>${[-.5, -.1, .1, .5].map(d => `<button class="btn sm" data-a="trB" data-v="${i + 1}:${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}<button class="btn sm main" data-a="trCur" data-v="${i + 1}">커서부터</button></div>` : ''}
      ${c.kind === 'video' ? `<div class="row"><span class="lbl">영상 시작점</span>${[-1, -.5, .5, 1].map(d => `<button class="btn sm" data-a="trOff" data-v="${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}<span class="muted">${(c.off || 0).toFixed(1)}초부터</span></div>` : ''}
      <div class="row"><span class="lbl">뒤 장면</span><div class="chips">${chip('fKeep2', 'stay', T.keep === 'stay', '📍 제자리')}${chip('fKeep2', 'follow', T.keep === 'follow', '🚃 따라감')}</div></div>`;
  }
  function capSheet() {
    const p = P(), L = p.lines || [], s = T.esel; let i = s && s.k === 'ly' ? s.i : MV.lineAt(p, now());
    if (i < 0) { return `<p class="muted">커서 자리에 자막이 없어요. 고칠 줄을 고르세요.</p><div class="lines">${L.map((l, k) => `<div class="ln"><span class="t${l.s == null ? ' no' : ''}">${l.s == null ? '--:--' : fmt(l.s)}</span><span class="x" data-a="capPick" data-v="${k}">${esc(l.t)}</span></div>`).join('')}</div>`; }
    const l = L[i], c = MV.capLines(p).find(q => q.i === i);
    return `<p><b>💬 ${i + 1}번 줄</b> · ${esc(l.t)}</p>
      <div class="row"><span class="lbl">시작 ${l.s != null ? fmt(l.s) : ''}</span>${[-.5, -.1, .1, .5].map(d => `<button class="btn sm" data-a="lyS" data-v="${i}:${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}<button class="btn sm" data-a="lnNow" data-v="${i}">⏱ 지금</button></div>
      <div class="row"><span class="lbl">끝 ${c ? fmt(c.e) : ''}</span>${[-.5, -.1, .1, .5].map(d => `<button class="btn sm" data-a="lyE" data-v="${i}:${d}">${d > 0 ? '+' : ''}${d}</button>`).join('')}<button class="btn sm" data-a="lyEauto" data-v="${i}">자동</button></div>
      <div class="row"><button class="btn sm" data-a="lnText" data-v="${i}">✏️ 글 고치기</button>${L[i + 1] ? `<button class="btn sm" data-a="capJoin" data-v="${i}">🔗 다음 줄과 합치기</button>` : ''}<button class="btn sm" data-a="capSplit" data-v="${i}">✂️ 두 줄로 나누기</button><button class="btn sm main" data-a="lnPlay" data-v="${i}">▶</button><button class="btn sm ghost" data-a="lyOff" data-v="${i}">🚫 빼기</button></div>`;
  }
  function audioSheet() {
    const p = P(), f = p.fx;
    return `<div class="row"><span class="lbl">소리 크기</span><div class="chips">${[[.6, '작게'], [.8, '조금 작게'], [1, '그대로'], [1.2, '크게']].map(a => chip('vol', a[0], f.vol === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">처음 커지기</span><div class="chips">${[[0, '없음'], [1, '1초'], [2, '2초'], [3, '3초']].map(a => chip('auFi', a[0], (f.afi || 0) === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">끝 작아지기</span><div class="chips">${[[0, '없음'], [1.5, '1.5초'], [2.5, '2.5초'], [4, '4초']].map(a => chip('fadeOut', a[0], f.fadeOut === a[0], a[1])).join('')}</div></div>
      <h4 style="margin:10px 0 4px">✂️ 노래 자르기 <span class="muted">(장면 · 자막 · 효과도 같이 당겨져요 · ↩ 되돌리기 가능)</span></h4>
      <div class="row"><button class="btn sm" data-a="auCut" data-v="head">⏮ 커서 앞부분 지우기 (전주 줄이기)</button><button class="btn sm" data-a="auCut" data-v="tail">커서 뒷부분 지우기 ⏭</button></div>
      <div class="row"><button class="btn sm ${T.cutA != null ? 'main' : ''}" data-a="auCutA">📍 구간 시작: ${T.cutA != null ? fmt(T.cutA) : '여기부터'}</button><button class="btn sm pink" data-a="auCutB"${T.cutA != null ? '' : ' disabled'}>🗑 여기까지 지우기</button></div>
      <p class="muted">지금 노래 길이 ${fmt0(dur())}${p.song.full && Math.abs(p.song.full - dur()) > .2 ? ` (원래 ${fmt0(p.song.full)})` : ''}</p>`;
  }
  function fxSheet() {
    const F = g.BKFX;
    return `<p class="muted">📍 커서 자리(${fmt(now())})에 넣어요</p>
      <h4 style="margin:6px 0">✨ 화면 효과 (3초)</h4><div class="chips">${Object.entries(F.EFX).map(([k, t]) => chip('edEfx', k, false, t)).join('')}</div>
      <h4 style="margin:10px 0 6px">😀 스티커 (3초)</h4><div class="emo">${F.EMOJI.map(e => `<button type="button" data-a="edStk" data-v="${e}">${e}</button>`).join('')}</div>
      <h4 style="margin:10px 0 6px">🔔 효과음</h4><div class="chips">${Object.entries(F.SFX).map(([k, t]) => chip('edSfx', k, false, t)).join('')}</div>
      <button class="btn sm" data-a="open" data-v="4" style="margin-top:10px">✨ 효과 단계에서 더 자세히</button>`;
  }
  function moreSheet() {
    const p = P(), i = selScene(), c = p.scenes[i] || {};
    return `<h4 style="margin:0 0 6px">🎞 장면 ${i + 1}</h4>
      ${c.kind === 'video' ? `<div class="row"><span class="lbl">속도</span><div class="chips">${[[.5, '0.5배'], [.75, '0.75배'], [1, '보통'], [1.5, '1.5배'], [2, '2배']].map(a => chip('mSpeed', a[0], (c.speed || 1) === a[0], a[1])).join('')}</div></div>` : ''}
      <div class="row"><span class="lbl">화면 맞춤</span><div class="chips">${[['cover', '꽉 채우기'], ['blur', '흐린 배경'], ['contain', '전체 보이기']].map(a => chip('mFit', a[0], (c.fit || 'cover') === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">확대</span><div class="chips">${[[1, '그대로'], [1.2, '1.2배'], [1.5, '1.5배'], [2, '2배']].map(a => chip('mZoom', a[0], (c.zoom || 1) === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">위치</span><div class="chips">${[['0:0', '가운데'], ['-1:0', '◀ 왼쪽'], ['1:0', '오른쪽 ▶'], ['0:-1', '▲ 위'], ['0:1', '▼ 아래']].map(a => chip('mPos', a[0], `${c.px || 0}:${c.py || 0}` === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">장면 페이드</span><div class="chips">${[[0, '들어올 때 없음'], [.5, '0.5초'], [1, '1초']].map(a => chip('mFi', a[0], (c.fi || 0) === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl"></span><div class="chips">${[[0, '나갈 때 없음'], [.5, '0.5초'], [1, '1초']].map(a => chip('mFo', a[0], (c.fo || 0) === a[0], a[1])).join('')}</div></div>
      <div class="row"><button class="btn sm ${c.freeze ? 'main' : ''}" data-a="mFreeze">⏸ 멈춤 화면 ${c.freeze ? '켜짐' : ''}</button><button class="btn sm ${c.flip ? 'main' : ''}" data-a="mFlip">↔️ 좌우 뒤집기 ${c.flip ? '켜짐' : ''}</button></div>
      <div class="row"><span class="lbl">순서</span><button class="btn sm" data-a="mMove" data-v="-1"${i ? '' : ' disabled'}>◀ 앞으로</button><button class="btn sm" data-a="mMove" data-v="1"${p.scenes[i + 1] ? '' : ' disabled'}>뒤로 ▶</button><button class="btn sm" data-a="mDup"${p.scenes[i + 1] ? '' : ' disabled'}>📄 다음 장면에 복사</button></div>
      <h4 style="margin:10px 0 6px">📱 화면 모양</h4><div class="chips">${chip('ratio', '16:9', p.ratio === '16:9', '🖥 가로 16:9')}${chip('ratio', '9:16', p.ratio === '9:16', '📱 세로 9:16')}</div>
      <div class="row" style="margin-top:8px"><button class="btn sm" data-a="thSheet">🖼 썸네일</button><button class="btn sm" data-a="enSheet">🏁 엔딩</button></div>`;
  }
  /* 노래 구간 지우기 [a, b] (화면 시간) → 노래 · 장면 · 자막 · 효과 함께 당기기 */
  function cutRange(a, b) {
    const p = P(), D = dur(); a = clamp(a, 0, D); b = clamp(b, 0, D); if (b - a < .2) return false;
    const segs = [], d = b - a; let acc = 0;
    for (const [x, y] of MV.segs(p)) { const s0 = acc, s1 = acc + (y - x); if (s1 <= a || s0 >= b) segs.push([x, y]); else { if (s0 < a) segs.push([x, x + (a - s0)]); if (s1 > b) segs.push([x + (b - s0), y]); } acc = s1; }
    const map = t => t < a ? t : t > b ? t - d : a;
    const out = []; for (const sc of p.scenes) { const ns = map(sc.s), ne = map(sc.e); if (ne - ns < .2) { if (sc.file && !p.scenes.some(o => o !== sc && o.file === sc.file)) MV.delFile(sc.file); continue; } if (sc.s >= a && sc.s < b) sc.off = +((sc.off || 0) + (b - sc.s) * (sc.speed || 1)).toFixed(2); sc.s = +ns.toFixed(2); sc.e = +ne.toFixed(2); out.push(sc); }
    if (!out.length) return false; out[0].s = 0; for (let k = 1; k < out.length; k++) out[k].s = out[k - 1].e; out[out.length - 1].e = +(D - d).toFixed(2); p.scenes = out;
    (p.lines || []).forEach(l => { if (l.s == null) return; if (l.s >= a && l.s < b) { l.s = null; l.e = null; } else { l.s = +map(l.s).toFixed(2); if (l.e != null) l.e = +map(l.e).toFixed(2); } });
    p.efx = (p.efx || []).filter(e => { const ns = map(e.start), ne = map(e.start + e.dur); if (ne - ns < .2) return false; e.start = +ns.toFixed(2); e.dur = +(ne - ns).toFixed(2); return true; });
    p.stk = (p.stk || []).filter(e => { const ns = map(e.start), ne = map(e.start + e.dur); if (ne - ns < .2) return false; e.start = +ns.toFixed(2); e.dur = +(ne - ns).toFixed(2); return true; });
    p.sfx = (p.sfx || []).filter(z => !(z.at >= a && z.at < b)).map(z => Object.assign(z, { at: +map(z.at).toFixed(2) }));
    p.song.segs = segs; p.song.dur = +(D - d).toFixed(2); T.esel = null; T.fsel = null; return true;
  }
  async function editAct(a, v, el) {
    const p = P(), s = S(), t = now();
    const sc = () => p.scenes[selScene()];
    switch (a) {
      case 'edAdd': return openSheet('➕ 넣기', () => `<p class="muted">📍 커서 자리(${fmt(now())}) · 장면 ${sceneIdx(now()) + 1}</p>
        <button class="btn big" data-a="adPut">📂 이 장면 그림 · 영상 바꾸기</button><button class="btn big" data-a="adSplit" style="margin-top:6px">✂️ 커서에서 나눠서 뒤에 새 그림 넣기</button><button class="btn big" data-a="adLib" style="margin-top:6px">🗂 내 보관함에서 골라 이 장면에</button>`);
      case 'adPut': { U().sheetClose(); const i = sceneIdx(t), [f] = await U().pickFiles('image/*,video/*'); if (!f) return; snap(); await U().putScene(i, f); return changed(); }
      case 'adSplit': { U().sheetClose(); const i = sceneIdx(t), c = p.scenes[i]; if (t - c.s < .3 || c.e - t < .3) return U().toast('커서를 장면 안쪽으로 옮겨 주세요'); const [f] = await U().pickFiles('image/*,video/*'); if (!f) return; snap();
        const nw = { id: 'n' + Date.now().toString(36), s: t, e: c.e, file: null, kind: null, thumb: '', prompt: c.prompt || '', name: '' }; c.e = t; p.scenes.splice(i + 1, 0, nw); await U().putScene(i + 1, f); T.esel = { k: 'sc', i: i + 1 }; return changed(); }
      case 'adLib': U().sheetClose(); return U().libPick(sceneIdx(t), 1);
      case 'edSplit': { const i = sceneIdx(t), c = p.scenes[i]; if (t - c.s < .3 || c.e - t < .3) return U().toast('커서를 장면 안쪽(가운데쪽)으로 옮긴 뒤 눌러 주세요', 3000); snap();
        const nw = Object.assign({}, c, { id: 's' + Date.now().toString(36), s: t, off: +((c.off || 0) + (t - c.s) * (c.speed || 1)).toFixed(2), tr: 'cut' }); c.e = t; p.scenes.splice(i + 1, 0, nw); T.esel = { k: 'sc', i: i + 1 }; changed(); return U().toast('✂️ 나눴어요'); }
      case 'edTrim': return openSheet('📐 자르기', trimSheet);
      case 'trB': { const [j, d] = v.split(':'); snap(); setBoundary(+j, p.scenes[+j].s + +d, T.keep); return changed(); }
      case 'trCur': { snap(); setBoundary(+v, t, T.keep); return changed(); }
      case 'trOff': { const c = sc(), m = MV.mediaGet(c.file); snap(); c.off = +clamp((c.off || 0) + +v, 0, Math.max(0, ((m && m.dur) || 8) - .5)).toFixed(2); return changed(); }
      case 'fKeep2': T.keep = v; return reSheet();
      case 'edDel': { const se = T.esel || { k: 'sc', i: sceneIdx(t) };
        if (se.k === 'sc') { const i = se.i, c = p.scenes[i]; if (p.scenes.length < 2) return U().toast('장면이 하나뿐이에요'); if (!confirm(`장면 ${i + 1}을(를) 지울까요? (앞 장면이 그 시간을 이어받아요)`)) return; snap();
          rmScene(p, i); T.esel = null; changed(); return U().toast('🗑 지웠어요 · ↩ 로 되살려요'); }
        if (se.k === 'ly') { snap(); p.lines[se.i].s = null; p.lines[se.i].e = null; T.esel = null; return changed(); }
        if (se.k === 'efx' || se.k === 'stk' || se.k === 'sfx') { snap(); p[se.k].splice(se.i, 1); T.esel = null; return changed(); }
        if (se.k === 'th') { snap(); p.thumb.on = false; T.esel = null; return changed(); } if (se.k === 'en') { snap(); p.endc.on = false; T.esel = null; return changed(); }
        return U().toast('지울 것을 아래 줄에서 골라 주세요'); }
      case 'edCap': return openSheet('💬 자막', capSheet);
      case 'fScDel': { if (p.locked) return U().toast('🔒 잠겨 있어요'); const i = +v; if (p.scenes.length < 2) return U().toast('장면이 하나뿐이에요'); if (!confirm(`장면 ${i + 1} 칸을 없앨까요? (${i ? '앞' : '뒤'} 장면이 그 시간을 이어받아요 · ↩ 되돌리기로 되살릴 수 있어요)`)) return; snap(); rmScene(p, i); T.fsel = Math.max(0, i - 1); changed(); const c = p.scenes[T.fsel]; if (c) s.player.seek(c.s + .05); return U().toast(`❌ 장면 ${i + 1}을(를) 지웠어요 · ↩ 로 되살려요`); }
      case 'capPick': T.esel = { k: 'ly', i: +v }; if (p.lines[+v].s != null) s.player.seek(p.lines[+v].s); return reSheet();
      case 'capJoin': { const i = +v, l = p.lines[i], n = p.lines[i + 1]; snap(); l.t = (l.t + ' ' + n.t).trim(); l.e = n.e; p.lines.splice(i + 1, 1); return changed(); }
      case 'capSplit': { const i = +v, l = p.lines[i], tx = prompt('어디서 나눌까요? 나눌 자리에 | 를 넣어 주세요', l.t); if (!tx || tx.indexOf('|') < 0) return; const [x1, x2] = tx.split('|'); snap(); const c = MV.capLines(p).find(q => q.i === i); const mid = l.s != null && c ? +((l.s + c.e) / 2).toFixed(2) : null;
        p.lines.splice(i, 1, { t: x1.trim(), s: l.s, e: mid, sec: l.sec }, { t: x2.trim(), s: mid, e: l.e, sec: l.sec }); return changed(); }
      case 'edAudio': return openSheet('🎵 오디오', audioSheet);
      case 'auFi': p.fx.afi = +v; return changed();
      case 'auCut': { if (!confirm(v === 'head' ? `처음 ~ ${fmt(t)} 를 지울까요?` : `${fmt(t)} ~ 끝을 지울까요?`)) return; snap(); const ok = v === 'head' ? cutRange(0, t) : cutRange(t, dur()); if (!ok) { T.undo.pop(); return U().toast('지울 부분이 너무 짧아요'); } await s.player.seek(v === 'head' ? 0 : Math.max(0, t - 2)); changed(); return U().toast('✂️ 지웠어요 · ↩ 로 되살려요'); }
      case 'auCutA': T.cutA = t; U().toast('📍 구간 시작을 정했어요 · 커서를 끝으로 옮기고 「여기까지 지우기」'); return reSheet();
      case 'auCutB': { if (T.cutA == null) return; const a0 = Math.min(T.cutA, t), b0 = Math.max(T.cutA, t); if (!confirm(`${fmt(a0)} ~ ${fmt(b0)} 를 지울까요?`)) return; snap(); if (!cutRange(a0, b0)) { T.undo.pop(); return U().toast('구간이 너무 짧아요'); } T.cutA = null; await s.player.seek(a0); changed(); return U().toast('🗑 구간을 지웠어요 · ↩ 로 되살려요'); }
      case 'edFx': return openSheet('✨ 효과', fxSheet);
      case 'edEfx': snap(); p.efx.push({ k: v, start: t, dur: Math.min((g.BKFX.EFX_DUR || {})[v] || 3, dur() - t) }); changed(); return U().toast('✨ 넣었어요');
      case 'edStk': snap(); p.stk.push({ e: v, start: t, dur: Math.min(3, dur() - t), x: .5, y: .3, size: 1 }); changed(); return U().toast('😀 넣었어요');
      case 'edSfx': s.player.sfx(v); snap(); p.sfx.push({ k: v, at: t }); changed(); return U().toast('🔔 넣었어요');
      case 'edMore': return openSheet('⚙️ 더 보기', moreSheet);
      case 'mSpeed': snap(); sc().speed = +v; return changed();
      case 'mFit': snap(); sc().fit = v; return changed();
      case 'mZoom': snap(); sc().zoom = +v; return changed();
      case 'mPos': { snap(); const [x, y] = v.split(':'); sc().px = +x; sc().py = +y; return changed(); }
      case 'mFi': snap(); sc().fi = +v; return changed();
      case 'mFo': snap(); sc().fo = +v; return changed();
      case 'mFreeze': snap(); sc().freeze = !sc().freeze; return changed();
      case 'mFlip': snap(); sc().flip = !sc().flip; return changed();
      case 'mMove': { const i = selScene(), j = i + +v, A = p.scenes[i], B = p.scenes[j]; if (!B) return; snap(); const K = ['file', 'kind', 'thumb', 'name', 'prompt', 'off', 'fx', 'speed', 'fit', 'zoom', 'px', 'py', 'freeze', 'flip', 'ok', 'cp'];
        K.forEach(k => { const x = A[k]; A[k] = B[k]; B[k] = x; }); T.esel = { k: 'sc', i: j }; return changed(); }
      case 'mDup': { const i = selScene(), A = p.scenes[i], B = p.scenes[i + 1]; if (!B) return; snap(); if (B.file && B.file !== A.file && !p.scenes.some((o, k) => k !== i + 1 && o.file === B.file)) MV.delFile(B.file); ['file', 'kind', 'thumb', 'name', 'prompt', 'fit', 'zoom', 'px', 'py', 'flip'].forEach(k => { B[k] = A[k]; }); return changed(); }
    }
    return null;
  }

  /* ═════════ 공통 ═════════ */
  function act(a, v, el) {
    switch (a) {
      case 'tlUndo': return undo();
      case 'tlRedo': return redo();
      case 'tlZoom': { const [m, d] = v.split(':'); const z = +d; T.pps[m] = z === 0 ? (T.pps[m] > 20 ? 16 : 40) : clamp(T.pps[m] * (z > 0 ? 1.5 : 1 / 1.5), 4, 120); if (m === 'fill' && z === 0) return refreshView(); return tlRender(m); }
    }
    const p = P(), g0 = a === 'fPin' || !p ? null : pinSig(p), u0 = T.undo.length;
    const guard = r => { if (g0 != null && T.undo.length > u0 && pinSig(P()) !== g0) { restore(T.undo.pop()); T.redo = []; changed(); U().toast(`🔒 고정한 장면이 바뀌어서 취소했어요 · ${T.keep === 'follow' ? '🚃 따라감이면 뒤 장면도 밀려요 → 📍 제자리로 바꾸거나 ' : ''}고정을 풀고 고쳐 주세요`, 4500); } return r; };
    const r1 = fillAct(a, v, el); if (r1 !== null) return guard(r1);
    return Promise.resolve(cardAct(a, v)).then(r2 => r2 !== null ? r2 : editAct(a, v, el)).then(guard);
  }
  /* 타임라인 칸 누르기 */
  function tapBlock(mode, key) {
    const p = P(), [k, i0] = key.split(':'), i = +i0;
    if (k === 'th') return openSheet('🖼 썸네일', thumbSheet);
    if (k === 'en') return openSheet('🏁 엔딩', endSheet);
    if (mode === 'fill') { if (k === 'sc') { T.fsel = i; refreshView(); S().player.seek(p.scenes[i].s + .02); } return; }
    T.esel = { k, i }; tlRender('edit'); const d = $('edSel'); if (d) d.innerHTML = '고른 것: ' + selDesc();
  }
  function change(e) {
    const t = e.target, p = P(); if (!p) return false;
    if (t.dataset.tcard) { p.thumb[t.dataset.tcard] = t.value.trim(); changed(true); return true; }
    if (t.dataset.ecard) { p.endc[t.dataset.ecard] = t.value.trim(); changed(true); return true; }
    return false;
  }
  function refreshView() {
    const p = P(); if (!p || S().view !== 'stage') return;
    const f = document.querySelector('[data-sub="① 채우기"]'); if (f && p.step === 3) { f.innerHTML = fillPart(); tlFit('fill'); U().tapShow(S().player.time()); }
    const ed = document.querySelector('.edHost'); if (ed && p.step === 5) { ed.innerHTML = editPart(); tlFit('edit'); }
  }
  function onTime(t) {
    const p = P(); if (!p) return;
    if (p.step === 3) { tlScroll('fill', t); const st = $('fStat'); if (st) { const i = sceneIdx(t), c = p.scenes[i] || {}; st.textContent = `${fmt(t)} · ${i + 1}번 ${fmt0(c.s)}~${fmt0(c.e)}`; } }
    if (p.step === 5) { tlScroll('edit', t); const n = $('edNow'); if (n) n.textContent = fmt(t); const b = $('edPP'); if (b) b.textContent = S().player.playing() ? '⏸' : '▶'; }
  }
  function afterRender() { const p = P(); if (!p) return; if (p.step === 3) tlFit('fill'); if (p.step === 5) tlFit('edit'); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-tl]'); if (!b) return; const v = b.closest('.tlv'); if (!v || !P()) return; e.stopPropagation(); tapBlock(v.classList.contains('fill') ? 'fill' : 'edit', b.dataset.tl); }, true);
  g.addEventListener('resize', () => afterRender());
  const NAMES = new Set(['tlUndo', 'tlRedo', 'tlZoom', 'fNud', 'fKeep', 'fCut', 'fPrev', 'fBlank', 'fBlankGo', 'fTapGo', 'fTap', 'fTapUndo', 'fTapStop', 'fPlay', 'fNext', 'fLyTap', 'fSnap', 'fNextHere', 'fMove', 'fPin', 'fSplit', 'fPrevSc',
    'thSheet', 'enSheet', 'thOn', 'thDur', 'thSrc', 'thFile', 'thPos', 'thCol', 'thFont', 'thSave', 'enOn', 'enDur', 'enLogo',
    'edAdd', 'adPut', 'adSplit', 'adLib', 'edSplit', 'edTrim', 'trB', 'trCur', 'trOff', 'fKeep2', 'edDel', 'fScDel', 'edCap', 'capPick', 'capJoin', 'capSplit', 'edAudio', 'auFi', 'auCut', 'auCutA', 'auCutB', 'edFx', 'edEfx', 'edStk', 'edSfx', 'edMore', 'mSpeed', 'mFit', 'mZoom', 'mPos', 'mFi', 'mFo', 'mFreeze', 'mFlip', 'mMove', 'mDup']);
  MV.TL = { has: a => NAMES.has(a), reSheet, fillPart, editPart, act, change, onTime, afterRender, refreshView, reset() { T.undo = []; T.redo = []; T.fsel = null; T.esel = null; T.tapMode = false; T.cutA = null; } };
})(window);
