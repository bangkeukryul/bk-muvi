/* mu-auto.js — BK뮤드 (Bang Song Studio에서 가져옴): 🎵 음악에 저절로 맞추기 🛠 관리자 전용
 *  - 노래(MP3)를 내 PC에서 분석: 박자(BPM) · 마디 · 크게 울리는 구간(후렴 같은 곳) — 인터넷 · AI 없이
 *  - 장르 하나 고르고 「✨ 자동으로 맞추기」 한 번:
 *      장면 경계 → 가사 줄 시작 · 마디(박자)에 딱 맞춤 / 후렴은 강한 전환 · 확 줌인 / 사진은 천천히 다가가기
 *      색감 · 자막 글꼴 · 기본 전환 · 끝 어두워지기까지 장르에 맞게
 *  - 🔒 고정한 장면은 건드리지 않음 · 「↩ 자동 맞추기 되돌리기」 한 번에 전으로
 *  - 3단계(🎬 노래 · 장면 맞추기) · 4단계(✨ 효과) 화면 맨 위에 칸이 생김
 */
(function (g) {
  'use strict';
  const U = () => (g.MV && g.MV.UI) || null;
  const isAdmin = () => { try { return localStorage.getItem('bkAdmin') === '1'; } catch (e) { return false; } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* 장르 스타일: 전환 묶음(조용한 곳/후렴) · 색감 · 자막 글꼴/색 · 후렴 효과 */
  /* 🎭 드라마 장르 (드라마 작품에서만 보임 · 자막 모양은 건드리지 않음) */
  const GENRE_D = {
    sageuk:  { n: '🏯 사극', calm: 'classic', hit: 'classic', color: 'film', trans: 'fade', hitFx: 'vignette' },
    revenge: { n: '⚖️ 참교육 · 사이다', calm: 'classic', hit: 'strong', color: 'vivid', trans: 'cut', hitFx: 'shake' },
    romance: { n: '💕 로맨스', calm: 'soft', hit: 'soft', color: 'warm', trans: 'fade', hitFx: 'glow' },
    thriller:{ n: '🕵️ 스릴러 · 미스터리', calm: 'classic', hit: 'strong', color: 'dark', trans: 'black', hitFx: 'vignette' },
    family:  { n: '👨‍👩‍👧 가족 · 휴먼', calm: 'soft', hit: 'classic', color: 'warm', trans: 'fade', hitFx: 'lightleak' },
    comic:   { n: '😂 코믹', calm: 'fun', hit: 'fun', color: 'vivid', trans: 'cut', hitFx: 'shake' },
  };
  const GS = p => (p && p.kind === 'drama') ? GENRE_D : GENRE;
  const GENRE = {
    trot:   { n: '🎺 트로트', calm: 'fun', hit: 'strong', color: 'vivid', font: 'blackhan', cap: '#ffe14d', trans: 'slide', hitFx: 'confetti' },
    ballad: { n: '🎹 발라드', calm: 'soft', hit: 'soft', color: 'warm', font: 'gowunbatang', cap: '#ffffff', trans: 'fade', hitFx: 'lightleak' },
    dance:  { n: '💃 댄스', calm: 'fun', hit: 'strong', color: 'cool', font: 'dohyeon', cap: '#4fe3ff', trans: 'push', hitFx: 'flash' },
    ccm:    { n: '🙏 찬양', calm: 'soft', hit: 'classic', color: 'soft', font: 'gowunbatang', cap: '#fff7c2', trans: 'fade', hitFx: 'lightleak' },
    folk:   { n: '🎸 7080 · 감성', calm: 'classic', hit: 'soft', color: 'film', font: 'nanumpen', cap: '#ffffff', trans: 'fade', hitFx: 'grain' },
    kids:   { n: '🧸 동요 · 밝게', calm: 'fun', hit: 'fun', color: 'vivid', font: 'jua', cap: '#ffffff', trans: 'bounce', hitFx: 'confetti' },
  };
  let genre = 'trot', busy = false, ANA = { key: '', r: null }, UNDO = null, lastMsg = '';

  /* ── 🎵 노래 분석 (박자 · 마디 · 큰 소리 구간) ── */
  async function analyze(blob) {
    const ab = await blob.arrayBuffer();
    const AC = g.AudioContext || g.webkitAudioContext, ac = new AC();
    let buf; try { buf = await ac.decodeAudioData(ab); } finally { try { ac.close(); } catch (e) { /* 괜찮음 */ } }
    const sr = buf.sampleRate, N = buf.length, ch = buf.numberOfChannels, d0 = buf.getChannelData(0), d1 = ch > 1 ? buf.getChannelData(1) : d0;
    const hop = 512, F = Math.floor(N / hop), fps = sr / hop, en = new Float32Array(F), rms = new Float32Array(F);
    let prev = 0;
    for (let f = 0; f < F; f++) {
      let s = 0, r = 0; const o = f * hop;
      for (let i = 0; i < hop; i++) { const v = (d0[o + i] + d1[o + i]) * .5, hp = v - prev; prev = v; s += hp * hp; r += v * v; }
      en[f] = Math.log(1e-9 + s); rms[f] = Math.sqrt(r / hop);
    }
    // 소리가 갑자기 커지는 순간(온셋)
    const on = new Float32Array(F);
    for (let f = 1; f < F; f++) { let m = 0, k = 0; for (let j = Math.max(0, f - 10); j < f; j++) { m += en[j]; k++; } on[f] = Math.max(0, en[f] - m / k); }
    // 빠르기(BPM): 70~170 사이에서 반복이 가장 잘 맞는 간격 (80~140을 조금 더 좋아함)
    let best = 0, lagB = Math.round(fps * .5);
    for (let bpm = 70; bpm <= 170; bpm += .5) {
      const lag = fps * 60 / bpm; let s = 0;
      for (let f = Math.ceil(lag); f < F; f += 2) s += on[f] * (on[Math.round(f - lag)] + .5 * (on[Math.round(f - 2 * lag)] || 0));
      s *= (bpm >= 80 && bpm <= 140) ? 1.08 : 1;
      if (s > best) { best = s; lagB = lag; }
    }
    // 박자 위치(위상)
    let ph = 0, bs = -1;
    for (let o = 0; o < lagB; o++) { let s = 0; for (let f = o; f < F; f += lagB) s += on[Math.round(f)] || 0; if (s > bs) { bs = s; ph = o; } }
    const beats = []; for (let f = ph; f < F; f += lagB) beats.push(+(f / fps).toFixed(3));
    // 마디 첫 박(4박마다): 첫 박이 가장 센 쪽으로
    let down = 0, ds = -1;
    for (let k = 0; k < 4; k++) { let s = 0; for (let i = k; i < beats.length; i += 4) s += on[Math.round(beats[i] * fps)] || 0; if (s > ds) { ds = s; down = k; } }
    const bars = beats.filter((_, i) => i % 4 === down);
    // 크게 울리는 구간(후렴 후보): 4초 평균 소리 크기가 상위 30%
    const win = Math.round(fps * 4), loud = new Float32Array(F); let acc = 0;
    for (let f = 0; f < F; f++) { acc += rms[f]; if (f >= win) acc -= rms[f - win]; loud[Math.max(0, f - (win >> 1))] = acc / Math.min(f + 1, win); }
    const sorted = Array.from(loud).sort((a, b) => a - b), th = sorted[Math.floor(sorted.length * .7)] || 0;
    const hot = []; let st = null;
    for (let f = 0; f < F; f += Math.round(fps / 4)) { const on2 = loud[f] >= th; if (on2 && st == null) st = f / fps; if (!on2 && st != null) { if (f / fps - st > 6) hot.push([+st.toFixed(2), +(f / fps).toFixed(2)]); st = null; } }
    if (st != null && F / fps - st > 6) hot.push([+st.toFixed(2), +(F / fps).toFixed(2)]);
    return { bpm: Math.round(60 * fps / lagB), beats, bars, hot, dur: N / sr };
  }

  async function getAna() {
    const u = U(), p = u.S.p, blob = u.S.song; if (!p || !p.song || !blob) return null;
    const key = p.song.file + ':' + p.song.dur;
    if (ANA.key !== key) { ANA = { key, r: await analyze(blob) }; }
    return ANA.r;
  }

  /* ── ✨ 자동으로 맞추기 ── */
  const nearest = (arr, t) => { let b = null, bd = 1e9; for (const v of arr) { const d = Math.abs(v - t); if (d < bd) { bd = d; b = v; } } return [b, bd]; };
  function isHot(p, A, t) {
    const L = (p.lines || []).filter(l => l.s != null);
    const ln = L.filter(l => l.s <= t + .3).pop();
    if (ln && ln.sec === 'chorus') return true;
    if (L.some(l => l.sec === 'chorus')) return false;            // 가사에 후렴 표시가 있으면 그걸 믿음
    return A.hot.some(([a, b]) => t >= a - .5 && t < b);
  }
  /* mode: 'time' = 3단계 ② 화면 (장면 바뀌는 시간만) · 'style' = 4단계 ① 전환 (장르 꾸밈만) */
  async function autoFit(mode) {
    mode = mode || 'time';
    const u = U(), p = u.S.p, F = g.BKFX; if (!p || busy) return;
    if (!p.song) return u.toast('🎵 먼저 노래를 넣어 주세요');
    if (!p.scenes || !p.scenes.length) p.scenes = g.MV.planScenes(p);
    busy = true; mount();
    try {
      const A = await getAna(); if (!A) return;
      UNDO = JSON.stringify({ scenes: p.scenes, efx: p.efx, fx: p.fx, cap: p.cap });
      if (!GS(p)[genre]) genre = Object.keys(GS(p))[p.kind === 'drama' ? 1 : 0];
      const G = GS(p)[genre], S2 = p.scenes, L = (p.lines || []).filter(l => l.s != null).map(l => l.s);
      const beatLen = 60 / (A.bpm || 100), barLen = beatLen * 4;
      let moved = 0;
      if (mode !== 'style') {
      // 0) 후렴이 시작하는 곳에는 꼭 장면이 바뀌게 (5초 안의 가장 가까운 경계를 끌어옴)
      const LL = (p.lines || []).filter(l => l.s != null), starts = [];
      LL.forEach((l, i) => { if (l.sec === 'chorus' && (!LL[i - 1] || LL[i - 1].sec !== 'chorus')) starts.push(l.s); });
      if (!starts.length) A.hot.forEach(([a]) => { const [bt] = nearest(A.bars, a); starts.push(bt != null && Math.abs(bt - a) < barLen ? bt : a); });
      starts.forEach(cs => {
        let bi = -1, bd = 5.01;
        for (let i = 1; i < S2.length; i++) { const d = Math.abs(S2[i].s - cs); if (d < bd && !S2[i].pin && !S2[i - 1].pin) { bd = d; bi = i; } }
        if (bi < 0) return; const a = S2[bi - 1], b = S2[bi], t = Math.max(0, cs - .08);
        if (t > a.s + 1.2 && t < b.e - 1.2) { a.e = +t.toFixed(2); b.s = +t.toFixed(2); b._cs = 1; moved++; }
      });
      // 1) 장면 경계 → 가사 줄 시작 · 마디 첫 박 · 박자
      for (let i = 1; i < S2.length; i++) {
        const a = S2[i - 1], b = S2[i]; if (a.pin || b.pin) continue;
        if (b._cs) { delete b._cs; continue; }   // 후렴 시작에 맞춘 경계는 그대로
        const t0 = b.s; let t = t0;
        const [lt, ld] = nearest(L, t0), [bt, bd] = nearest(A.bars, t0), [kt, kd] = nearest(A.beats, t0);
        if (lt != null && ld <= Math.min(2.5, barLen * .75)) { const [k2, d2] = nearest(A.beats, lt - .05); t = d2 < .18 ? Math.min(k2, lt) : lt - .08; }   // 가사가 나오기 살짝 전에
        else if (bt != null && bd <= barLen * .5) t = bt;
        else if (kt != null && kd <= beatLen) t = kt;
        const lo = a.s + 1.2, hi = b.e - 1.2; if (hi <= lo) continue;
        t = Math.min(hi, Math.max(lo, t));
        if (Math.abs(t - t0) > .02) { a.e = +t.toFixed(2); b.s = +t.toFixed(2); moved++; }
      }
      }
      if (mode === 'time') {
        u.save(); u.S.player.refresh(); if (!u.S.player.playing()) u.S.player.seek(u.S.player.time());
        lastMsg = `✅ 맞췄어요 — 빠르기 ${A.bpm} BPM · 장면 경계 ${moved}곳을 박자 · 가사 · 후렴에 맞춤`;
        u.toast('✨ 장면을 박자 · 가사에 맞췄어요 · ▶ 들어 보세요', 4000); return;
      }
      // 2) 전환: 조용한 곳은 부드럽게, 후렴(크게 울리는 곳)은 강하게 · 후렴 첫 장면은 ⚡ 번쩍
      const calm = F.TRANS_SETS[G.calm], hit = F.TRANS_SETS[G.hit]; let ci = 0, hi2 = 1, wasHot = false;
      S2.forEach((sc, i) => { if (i === 0 || sc.pin) { wasHot = i === 0 ? isHot(p, A, sc.s) : wasHot; return; }
        const h = isHot(p, A, sc.s);
        sc.tr = h ? (!wasHot ? (G.hit === 'soft' ? 'lightleak' : 'bolt') : hit[hi2++ % hit.length]) : calm[ci++ % calm.length];
        wasHot = h; });
      // 3) 효과: 예전에 자동으로 넣은 것은 지우고 새로
      p.efx = (p.efx || []).filter(e => !e.auto);
      S2.forEach(sc => { if (!sc.pin && sc.kind !== 'video' && sc.e - sc.s > 1.5) p.efx.push({ k: 'slowzoom', start: sc.s, dur: +(sc.e - sc.s).toFixed(2), auto: 1 }); });
      let hits = 0; wasHot = false;
      S2.forEach(sc => { const h = isHot(p, A, sc.s); if (h && !wasHot) { p.efx.push({ k: 'punch', start: sc.s, dur: .8, auto: 1 }); if (F.EFX[G.hitFx]) p.efx.push({ k: G.hitFx, start: sc.s, dur: Math.min(4, sc.e - sc.s), auto: 1 }); hits++; } wasHot = h; });
      // 4) 장르 모양: 색감 · 기본 전환 · 자막 글꼴/색 · 끝 어두워지기
      p.fx.color = G.color; p.fx.trans = G.trans; if (!p.fx.fadeOut) p.fx.fadeOut = 2.5;
      if (p.cap && p.kind !== 'drama' && G.font) { p.cap.font = G.font; p.cap.color = G.cap; }
      p.pcAuto = { genre, bpm: A.bpm, at: Date.now() };
      u.save(); u.S.player.refresh(); if (!u.S.player.playing()) u.S.player.seek(u.S.player.time());
      lastMsg = `✅ ${G.n} 스타일로 꾸몄어요 — 전환 · 색감 · 자막 글씨 · 크게 울리는 곳 ${hits}곳에 강한 효과`;
      u.toast('🎨 장르 스타일로 꾸몄어요 · ▶ 처음부터 들어 보세요', 5000);
    } catch (e) {
      lastMsg = '⚠️ 노래를 분석하지 못했어요: ' + (e && e.message || e);
    } finally { busy = false; u.renderStage(); }
  }
  function undoAuto() {
    const u = U(), p = u.S.p; if (!UNDO || !p) return;
    const o = JSON.parse(UNDO); p.scenes = o.scenes; p.efx = o.efx; p.fx = o.fx; p.cap = o.cap; UNDO = null; lastMsg = '↩ 자동 맞추기 전으로 돌렸어요';
    u.save(); u.S.player.refresh(); u.renderStage(); u.toast('↩ 되돌렸어요');
  }

  /* ── 화면 칸 ── */
  function html(p) {
    const A = ANA.key && ANA.r && p.song && ANA.key === p.song.file + ':' + p.song.dur ? ANA.r : null;
    if (p.pcAuto && p.pcAuto.genre && GS(p)[p.pcAuto.genre] && html._init !== p.id) { genre = p.pcAuto.genre; html._init = p.id; }
    if (!GS(p)[genre]) genre = Object.keys(GS(p))[p.kind === 'drama' ? 1 : 0];
    const st = p.step === 4;
    if (!st) return `<details class="pcaCard" open><summary>✨ 장면을 박자 · 가사에 맞추기 <span class="pcsTag">🛠</span></summary>
      <p class="muted" style="margin:4px 0 8px">버튼 한 번 — 장면이 바뀌는 시간을 <b>가사 시작 · 박자 · 후렴</b>에 맞춰요. 🔒 고정한 장면은 그대로예요. (꾸밈은 4단계 「🎨 장르 스타일」에서)</p>
      <div class="row"><button class="btn main big" data-pca="go"${busy ? ' disabled' : ''}>${busy ? '⏳ 노래 듣고 맞추는 중…' : '✨ 박자 · 가사에 맞추기'}</button></div>
      ${UNDO ? '<button class="btn ghost sm" data-pca="undo" style="margin-top:6px">↩ 맞추기 되돌리기</button>' : ''}
      ${lastMsg ? `<p class="note ${lastMsg.startsWith('⚠') ? 'red' : 'green'}" style="margin-top:8px">${esc(lastMsg)}</p>` : ''}
      ${A ? `<p class="muted" style="margin:6px 0 0">🎵 이 노래: 빠르기 약 ${A.bpm} BPM · 박자 ${A.beats.length}개 · 크게 울리는 구간 ${A.hot.length}곳</p>` : ''}
    </details>`;
    return `<details class="pcaCard" open><summary>🎨 장르 스타일 한 번에 꾸미기 <span class="pcsTag">🛠</span></summary>
      <p class="muted" style="margin:4px 0 8px">장르를 고르고 버튼 한 번 — <b>장면 전환 · 색감 · 화면 효과 · 자막 글씨</b>가 장르에 맞게 한 번에 들어가요. 그다음 아래에서 하나씩 고쳐도 돼요.</p>
      <div class="chips">${Object.entries(GS(p)).map(([k, v]) => `<button type="button" class="chip${genre === k ? ' on' : ''}" data-pca="genre" data-v="${k}">${v.n}</button>`).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn main big" data-pca="go"${busy ? ' disabled' : ''}>${busy ? '⏳ 꾸미는 중…' : '🎨 이 장르로 꾸미기'}</button></div>
      ${UNDO ? '<button class="btn ghost sm" data-pca="undo" style="margin-top:6px">↩ 꾸미기 되돌리기</button>' : ''}
      ${lastMsg ? `<p class="note ${lastMsg.startsWith('⚠') ? 'red' : 'green'}" style="margin-top:8px">${esc(lastMsg)}</p>` : ''}
    </details>`;
  }
  function mount() {
    const u = U(), p = u && u.S.p;
    const ok = isAdmin() && p && u.S.view === 'stage' && (p.step === 3 && p.kind !== 'drama' || p.step === 4) && p.song;
    const old = document.getElementById('pcAuto');
    if (!ok) { if (old) old.remove(); return; }
    const host = document.querySelector(p.step === 3 ? '#stage [data-sub="② 화면"]' : '#stage [data-sub="① 전환"]') || document.querySelector('#stage .stBody'); if (!host) return;
    if (old && old.parentNode === host && old._step === p.step && old._msg === lastMsg + busy + !!UNDO + genre) return;
    let box = old;
    if (!box || box.parentNode !== host) { if (box) box.remove(); box = document.createElement('div'); box.id = 'pcAuto'; host.insertBefore(box, host.firstChild); }
    box._step = p.step; box._msg = lastMsg + busy + !!UNDO + genre;
    const open = box.querySelector('details') ? box.querySelector('details').open : true;
    box.innerHTML = html(p); box.querySelector('details').open = open;
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-pca]'); if (!b || !b.closest('#pcAuto')) return;
    e.preventDefault(); const a = b.dataset.pca;
    if (a === 'genre') { genre = b.dataset.v; return mount(); }
    if (a === 'go') { const u = U(); return autoFit(u && u.S.p && u.S.p.step === 4 ? 'style' : 'time'); }
    if (a === 'undo') return undoAuto();
  }, true);
  g.addEventListener('DOMContentLoaded', () => {
    const app = document.getElementById('app'); let raf = 0;
    if (app) new MutationObserver(() => { if (raf) return; raf = setTimeout(() => { raf = 0; const u = U(), need = isAdmin() && u && u.S.p && u.S.view === 'stage' && (u.S.p.step === 3 || u.S.p.step === 4) && u.S.p.song, b = document.getElementById('pcAuto'); if (need && (!b || !b.isConnected || !b.closest('[data-sub]'))) mount(); else if (!need && b) b.remove(); }, 40); }).observe(app, { childList: true, subtree: true });
  });
  g.BKAUTO = { analyze, autoFit, GENRE };
})(window);
