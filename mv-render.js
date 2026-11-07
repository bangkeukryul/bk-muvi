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
  function srcTime(sc, m, t) { const d = (m && m.dur) || 8; let x = (sc.off || 0) + Math.max(0, t - sc.s); if (x > d - 0.05) x = x % Math.max(0.5, d - 0.05); return x; }

  function filterFor(p, sc) {
    const f = [];
    const fx = sc.fx || '';
    if (fx === 'bw') f.push('grayscale(1) contrast(1.1)');
    if (fx === 'warm') f.push('sepia(.3) saturate(1.2)');
    if (fx === 'bright') f.push('brightness(1.15) saturate(1.1)');
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
    let sc0 = Math.max(W / iw, H / ih);
    const len = Math.max(.5, sc.e - sc.s), pr = clamp((t - sc.s) / len, 0, 1);
    let zfx = sc.fx === 'zoomin' ? 1 : sc.fx === 'zoomout' ? -1 : (m.kind === 'image' && p.fx.zoom && sc.fx !== 'still') ? (i % 2 ? -1 : 1) : 0;
    const z = zfx > 0 ? 1 + .1 * pr : zfx < 0 ? 1.1 - .1 * pr : 1;
    sc0 *= z; const dw = iw * sc0, dh = ih * sc0;
    const dx = (W - dw) / 2 + (zfx ? (i % 3 - 1) * W * .02 * pr : 0), dy = (H - dh) / 2;
    x.filter = filterFor(p, sc);
    x.drawImage(el, dx, dy, dw, dh);
    x.filter = 'none'; x.restore();
  }
  function transOf(p, sc) { return sc.tr || p.fx.trans || 'fade'; }

  /* 자막에 쓸 줄: 시간이 맞춰진 줄만 */
  function capLines(p) {
    const L = p.lines || [], dur = (p.song && p.song.dur) || 1e9, out = [];
    L.forEach((l, i) => { if (l.s == null) return; let e = l.e; if (e == null) { const nx = L.slice(i + 1).find(q => q.s != null); e = nx ? nx.s : l.s + 6; e = Math.min(e, l.s + 8, dur); } out.push({ t: l.t, s: l.s, e: Math.max(l.s + .3, e), i }); });
    return out;
  }
  function fitFont(x, text, px, maxW) { let f = px; x.font = `900 ${f}px ${FONT}`; while (f > 12 && x.measureText(text).width > maxW) { f -= 2; x.font = `900 ${f}px ${FONT}`; } return f; }
  function drawCaps(x, W, H, p, t, CL) {
    const st = p.cap.style; if (st === 'none') return;
    CL = CL || capLines(p);
    let k = -1; for (let j = CL.length - 1; j >= 0; j--) if (t >= CL[j].s - .05 && t < CL[j].e) { k = j; break; }
    if (k < 0) return;
    const c = CL[k], base = Math.round(Math.min(W, H) * .072 * (p.cap.size || 1));
    const y = p.cap.pos === 'top' ? H * .14 : p.cap.pos === 'middle' ? H * .5 : H * (p.ratio === '9:16' ? .78 : .86);
    const fade = clamp((t - c.s + .05) / .2, 0, 1) * clamp((c.e - t) / .2, 0, 1);
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    const f = fitFont(x, c.t, base, W * .9);
    const outline = (s, yy, fill, a) => { x.globalAlpha = a; x.lineWidth = Math.max(4, f * .18); x.strokeStyle = 'rgba(0,0,0,.85)'; x.strokeText(s, W / 2, yy); x.fillStyle = fill; x.fillText(s, W / 2, yy); };
    if (st === 'karaoke' || st === 'two') {
      const tw = x.measureText(c.t).width, left = W / 2 - tw / 2, pr = clamp((t - c.s) / Math.max(.3, (c.e - c.s) * .88), 0, 1);
      outline(c.t, y, '#ffffff', fade);
      x.save(); x.beginPath(); x.rect(left - 4, y - f, (tw + 8) * pr, f * 2); x.clip(); x.globalAlpha = fade; x.fillStyle = p.cap.color || '#ffe14d'; x.fillText(c.t, W / 2, y); x.restore();
      if (st === 'two' && CL[k + 1]) { const n = CL[k + 1].t, f2 = fitFont(x, n, Math.round(base * .78), W * .86); x.font = `900 ${f2}px ${FONT}`; const y2 = p.cap.pos === 'top' ? y + f * 1.35 : y - f * 1.35; x.lineWidth = Math.max(3, f2 * .16); x.globalAlpha = fade * .8; x.strokeStyle = 'rgba(0,0,0,.8)'; x.strokeText(n, W / 2, y2); x.fillStyle = 'rgba(255,255,255,.75)'; x.fillText(n, W / 2, y2); }
    } else outline(c.t, y, '#ffffff', fade);
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
    const i = MV.sceneAt(p, t), sc = S[i];
    drawScene(x, W, H, p, i, t, 1);
    const nx = S[i + 1], D = .6;
    if (nx && t > sc.e - D) {
      const k = (t - (sc.e - D)) / D, tr = transOf(p, nx);
      if (tr === 'fade') drawScene(x, W, H, p, i + 1, t, k);
      if (tr === 'flash' && t > sc.e - .2) { x.fillStyle = `rgba(255,255,255,${clamp((t - (sc.e - .2)) / .2, 0, 1)})`; x.fillRect(0, 0, W, H); }
    }
    if (i > 0 && transOf(p, sc) === 'flash' && t < sc.s + .35) { x.fillStyle = `rgba(255,255,255,${clamp(1 - (t - sc.s) / .35, 0, 1)})`; x.fillRect(0, 0, W, H); }
    if (p.fx.film === 'cinema') { const bh = Math.max(0, (H - W / 2.39) / 2); if (bh > 2) { x.fillStyle = '#000'; x.fillRect(0, 0, W, bh); x.fillRect(0, H - bh, W, bh); } }
    if (p.fx.film === 'vintage' || p.fx.film === 'cinema') { const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .72); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
    const dur = (p.song && p.song.dur) || S[S.length - 1].e;
    if (p.fx.intro) { const tt = p.fx.introText || p.title; bigText(x, W, H, tt, t < 4 ? clamp(Math.min((t - .3) / .6, (4 - t) / .8), 0, 1) : 0, p.fx.introSub || ''); }
    if (p.fx.outro && p.fx.outroText) bigText(x, W, H, p.fx.outroText, clamp(Math.min((t - (dur - 5)) / .8, (dur - t) / .6 + .5), 0, 1));
    if (!(p.fx.intro && t < 4)) drawCaps(x, W, H, p, t, CL);
    const fi = p.fx.fadeIn || 0, fo = p.fx.fadeOut || 0;
    let blk = 0; if (fi && t < fi) blk = 1 - t / fi; if (fo && t > dur - fo) blk = Math.max(blk, (t - (dur - fo)) / fo);
    if (blk > 0) { x.fillStyle = `rgba(0,0,0,${clamp(blk, 0, 1)})`; x.fillRect(0, 0, W, H); }
  }

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
    P.time = () => P.audio.currentTime || 0;
    P.playing = () => !P.audio.paused;
    P.syncVideos = function (t, play) {
      const p = P.p, i = MV.sceneAt(p, t), S = p.scenes;
      for (const m of MEDIA.values()) if (m.vid && !m.p) { const owner = [S[i], S[i + 1]].find(s => s && s.file === m.id); if (!owner) { if (!m.vid.paused) m.vid.pause(); continue; }
        const want = srcTime(owner, m, t); if (owner === S[i + 1] && t < owner.s) { if (!m.vid.paused) m.vid.pause(); if (Math.abs(m.vid.currentTime - want) > .2) m.vid.currentTime = want; continue; }
        if (play) { if (Math.abs(m.vid.currentTime - want) > .35) m.vid.currentTime = want; if (m.vid.paused) m.vid.play().catch(() => {}); } else { if (!m.vid.paused) m.vid.pause(); if (Math.abs(m.vid.currentTime - want) > .03) m.vid.currentTime = want; } }
    };
    P.draw = function () { if (!P.p) return; const t = P.time(); drawFrame(P.x, P.cv.width, P.cv.height, P.p, t, P.CL); };
    P.loop = function () {
      P.raf = 0; if (!P.p) return; const t = P.time(), i = MV.sceneAt(P.p, t);
      if (i !== P.cur) { P.cur = i; near(P.p, i); }
      if (P.stopAt != null && t >= P.stopAt) { P.pause(); P.stopAt = null; }
      P.syncVideos(t, P.playing()); P.draw(); P.onTime && P.onTime(t);
      if (P.playing()) P.raf = requestAnimationFrame(P.loop);
    };
    P.play = async function (from, to) {
      if (from != null) await P.seek(from); P.stopAt = to == null ? null : to;
      try { await P.audio.play(); } catch (e) { /* 누르면 재생 */ }
      if (!P.raf) P.raf = requestAnimationFrame(P.loop);
    };
    P.pause = function () { P.audio.pause(); P.syncVideos(P.time(), false); P.draw(); P.onTime && P.onTime(P.time()); };
    P.toggle = () => P.playing() ? P.pause() : P.play();
    P.seek = async function (t) {
      if (!P.p) return; t = clamp(t, 0, (P.p.song && P.p.song.dur) || 0); try { P.audio.currentTime = t; } catch (e) { /* 아직 */ }
      const i = MV.sceneAt(P.p, t); P.cur = i; await near(P.p, i);
      for (const s of [P.p.scenes[i], P.p.scenes[i + 1]]) { const m = s && s.file && get(s.file); if (m && m.vid) await MV.seekVideo(m.vid, srcTime(s, m, Math.max(t, s.s))); }
      P.draw(); P.onTime && P.onTime(t);
    };
    P.stop = function () { P.audio.pause(); if (P.raf) cancelAnimationFrame(P.raf); P.raf = 0; };
    P.audio.addEventListener('pause', () => { if (P.raf) { cancelAnimationFrame(P.raf); P.raf = 0; } P.onTime && P.onTime(P.time()); });
    P.audio.addEventListener('ended', () => P.pause());
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
    const s = oc.createBufferSource(); s.buffer = dec; const gn = oc.createGain(); const v = p.fx.vol == null ? 1 : p.fx.vol;
    gn.gain.setValueAtTime(v, 0); const fo = Math.min(p.fx.fadeOut || 0, total / 3); if (fo > 0) { gn.gain.setValueAtTime(v, Math.max(0, total - fo)); gn.gain.linearRampToValueAtTime(0, total); }
    s.connect(gn); gn.connect(oc.destination); s.start(0);
    return await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const q = oc.startRendering(); if (q && q.then) q.then(res, rej); });
  }
  async function exportMp4(p, q, onProg, ctl) {
    ctl = ctl || {};
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 크롬으로 열어 주세요.');
    const [W, H] = outSize(p.ratio, q), fps = 30, SR = 48000, total = p.song.dur;
    const vcfg = await pickV(W, H, fps); if (!vcfg) throw new Error(`이 휴대폰은 ${W}x${H} 영상을 못 만들어요. 720으로 낮춰 보세요.`);
    try { await document.fonts.load(`900 40px "Noto Sans KR"`, '가나다'); await document.fonts.load(`700 40px "Noto Sans KR"`, '가나다'); } catch (e) { /* 기본 글꼴 */ }
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
    let lastI = -2;
    try {
      for (let f = 0; f < nF; f++) {
        if (ctl.aborted) throw new Error('취소했어요.'); if (err) throw err;
        const t = f / fps, i = MV.sceneAt(p, t), S = p.scenes;
        if (i !== lastI) { lastI = i; await near(p, i, 1); }
        for (const s of [S[i], (S[i + 1] && t > S[i].e - .6) ? S[i + 1] : null]) { const m = s && s.file && get(s.file); if (m && m.vid) await MV.seekVideo(m.vid, srcTime(s, m, Math.max(t, s.s))); }
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
