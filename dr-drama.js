/* dr-drama.js — BK뮤드: 🎭 드라마 모드 (Bang Song Studio 드라마 모드를 가져와 휴대폰에 맞게 다듬음) (대문에서 🎵 뮤직비디오 / 🎭 드라마 고르기)  🛠 관리자 전용
 *  밑바탕(미리 보기 · 타임라인 · 효과 · 엔딩 · MP4 저장 · 되돌리기 · 🔒 고정)은 뮤직비디오와 같이 씀
 *  ① 📝 기획 · 대본  : k-drama-longform-master-v3 스킬 요청 글 복사 · 받은 자막.md · 칼컷표.md · 브금.md 보관
 *  ② 🎞 클립 넣기    : 여러 개 · 폴더째 · 끌어다 놓기 · 파일 이름 순서 · 9:16/16:9 자동 · 칼컷표로 대사 뒤 무음 자르기
 *  ③ 💬 자막          : 자막.md → (클립 N) 번호대로 그 클립에 붙임 (칼컷 · 순서 바꿔도 따라감) · 자막 모양 묶음 6가지
 *  ④ ✨ 효과 · ⑤ ✂️ 다듬기 · 저장 : 뮤직비디오 것 그대로
 *  소리: 클립들의 소리를 장면 순서대로 이어 붙여 「소리 한 줄」을 만들어 노래 자리에 넣음 → 미리 보기 · MP4가 그대로 작동
 */
