/* mv-core.js — BK뮤비 데이터 · 저장(IndexedDB 'bk-muvi') · 공용 도구
 *  - 작품(뮤비)마다: 노래 · 가사 줄 · 장면 칸 · 잠금 · 자막 모양 · 효과
 *  - 노래 · 영상 · 사진 파일은 'files' 칸에 따로 보관 (작품 글에는 열쇠만)
 */
(function (g) {
  'use strict';
  const MV = g.MV = {};
  const DBN = 'bk-muvi';
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      const r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('projects')) d.createObjectStore('projects', { keyPath: 'id' }); if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' }); };
      r.onsuccess = () => res(r.result); r.onerror = () => { dbP = null; rej(r.error); };
    });
    return dbP;
  }
  function tx(store, mode, fn) {
    return db().then(d => new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); let out; const q = fn(s); if (q) q.onsuccess = () => { out = q.result; }; t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }));
  }
  MV.listProjects = () => tx('projects', 'readonly', s => s.getAll()).then(a => (a || []).sort((x, y) => (y.at || 0) - (x.at || 0)));
  MV.getProject = id => tx('projects', 'readonly', s => s.get(id));
  MV.putProject = p => tx('projects', 'readwrite', s => s.put(JSON.parse(JSON.stringify(p))));
  MV.delProject = async p => { const keys = [p.song && p.song.file, ...(p.scenes || []).map(s => s.file)].filter(Boolean); await tx('files', 'readwrite', s => { keys.forEach(k => s.delete(k)); return null; }); return tx('projects', 'readwrite', s => s.delete(p.id)); };
  MV.putFile = (blob, name) => { const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); return tx('files', 'readwrite', s => s.put({ id, blob, name: name || '', type: blob.type || '' })).then(() => id); };
  MV.getFile = id => id ? tx('files', 'readonly', s => s.get(id)).then(r => r ? r.blob : null) : Promise.resolve(null);
  MV.delFile = id => id ? tx('files', 'readwrite', s => s.delete(id)) : Promise.resolve();
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* 괜찮음 */ }

  /* ── BK뮤직 「내 노래함」 읽기 (같은 주소라 볼 수 있음 · 읽기만 하고 바꾸지 않음) ── */
  MV.musicBox = function () {
    return new Promise(res => {
      let r; try { r = indexedDB.open('bk-music'); } catch (e) { return res([]); }
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) { /* 없음 */ } };   // 노래함이 없으면 새로 만들지 않기
      r.onerror = () => res([]);
      r.onsuccess = () => { const d = r.result; if (!d.objectStoreNames.contains('songs')) { d.close(); return res([]); }
        const q = d.transaction('songs').objectStore('songs').getAll(); q.onsuccess = () => { d.close(); res((q.result || []).filter(o => o && o.blob).sort((a, b) => (b.at || 0) - (a.at || 0))); }; q.onerror = () => { d.close(); res([]); }; };
    });
  };

  /* ── 새 작품 ── */
  MV.newProject = function () {
    const now = Date.now();
    return {
      id: 'mv' + now, at: now, v: 2, title: '', step: 1, mk: null,
      song: null,              // { file, name, dur }
      lyricsRaw: '', lines: [],// [{ t, s, e }]  s/e: 초 (없으면 null)
      ratio: '16:9', clipLen: 8, mode: 'video',
      look: { mood: '', style: '실사 시네마틱', hero: '' },
      scenes: [],              // [{ id, s, e, file, kind, name, prompt, ok, off, fx, tr }]
      locked: false,
      cap: { style: 'karaoke', pos: 'bottom', size: 1, color: '#ffe14d' },
      fx: { intro: true, introText: '', outro: false, outroText: '', fadeIn: 1, fadeOut: 2.5, trans: 'fade', film: 'none', zoom: true, vol: 1 },
    };
  };

  /* ── 가사 정리: [Verse] 같은 표시 · 빈 줄 빼고, [00:15] 시간이 있으면 읽기 ── */
  MV.parseLyrics = function (raw) {
    const out = []; let timed = 0;
    String(raw || '').split(/\r?\n/).forEach(l => {
      let s = null, t = l.trim(); if (!t) return;
      const m = t.match(/^\[?\(?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\)?\]?\s*[-–:]?\s*(.*)$/);
      if (m) { s = (+m[1]) * 60 + (+m[2]) + (m[3] ? +('0.' + m[3]) : 0); t = m[4].trim(); timed++; }
      if (!t || /^[\[(（【].*[\])）】]$/.test(t)) return;     // [후렴] (간주) 같은 표시
      if (/^(verse|chorus|bridge|intro|outro|pre-?chorus|hook|간주|전주|후주|후렴|브릿지)\s*\d*\s*:?$/i.test(t)) return;
      out.push({ t: t.replace(/^[-•·]\s*/, ''), s, e: null });
    });
    return { lines: out, timed: timed > 0 && timed >= out.length * 0.6 };
  };

  /* ── 장면 칸 나누기: 곡 길이 ÷ 한 장면 길이 ── */
  MV.planScenes = function (p) {
    const dur = (p.song && p.song.dur) || 0, L = p.clipLen || 8; if (!dur) return [];
    const n = Math.max(1, Math.ceil(dur / L - 0.25)), step = dur / n, old = p.scenes || [], out = [];
    for (let i = 0; i < n; i++) { const o = old[i] || {}; out.push({ id: o.id || ('s' + i + '_' + Date.now().toString(36)), s: +(i * step).toFixed(2), e: +((i + 1) * step).toFixed(2), file: o.file || null, kind: o.kind || null, name: o.name || '', prompt: o.prompt || '', ok: !!o.ok, off: o.off || 0, fx: o.fx || '', tr: o.tr || '' }); }
    for (let i = n; i < old.length; i++) if (old[i].file) MV.delFile(old[i].file);
    return out;
  };

  /* 가사 줄의 시간 (맞춘 시간이 없으면 곡 10%~92% 사이에 고르게 · 대략) */
  MV.lineTimes = function (p) {
    const L = p.lines || [], dur = (p.song && p.song.dur) || 0, n = L.length, a = dur * 0.1, b = dur * 0.92;
    return L.map((l, i) => {
      const s = l.s != null ? l.s : a + (b - a) * i / Math.max(1, n);
      let e = l.e != null ? l.e : null;
      if (e == null) { const nx = L.slice(i + 1).find(q => q.s != null); const ns = i + 1 < n ? (L[i + 1].s != null ? L[i + 1].s : a + (b - a) * (i + 1) / n) : Math.min(dur, s + 5); e = Math.min(ns, s + 7); if (nx && nx.s < e) e = nx.s; }
      return { s, e: Math.max(s + 0.4, e), guess: l.s == null };
    });
  };
  /* 장면에 걸친 가사 줄 */
  MV.sceneLines = function (p, sc) {
    const T = MV.lineTimes(p); const r = [];
    (p.lines || []).forEach((l, i) => { const m = (T[i].s + T[i].e) / 2; if ((T[i].s >= sc.s - 0.3 && T[i].s < sc.e - 0.3) || (m >= sc.s && m < sc.e)) r.push(l.t); });
    return r;
  };
  MV.sceneAt = function (p, t) { const S = p.scenes || []; for (let i = 0; i < S.length; i++) if (t < S[i].e || i === S.length - 1) return i; return -1; };
  MV.lineAt = function (p, t) { const T = MV.lineTimes(p); for (let i = T.length - 1; i >= 0; i--) if (t >= T[i].s && t < T[i].e) return i; return -1; };

  /* ── 작은 도구 ── */
  MV.fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(r % 1 ? 1 : 0); };
  MV.fmt0 = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  MV.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MV.sleep = ms => new Promise(r => setTimeout(r, ms));
  MV.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  MV.mediaDur = function (blob) {
    return new Promise(res => { const u = URL.createObjectURL(blob), isV = /^video/.test(blob.type), el = document.createElement(isV ? 'video' : 'audio'); let done = false;
      const fin = d => { if (done) return; done = true; URL.revokeObjectURL(u); res(isFinite(d) ? d : 0); };
      el.preload = 'metadata'; el.muted = true; el.onloadedmetadata = () => fin(el.duration); el.onerror = () => fin(0); setTimeout(() => fin(el.duration), 8000); el.src = u; });
  };
  MV.copy = function (t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(() => true, () => fallback());
    return Promise.resolve(fallback());
    function fallback() { try { const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;top:-99px;opacity:0'; document.body.appendChild(a); a.select(); const ok = document.execCommand('copy'); a.remove(); return ok; } catch (e) { return false; } }
  };
  MV.seekVideo = function (v, time) {
    return new Promise(res => { if (Math.abs(v.currentTime - time) < 0.004) return res(); let done = false;
      const fin = () => { if (!done) { done = true; v.removeEventListener('seeked', fin); res(); } };
      v.addEventListener('seeked', fin); v.currentTime = time; setTimeout(fin, 700); });
  };
})(window);
