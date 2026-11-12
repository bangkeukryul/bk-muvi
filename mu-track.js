/* mu-track.js — BK뮤드 (Bang Song Studio에서 가져옴): 스티커 · 말풍선이 사람을 따라가기 (Bang Song Studio)  🛠 관리자 전용
 *  🎯 따라가기: 스티커가 나오는 첫 순간에서 따라갈 사람(얼굴)을 미리 보기에서 한 번 클릭
 *     → 내 PC가 영상을 0.1초씩 넘기며 그 부분이 어디로 움직이는지 찾아 길(path)을 만듦 (인터넷 · AI 없이)
 *  📍 자리: 지금 시간에서 미리 보기를 클릭하면 그 시간의 자리를 기억 · 📍 사이는 부드럽게 이어짐 (틀린 곳 고치기)
 *  ↩ : 따라가기 끄기 (원래 고정 자리로)
 *  스티커 길은 it.path = [[시간, x(0~1), y(0~1)], …] — fx.js drawSticker가 그 길대로 그림
 */
(function (g) {
  'use strict';
  const U = () => (g.MV && g.MV.UI) || null;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let waiting = null, busy = false;

  function canvas() { const u = U(); return u && u.S.pv ? u.S.pv.querySelector('#pvCv') : document.getElementById('pvCv'); }
  function bar(msg, cancel) {
    let b = document.getElementById('trkBar'); if (!msg) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'trkBar'; b.className = 'trkBar'; document.body.appendChild(b); }
    b.innerHTML = `<span>${msg}</span>${cancel ? '<button type="button" data-trkcancel="1">✕ 그만</button>' : ''}`;
  }
  function stopWait() { waiting = null; const c = canvas(); if (c) c.classList.remove('trkWait'); bar(null); }
  function waitClick(kind, i, msg) {
    const c = canvas(); if (!c) return U().toast('미리 보기 화면이 있는 곳에서 해 주세요', 3000);
    waiting = { kind, i }; c.classList.add('trkWait'); c.scrollIntoView({ behavior: 'smooth', block: 'center' }); bar(msg, true);
  }
  /* 미리 보기 화면 → 작은 회색 그림 (따라가기 계산용) */
  function gray(c, w) {
    const h = Math.round(w * c.height / c.width), o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data, G = new Float32Array(w * h);
    for (let k = 0, j = 0; k < G.length; k++, j += 4) G[k] = d[j] * .3 + d[j + 1] * .59 + d[j + 2] * .11;
    return { G, w, h };
  }
  function patch(F, cx, cy, r) { const n = r * 2 + 1, P = new Float32Array(n * n); let m = 0;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const xx = Math.min(F.w - 1, Math.max(0, cx + x)), yy = Math.min(F.h - 1, Math.max(0, cy + y)); const v = F.G[yy * F.w + xx]; P[m++] = v; }
    let s = 0, q = 0; for (const v of P) { s += v; q += v * v; } const mean = s / P.length, sd = Math.sqrt(Math.max(1, q / P.length - mean * mean)); for (let k = 0; k < P.length; k++) P[k] = (P[k] - mean) / sd * 40; return P; }   // 밝기 · 어둡기가 바뀌어도 모양으로 찾기
  function find(F, T, r, px, py, R, st) {   // 밝기 차이를 뺀 비교로 가장 닮은 자리 찾기 (st칸씩 건너 넓게 → 촘촘히)
    st = st || 1; let best = 1e18, bx = px, by = py;
    for (let dy = -R; dy <= R; dy += st) for (let dx = -R; dx <= R; dx += st) {
      const cx = px + dx, cy = py + dy; if (cx - r < 0 || cy - r < 0 || cx + r >= F.w || cy + r >= F.h) continue;
      const P = patch(F, cx, cy, r); let s = 0; for (let k = 0; k < P.length; k++) { const e = P[k] - T[k]; s += e * e; if (s > best) break; }
      if (s < best) { best = s; bx = cx; by = cy; }
    }
    return { x: bx, y: by, err: best / T.length };
  }
  function seek2(F, T, r, px, py, R) { const a = find(F, T, r, px, py, R, 2), b = find(F, T, r, a.x, a.y, 2, 1); return b.err <= a.err ? b : a; }
  function locate(F, T, r, px, py, vx, vy, W0) {   // 움직이던 쪽을 먼저 보고, 못 찾으면 더 넓게
    const ex = Math.round(px + vx), ey = Math.round(py + vy);
    let m = seek2(F, T, r, ex, ey, Math.round(W0 * .12));
    if (m.err > 700) { const w = seek2(F, T, r, px, py, Math.round(W0 * .25)); if (w.err < m.err) m = w; }
    return m;
  }
  async function track(i, rx, ry) {
    const u = U(), p = u.S.p, it = (p.stk || [])[i]; if (!it || busy) return; busy = true;
    const c = canvas(), pl = u.S.player, cap = p.cap ? p.cap.style : null, stkAll = p.stk;
    const t0 = it.start, t1 = it.start + it.dur, step = .1;
    // 계산할 때는 자막 · 스티커를 잠깐 숨김 (사람 모습만 보고 따라가게)
    const fx0 = p.fx ? { fi: p.fx.fadeIn, fo: p.fx.fadeOut } : null, efx0 = p.efx, th0 = p.thumb && p.thumb.on, en0 = p.endc && p.endc.on;
    if (p.cap) p.cap.style = 'none'; p.stk = []; p.efx = []; if (p.fx) { p.fx.fadeIn = 0; p.fx.fadeOut = 0; } if (p.thumb) p.thumb.on = false; if (p.endc) p.endc.on = false; pl.refresh();   // 화면 효과 · 밝아짐/어두워짐도 잠깐 끔
    const ox = (it.x == null ? .5 : it.x) - rx, oy = (it.y == null ? .3 : it.y) - ry;   // 사람에서 스티커까지 거리 (처음 놓은 대로)
    const offX = Math.hypot(ox, oy) > .35 ? 0 : ox, offY = Math.hypot(ox, oy) > .35 ? -.15 : oy;
    const path = []; let cancelled = false;
    try {
      const Wd = 200; await pl.seek(t0 + .01); let F = gray(c, Wd); const r = Math.max(5, Math.round(Wd * .045));
      let px = Math.round(rx * F.w), py = Math.round(ry * F.h), T = patch(F, px, py, r);
      path.push([+t0.toFixed(2), +(rx + offX).toFixed(4), +(ry + offY).toFixed(4)]);
      const sc0 = g.MV.sceneAt ? g.MV.sceneAt(p, t0) : -1; let lost = 0, vx = 0, vy = 0;
      for (let t = t0 + step; t < t1 - .02; t += step) {
        if (!busy) { cancelled = true; break; }
        if (g.MV.sceneAt && g.MV.sceneAt(p, t) !== sc0) break;   // 장면이 바뀌면 거기까지
        await pl.seek(t); F = gray(c, Wd);
        const m = locate(F, T, r, px, py, vx, vy, Wd); vx = (m.x - px) * .7 + vx * .3; vy = (m.y - py) * .7 + vy * .3; px = m.x; py = m.y;
        if (m.err > 900) lost++; else { const N = patch(F, px, py, r); for (let k = 0; k < T.length; k++) T[k] = T[k] * .85 + N[k] * .15; }   // 모습이 조금씩 바뀌어도 따라가게
        path.push([+t.toFixed(2), +(px / F.w + offX).toFixed(4), +(py / F.h + offY).toFixed(4)]);
        bar(`🎯 따라가는 중… ${Math.round((t - t0) / (t1 - t0) * 100)}%`, true);
      }
      // 덜컹거림 줄이기 (앞뒤 평균)
      for (let k = 1; k < path.length - 1; k++) { path[k][1] = +((path[k - 1][1] + path[k][1] * 2 + path[k + 1][1]) / 4).toFixed(4); path[k][2] = +((path[k - 1][2] + path[k][2] * 2 + path[k + 1][2]) / 4).toFixed(4); }
      if (!cancelled) { it.path = path; u.toast(lost > path.length / 3 ? '🎯 따라갔어요 · 놓친 곳이 있을 수 있어요 → ▶ 보고 「📍 자리」로 고쳐 주세요' : '🎯 사람을 따라가게 했어요 · ▶ 들어 보세요', 4500); }
    } catch (e) { u.toast('⚠️ 따라가기를 못 했어요: ' + (e && e.message || e), 4000); }
    finally { p.stk = stkAll; p.efx = efx0; if (fx0) { p.fx.fadeIn = fx0.fi; p.fx.fadeOut = fx0.fo; } if (p.thumb) p.thumb.on = th0; if (p.endc) p.endc.on = en0; if (p.cap && cap) p.cap.style = cap; busy = false; bar(null); pl.refresh(); await pl.seek(t0 + .05); u.save(); u.renderStage(); }
  }
  function pin(i, rx, ry) {
    const u = U(), p = u.S.p, it = (p.stk || [])[i]; if (!it) return;
    const t = u.S.player.time();
    if (t < it.start - .05 || t > it.start + it.dur + .05) return u.toast(`📍 이 스티커가 나오는 시간(${it.start.toFixed(1)}~${(it.start + it.dur).toFixed(1)}초) 안에서 눌러 주세요`, 3500);
    if (!it.path || !it.path.length) { it.x = +rx.toFixed(4); it.y = +ry.toFixed(4); it.path = [[+it.start.toFixed(2), it.x, it.y]]; }
    const P = it.path.filter(q => Math.abs(q[0] - t) > .08); P.push([+t.toFixed(2), +rx.toFixed(4), +ry.toFixed(4)]); P.sort((a, b) => a[0] - b[0]); it.path = P;
    u.save(); u.S.player.refresh(); u.S.player.seek(t); u.renderStage(); u.toast(`📍 ${t.toFixed(1)}초의 자리를 기억했어요 · 📍 사이는 부드럽게 이어져요`, 3000);
  }

  document.addEventListener('click', async e => {
    const u = U(); if (!u || !u.S.p) return;
    if (e.target.closest('[data-trkcancel]')) { busy = false; stopWait(); return; }
    const tk = e.target.closest('[data-trk]'), pn = e.target.closest('[data-pin]'), off = e.target.closest('[data-trkoff]');
    if (tk) { e.preventDefault(); const i = +tk.dataset.trk, it = u.S.p.stk[i]; await u.S.player.seek(it.start + .01); return waitClick('trk', i, '🎯 미리 보기에서 <b>따라갈 사람의 얼굴</b>을 한 번 눌러 주세요'); }
    if (pn) { e.preventDefault(); const i = +pn.dataset.pin; return waitClick('pin', i, '📍 미리 보기에서 <b>이 시간에 스티커가 있을 자리</b>를 눌러 주세요'); }
    if (off) { e.preventDefault(); const it = u.S.p.stk[+off.dataset.trkoff]; if (it) { if (it.path && it.path[0]) { it.x = it.path[0][1]; it.y = it.path[0][2]; } delete it.path; u.save(); u.S.player.refresh(); u.renderStage(); u.toast('↩ 따라가기를 껐어요 (처음 자리에 고정)', 2500); } return; }
    if (waiting && e.target.closest('#pvCv')) {
      e.preventDefault(); e.stopPropagation(); const c = e.target.closest('#pvCv'), r = c.getBoundingClientRect();
      const rx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), ry = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), w = waiting; stopWait();
      if (w.kind === 'trk') return track(w.i, rx, ry); return pin(w.i, rx, ry);
    }
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (waiting || busy)) { busy = false; stopWait(); } });
  g.BKTRACK = { track, pin };
})(window);