(function (g) {
  'use strict';
  const U = () => (g.MV && g.MV.UI) || null;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const isD = p => !!(p && p.kind === 'drama');
  const f0 = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = Math.round(s - m * 60); return m + ':' + String(r).padStart(2, '0'); };
  const f1 = s => (Math.round((s || 0) * 10) / 10).toFixed(1);

  /* ── 단계 이름 (드라마일 때만 바꿔 끼움 · 뮤직비디오면 원래대로) ── */
  const DR = [
    { e: '📝', t: '기획', h: '기획 · 대본 (스킬)' },
    { e: '🎞', t: '클립', h: '클립 넣기' },
    { e: '💬', t: '자막', h: '자막 넣기 · 모양' },
    { e: '✨', t: '효과', h: '효과 넣기' },
    { e: '✂️', t: '편집', h: '다듬기 · MP4 저장' },
  ];
  const DR_DESC = { 1: '스킬로 기획안 → 클립 프롬프트 · 자막.md · 칼컷표.md · 브금.md 받기', 2: 'Flow에서 만든 클립을 한꺼번에 넣기 · 이름 순서 · 화면 비율 자동 · 무음 칼컷', 3: '자막.md 붙여넣기 → 클립 번호대로 자동 · 자막 모양 15가지', 4: '장면 전환 · 색감 · 효과 · 스티커 · 효과음 · 제목', 5: '타임라인으로 다듬고 MP4 저장' };
  let ORIG = null, ORIG_D = null;
  function labels(ST, DESC, p) {
    if (!ORIG) { ORIG = ST.map(s => Object.assign({}, s)); ORIG_D = Object.assign({}, DESC); }
    const src = isD(p) ? DR : ORIG;
    ST.forEach((s, i) => { if (src[i]) Object.assign(s, { e: src[i].e, t: src[i].t, h: src[i].h }); });
    Object.assign(DESC, isD(p) ? DR_DESC : ORIG_D);
  }
  const PCSTAGES = DR.map((s, i) => ({ n: i + 1, e: s.e, t: s.h }));

  function dr(p) { if (!p.dr) p.dr = { topic: '', len: 1, ratio: '9:16', clip: 10, md: { sub: '', cut: '', bgm: '' }, clips: [], subs: [], sig: '' }; if (!p.dr.md) p.dr.md = { sub: '', cut: '', bgm: '' }; return p.dr; }

  /* ═════════ 대문: 🎵 / 🎭 고르기 ═════════ */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-a="newP"]'); if (!b || b.dataset.kindOk) return;
    const u = U(); if (!u) return; e.preventDefault(); e.stopPropagation();
    const old = document.getElementById('kindInline'); if (old) { old.remove(); b.classList.remove('kindOpen'); return; }   // 다시 누르면 접기
    const d = document.createElement('div'); d.id = 'kindInline'; d.className = 'kindPick kindInline';
    d.innerHTML = `<button type="button" class="kindCard mv" data-kind="mv"><span class="e">🎵</span><b>뮤직비디오</b><small>노래 한 곡 → 뮤직비디오 한 편<br>그림 · 사진 · 영상 + 노래방 자막</small></button>
      <button type="button" class="kindCard dr" data-kind="drama"><span class="e">🎭</span><b>드라마</b><small>Flow 클립 여러 개 → 드라마 한 편<br>자막.md · 칼컷표.md 자동</small></button>
      <button type="button" class="kindCard soon" disabled><span class="e">➕</span><b>곧 나와요</b><small>동화 낭독 · 신앙 영상 · 상품 설명 …</small></button>`;
    b.after(d); b.classList.add('kindOpen'); d.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, true);
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-kind]'); if (!b) return; const u = U(); if (!u) return; e.preventDefault();
    u.sheetClose(); const ki = document.getElementById('kindInline'); if (ki) ki.remove();
    if (b.dataset.kind === 'mv') { const nb = document.createElement('button'); nb.dataset.a = 'newP'; nb.dataset.kindOk = '1'; nb.hidden = true; document.body.appendChild(nb); nb.click(); nb.remove(); return; }
    const np = g.MV.newProject(); np.kind = 'drama'; np.id = 'dr' + Date.now(); np.mode = 'video'; np.ratio = '9:16'; np.step = 1;
    np.cap = { style: 'box', preset: 1, y: .74, size: 1, font: 'gowunbatang', color: '#f5f0e6', bg: '#1c1917', bga: .55, ol: .25, alpha: 1, pos: 'bottom' };
    np.fx = Object.assign(np.fx || {}, { trans: 'cut', zoom: false, fadeIn: .5, fadeOut: 1 });
    dr(np); g.MV.fixCards && g.MV.fixCards(np); if (np.thumb) np.thumb.on = false; if (np.endc) np.endc.on = false;   // 드라마는 첫 장면 · 마지막 대사를 가리지 않게 (5단계에서 켤 수 있어요)
    await g.MV.putProject(np); u.act('openP', np.id);
  });

  /* ═════════ ① 기획 · 대본 ═════════ */
  const sel = (k, cur, opts) => `<select class="pcSel" data-drs="${k}">${opts.map(([v, t]) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  function reqText(p) {
    const D = dr(p), n = { 1: 6, 3: 18, 5: 30, 10: 60 }[D.len] || 18;
    return `k-drama-longform-master-v3 스킬로 드라마를 만들어 주세요.\n\n[주제 · 링크 · 대본]\n${D.topic.trim() || '(여기에 주제나 유튜브 링크, 대본을 넣어 주세요)'}\n\n[원하는 것]\n- 분량: ${D.len}분 (${n}클립)${D.len <= 3 ? ' · 쇼츠' : ' · 롱폼'}\n- 화면: ${D.ratio === '9:16' ? '9:16 세로 쇼츠' : '16:9 가로 롱폼'}\n- 클립 길이: ${D.clip}초\n- 먼저 1안 · 2안 기획안을 보여 주고 기다려 주세요.\n- 풀세트를 쓸 때 자막.md는 「## 00:00-00:10 (클립 1)」 모양, 칼컷표.md · 브금.md도 꼭 함께 주세요.`;
  }
  function body1(p) {
    const D = dr(p), M = D.md;
    const INFO = { sub: '클립마다 나오는 <b>대사</b>예요 → ③ 자막에서 (클립 N) 번호대로 그 클립에 붙어요', cut: '클립마다 <b>쓸 구간</b>(예: 0.0~4.5초)이에요 → ② 클립 넣기에서 대사 뒤 무음을 자동으로 잘라요', bgm: '<b>배경음</b> 넣는 법(대사 때 소리 줄이기 · 정적 · 암전)이에요 → 다음 버전에서 배경음 자동에 써요' };
    const mdBox = (k, t, ph) => `<div class="field"><label>${t} ${M[k] ? `<span class="cpd ok">✓ ${M[k].split('\n').length}줄</span>` : ''} <button type="button" class="btn sm ghost" data-drf="${k}">📄 파일에서</button></label><p class="drNote">${INFO[k]}</p><textarea data-drm="${k}" class="drMd" placeholder="${ph}">${esc(M[k])}</textarea></div>`;
    return `<section class="mkBox"><h3 class="mkBoxH">❶ 📋 스킬에게 기획 부탁하기</h3>
        <div class="field"><label>🎬 주제 · 유튜브 링크 · 대본</label><textarea data-drt="topic" style="min-height:90px" placeholder="예: 시골 장터에서 무시당한 할머니의 통쾌한 반전 (조선 사극으로)">${esc(D.topic)}</textarea></div>
        <div class="selGrid"><label><span>⏱ 분량</span>${sel('len', D.len, [[1, '1분 · 6클립 (쇼츠)'], [3, '3분 · 18클립'], [5, '5분 · 30클립'], [10, '10분 · 60클립']])}</label>
          <label><span>📐 화면</span>${sel('ratio', D.ratio, [['9:16', '📱 9:16 세로 쇼츠'], ['16:9', '🖥 16:9 가로 롱폼']])}</label>
          <label><span>🎞 클립 길이</span>${sel('clip', D.clip, [[10, '10초 (기본)'], [8, '8초']])}</label></div>
        <div class="row pickRow2" style="margin-top:12px"><button class="btn pickBtn${D.ai === 'claude' ? '' : ' on'}" data-dra="reqG">📋 요청 글 복사 + Gemini 열기</button><button class="btn pickBtn${D.ai === 'claude' ? ' on' : ''}" data-dra="reqC">📋 요청 글 복사 + Claude 열기</button></div>
        <details class="help"><summary>❓ 도움말</summary><p>Gemini · Claude에 <b>k-drama-longform-master-v3</b> 스킬을 넣어 두고 쓰세요. 기획안 1안 · 2안 중 고르고 「계속」으로 Part를 받아요.<br>받은 클립 프롬프트로 <b>Google Flow</b>에서 클립을 만들고, 파일 이름을 Clip01, Clip02 … 처럼 두면 ② 에서 순서대로 들어가요.</p></details></section>
      <section class="mkBox"><h3 class="mkBoxH">❷ 📥 받은 파일 보관 <span class="muted">(붙여넣거나 파일에서 · 자동 저장)</span></h3>
        <p class="drNote">스킬이 만들어 준 파일을 여기 넣어 두면 다음 단계에서 <b>저절로</b> 써요. 클립 프롬프트(Flow용)는 여기 넣지 않아도 돼요.</p>
        ${mdBox('sub', '💬 자막.md', '## 00:00-00:10 (클립 1)\n대사…')}
        ${mdBox('cut', '✂️ 칼컷표.md', '| 클립 | 사용 구간 | 이어 붙인 뒤 시작 |\n| 1 | 0.0~4.5s | 00:00.0 |')}
        ${mdBox('bgm', '🎵 브금.md', '(다음 버전에서 배경음 자동에 써요)')}
        <p class="muted">자막.md는 ③ 자막에서, 칼컷표.md는 ② 클립 넣기에서 바로 쓰여요.</p></section>`;
  }

  /* ═════════ ② 클립 넣기 ═════════ */
  const natural = (a, b) => a.localeCompare(b, 'ko', { numeric: true, sensitivity: 'base' });
  const clipNo = (name, i) => { const m = String(name).replace(/\.[a-z0-9]{2,4}$/i, '').match(/(\d+)(?!.*\d)/); return m ? +m[1] : i + 1; };   // 확장자(mp4의 4)는 빼고
  const isSkillText = t => /^\s*-{3}\s*\n\s*name\s*:/m.test(String(t || '')) || /k-drama-longform-master|bk-muvi-mv-master|##\s*\[?핵심 지침|7대 Voice DNA/.test(String(t || ''));
  function warnSkill(u, t) { if (isSkillText(t)) { u.toast('⚠️ 이건 「스킬 파일(SKILL.md)」이에요 · 스킬이 만들어 준 자막.md · 칼컷표.md 내용을 넣어 주세요', 6000); return true; } return false; }
  function parseCut(t) { const out = {}; String(t || '').split(/\r?\n/).forEach(l => { const m = l.match(/^\s*\|?\s*(\d{1,3})\s*\|\s*([\d.]+)\s*(?:s|초)?\s*[~\-–]\s*([\d.]+)\s*(?:s|초)?/); if (m) out[+m[1]] = { a: +m[2], b: +m[3] }; }); return out; }
  function meta(blob) { return new Promise(res => { const u = URL.createObjectURL(blob), v = document.createElement('video'); let d = false; const fin = r => { if (d) return; d = true; URL.revokeObjectURL(u); res(r); };
    v.preload = 'metadata'; v.muted = true; v.onloadedmetadata = () => fin({ dur: isFinite(v.duration) ? v.duration : 0, w: v.videoWidth, h: v.videoHeight }); v.onerror = () => fin({ dur: 0, w: 0, h: 0 }); setTimeout(() => fin({ dur: v.duration || 0, w: v.videoWidth, h: v.videoHeight }), 8000); v.src = u; }); }
  let busy = false;
  async function addClips(files) {
    const u = U(), p = u && u.S.p; if (!isD(p)) return;
    files = [...files].filter(f => /^video\//.test(f.type) || /\.(mp4|mov|webm|m4v)$/i.test(f.name)); if (!files.length) return u.toast('🎞 영상 파일(MP4 등)을 골라 주세요', 3000);
    if (busy) return; busy = true; const D = dr(p);
    try {
      files.sort((a, b) => natural(a.webkitRelativePath || a.name, b.webkitRelativePath || b.name));
      for (let i = 0; i < files.length; i++) { const f = files[i]; u.toast(`🎞 클립 넣는 중… ${i + 1} / ${files.length}`, 1500);
        const m = await meta(f); if (m.dur > 180 && !confirm(`「${f.name}」은(는) ${f0(m.dur)} 길이예요. 드라마 클립(보통 8~10초)이 맞나요?\n「취소」를 누르면 이 파일은 빼요.`)) continue;
        const id = await g.MV.putFile(f, f.name), th = await u.thumbOf(f);
        D.clips.push({ id, name: f.name, dur: +f1(m.dur || 8), w: m.w, h: m.h, n: clipNo(f.name, D.clips.length), thumb: th }); }
      D.clips.sort((a, b) => natural(a.name, b.name));
      const c0 = D.clips[0]; if (c0 && c0.w && c0.h) { p.ratio = c0.h > c0.w ? '9:16' : '16:9'; D.ratio = p.ratio; }
      if (!p.title) p.title = (files[0].webkitRelativePath || '').split('/')[0] || '';
      layout(p); await rebuildAudio(p, true);
      u.toast(`✅ 클립 ${files.length}개를 넣었어요 · 화면 ${p.ratio} · 길이 ${f0(p.song ? p.song.dur : 0)}`, 4000);
    } catch (er) { u.toast('⚠️ 클립을 넣지 못했어요: ' + (er && er.message || er), 5000); }
    finally { busy = false; u.renderStage(); }
  }
  /* 클립 목록 → 장면(이어 붙이기) · 칼컷표가 있고 켜져 있으면 사용 구간만 */
  function layout(p) {
    const D = dr(p), cut = D.useCut !== false ? parseCut(D.md.cut) : {}; let t = 0; const old = p.scenes || [];
    p.scenes = D.clips.map((c, i) => { const k = cut[c.n], a = k ? Math.min(k.a, c.dur - .3) : 0, b = k ? Math.min(Math.max(k.b, a + .3), c.dur) : c.dur, len = +(b - a).toFixed(2);
      const o = old.find(x => x.clip === c.n && x.file === c.id) || {};
      const sc = Object.assign({ id: 'c' + c.n + '_' + i, prompt: '', ok: false, fx: '', tr: o.tr || '', cp: 0, reuse: null, auto: false }, { s: +t.toFixed(2), e: +(t + len).toFixed(2), file: c.id, kind: 'video', name: c.name, off: +a.toFixed(2), thumb: c.thumb, clip: c.n, pin: !!o.pin });
      t += len; return sc; });
    relayoutSubs(p);
  }
  /* ── 🔊 소리 한 줄: 장면 순서대로 각 클립의 그 구간 소리를 이어 붙임 (WAV) ── */
  const sigOf = p => JSON.stringify((p.scenes || []).map(s => [s.file, s.off || 0, s.s, s.e, s.speed || 1, s.freeze ? 1 : 0, s.mute ? 1 : 0]));
  async function rebuildAudio(p, quiet) {
    const u = U(); if (!p.scenes || !p.scenes.length) return;
    const SR = 44100, total = Math.max(...p.scenes.map(s => s.e)), N = Math.ceil(total * SR) + SR, L = new Float32Array(N), R = new Float32Array(N), cache = new Map();
    const AC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
    for (const sc of p.scenes) {
      if (sc.kind !== 'video' || !sc.file || sc.freeze || sc.mute) continue;
      let buf = cache.get(sc.file);
      if (buf === undefined) { buf = null; try { const bl = await g.MV.getFile(sc.file); if (bl) { const ab = await bl.arrayBuffer(); buf = await new Promise(res => { const c = new AC(2, SR, SR); const pr = c.decodeAudioData(ab, res, () => res(null)); if (pr && pr.catch) pr.catch(() => res(null)); }); } } catch (e) { buf = null; } cache.set(sc.file, buf); }
      if (!buf) continue;
      const bsr = buf.sampleRate, b0 = buf.getChannelData(0), b1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : b0, sp = sc.speed || 1;
      const i0 = Math.round(sc.s * SR), n = Math.round((sc.e - sc.s) * SR), fade = Math.min(220, n >> 2);
      for (let i = 0; i < n; i++) { const j = Math.floor(((sc.off || 0) + (i / SR) * sp) * bsr); if (j >= b0.length) break; const a = i < fade ? i / fade : i > n - fade ? (n - i) / fade : 1; L[i0 + i] += b0[j] * a; R[i0 + i] += b1[j] * a; }
    }
    const len = Math.ceil(total * SR), dv = new DataView(new ArrayBuffer(44 + len * 4)), ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + len * 4, true); ws(8, 'WAVE'); ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); ws(36, 'data'); dv.setUint32(40, len * 4, true);
    for (let i = 0, o = 44; i < len; i++, o += 4) { dv.setInt16(o, Math.max(-1, Math.min(1, L[i])) * 32767, true); dv.setInt16(o + 2, Math.max(-1, Math.min(1, R[i])) * 32767, true); }
    const blob = new Blob([dv.buffer], { type: 'audio/wav' }), id = await g.MV.putFile(blob, '드라마 소리.wav');
    if (p.song && p.song.file) g.MV.delFile(p.song.file);
    p.song = { file: id, name: '🎭 클립 소리 (자동)', dur: +total.toFixed(2), full: +total.toFixed(2) }; dr(p).sig = sigOf(p);
    if (u) { u.S.song = blob; if (g.MV.TL && g.MV.TL.reset) g.MV.TL.reset(); await u.S.player.setProject(p, blob); u.save(); if (!quiet) u.toast('🔊 클립 소리를 다시 맞췄어요', 2000); }
  }
  let rb = false;
  setInterval(async () => {   // 다듬기에서 장면을 자르거나 옮기면 → 소리 · 자막 자동으로 다시 맞춤
    const u = U(), p = u && u.S.p; if (!isD(p) || rb || busy || !p.scenes || !p.scenes.length || !u.S.player || u.S.player.playing()) return;
    if (dr(p).sig === sigOf(p)) return; rb = true;
    try { relayoutSubs(p); await rebuildAudio(p, false); if (u.S.view === 'stage' && p.step !== 5) u.renderStage(); } catch (e) { /* 다음에 */ } finally { rb = false; }
  }, 1500);

  function body2(p) {
    const D = dr(p), sc = p.scenes || [], tot = sc.length ? Math.max(...sc.map(s => s.e)) : 0, raw = D.clips.reduce((a, c) => a + c.dur, 0), cut = parseCut(D.md.cut), nCut = Object.keys(cut).length;
    return `<div class="pvStick" data-pv></div>
      <section class="mkBox"><h3 class="mkBoxH">❶ 🎞 클립 넣기 ${D.clips.length ? `<span class="cpd ok">${D.clips.length}개 · ${f0(tot)}</span>` : ''}</h3>
        <div class="drDrop" data-dra="pick">🎞 여기를 누르거나 <b>클립(MP4)을 끌어다 놓으세요</b><small>여러 개 한꺼번에 · 파일 이름 순서(Clip01, Clip02 …)대로 들어가요</small></div>
        <div class="row" style="margin-top:10px"><button class="btn main" data-dra="pick">📁 클립 여러 개 고르기</button><button class="btn" data-dra="dir">📂 폴더째 고르기</button><button class="btn" data-dra="lib">🗂 내 보관함에서</button>${D.clips.length ? '<button class="btn ghost" data-dra="clear">🗑 모두 빼기</button>' : ''}</div>
        <div class="selGrid" style="margin-top:12px"><label><span>📐 화면 비율 (자동 알아봄)</span>${sel('pratio', p.ratio, [['16:9', '🖥 16:9 롱폼'], ['9:16', '📱 9:16 쇼츠']])}</label>
          <label><span>✂️ 칼컷 (대사 뒤 무음 자르기)</span>${sel('useCut', D.useCut === false ? 0 : 1, [[1, nCut ? `켜기 · 칼컷표 ${nCut}줄` : '켜기 (칼컷표가 있으면)'], [0, '끄기 · 클립 전체 쓰기']])}</label></div>
        ${D.clips.length ? `<p class="muted" style="margin:8px 0 0">원래 ${f0(raw)} → ${nCut && D.useCut !== false ? `칼컷 후 <b>${f0(tot)}</b>` : `<b>${f0(tot)}</b>`}${nCut ? '' : ' · 칼컷표.md를 ① 기획에 넣으면 대사 뒤 무음이 자동으로 잘려요'}</p>` : ''}</section>
      ${D.clips.length ? `<section class="mkBox"><h3 class="mkBoxH">❷ 🧩 클립 순서</h3><div class="drList">${D.clips.map((c, i) => { const s = sc[i], k = cut[c.n]; return `
        <div class="drClip"><div class="th">${c.thumb ? `<img src="${c.thumb}" alt="">` : '🎞'}<span class="k">${c.n}</span></div>
          <div class="bd"><b>클립 ${c.n}</b> <span class="muted">${esc(c.name)}</span><br><span class="muted">${f1(c.dur)}초${k && D.useCut !== false ? ` → ✂️ ${f1(k.a)}~${f1(k.b)}초` : ''}${s ? ` · ${f0(s.s)}부터` : ''}</span></div>
          <div class="ac"><button type="button" class="btn sm ghost" data-drmv="${i}:-1"${i ? '' : ' disabled'}>▲</button><button type="button" class="btn sm ghost" data-drmv="${i}:1"${i < D.clips.length - 1 ? '' : ' disabled'}>▼</button><button type="button" class="btn sm ghost" data-drdel="${i}">🗑</button></div></div>`; }).join('')}</div></section>` : ''}`;
  }

  /* 🗂 내 보관함(bk-lib, 읽기만)에서 영상 클립 고르기 — 누른 순서대로 */
  let LB = null;
  async function libOpen() { const u = U(); const all = await g.MV.libList(); LB = { list: all.filter(o => o.kind === 'video'), sel: [] };
    if (!LB.list.length) return u.toast('🗂 보관함에 영상이 없어요 (BK쇼츠 · BK에딧에서 담은 영상이 여기 보여요)', 4000); libSheet(); }
  function libSheet() { const u = U();
    u.sheet('🗂 내 보관함 — 영상 클립', `<p class="muted">누른 순서대로 클립 번호가 붙어요 · ${LB.sel.length}개 고름</p>
      <div class="libGrid">${LB.list.map(o => { const k = LB.sel.indexOf(o.id); return `<button type="button" class="${k >= 0 ? 'on' : ''}" data-drlib="${esc(o.id)}">${o.th ? `<img src="${o.th}" alt="">` : '🎞'}${k >= 0 ? `<b>${k + 1}</b>` : ''}<i>🎞</i></button>`; }).join('')}</div>
      <button class="btn main big" data-drlibgo="1"${LB.sel.length ? '' : ' disabled'}>✅ 고른 ${LB.sel.length}개 넣기</button>`); }
  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-drlib]'), go = e.target.closest('[data-drlibgo]'); if (!(t || go) || !LB) return; e.preventDefault(); e.stopPropagation();
    if (t) { const id = t.dataset.drlib, k = LB.sel.indexOf(id); if (k >= 0) LB.sel.splice(k, 1); else LB.sel.push(id); return libSheet(); }
    const u = U(); u.sheetClose(); const fs = [];
    for (let i = 0; i < LB.sel.length; i++) { const o = LB.list.find(x => x.id === LB.sel[i]), f = await g.MV.libGet(LB.sel[i]); if (!f) continue;
      const nm = 'Clip' + String(i + 1).padStart(2, '0') + '.mp4'; fs.push(new File([f], nm, { type: f.type || 'video/mp4' })); }
    LB = null; if (fs.length) addClips(fs);
  }, true);

  /* ═════════ ③ 자막 ═════════ */
  /* 자막.md: 「## 00:00-00:10 (클립 1)」(v3) 또는 「[00:00 - 00:10]」(v2, 순서대로) */
  function parseSub(t) {
    const out = []; let cur = null, seq = 0;
    String(t || '').replace(/\r/g, '').split('\n').forEach(l => {
      const x = l.trim(); if (!x || /^#\s*자막/.test(x) || /^```/.test(x)) { if (!x && cur && cur.buf.length) { cur.parts.push(cur.buf.join('\n')); cur.buf = []; } return; }
      const m3 = x.match(/^#{1,4}\s*.*?\(\s*클립\s*(\d{1,3})\s*\)/i) || x.match(/^#{1,4}\s*(?:클립|clip)\s*(\d{1,3})\b/i);
      const m2 = !m3 && x.match(/^[#\s]*\[?\s*\d{1,2}:\d{2}(?:\.\d+)?\s*[-~–]\s*\d{1,2}:\d{2}(?:\.\d+)?\s*\]?\s*$/);
      if (m3 || m2) { if (cur && cur.buf.length) cur.parts.push(cur.buf.join('\n')); seq++; cur = { n: m3 ? +m3[1] : seq, parts: [], buf: [] }; out.push(cur); return; }
      if (!cur) return;
      if (/^[\[(（【].*[\])）】]$/.test(x) || /^[-*]\s*$/.test(x)) return;   // [할아버지] (설명) 같은 줄은 빼기
      cur.buf.push(x.replace(/^["“”']|["“”']$/g, ''));
      if (cur.buf.length >= 2) { cur.parts.push(cur.buf.join('\n')); cur.buf = []; }   // 두 줄까지 한 자막
    });
    if (cur && cur.buf.length) cur.parts.push(cur.buf.join('\n'));
    return out.filter(o => o.parts.length).map(o => ({ clip: o.n, parts: o.parts }));
  }
  /* 클립 번호로 자막 시간 정하기 — 칼컷 · 분할 · 순서 바꿈을 따라감 */
  function relayoutSubs(p) {
    const D = dr(p); if (!D.subs || !D.subs.length) return;
    const lines = [];
    D.subs.forEach(sb => {
      const ss = (p.scenes || []).filter(s => s.clip === sb.clip).sort((a, b) => a.s - b.s); if (!ss.length) return;
      const a = ss[0].s, b = ss[ss.length - 1].e, d = Math.max(.6, b - a - .1), w = sb.parts.map(t => Math.max(4, t.replace(/\s/g, '').length)), W = w.reduce((x, y) => x + y, 0); let t = a + .05;
      sb.parts.forEach((txt, i) => { const len = d * w[i] / W; lines.push({ t: txt, s: +t.toFixed(2), e: +(t + len - .05).toFixed(2), sec: '', clip: sb.clip }); t += len; });
    });
    lines.sort((x, y) => x.s - y.s); p.lines = lines; p.lyricsRaw = lines.map(l => l.t.replace(/\n/g, ' ')).join('\n');
  }
  const PRESETS = [
    { n: '먹빛 반투명', d: '사극 · 한지 느낌', smp: '이 은혜, 평생 잊지 않겠습니다', c: { font: 'gowunbatang', color: '#f5f0e6', bg: '#1c1917', bga: .55, ol: .25, alpha: 1, frame: '' } },
    { n: '황금 테', d: '궁중 · 고급', smp: '어명이오, 모두 물러서라', c: { font: 'gowunbatang', color: '#f7d774', bg: '#2a2112', bga: .62, ol: .2, alpha: 1, frame: '#d4a64a' } },
    { n: '한지 백색', d: '은은한 · 상자 없음', smp: '그날 장터에 비가 내렸지요', c: { font: 'gowunbatang', color: '#fdfaf2', bg: '#000', bga: 0, ol: .45, alpha: .95, frame: '' } },
    { n: '블랙박스 강조', d: '현대극 · 반전', smp: '그 땅, 원래 제 겁니다', c: { font: 'dohyeon', color: '#ffd34d', bg: '#000000', bga: .72, ol: 0, alpha: 1, frame: '' } },
    { n: '굵은 테두리', d: '쇼츠 · 잘 보임', smp: '다 녹음돼 있습니다', c: { font: 'blackhan', color: '#ffffff', bg: '#000', bga: 0, ol: 1, alpha: 1, frame: '' } },
    { n: '시네마', d: '법정 · 참교육 · 깔끔', smp: '증거는 여기 있습니다, 판사님', c: { font: 'noto', color: '#f1f1f1', bg: '#000', bga: .28, ol: .15, alpha: .95, frame: '' } },
    { n: '붓글씨 한지', d: '사극 · 손글씨', smp: '달이 밝으니 그대 생각이 납니다', c: { font: 'nanumpen', color: '#2b211a', bg: '#f3ead8', bga: .88, ol: 0, alpha: 1, frame: '#b08a5a' } },
    { n: '진홍 단청', d: '사극 · 궁중 위엄', smp: '왕실의 명예를 걸겠소', c: { font: 'gowunbatang', color: '#fde68a', bg: '#7f1d1d', bga: .8, ol: .15, alpha: 1, frame: '#fbbf24' } },
    { n: '뉴스 자막', d: '현대극 · 사건', smp: '속보, 땅 주인이 바뀌었습니다', c: { font: 'noto', color: '#ffffff', bg: '#0c447c', bga: .9, ol: 0, alpha: 1, frame: '' } },
    { n: '문자 메시지', d: '현대극 · 휴대폰', smp: '엄마, 오늘 일찍 갈게요', c: { font: 'noto', color: '#111827', bg: '#ffffff', bga: .93, ol: 0, alpha: 1, frame: '#cbd5e1' } },
    { n: '노랑 강조', d: '쇼츠 · 사이다', smp: '이제야 진실이 밝혀졌어요', c: { font: 'blackhan', color: '#ffe14d', bg: '#000', bga: 0, ol: 1, alpha: 1, frame: '' } },
    { n: '형광 연두', d: '쇼츠 · 코믹', smp: '어머, 이게 다 뭐예요?', c: { font: 'dohyeon', color: '#b9f227', bg: '#000', bga: 0, ol: 1, alpha: 1, frame: '' } },
    { n: '분홍 파스텔', d: '로맨스 · 설렘', smp: '처음 본 날부터 좋았어요', c: { font: 'jua', color: '#831843', bg: '#fbcfe8', bga: .88, ol: 0, alpha: 1, frame: '' } },
    { n: '뽀얀 흰 글씨', d: '감성 · 가족', smp: '고생 많으셨어요, 어머니', c: { font: 'gowunbatang', color: '#ffffff', bg: '#000', bga: 0, ol: .2, alpha: .96, frame: '' } },
    { n: '차가운 파랑', d: '스릴러 · 미스터리', smp: '그날 밤, 누가 문을 열었죠?', c: { font: 'noto', color: '#93c5fd', bg: '#0f172a', bga: .72, ol: .1, alpha: 1, frame: '' } },
  ];
  const FONT_N = [['gowunbatang', '고운바탕 (사극)'], ['noto', '본고딕 (깔끔)'], ['blackhan', '검은고딕 (굵게)'], ['dohyeon', '도현 (또렷)'], ['jua', '주아 (동글)'], ['nanumpen', '나눔손글씨 펜'], ['gaegu', '개구 (손글씨)']];
  function body3(p) {
    const D = dr(p), C = p.cap, n = (p.lines || []).length, noClip = (D.subs || []).filter(sb => !(p.scenes || []).some(s => s.clip === sb.clip)).length;
    const fam = k => (g.BKFX && g.BKFX.fam) ? g.BKFX.fam(k) : 'sans-serif';
    return `<div class="pvStick" data-pv></div>
      <section class="mkBox"><h3 class="mkBoxH">❶ 💬 자막.md 넣기 ${n ? `<span class="cpd ok">자막 ${n}개</span>` : ''}</h3>
        <div class="field"><label>자막.md <button type="button" class="btn sm ghost" data-drf="sub">📄 파일에서</button></label><textarea data-drm="sub" class="drMd" style="min-height:150px" placeholder="## 00:00-00:10 (클립 1)&#10;대사…">${esc(D.md.sub)}</textarea></div>
        <div class="row"><button class="btn main" data-dra="subGo">✅ 자막 넣기 (클립 번호대로)</button>${n ? '<button class="btn ghost" data-dra="subClear">🗑 자막 빼기</button>' : ''}</div>
        ${n ? `<p class="note green" style="margin-top:10px">✅ 자막 ${n}개를 클립 번호대로 붙였어요. 칼컷 · 순서 바꿈 · 다듬기를 해도 자막이 그 클립을 따라가요.${noClip ? ` ⚠️ 클립이 없는 자막 ${noClip}개는 빠졌어요.` : ''}</p>` : ''}
        <details class="help"><summary>❓ 도움말</summary><p>「## 00:00-00:10 (클립 1)」(스킬 v3) 모양은 <b>클립 번호</b>로, 「[00:00 - 00:10]」(v2) 모양은 <b>나오는 순서대로</b> 붙여요. 두 줄까지 한 자막으로 보여요. [화자 이름] 같은 줄은 빼요.</p></details></section>
      <section class="mkBox"><h3 class="mkBoxH">❷ 🎨 자막 모양</h3>
        <div class="capNow"><span class="smp" style="${smpStyle(PRESETS[(C.preset || 1) - 1].c, fam)}">${esc(PRESETS[(C.preset || 1) - 1].smp)}</span><div><b>지금 모양: 스타일 ${C.preset || 1} · ${esc(PRESETS[(C.preset || 1) - 1].n)}</b><br><button type="button" class="btn sm main" data-dra="capPop">🎨 자막 모양 바꾸기</button></div></div>
        <div class="selGrid" style="margin-top:12px">
          <label><span>✒️ 글꼴</span>${sel('cfont', C.font || 'gowunbatang', FONT_N)}</label>
          <label><span>🔠 글자 크기</span>${sel('csize', C.size || 1, [[.85, '작게 (85%)'], [1, '표준 (100%)'], [1.15, '크게 (115%)'], [1.3, '왕큰글씨 (130%)']])}</label>
          <label><span>↕ 자막 위치</span>${sel('cy', C.y || .74, [[.52, '중앙 (52%)'], [.68, '중하단 (68%)'], [.74, '안전 표준 (74%)'], [.82, '하단 (82%)']])}</label>
          <label><span>✨ 글자 선명도 <b data-drv="calpha">${Math.round((C.alpha || 1) * 100)}%</b></span><input type="range" min="50" max="100" step="5" value="${Math.round((C.alpha || 1) * 100)}" data-drr="calpha"></label>
          <label><span>⬛ 배경 상자 농도 <b data-drv="cbga">${Math.round((C.bga || 0) * 100)}%</b></span><input type="range" min="0" max="90" step="5" value="${Math.round((C.bga || 0) * 100)}" data-drr="cbga"></label>
        </div></section>`;
  }
  function smpStyle(c, fam) { return `font-family:${esc(fam(c.font))};color:${c.color};background:${c.bga ? `rgba(${hexRgb(c.bg)},${c.bga})` : 'transparent'};${c.frame ? `outline:2px solid ${c.frame};` : ''}${c.ol >= .4 ? 'text-shadow:0 0 3px #000,0 0 3px #000,0 0 2px #000;' : c.ol > 0 ? 'text-shadow:0 0 2px #000;' : ''}`; }
  /* 🎨 자막 모양 팝업: 장면 위에 얹힌 모양으로 크게 · 샘플 여러 개 */
  const BGS = ['linear-gradient(135deg,#3b2f2a,#8a6a4a 60%,#d9b98a)', 'linear-gradient(160deg,#1e293b,#475569 55%,#94a3b8)', 'linear-gradient(135deg,#14532d,#4d7c0f 50%,#d9f99d)', 'linear-gradient(135deg,#0f172a,#1e3a8a 60%,#60a5fa)', 'linear-gradient(135deg,#3f1d38,#9d174d 55%,#fbcfe8)', 'linear-gradient(135deg,#111,#444 60%,#999)', 'linear-gradient(135deg,#4a3b2a,#a08060 60%,#e8d5b0)', 'linear-gradient(135deg,#3b0d0d,#7f1d1d 55%,#d97706)', 'linear-gradient(135deg,#0b1d33,#334155 60%,#64748b)', 'linear-gradient(135deg,#1f2937,#6b7280 60%,#d1d5db)', 'linear-gradient(135deg,#1c1917,#57534e 60%,#a8a29e)', 'linear-gradient(135deg,#052e16,#166534 60%,#4ade80)', 'linear-gradient(135deg,#500724,#be185d 55%,#fce7f3)', 'linear-gradient(135deg,#7c2d12,#ea580c 60%,#fed7aa)', 'linear-gradient(135deg,#020617,#0f172a 55%,#1e3a8a)'];
  const GRP = { 0: '🏯 사극', 3: '🏙 현대극', 4: '📱 쇼츠', 5: '⚖️ 법정 · 참교육', 6: '🏯 사극 더 보기', 8: '🏙 현대극 더 보기', 10: '📱 쇼츠 더 보기', 12: '💕 감성 · 가족', 14: '🕵️ 스릴러' };
  function capPop(p) {
    const u = U(), C = p.cap, fam = k => (g.BKFX && g.BKFX.fam) ? g.BKFX.fam(k) : 'sans-serif';
    u.sheet('🎨 자막 모양 고르기', `<p class="muted" style="margin:0 0 10px">장면 위에 이렇게 보여요 · 고르면 바로 미리 보기에 들어가요 · 모두 ${PRESETS.length}가지</p><div class="capPop">${PRESETS.map((s2, i) => `${GRP[i] ? `<div class="capGrp">${GRP[i]}</div>` : ''}<button type="button" class="capPopC${(C.preset || 1) === i + 1 ? ' on' : ''}" data-drp="${i}"><span class="scn" style="background:${BGS[i]}"><span class="smp" style="${smpStyle(s2.c, fam)}">${esc(s2.smp)}</span></span><b>스타일 ${i + 1} · ${esc(s2.n)}</b><i>${esc(s2.d)}</i></button>`).join('')}</div>`);
  }
  function hexRgb(h) { h = String(h || '#000').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(','); }

  /* ═════════ 단계 본문 · 끝냄 · 상태 ═════════ */
  function body(p, n) {
    if (!isD(p)) return '';
    if (n === 1) return body1(p);
    if (n === 2) return body2(p);
    if (n === 3) return body3(p);
    return '';   // ④ 효과 · ⑤ 다듬기 · 저장은 뮤직비디오 것 그대로
  }
  function done(p, n) {
    const D = dr(p);
    if (n === 1) return !!(D.md.sub || D.clips.length);
    if (n === 2) return D.clips.length > 0;
    if (n === 3) return (p.lines || []).length > 0;
    return undefined;
  }
  function status(p, n) {
    const D = dr(p);
    if (n === 1) return [D.md.sub ? '자막.md ✓' : '', D.md.cut ? '칼컷표 ✓' : ''].filter(Boolean).join(' · ');
    if (n === 2) return D.clips.length ? `클립 ${D.clips.length}개 · ${f0(p.song ? p.song.dur : 0)}` : '';
    if (n === 3) return (p.lines || []).length ? `자막 ${p.lines.length}개` : '';
    return undefined;
  }

  /* ═════════ 버튼 · 칸 ═════════ */
  function refresh(u, p) { u.save(); try { u.S.player.refresh(); if (!u.S.player.playing()) u.S.player.seek(u.S.player.time()); } catch (e) { /* 괜찮음 */ } }
  function pickVideos(dir) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.multiple = true; if (dir) i.webkitdirectory = true; else i.accept = 'video/*,.mp4,.mov,.webm'; i.onchange = () => res([...(i.files || [])]); i.click(); }); }
  function pickText() { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.md,.txt,text/*'; i.onchange = async () => { const f = i.files && i.files[0]; res(f ? await f.text() : ''); }; i.click(); }); }
  document.addEventListener('click', async e => {
    const u = U(), p = u && u.S.p; if (!isD(p)) return; const D = dr(p);
    const a = e.target.closest('[data-dra]'), mv = e.target.closest('[data-drmv]'), dl = e.target.closest('[data-drdel]'), fl = e.target.closest('[data-drf]'), pr = e.target.closest('[data-drp]');
    if (a) { e.preventDefault(); const k = a.dataset.dra;
      if (k === 'reqG' || k === 'reqC') { D.ai = k === 'reqC' ? 'claude' : 'gemini'; u.save(); document.querySelectorAll('[data-dra="reqG"],[data-dra="reqC"]').forEach(x => x.classList.toggle('on', x === a)); }
      if (k === 'reqG' || k === 'reqC') return u.copyOpen(reqText(p), k === 'reqG' ? 'https://gemini.google.com/app' : 'https://claude.ai/new', '📋 요청 글을 복사했어요 · 붙여넣기(Ctrl+V) → 보내기');
      if (k === 'pick' || k === 'dir') { const fs = await pickVideos(k === 'dir'); if (fs.length) addClips(fs); return; }
      if (k === 'lib') return libOpen();
      if (k === 'clear') { if (!confirm('넣은 클립을 모두 뺄까요? (휴대폰 · PC에 있는 원래 파일과 보관함은 그대로예요)')) return; D.clips = []; p.scenes = []; p.song = null; D.sig = ''; u.save(); return u.renderStage(); }
      if (k === 'subGo') { if (warnSkill(u, D.md.sub)) return; D.subs = parseSub(D.md.sub); if (!D.subs.length) return u.toast('⚠️ 자막을 찾지 못했어요 · 「## 00:00-00:10 (클립 1)」 모양인지 봐 주세요', 4500);
        relayoutSubs(p); if (!p.cap || p.cap.style !== 'box') p.cap = Object.assign({}, p.cap, PRESETS[0].c, { style: 'box', preset: 1, y: .74, size: 1 }); refresh(u, p); u.renderStage(); return u.toast(`✅ 자막 ${p.lines.length}개를 넣었어요 · ▶ 들어 보세요`, 3000); }
      if (k === 'capPop') return capPop(p);
      if (k === 'subClear') { D.subs = []; p.lines = []; p.lyricsRaw = ''; refresh(u, p); return u.renderStage(); }
    }
    if (mv) { e.preventDefault(); const [i, d] = mv.dataset.drmv.split(':').map(Number), j = i + d; if (j < 0 || j >= D.clips.length) return; [D.clips[i], D.clips[j]] = [D.clips[j], D.clips[i]]; layout(p); await rebuildAudio(p, true); refresh(u, p); return u.renderStage(); }
    if (dl) { e.preventDefault(); const i = +dl.dataset.drdel; if (!confirm(`클립 ${D.clips[i].n}을(를) 뺄까요?`)) return; D.clips.splice(i, 1); layout(p); if (D.clips.length) await rebuildAudio(p, true); else { p.song = null; p.scenes = []; } refresh(u, p); return u.renderStage(); }
    if (fl) { e.preventDefault(); const t = await pickText(); if (!t) return; if (warnSkill(u, t)) return; D.md[fl.dataset.drf] = t; u.save(); u.renderStage(); return u.toast('📄 파일을 넣었어요', 2000); }
    if (pr) { e.preventDefault(); const s = PRESETS[+pr.dataset.drp]; p.cap = Object.assign({}, p.cap, s.c, { style: 'box', preset: +pr.dataset.drp + 1 }); refresh(u, p); u.sheetClose(); u.toast(`🎨 스타일 ${+pr.dataset.drp + 1} · ${s.n}`, 2000); return u.renderStage(); }
  }, true);
  document.addEventListener('change', async e => {
    const t = e.target, u = U(), p = u && u.S.p; if (!isD(p)) return; const D = dr(p);
    if (t.matches('select[data-drs]')) { const k = t.dataset.drs, v = t.value;
      if (k === 'len') { D.len = +v; D.ratio = D.len <= 3 ? '9:16' : '16:9'; if (!D.clips.length) p.ratio = D.ratio; u.toast(D.len <= 3 ? '📱 3분 이하는 쇼츠예요 · 화면을 9:16으로 골랐어요 (바꿀 수 있어요)' : '🖥 5분 이상은 롱폼이에요 · 화면을 16:9로 골랐어요 (바꿀 수 있어요)', 3500); }
      else if (k === 'clip') D.clip = +v; else if (k === 'ratio') { D.ratio = v; if (!D.clips.length) p.ratio = v; }
      else if (k === 'pratio') { p.ratio = v; D.ratio = v; await u.S.player.setProject(p, u.S.song); }
      else if (k === 'useCut') { D.useCut = v === '1'; if (D.clips.length) { layout(p); await rebuildAudio(p, true); } }
      else if (k === 'cfont') p.cap.font = v; else if (k === 'csize') p.cap.size = +v; else if (k === 'cy') p.cap.y = +v;
      refresh(u, p); return u.renderStage(); }
    if (t.matches('textarea[data-drm]')) { warnSkill(u, t.value); D.md[t.dataset.drm] = t.value; u.save(); if (t.dataset.drm === 'cut' && D.clips.length) { layout(p); await rebuildAudio(p, true); } return; }
    if (t.matches('textarea[data-drt]')) { D[t.dataset.drt] = t.value; u.save(); }
  });
  document.addEventListener('input', e => {
    const t = e.target, u = U(), p = u && u.S.p; if (!isD(p)) return;
    if (t.matches('input[data-drr]')) { const k = t.dataset.drr, v = +t.value / 100; if (k === 'calpha') p.cap.alpha = v; if (k === 'cbga') p.cap.bga = v; const b = document.querySelector(`[data-drv="${k}"]`); if (b) b.textContent = t.value + '%'; refresh(u, p); }
    if (t.matches('textarea[data-drm]')) { dr(p).md[t.dataset.drm] = t.value; }
    if (t.matches('textarea[data-drt]')) { dr(p)[t.dataset.drt] = t.value; }
  });

  g.BKDRAMA = { labels, body, done, status, addClips, isD, PCSTAGES, DESC: DR_DESC, parseSub, parseCut, rebuildAudio, layout };
})(window);
