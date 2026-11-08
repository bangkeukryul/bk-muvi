/* mv-render.js — BK뮤비 화면 그리기 · 미리 보기 재생 · MP4 내보내기
 *  - 장면(영상/사진) + 장면 넘김 + 노래방 자막 + 효과(제목 · 페이드 · 필름 느낌)
 *  - 휴대폰 메모리를 아끼려고 지금 장면 앞뒤 몇 개만 불러 둠
 */
(function (g) {
  'use strict';
  const MV = g.MV, clamp = MV.clamp;
  const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif';
  const MEDIA = new Map();   // fileId → { kind, url, img|vid, dur }

  async function load(id, kind) {
    if (!id) return null;
    let m = MEDIA.get(id); if (m) return m.p ? m.p : m;
    m = { id, kind }; MEDIA.set(id, m);
    m.p = (async () => {
      const blob = await MV.getFile(id); if (!blob) { MEDIA.delete(id); return null; }
      if (kind === 'video' || /^video/.test(blob.type)) {
        m.kind = 'video'; m.url = URL.createObjectURL(blob);
        const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.setAttribute('playsinline', ''); v.crossOrigin = 'anonymous';
        await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 6000); v.src = m.url; });
        m.vid = v; m.dur = isFinite(v.duration) ? v.duration : 8;
      } else {
        m.kind = 'image';
        try { const bm0 = await createImageBitmap(blob); const sc = Math.min(1, 1920 / Math.max(bm0.width, bm0.height)); if (sc < 1) { m.img = await createImageBitmap(blob, { resizeWidth: Math.round(bm0.width * sc), resizeHeight: Math.round(bm0.height * sc), resizeQuality: 'high' }); bm0.close(); } else m.img = bm0; }
        catch (e) { m.url = URL.createObjectURL(blob); const im = new Image(); await new Promise(r => { im.onload = r; im.onerror = r; im.src = m.url; }); m.img = im; }
      }
      delete m.p; return m;
    })();
    return m.p;
  }
  function drop(id) {
    const m = MEDIA.get(id); if (!m || m.p) return;
    if (m.vid) { try { m.vid.pause(); m.vid.removeAttribute('src'); m.vid.load(); } catch (e) { /* 괜찮음 */ } }
    if (m.img && m.img.close) m.img.close();
    if (m.url) URL.revokeObjectURL(m.url);
    MEDIA.delete(id);
  }
  /* i번 장면 앞뒤만 불러 두고 나머지는 비우기 */
  async function near(p, i, keep) {
    const S = p.scenes || [], want = new Set();
    for (let k = i - 1; k <= i + (keep || 2); k++) if (S[k] && S[k].file) want.add(S[k].file);
    for (const id of [...MEDIA.keys()]) if (!want.has(id)) drop(id);
    for (const id of want) { const sc = S.find(s => s.file === id); await load(id, sc && sc.kind); }
  }
  function dropAll() { for (const id of [...MEDIA.keys()]) drop(id); }
  function get(id) { const m = MEDIA.get(id); return m && !m.p ? m : null; }

  /* 장면 안에서 영상 몇 초를 보여 줄지 (짧으면 처음부터 다시) */
  function srcTime(sc, m, t) { const d = (m && m.dur) || 8; let x = (sc.off || 0) + (sc.freeze ? 0 : Math.max(0, t - sc.s) * (sc.speed || 1)); if (x > d - 0.05) x = x % Math.max(0.5, d - 0.05); return x; }

  function filterFor(p, sc) {
    const f = [];
    const fx = sc.fx || '';
    if (fx === 'bw') f.push('grayscale(1) contrast(1.1)');
    if (fx === 'warm') f.push('sepia(.3) saturate(1.2)');
    if (fx === 'bright') f.push('brightness(1.15) saturate(1.1)');
    const F = g.BKFX, cf = F && F.FILTERS[p.fx.color]; if (cf && cf[1]) f.push(cf[1]);
    if (p.fx.film === 'vintage') f.push('sepia(.35) contrast(1.05) saturate(.9)');
    if (p.fx.film === 'vivid') f.push('saturate(1.3) contrast(1.06)');
    return f.join(' ') || 'none';
  }
  function drawScene(x, W, H, p, i, t, alpha) {
    const sc = p.scenes[i]; if (!sc) return;
    const m = sc.file ? get(sc.file) : null;
    x.save(); x.globalAlpha = alpha == null ? 1 : alpha;
    if (!m) { x.fillStyle = '#1e1b4b'; x.fillRect(0, 0, W, H); x.fillStyle = 'rgba(255,255,255,.55)'; x.font = `800 ${Math.round(Math.min(W, H) * .07)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sc.file ? '불러오는 중…' : `장면 ${i + 1} 비어 있음`, W / 2, H / 2); x.restore(); return; }
    const el = m.kind === 'video' ? m.vid : m.img, iw = el.videoWidth || el.width, ih = el.videoHeight || el.height;
    if (!iw || !ih) { x.restore(); return; }
    const fit = sc.fit || 'cover';
    if (fit === 'blur') { const cb = Math.max(W / iw, H / ih); x.save(); x.filter = 'blur(18px) brightness(.7)'; x.drawImage(el, (W - iw * cb) / 2, (H - ih * cb) / 2, iw * cb, ih * cb); x.restore(); }
    let sc0 = fit === 'cover' ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
    const len = Math.max(.5, sc.e - sc.s), pr = clamp((t - sc.s) / len, 0, 1);
    let zfx = sc.fx === 'zoomin' ? 1 : sc.fx === 'zoomout' ? -1 : (m.kind === 'image' && p.fx.zoom && sc.fx !== 'still' && fit === 'cover') ? (i % 2 ? -1 : 1) : 0;
    const z = (zfx > 0 ? 1 + .1 * pr : zfx < 0 ? 1.1 - .1 * pr : 1) * (sc.zoom || 1);
    sc0 *= z; const dw = iw * sc0, dh = ih * sc0;
    const dx = (W - dw) / 2 + (zfx ? (i % 3 - 1) * W * .02 * pr : 0) + (sc.px || 0) * Math.max(0, dw - W) / 2, dy = (H - dh) / 2 + (sc.py || 0) * Math.max(0, dh - H) / 2;
    if (sc.flip) { x.translate(W, 0); x.scale(-1, 1); }
    x.filter = filterFor(p, sc);
    x.drawImage(el, dx, dy, dw, dh);
    x.filter = 'none'; x.restore();
    const fi = sc.fi || 0, fo = sc.fo || 0; let bk = 0; if (fi && t < sc.s + fi) bk = 1 - (t - sc.s) / fi; if (fo && t > sc.e - fo) bk = Math.max(bk, (t - (sc.e - fo)) / fo);
    if (bk > 0) { x.save(); x.globalAlpha = (alpha == null ? 1 : alpha) * clamp(bk, 0, 1); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.restore(); }
  }
  function transOf(p, sc) { let k = sc.tr || p.fx.trans || 'fade'; if (k === 'flash') k = 'white'; return k; }
  const BUF = [null, null];
  function buf(k, W, H) { let c = BUF[k]; if (!c) c = BUF[k] = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; }
  const PRE = { punch: 1, shake: 1, mirror: 1, slowzoom: 1, heartbeat: 1 };
  const on = (it, t) => t >= it.start && t < it.start + it.dur;

  /* 자막에 쓸 줄: 시간이 맞춰진 줄만 */
  function capLines(p) {
    const L = p.lines || [], dur = (p.song && p.song.dur) || 1e9, out = [];
    L.forEach((l, i) => { if (l.s == null) return; const nx = L.slice(i + 1).find(q => q.s != null); let e = l.e;
      if (e == null) { e = nx ? nx.s : l.s + 6; e = Math.min(e, l.s + 8, dur); }
      else if (nx && nx.s - e < .5 && nx.s > e) e = nx.s;          // 줄 사이가 아주 짧으면 깜빡이지 않게 이어 주기
      if (nx && e > nx.s) e = nx.s;                                 // 다음 줄이 시작되면 앞 줄은 바로 사라지게
      out.push({ t: l.t, s: l.s, e: Math.max(l.s + .3, e), i }); });
    return out;
  }
  let CF = FONT;
  function fitFont(x, text, px, maxW) { let f = px; x.font = `900 ${f}px ${CF}`; while (f > 12 && x.measureText(text).width > maxW) { f -= 2; x.font = `900 ${f}px ${CF}`; } return f; }
  /* 긴 가사는 두 줄로 (가운데 가까운 띄어쓰기에서 나누기) */
  function split2(x, text, px, maxW) {
    x.font = `900 ${px}px ${CF}`; if (x.measureText(text).width <= maxW) return [text];
    const mid = text.length / 2; let best = -1;
    for (let i = 0; i < text.length; i++) if (text[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
    if (best < 0) best = Math.round(mid);
    return [text.slice(0, best).trim(), text.slice(best).trim()].filter(Boolean);
  }
  function drawCaps(x, W, H, p, t, CL) {
    const st = p.cap.style; if (st === 'none') return; CF = g.BKFX && p.cap.font ? g.BKFX.fam(p.cap.font) : FONT;
    CL = CL || capLines(p);
    let k = -1; for (let j = CL.length - 1; j >= 0; j--) if (t >= CL[j].s - .05 && t < CL[j].e) { k = j; break; }
    if (k < 0) return;
    const c = CL[k], base = Math.round(Math.min(W, H) * .072 * (p.cap.size || 1)), maxW = W * .9;
    const y0 = p.cap.pos === 'top' ? H * .14 : p.cap.pos === 'middle' ? H * .5 : H * (p.ratio === '9:16' ? .78 : .86);
    const fade = clamp((t - c.s + .05) / .15, 0, 1) * clamp((c.e - t) / .15, 0, 1);
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const rows = split2(x, c.t, base, maxW); let f = base; for (const r of rows) f = Math.min(f, fitFont(x, r, base, maxW)); x.font = `900 ${f}px ${CF}`;
    const lh = f * 1.25, n = rows.length, ys = rows.map((r, i) => p.cap.pos === 'top' ? y0 + i * lh : p.cap.pos === 'middle' ? y0 + (i - (n - 1) / 2) * lh : y0 - (n - 1 - i) * lh);
    const outline = (s, yy, fill, a) => { x.globalAlpha = a; x.lineWidth = Math.max(4, f * .18); x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(s, W / 2, yy); x.fillStyle = fill; x.fillText(s, W / 2, yy); };
    if (st === 'karaoke' || st === 'two') {
      const span = (c.e - c.s) * (p.cap.speed === 'fast' ? .7 : .88), pr = clamp((t - c.s) / Math.max(.3, span), 0, 1);
      const ws = rows.map(r => x.measureText(r).width), tot = ws.reduce((a, b) => a + b, 0) || 1; let done = pr * tot;
      rows.forEach((r, i) => { const tw = ws[i], left = W / 2 - tw / 2, part = clamp(done / tw, 0, 1); done -= tw;
        outline(r, ys[i], '#ffffff', fade);
        if (part > 0) { x.save(); x.beginPath(); x.rect(left - 4, ys[i] - f, (tw + 8) * part, f * 2); x.clip(); x.globalAlpha = fade; x.fillStyle = p.cap.color || '#ffe14d'; x.fillText(r, W / 2, ys[i]); x.restore(); } });
      if (st === 'two' && CL[k + 1]) { const nt = CL[k + 1].t, f2 = fitFont(x, nt, Math.round(base * .74), W * .86); x.font = `900 ${f2}px ${CF}`; const y2 = p.cap.pos === 'top' ? ys[n - 1] + f * 1.35 : ys[0] - f * 1.3; x.lineWidth = Math.max(3, f2 * .16); x.globalAlpha = fade * .8; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(nt, W / 2, y2); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(nt, W / 2, y2); }
    } else rows.forEach((r, i) => outline(r, ys[i], '#ffffff', fade));
    x.restore();
  }
  function bigText(x, W, H, text, a, sub) {
    if (!text || a <= 0) return;
    x.save(); x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const f = fitFont(x, text, Math.round(Math.min(W, H) * .12), W * .86);
    x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = f * .4; x.fillStyle = '#fff'; x.fillText(text, W / 2, H * .46); x.shadowBlur = 0;
    if (sub) { x.font = `700 ${Math.round(f * .38)}px ${FONT}`; x.fillStyle = 'rgba(255,255,255,.85)'; x.fillText(sub, W / 2, H * .46 + f * .95); }
    x.restore();
  }
  /* 한 장면(프레임) 그리기 */
  function drawFrame(x, W, H, p, t, CL) {
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const S = p.scenes || []; if (!S.length) return;
    const i = MV.sceneAt(p, t), sc = S[i], F = g.BKFX, D = p.fx.tdur || .6;
    const act = (p.efx || []).filter(e => on(e, t));
    x.save(); if (F) F.preTransform(x, W, H, act.filter(e => PRE[e.k]), t);
    const tk = i > 0 ? transOf(p, sc) : 'cut';
    if (F && i > 0 && tk !== 'cut' && t < sc.s + D) {
      const A = buf(0, W, H), B = buf(1, W, H), ax = A.getContext('2d'), bx = B.getContext('2d');
      ax.fillStyle = '#000'; ax.fillRect(0, 0, W, H); drawScene(ax, W, H, p, i - 1, t, 1);
      bx.fillStyle = '#000'; bx.fillRect(0, 0, W, H); drawScene(bx, W, H, p, i, t, 1);
      F.transition(x, W, H, tk, A, B, clamp((t - sc.s) / D, 0, 1));
    } else drawScene(x, W, H, p, i, t, 1);
    x.restore();
    if (p.fx.film === 'cinema') { const bh = Math.max(0, (H - W / 2.39) / 2); if (bh > 2) { x.fillStyle = '#000'; x.fillRect(0, 0, W, bh); x.fillRect(0, H - bh, W, bh); } }
    if (p.fx.film === 'vintage' || p.fx.film === 'cinema') { const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    const dur = (p.song && p.song.dur) || S[S.length - 1].e;
    if (F) { for (const e of act) if (!PRE[e.k]) F.overlay(x, W, H, e, t); for (const k of (p.stk || [])) if (on(k, t)) F.drawSticker(x, W, H, k, t); }
    const TH = p.thumb && p.thumb.on && t < (p.thumb.dur || 0), EN = p.endc && p.endc.on && t > dur - (p.endc.dur || 0) && t <= dur + .01;
    if (TH) drawThumb(x, W, H, p, clamp((p.thumb.dur - t) / .35, 0, 1));
    else if (EN) drawEnd(x, W, H, p, (t - (dur - p.endc.dur)) / .6);
    else drawCaps(x, W, H, p, t, CL);
    const fi = p.fx.fadeIn || 0, fo = p.fx.fadeOut || 0;
    let blk = 0; if (fi && t < fi) blk = 1 - t / fi; if (fo && t > dur - fo) blk = Math.max(blk, (t - (dur - fo)) / fo);
    if (blk > 0) { x.fillStyle = `rgba(0,0,0,${clamp(blk, 0, 1)})`; x.fillRect(0, 0, W, H); }
  }

  /* ═════════ 🖼 썸네일 · 🏁 엔딩 카드 ═════════ */
  const CARD = { key: null, img: null };
  let LOGO = null;
  function logo() { if (!LOGO) { LOGO = new Image(); LOGO.src = 'icon-192.png'; } return LOGO; }
  function cardKey(p) { const T = p.thumb || {}; return T.src === 'hero' ? 'h:' + ((p.look || {}).heroImg || '') : T.src === 'file' ? 'f:' + (T.file || '') : 's:' + (((p.scenes || [])[T.k || 0] || {}).file || ''); }
  async function loadCards(p) {
    logo(); const key = cardKey(p); if (key === CARD.key) return; CARD.key = key; CARD.img = null;
    const id = key.slice(2); if (!id) return; const blob = await MV.getFile(id); if (!blob || CARD.key !== key) return;
    try {
      if (/^video/.test(blob.type)) { const u = URL.createObjectURL(blob), v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto';
        await new Promise(r => { v.onloadeddata = r; v.onerror = r; setTimeout(r, 6000); v.src = u; }); await MV.seekVideo(v, Math.min(1, (v.duration || 2) / 2));
        const c = document.createElement('canvas'); c.width = v.videoWidth || 640; c.height = v.videoHeight || 360; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); URL.revokeObjectURL(u); if (CARD.key === key) CARD.img = c; }
      else { const b0 = await createImageBitmap(blob), k = Math.min(1, 1920 / Math.max(b0.width, b0.height)); const bm = k < 1 ? await createImageBitmap(blob, { resizeWidth: Math.round(b0.width * k), resizeHeight: Math.round(b0.height * k), resizeQuality: 'high' }) : b0; if (CARD.key === key) CARD.img = bm; }
    } catch (e) { /* 그림 없이 */ }
  }
  function drawThumb(x, W, H, p, a) {
    const T = p.thumb || {}, im = CARD.img; x.save(); x.globalAlpha = a == null ? 1 : a;
    if (im) { const iw = im.width, ih = im.height, k = Math.max(W / iw, H / ih); x.drawImage(im, (W - iw * k) / 2, (H - ih * k) / 2, iw * k, ih * k); }
    else { const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#312e81'); gr.addColorStop(1, '#db2777'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    const title = T.title || p.title || '', sub = T.sub || '';
    if (title || sub) {
      const top = T.pos === 'top', mid = T.pos === 'middle', gr = top ? x.createLinearGradient(0, 0, 0, H * .5) : x.createLinearGradient(0, H * .5, 0, H);
      if (!mid) { gr.addColorStop(top ? 0 : 1, 'rgba(0,0,0,.6)'); gr.addColorStop(top ? 1 : 0, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, top ? 0 : H * .5, W, H * .5); }
      const fam = g.BKFX ? g.BKFX.fam(T.font || 'blackhan') : FONT, base = Math.round(Math.min(W, H) * .13); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
      x.font = `900 ${base}px ${fam}`; const rows = split2(x, title, base, W * .9); let f = base; for (const r of rows) { x.font = `900 ${f}px ${fam}`; while (f > 14 && x.measureText(r).width > W * .9) { f -= 2; x.font = `900 ${f}px ${fam}`; } }
      const lh = f * 1.15, fs = Math.round(f * .42), totalH = rows.length * lh + (sub ? fs * 1.6 : 0); let y = top ? H * .1 + lh / 2 : mid ? H / 2 - totalH / 2 + lh / 2 : H * .9 - totalH + lh / 2;
      x.font = `900 ${f}px ${fam}`; rows.forEach(r => { x.lineWidth = f * .16; x.strokeStyle = '#000'; x.strokeText(r, W / 2, y); x.fillStyle = T.color || '#ffffff'; x.fillText(r, W / 2, y); y += lh; });
      if (sub) { x.font = `800 ${fs}px ${FONT}`; x.lineWidth = fs * .18; x.strokeStyle = '#000'; x.strokeText(sub, W / 2, y - lh / 2 + fs * .9); x.fillStyle = '#fde68a'; x.fillText(sub, W / 2, y - lh / 2 + fs * .9); }
    }
    x.restore();
  }
  function drawEnd(x, W, H, p, a) {
    const E = p.endc || {}; x.save(); x.globalAlpha = clamp(a, 0, 1) * .78; x.fillStyle = '#0b0820'; x.fillRect(0, 0, W, H); x.globalAlpha = clamp(a, 0, 1);
    const u = Math.min(W, H); x.textAlign = 'center'; x.textBaseline = 'middle'; let y = H * .4;
    const lg = logo(); if (E.logo !== false && lg.complete && lg.naturalWidth) { const s2 = u * .26; x.save(); x.beginPath(); if (x.roundRect) x.roundRect(W / 2 - s2 / 2, y - s2 / 2, s2, s2, s2 * .22); else x.rect(W / 2 - s2 / 2, y - s2 / 2, s2, s2); x.clip(); x.drawImage(lg, W / 2 - s2 / 2, y - s2 / 2, s2, s2); x.restore(); y += s2 * .5 + u * .07; }
    if (E.by) { x.font = `900 ${Math.round(u * .085)}px ${FONT}`; x.fillStyle = '#fde68a'; x.fillText(E.by, W / 2, y); y += u * .1; }
    if (E.msg) { x.font = `700 ${Math.round(u * .055)}px ${FONT}`; x.fillStyle = '#ffffff'; x.fillText(E.msg, W / 2, y); }
    x.restore();
  }
  MV.loadCards = loadCards;
  MV.thumbImage = async function (p, W, H) { await loadCards(p); try { await document.fonts.load(`900 60px ${g.BKFX ? g.BKFX.fam((p.thumb || {}).font || 'blackhan') : FONT}`, (p.thumb || {}).title || p.title || '가'); } catch (e) { /* 기본 */ } const c = document.createElement('canvas'); c.width = W; c.height = H; drawThumb(c.getContext('2d'), W, H, p, 1); return await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); };

  function outSize(ratio, q) { const s = q === 1080 ? 1080 : 720, l = q === 1080 ? 1920 : 1280; return ratio === '9:16' ? [s, l] : [l, s]; }

  /* ═════════ 미리 보기 재생기 ═════════ */
  function Player(canvas, opts) {
    opts = opts || {};
    const P = this; P.cv = canvas; P.x = canvas.getContext('2d', { alpha: false }); P.p = null; P.audio = new Audio(); P.audio.preload = 'auto'; P.raf = 0; P.cur = -1; P.onTime = opts.onTime || null; P.stopAt = null; P.url = null; P.CL = null;
    P.setProject = async function (p, songBlob) {
      P.p = p; const [w, h] = p.ratio === '9:16' ? [360, 640] : [640, 360]; P.cv.width = w; P.cv.height = h;
      if (songBlob && P.songBlob !== songBlob) { if (P.url) URL.revokeObjectURL(P.url); P.url = URL.createObjectURL(songBlob); P.audio.src = P.url; P.songBlob = songBlob; }
      P.refresh(); await P.seek(P.audio.currentTime || 0);
    };
    P.refresh = function () { P.CL = P.p ? capLines(P.p) : null; };
    P.total = () => { const p = P.p; if (!p) return 0; const D = (p.song && p.song.dur) || 0, S = p.scenes || [], L = S.length ? S[S.length - 1].e : 0; return Math.max(D, L); };
    P.vt = null; P.vplay = null;
    P.time = () => P.vt != null ? (P.vplay ? Math.min(P.total(), P.vplay.t0 + (performance.now() - P.vplay.at) / 1000) : P.vt) : P.p ? MV.song2tl(P.p, P.audio.currentTime || 0) : (P.audio.currentTime || 0);
    P.segFix = function () { const p = P.p; if (!p || !p.song || !p.song.segs) return; const x = P.audio.currentTime, S = MV.segs(p); for (let k = 0; k < S.length; k++) { const [a, b] = S[k]; if (x < a - .02) { P.audio.currentTime = a; return; } if (x < b - .03) return; if (k === S.length - 1) { P.audio.pause(); return; } } };
    P.sfx = function (k) { try { const F = g.BKFX; if (!F) return; const C = P.ac || (P.ac = new (g.AudioContext || g.webkitAudioContext)()); if (C.state === 'suspended') C.resume(); const gn = C.createGain(); gn.gain.value = (P.p && P.p.fx.sfxVol) || .8; gn.connect(C.destination); F.sfx(C, gn, k, C.currentTime + .02); } catch (e) { /* 소리 없음 */ } };
    P.playing = () => !P.audio.paused || !!P.vplay;
    P.syncVideos = function (t, play) {
      const p = P.p, i = MV.sceneAt(p, t), S = p.scenes;
      for (const m of MEDIA.values()) if (m.vid && !m.p) { const pv = S[i - 1] && t < S[i].s + (p.fx.tdur || .6) ? S[i - 1] : null, owner = [pv, S[i], S[i + 1]].find(s => s && s.file === m.id); if (!owner) { if (!m.vid.paused) m.vid.pause(); continue; }
        const want = srcTime(owner, m, t); if (owner === S[i + 1] && t < owner.s) { if (!m.vid.paused) m.vid.pause(); if (Math.abs(m.vid.currentTime - want) > .2) m.vid.currentTime = want; continue; }
        if (play) { if (Math.abs(m.vid.currentTime - want) > .35) m.vid.currentTime = want; if (m.vid.paused) m.vid.play().catch(() => {}); } else { if (!m.vid.paused) m.vid.pause(); if (Math.abs(m.vid.currentTime - want) > .03) m.vid.currentTime = want; } }
    };
    P.draw = function () { if (!P.p) return; const t = P.time(); drawFrame(P.x, P.cv.width, P.cv.height, P.p, t, P.CL);
      const D = (P.p.song && P.p.song.dur) || 0; if (t > D + .01) { const x = P.x, W = P.cv.width; x.save(); x.fillStyle = 'rgba(220,38,38,.88)'; x.fillRect(0, 0, W, 30); x.fillStyle = '#fff'; x.font = 'bold 15px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('🎵 노래 끝 뒤 장면 (저장할 때 빠져요)', W / 2, 15); x.restore(); } };
    P.loop = function () {
      P.raf = 0; if (!P.p) return; if (P.playing()) P.segFix(); const t = P.time(), i = MV.sceneAt(P.p, t);
      if (i !== P.cur) { P.cur = i; near(P.p, i); }
      if (P.vplay && t >= P.total() - .01) { P.pause(); }
      if (P.stopAt != null && t >= P.stopAt) { P.pause(); P.stopAt = null; }
      if (P.playing() && P.lastT != null && t > P.lastT && t - P.lastT < .5) for (const z of (P.p.sfx || [])) if (z.at > P.lastT && z.at <= t) P.sfx(z.k);
      P.lastT = t;
      P.syncVideos(t, P.playing()); P.draw(); P.onTime && P.onTime(t);
      if (P.playing()) P.raf = requestAnimationFrame(P.loop);
    };
    P.play = async function (from, to) {
      if (from != null) await P.seek(from); P.stopAt = to == null ? null : to;
      if (P.vt != null) { if (P.vt >= P.total() - .05) await P.seek(0); }
      if (P.vt != null) P.vplay = { t0: P.vt, at: performance.now() };
      else { try { await P.audio.play(); } catch (e) { /* 누르면 재생 */ } }
      if (!P.raf) P.raf = requestAnimationFrame(P.loop);
    };
    P.pause = function () { if (P.vplay) { P.vt = P.time(); P.vplay = null; if (P.raf) { cancelAnimationFrame(P.raf); P.raf = 0; } } P.audio.pause(); if (!P.p) return; P.syncVideos(P.time(), false); P.draw(); P.onTime && P.onTime(P.time()); };
    P.toggle = () => P.playing() ? P.pause() : P.play();
    P.seek = async function (t) {
      if (!P.p) return; const D = (P.p.song && P.p.song.dur) || 0; t = clamp(t, 0, P.total()); const was = !!P.vplay;
      if (t > D - .01 && P.total() > D + .05) { P.vt = t; P.vplay = was ? { t0: t, at: performance.now() } : null; P.audio.pause(); try { P.audio.currentTime = MV.tl2song(P.p, D); } catch (e) { /* 아직 */ } }
      else { P.vt = null; P.vplay = null; try { P.audio.currentTime = MV.tl2song(P.p, t); } catch (e) { /* 아직 */ } } loadCards(P.p);
      const i = MV.sceneAt(P.p, t); P.cur = i; await near(P.p, i);
      for (const s of [P.p.scenes[i - 1], P.p.scenes[i], P.p.scenes[i + 1]]) { const m = s && s.file && get(s.file); if (m && m.vid) await MV.seekVideo(m.vid, srcTime(s, m, Math.max(t, s.s))); }
      P.draw(); P.onTime && P.onTime(t);
    };
    P.stop = function () { P.vplay = null; P.audio.pause(); if (P.raf) cancelAnimationFrame(P.raf); P.raf = 0; };
    P.audio.addEventListener('pause', () => { if (P.vplay) return; if (P.raf) { cancelAnimationFrame(P.raf); P.raf = 0; } P.onTime && P.onTime(P.time()); });
    P.audio.addEventListener('ended', () => { const p = P.p, D = p && p.song ? p.song.dur : 0; if (p && P.total() > D + .05 && (P.stopAt == null || P.stopAt > D)) { P.vt = D; P.vplay = { t0: D, at: performance.now() }; if (!P.raf) P.raf = requestAnimationFrame(P.loop); return; } P.pause(); });
  }

  /* ═════════ MP4 만들기 ═════════ */
  async function pickV(W, H, fps) {
  const list = Math.min(W, H) >= 1080 ? ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032'] : ['avc1.64001f', 'avc1.4d001f', 'avc1.42e01f', 'avc1.640028'];
    const bitrate = Math.min(W, H) >= 1080 ? 9e6 : 5e6;
    for (const codec of list) { const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } }; try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) { /* 다음 */ } }
    return null;
  }
  async function pickA(sr) {
    if (typeof AudioEncoder === 'undefined') return null;
    for (const c of [{ codec: 'mp4a.40.2', mux: 'aac', b: 192000 }, { codec: 'opus', mux: 'opus', b: 160000 }]) { const cfg = { codec: c.codec, sampleRate: sr, numberOfChannels: 2, bitrate: c.b }; try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux: c.mux }; } catch (e) { /* 다음 */ } }
    return null;
  }
  async function songBuffer(p, SR) {
    const blob = await MV.getFile(p.song.file); const ab = await blob.arrayBuffer();
    const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
    const dec = await new Promise((res, rej) => { const c = new OAC(2, 44100, 44100); const q = c.decodeAudioData(ab, res, () => rej(new Error('노래 파일을 읽을 수 없어요 (MP3 · M4A · WAV)'))); if (q && q.then) q.then(res, () => {}); });
    const total = p.song.dur || dec.duration, oc = new OAC(2, Math.ceil(total * SR), SR);
    const gn = oc.createGain(); const v = p.fx.vol == null ? 1 : p.fx.vol; let acc = 0;
    for (const [a, b] of MV.segs(p)) { const s = oc.createBufferSource(); s.buffer = dec; s.connect(gn); s.start(acc, a, Math.max(0, b - a)); acc += b - a; }
    const afi = Math.min(p.fx.afi || 0, total / 3); if (afi > 0) { gn.gain.setValueAtTime(0, 0); gn.gain.linearRampToValueAtTime(v, afi); } else gn.gain.setValueAtTime(v, 0); const fo = Math.min(p.fx.fadeOut || 0, total / 3); if (fo > 0) { gn.gain.setValueAtTime(v, Math.max(0, total - fo)); gn.gain.linearRampToValueAtTime(0, total); }
    gn.connect(oc.destination);
    if (g.BKFX && (p.sfx || []).length) { const sg = oc.createGain(); sg.gain.value = p.fx.sfxVol || .8; sg.connect(oc.destination); for (const z of p.sfx) if (z.at < total) g.BKFX.sfx(oc, sg, z.k, Math.max(0, z.at)); }
    return await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const q = oc.startRendering(); if (q && q.then) q.then(res, rej); });
  }
  async function exportMp4(p, q, onProg, ctl) {
    ctl = ctl || {};
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 크롬으로 열어 주세요.');
    const [W, H] = outSize(p.ratio, q), fps = 30, SR = 48000, total = p.song.dur;
    const vcfg = await pickV(W, H, fps); if (!vcfg) throw new Error(`이 휴대폰은 ${W}x${H} 영상을 못 만들어요. 720으로 낮춰 보세요.`);
    try { if (g.BKFX && p.cap.font) await document.fonts.load(`900 40px ${g.BKFX.fam(p.cap.font)}`, (p.lines || []).map(l => l.t).join('').slice(0, 300) || '가'); await document.fonts.load(`900 40px "Noto Sans KR"`, '가나다'); await document.fonts.load(`700 40px "Noto Sans KR"`, '가나다'); } catch (e) { /* 기본 글꼴 */ }
    const acfg = await pickA(SR), warning = acfg ? null : '이 브라우저는 소리 넣기를 지원하지 않아 소리 없이 만들었어요.';
    const mux = new g.Mp4Muxer({ video: { width: W, height: H }, audio: acfg ? { codec: acfg.mux, sampleRate: SR, numberOfChannels: 2, bitrate: acfg.cfg.bitrate } : undefined });
    let err = null;
    if (acfg) {
      onProg && onProg(0, '🎵 노래 넣는 중…');
      const ab = await songBuffer(p, SR);
      const ae = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: e => { err = e; } }); ae.configure(acfg.cfg);
      const L = ab.getChannelData(0), R = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, N = ab.length, BLK = 4800;
      for (let i = 0; i < N; i += BLK) { const n = Math.min(BLK, N - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n); const a = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data: d }); ae.encode(a); a.close(); if (ae.encodeQueueSize > 16) await MV.sleep(1); if (err) throw err; if (ctl.aborted) throw new Error('취소했어요.'); }
      await ae.flush(); ae.close(); if (err) throw err;
    }
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { alpha: false }); x.imageSmoothingQuality = 'high';
    const ve = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => { err = e; } }); ve.configure(vcfg);
    const nF = Math.max(1, Math.round(total * fps)), fd = Math.round(1e6 / fps), CL = capLines(p), t0 = performance.now();
    for (const m of MEDIA.values()) if (m.vid) m.vid.pause();
    await loadCards(p); try { if (g.BKFX && p.thumb) await document.fonts.load(`900 60px ${g.BKFX.fam(p.thumb.font || 'blackhan')}`, p.thumb.title || p.title || '가'); } catch (e) { /* 기본 */ }
    let lastI = -2;
    try {
      for (let f = 0; f < nF; f++) {
        if (ctl.aborted) throw new Error('취소했어요.'); if (err) throw err;
        const t = f / fps, i = MV.sceneAt(p, t), S = p.scenes;
        if (i !== lastI) { lastI = i; await near(p, i, 1); }
        for (const s of [(S[i - 1] && t < S[i].s + (p.fx.tdur || .6)) ? S[i - 1] : null, S[i]]) { const m = s && s.file && get(s.file); if (m && m.vid) await MV.seekVideo(m.vid, srcTime(s, m, Math.max(t, s.s))); }
        drawFrame(x, W, H, p, t, CL);
        const vf = new VideoFrame(cv, { timestamp: Math.round(f * 1e6 / fps), duration: fd }); ve.encode(vf, { keyFrame: f % (fps * 2) === 0 }); vf.close();
        while (ve.encodeQueueSize > 6) await MV.sleep(2);
        if (f % 6 === 0 || f === nF - 1) { const el = (performance.now() - t0) / 1000, done = (f + 1) / nF; onProg && onProg(done, `🎬 ${Math.round(done * 100)}% · 남은 시간 약 ${MV.fmt0(el / done - el)}`); await MV.sleep(0); }
      }
      await ve.flush(); if (err) throw err;
    } finally { try { ve.close(); } catch (e) { /* 닫힘 */ } cv.width = cv.height = 0; }
    return { blob: new Blob(mux.finalize(), { type: 'video/mp4' }), W, H, warning };
  }

  Object.assign(MV, { load, near, dropAll, drawFrame, capLines, Player, exportMp4, outSize, mediaGet: get });
})(window);
