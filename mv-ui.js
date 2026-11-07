/* mv-ui.js — BK뮤비 화면: 내 뮤비 목록 · 큰 단계 5개 (노래 → 장면 → 잠금 → 자막 → 최종 편집)
 *  - 지금 단계만 펼쳐 보이고, 다 하면 「✅ 다음 단계로 ▶」
 *  - 바꿀 때마다 휴대폰에 자동 저장 (IndexedDB 'bk-muvi')
 */
(function (g) {
  'use strict';
  const MV = g.MV, esc = MV.esc, fmt = MV.fmt, fmt0 = MV.fmt0, clamp = MV.clamp;
  const $ = id => document.getElementById(id);
  const S = { p: null, song: null, player: null, tapK: 0, sel: null, zoom: 14, q: 720, busy: false };
  const STAGES = [
    { n: 1, e: '🎵', t: '노래', h: '노래 · 가사 넣기' },
    { n: 2, e: '🎬', t: '장면', h: '장면 만들기 (Flow 영상 · 그림)' },
    { n: 3, e: '🔒', t: '잠금', h: '노래 · 장면 맞춤 잠금' },
    { n: 4, e: '🎤', t: '자막', h: '가사 자막 맞추기' },
    { n: 5, e: '✂️', t: '편집', h: '최종 편집 · 저장' },
  ];
  const STYLES = ['실사 시네마틱', '감성 애니메이션', '수채화', '3D 애니메이션', '흑백 필름', '레트로 80년대'];
  const MUSIC_URL = 'https://bangkeukryul.github.io/bk-card/music.html';
  const FLOW_URL = 'https://labs.google/fx/tools/flow';

  /* ── 작은 도구 ── */
  let toastT = 0;
  function toast(m, ms) { let t = $('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.classList.remove('hide'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hide'), ms || 2600); }
  let saveT = 0;
  function save() { if (!S.p) return; S.p.at = Date.now(); clearTimeout(saveT); saveT = setTimeout(() => MV.putProject(S.p).catch(() => toast('⚠️ 저장하지 못했어요 · 휴대폰 저장 공간을 확인해 주세요', 4000)), 400); }
  function pickFiles(accept, multi) { return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = accept; if (multi) i.multiple = true; i.onchange = () => res([...(i.files || [])]); i.click(); }); }
  async function copyOpen(text, url, msg) { const ok = await MV.copy(text); toast(ok ? msg : '복사가 안 됐어요 · 다시 눌러 주세요', 5000); if (url) setTimeout(() => g.open(url, '_blank'), 400); }
  const chip = (a, v, on, label) => `<button type="button" class="chip${on ? ' on' : ''}" data-a="${a}" data-v="${esc(v)}">${label}</button>`;
  function thumbOf(blob) {
    return new Promise(res => {
      const u = URL.createObjectURL(blob), done = d => { URL.revokeObjectURL(u); res(d || ''); };
      const shot = el => { try { const w = el.videoWidth || el.naturalWidth, h = el.videoHeight || el.naturalHeight, sc = 200 / Math.max(w, h), c = document.createElement('canvas'); c.width = Math.round(w * sc); c.height = Math.round(h * sc); c.getContext('2d').drawImage(el, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', .7); } catch (e) { return ''; } };
      if (/^video/.test(blob.type)) { const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.onloadeddata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); }; v.onseeked = () => done(shot(v)); v.onerror = () => done(''); setTimeout(() => done(''), 8000); v.src = u; }
      else { const im = new Image(); im.onload = () => done(shot(im)); im.onerror = () => done(''); im.src = u; }
    });
  }

  /* ═════════ 관리자 확인 ═════════ */
  function isAdmin() { try { return localStorage.getItem('bkAdmin') === '1'; } catch (e) { return false; } }

  /* ═════════ 내 뮤비 목록 ═════════ */
  async function home() {
    if (S.player) { S.player.stop(); }
    MV.dropAll(); S.p = null; $('title').textContent = '🎬 BK뮤비'; $('homeBtn').classList.add('hide');
    const root = $('app');
    if (!isAdmin()) { root.innerHTML = `<div class="gate"><div class="e">🛠</div><h2>관리자 전용 (준비 중)</h2><p class="muted">BK뮤비는 아직 관리자만 쓸 수 있어요.<br>다른 BK 앱에서 관리자 모드를 켠 휴대폰에서 열어 주세요.</p></div>`; return; }
    const list = await MV.listProjects().catch(() => []);
    root.innerHTML = `
      <div class="note blue" style="margin-top:14px">🎬 <b>노래 한 곡 → 뮤직비디오 한 편</b><br>① 노래 → ② 장면(Flow) → ③ 🔒 잠금 → ④ 🎤 자막 → ⑤ ✂️ 최종 편집 순서로 차례차례 만들어요.</div>
      <button class="btn main big" data-a="newP">＋ 새 뮤비 만들기</button>
      <div class="plist">${list.length ? list.map(p => `
        <div class="pitem"><div style="font-size:1.6rem">${p.locked ? '🔒' : '🎬'}</div>
          <div class="bd"><b>${esc(p.title || '(제목 없음)')}</b><span class="muted">${p.song ? fmt0(p.song.dur) + ' · ' : ''}장면 ${(p.scenes || []).filter(s => s.file).length}/${(p.scenes || []).length} · ${STAGES[(p.step || 1) - 1].e} ${STAGES[(p.step || 1) - 1].t} 단계 · ${new Date(p.at).toLocaleDateString('ko-KR')}</span></div>
          <button class="btn sm main" data-a="openP" data-v="${p.id}">열기</button>
          <button class="btn sm ghost" data-a="delP" data-v="${p.id}">🗑</button></div>`).join('') : '<p class="muted" style="text-align:center">아직 만든 뮤비가 없어요.</p>'}</div>`;
  }

  async function openP(id) {
    const p = await MV.getProject(id); if (!p) return toast('작품을 찾을 수 없어요');
    S.p = p; S.sel = null; S.tapK = Math.max(0, (p.lines || []).findIndex(l => l.s == null)); if (S.tapK < 0) S.tapK = (p.lines || []).length;
    S.song = p.song ? await MV.getFile(p.song.file) : null;
    $('homeBtn').classList.remove('hide');
    buildEditor();
  }

  /* ═════════ 편집 화면 틀 ═════════ */
  function buildEditor() {
    const root = $('app');
    root.innerHTML = `<div class="steps" id="steps"></div><div id="stages">${STAGES.map(s => `<section class="stage" id="st${s.n}"><div class="sh" data-a="go" data-v="${s.n}"><h2>${s.e} ${s.n}. ${s.h}</h2><span class="st" id="sts${s.n}"></span></div><div class="sb" id="sb${s.n}"></div></section>`).join('')}</div>`;
    if (!S.pv) {
      S.pv = document.createElement('div');
      S.pv.innerHTML = `<div class="pv" id="pvWrap"><canvas id="pvCv"></canvas></div>
        <div class="tp"><button class="btn sm main" data-a="pp" id="ppBtn">▶</button><input type="range" id="pvSeek" min="0" max="1000" value="0"><span class="tm" id="pvTm">0:00</span></div>`;
      S.player = new MV.Player(S.pv.querySelector('#pvCv'), { onTime: onTime });
      S.pv.querySelector('#pvSeek').addEventListener('input', e => { if (!S.p || !S.p.song) return; S.player.seek(e.target.value / 1000 * S.p.song.dur); });
    }
    S.player.audio.volume = Math.min(1, S.p.fx.vol || 1);
    if (S.p.song && S.song) S.player.setProject(S.p, S.song);
    render();
  }
  function onTime(t) {
    if (!S.pv) return; const d = (S.p && S.p.song && S.p.song.dur) || 1;
    const sk = S.pv.querySelector('#pvSeek'); if (sk && document.activeElement !== sk) sk.value = Math.round(t / d * 1000);
    S.pv.querySelector('#pvTm').textContent = fmt0(t) + ' / ' + fmt0(d);
    S.pv.querySelector('#ppBtn').textContent = S.player.playing() ? '⏸' : '▶';
    if (S.p.step === 4) tapShow(t);
    if (S.p.step === 5) tlHead(t);
  }

  function done(n) {
    const p = S.p, sc = p.scenes || [];
    if (n === 1) return !!(p.song && (p.lines || []).length);
    if (n === 2) return sc.length > 0 && sc.every(s => s.file);
    if (n === 3) return !!p.locked;
    if (n === 4) return (p.lines || []).length > 0 && p.lines.every(l => l.s != null);
    if (n === 5) return !!p.exported;
  }
  function status(n) {
    const p = S.p, sc = p.scenes || [];
    if (n === 1) return p.song ? `${fmt0(p.song.dur)} · 가사 ${(p.lines || []).length}줄` : '노래 없음';
    if (n === 2) return sc.length ? `${sc.filter(s => s.file).length}/${sc.length} 채움` : '';
    if (n === 3) return p.locked ? '잠김' : '';
    if (n === 4) return (p.lines || []).length ? `${p.lines.filter(l => l.s != null).length}/${p.lines.length}줄` : '';
    if (n === 5) return p.exported ? '저장함' : '';
  }
  function render() {
    const p = S.p; if (!p) return;
    $('title').textContent = '🎬 ' + (p.title || 'BK뮤비');
    $('steps').innerHTML = STAGES.map(s => `<button class="${p.step === s.n ? 'on' : ''} ${done(s.n) ? 'done' : ''}" data-a="go" data-v="${s.n}"><b>${done(s.n) && p.step !== s.n ? '✅' : s.e}</b>${s.n}. ${s.t}</button>`).join('');
    STAGES.forEach(s => {
      const el = $('st' + s.n); el.classList.toggle('open', p.step === s.n); el.classList.toggle('done', !!done(s.n));
      $('sts' + s.n).textContent = status(s.n) || '';
      $('sb' + s.n).innerHTML = p.step === s.n ? BODY[s.n]() : '';
    });
    const slot = document.querySelector('#sb' + p.step + ' [data-pv]');
    if (slot && p.song) { slot.appendChild(S.pv); S.pv.querySelector('#pvWrap').classList.toggle('v916', p.ratio === '9:16'); S.player.refresh(); S.player.draw(); onTime(S.player.time()); }
    else if (S.player) { S.player.pause(); if (S.pv.parentNode) S.pv.remove(); }
    if (p.step === 5) tlBuild();
    if (p.step === 4) tapShow(S.player ? S.player.time() : 0);
  }
  function go(n) {
    const p = S.p; n = +n;
    if (n > 1 && !p.song) { toast('🎵 먼저 노래를 넣어 주세요'); n = 1; }
    if (n === 2 && !p.scenes.length) p.scenes = MV.planScenes(p);
    p.step = n; save(); render();
    setTimeout(() => { const el = $('st' + n); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30);
  }
  const nextBtn = (n, label) => `<button class="btn main big next" data-a="go" data-v="${n + 1}">${label || '✅ 다음 단계로 ▶'}</button>`;

  /* ═════════ 1. 노래 ═════════ */
  const BODY = {};
  BODY[1] = function () {
    const p = S.p, L = p.lines || [], timed = L.filter(l => l.s != null).length;
    return `
      <div class="field"><label>🏷 뮤비 제목 (노래 제목)</label><input type="text" id="fTitle" value="${esc(p.title)}" placeholder="예: 봄날의 약속"></div>
      <div class="sub"><h3>🎵 노래 넣기</h3>
        ${p.song ? `<div class="song"><div class="ic">🎧</div><div style="flex:1;min-width:0"><b>${esc(p.song.name)}</b><div class="muted">길이 ${fmt0(p.song.dur)}</div><audio controls preload="none" id="songAu"></audio></div></div>` : '<p class="muted">아직 노래가 없어요.</p>'}
        <div class="row" style="margin-top:8px"><button class="btn main" data-a="pickSong">📂 내 MP3 고르기</button><button class="btn" data-a="musicBox">🎼 BK뮤직 노래함에서</button></div>
        <div id="boxList"></div>
        <p class="muted">✍️ 새 노래를 만들려면 <a href="${MUSIC_URL}" target="_blank" rel="noopener">BK뮤직</a>에서 만들어 「💾 내 노래함」에 노래 파일까지 저장한 뒤, 여기서 「🎼 BK뮤직 노래함에서」를 누르세요.</p>
        <div class="note">⚠️ 다른 가수의 노래는 <b>내가 가진 MP3</b>만 쓸 수 있어요. 유튜브에 올리면 저작권 신고가 들어올 수 있어요.</div>
      </div>
      <div class="sub"><h3>📝 가사</h3>
        <div class="field"><textarea id="fLyr" placeholder="가사를 붙여 넣으세요 (한 줄씩)&#10;[00:15] 처럼 시간이 붙어 있으면 자막 시간도 같이 들어가요">${esc(p.lyricsRaw)}</textarea></div>
        <div class="row"><button class="btn main" data-a="lyrApply">✅ 가사 넣기</button><button class="btn" data-a="lyrAI">🤖 Gemini에게 가사 시간 받기</button></div>
        <p class="muted">${L.length ? `가사 ${L.length}줄 들어 있어요${timed ? ` · 시간 맞춘 줄 ${timed}줄` : ''}` : '가사를 넣으면 장면마다 그 시간의 가사가 보여요.'}<br>🤖 버튼: 요청 글이 복사되고 Gemini가 열려요 → ＋로 MP3 올리기 → 붙여넣기 → 보내기 → 받은 답을 위 칸에 붙여넣고 「✅ 가사 넣기」</p>
      </div>
      <div class="sub"><h3>📐 화면 모양</h3>
        <div class="cards"><button class="card${p.ratio === '16:9' ? ' on' : ''}" data-a="ratio" data-v="16:9"><span class="e">🖥</span>가로 16:9<small>유튜브 뮤직비디오</small></button><button class="card${p.ratio === '9:16' ? ' on' : ''}" data-a="ratio" data-v="9:16"><span class="e">📱</span>세로 9:16<small>쇼츠 · 릴스</small></button></div>
      </div>
      ${nextBtn(1, '✅ 다음 단계로 ▶ 장면 만들기')}`;
  };
  async function setSong(blob, name, lyrics, title) {
    const p = S.p, dur = await MV.mediaDur(blob);
    if (!dur) return toast('⚠️ 노래 파일을 읽을 수 없어요 (MP3 · M4A · WAV)', 4000);
    const id = await MV.putFile(blob, name);
    if (p.song && p.song.file) MV.delFile(p.song.file);
    const changed = !p.song || Math.abs(p.song.dur - dur) > .5;
    p.song = { file: id, name, dur }; S.song = blob;
    if (title && !p.title) p.title = title;
    if (!p.title) p.title = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
    if (lyrics && !p.lyricsRaw.trim()) { p.lyricsRaw = lyrics; applyLyrics(); }
    if (changed && p.scenes.length) p.scenes = MV.planScenes(p);
    await S.player.setProject(p, blob);
    save(); render(); toast('🎵 노래를 넣었어요 · ' + fmt0(dur));
  }
  function applyLyrics() {
    const p = S.p, old = p.lines || [], r = MV.parseLyrics(p.lyricsRaw);
    r.lines.forEach((l, i) => { if (l.s == null && old[i] && old[i].t === l.t) { l.s = old[i].s; l.e = old[i].e; } });
    p.lines = r.lines; S.tapK = Math.max(0, p.lines.findIndex(l => l.s == null)); if (p.lines.every(l => l.s != null)) S.tapK = p.lines.length;
    return r;
  }
  function lyrAIText() {
    return '(이 메시지와 함께 노래 MP3 파일을 첨부했어요)\n첨부한 노래(MP3)의 가사를 들리는 대로 받아 적어 주세요.\n- 한 줄씩 나눠서, 줄마다 맨 앞에 그 줄을 부르기 시작하는 시간을 [분:초] 형식으로 붙여 주세요. 예: [00:15] 첫 줄 가사\n- 반주만 나오는 부분(간주)은 쓰지 마세요.\n- 한 줄은 화면 자막에 맞게 15자 안팎으로 짧게 나눠 주세요.\n- 다른 설명 없이 시간과 가사만 써 주세요.' + (S.p.lyricsRaw.trim() ? '\n\n아래는 원래 가사예요. 이 글자 그대로 쓰고 시간만 맞춰 주세요:\n' + S.p.lyricsRaw.replace(/^\[?\d{1,2}:\d{2}[^\]\s]*\]?\s*/gm, '').trim() : '');
  }
  async function showMusicBox() {
    const el = $('boxList'); el.innerHTML = '<p class="muted">불러오는 중…</p>';
    const a = await MV.musicBox();
    if (!a.length) { el.innerHTML = `<div class="note">BK뮤직 「내 노래함」에 노래 파일이 없어요. <a href="${MUSIC_URL}" target="_blank" rel="noopener">BK뮤직</a>에서 노래 파일을 노래함에 저장해 주세요.</div>`; return; }
    S.box = a;
    el.innerHTML = `<div class="boxlist">${a.map((o, i) => `<button data-a="boxPick" data-v="${i}">🎵 <b>${esc(o.title || o.name)}</b> <span class="muted">${o.dur ? fmt0(o.dur) : ''}${o.lyrics ? ' · 가사 있음' : ''}</span></button>`).join('')}</div>`;
  }

  /* ═════════ 2. 장면 ═════════ */
  function sceneText(i) {
    const p = S.p, sc = p.scenes[i], ly = MV.sceneLines(p, sc), lk = p.look || {}, vid = p.mode !== 'image';
    const what = sc.prompt || (ly.length ? `가사 「${ly.join(' / ')}」의 감정을 담은 장면` : (i === 0 ? '노래가 시작되는 첫 장면, 분위기를 보여 주는 풍경' : '가사 없이 반주만 나오는 부분, 분위기를 이어 주는 장면'));
    return [`${lk.style || '실사 시네마틱'} 스타일, ${p.ratio === '9:16' ? '세로 9:16' : '가로 16:9'} 화면.`,
      lk.mood ? `전체 분위기: ${lk.mood}.` : '', lk.hero ? `주인공: ${lk.hero} (모든 장면에서 같은 얼굴 · 같은 옷).` : '',
      `장면: ${what}`,
      vid ? `${Math.round(sc.e - sc.s)}초 길이, 카메라가 천천히 움직이는 영화 같은 장면.` : '고화질 한 장의 이미지.',
      '화면에 글자 · 자막 · 로고를 넣지 마세요. 대사나 말소리 없이.'].filter(Boolean).join('\n');
  }
  function planAIText() {
    const p = S.p, lk = p.look || {}, vid = p.mode !== 'image';
    return `[BK뮤비 장면 기획 요청]\n노래 「${p.title || '제목 없음'}」(길이 ${fmt0(p.song.dur)})로 뮤직비디오를 만들려고 해요.\n장면은 ${p.scenes.length}개이고, 장면 하나는 ${vid ? `${p.clipLen}초짜리 영상(구글 Flow)` : '그림 한 장'}이에요.\n` +
      `그림 느낌: ${lk.style || '실사 시네마틱'}${lk.mood ? `\n전체 분위기: ${lk.mood}` : ''}${lk.hero ? `\n주인공: ${lk.hero}` : ''}\n\n` +
      `아래에 장면마다 그 시간에 나오는 가사를 적었어요. 노래 전체가 하나의 이야기처럼 이어지게, 장면마다 ${vid ? 'Flow에 넣을 영상' : '그림 AI에 넣을 그림'} 설명을 한국어 한두 문장으로 써 주세요.\n` +
      `- 가사의 감정과 맞게 (밝은 부분은 밝게, 슬픈 부분은 차분하게)\n- 같은 주인공 · 같은 옷 · 같은 장소 느낌이 이어지게\n${vid ? '- 카메라 움직임도 넣기 (천천히 다가가기, 옆으로 흐르기 등)\n' : ''}- 화면에 글자 · 자막 · 로고는 넣지 않기\n- 다른 설명 없이 아래 형식으로만 써 주세요:\nS1: (설명)\nS2: (설명)\n\n` +
      p.scenes.map((sc, i) => { const ly = MV.sceneLines(p, sc); return `S${i + 1} (${fmt0(sc.s)}~${fmt0(sc.e)}) 가사: ${ly.length ? ly.join(' / ') : (i === 0 ? '(전주)' : '(반주만)')}`; }).join('\n');
  }
  function parsePlan(t) {
    let n = 0; const S2 = S.p.scenes;
    String(t || '').split(/\r?\n/).forEach(l => { const m = l.replace(/\*\*/g, '').match(/^\s*[-#]*\s*(?:S|장면\s*)?(\d{1,3})\s*(?:\([^)]*\))?\s*[.:)\]：-]\s*(.+)$/i); if (m && S2[+m[1] - 1] && m[2].trim().length > 3) { S2[+m[1] - 1].prompt = m[2].trim(); n++; } });
    return n;
  }
  BODY[2] = function () {
    const p = S.p, sc = p.scenes, lk = p.look || (p.look = {}), L = !!p.locked, filled = sc.filter(s => s.file).length, oks = sc.filter(s => s.ok).length, vid = p.mode !== 'image', dis = L ? ' disabled' : '';
    return `<div data-pv></div>
      ${L ? `<div class="note red">🔒 잠겨 있어요 — 장면을 바꾸려면 <button class="btn sm" data-a="unlock">🔓 잠금 풀기</button></div>` : ''}
      <div class="note blue">🎵 ${fmt0(p.song.dur)} 노래 → <b>장면 ${sc.length}개</b> (한 장면 약 ${p.clipLen}초)</div>
      <div class="field"><label>⏱ 장면 하나 길이</label><div class="chips">${[4, 6, 8, 10].map(v => chip('clipLen', v, p.clipLen === v, v + '초' + (v === 8 ? ' (Flow)' : ''))).join('')}</div></div>
      <div class="field"><label>🛠 만드는 방법</label><div class="chips">${chip('mode', 'video', vid, '🎬 영상 (Flow)')}${chip('mode', 'image', !vid, '🖼 그림 · 사진')}</div></div>
      <div class="sub"><h3>🎨 전체 분위기 <span class="muted">(모든 장면 글에 똑같이 들어가요)</span></h3>
        <div class="chips">${STYLES.map(s => chip('style', s, lk.style === s, s)).join('')}</div>
        <div class="field"><label>💭 노래 분위기</label><input type="text" id="fMood" value="${esc(lk.mood)}" placeholder="예: 봄 햇살, 그리움, 따뜻한 재회"></div>
        <div class="field"><label>🧑 주인공 (같은 사람이 계속 나오게)</label><input type="text" id="fHero" value="${esc(lk.hero)}" placeholder="예: 20대 여성, 긴 생머리, 하얀 원피스"></div>
      </div>
      <div class="sub"><h3>🤖 장면 글 한꺼번에 받기 (추천)</h3>
        <p class="muted">① 아래 버튼 → 요청 글이 복사되고 Gemini가 열려요 → 붙여넣고 보내기<br>② 받은 답을 통째로 복사해서 아래 칸에 붙여넣기 → 「✅ 장면 글 넣기」</p>
        <div class="row"><button class="btn main" data-a="planAI">📋 요청 복사 + Gemini 열기</button></div>
        <div class="field"><textarea id="fPlan" placeholder="S1: …&#10;S2: …" style="min-height:80px"></textarea></div>
        <button class="btn" data-a="planIn">✅ 장면 글 넣기</button>
      </div>
      <div class="sub"><h3>🎞 장면 칸 · 채움 ${filled}/${sc.length} · 👍 ${oks}</h3>
        <p class="muted">장면마다: 📋 글 복사 → ${vid ? 'Flow에서 영상 만들기 → 내려받기' : '그림 AI에서 그림 만들기 → 저장'} → 📂 넣기 → ▶ 들어 보고 분위기가 맞으면 👍</p>
        <div class="row"><button class="btn" data-a="flow">🌊 Flow 열기</button><button class="btn" data-a="bulk"${dis}>📥 여러 개 한꺼번에 넣기</button></div>
        <div class="grid">${sc.map((s, i) => { const ly = MV.sceneLines(p, s); return `
          <div class="sc${s.ok ? ' ok' : ''}">
            <button class="th${p.ratio === '9:16' ? ' v916' : ''}" data-a="scPlay" data-v="${i}">${s.thumb ? `<img src="${s.thumb}" alt="">` : (s.file ? '🎞' : '비어 있음')}<span class="k">${i + 1}</span></button>
            <div class="bd"><div class="hd">장면 ${i + 1} · ${fmt0(s.s)}~${fmt0(s.e)}</div>
              <div class="ly">🎤 ${ly.length ? esc(ly.join(' / ')) : '<span class="muted">(반주)</span>'}</div>
              <div class="pr">✏️ ${s.prompt ? esc(s.prompt) : '장면 글 없음 → 가사로 자동'}</div>
              <div class="row"><button class="btn sm main" data-a="scCopy" data-v="${i}">📋 ${vid ? 'Flow' : '그림'} 글</button><button class="btn sm" data-a="scPut" data-v="${i}"${dis}>📂 ${s.file ? '바꾸기' : '넣기'}</button><button class="btn sm" data-a="scPlay" data-v="${i}">▶</button><button class="btn sm ${s.ok ? 'ok' : 'ghost'}" data-a="scOk" data-v="${i}">👍</button><button class="btn sm ghost" data-a="scEdit" data-v="${i}">✏️</button></div>
            </div></div>`; }).join('')}</div>
      </div>
      ${nextBtn(2, '✅ 다음 단계로 ▶ 잠금')}`;
  };
  async function putScene(i, f) {
    const p = S.p, sc = p.scenes[i]; if (!sc || !f) return;
    const kind = /^video/.test(f.type) ? 'video' : 'image', id = await MV.putFile(f, f.name);
    if (sc.file && !p.scenes.some((o, k) => k !== i && o.file === sc.file)) MV.delFile(sc.file);
    Object.assign(sc, { file: id, kind, name: f.name, ok: false, off: 0, thumb: await thumbOf(f) });
  }

  /* ═════════ 3. 잠금 ═════════ */
  BODY[3] = function () {
    const p = S.p, sc = p.scenes, empty = sc.map((s, i) => s.file ? 0 : i + 1).filter(Boolean), oks = sc.filter(s => s.ok).length;
    return `<div data-pv></div>
      <button class="btn big" data-a="playAll">▶ 처음부터 끝까지 보기</button>
      <div class="note ${empty.length ? 'red' : 'blue'}">장면 ${sc.length}개 중 채움 ${sc.length - empty.length}개 · 👍 ${oks}개${empty.length ? `<br>⚠️ 빈 장면: ${empty.join(', ')}번 (2단계에서 넣어 주세요)` : ''}</div>
      ${p.locked ? `<div class="note blue">🔒 노래 · 장면이 잠겨 있어요. 이제 자막을 맞춰도 장면이 안 틀어져요.</div><div class="row"><button class="btn sm ghost" data-a="unlock">🔓 잠금 풀기</button></div>${nextBtn(3, '✅ 다음 단계로 ▶ 자막 맞추기')}`
        : `<p class="muted">노래와 장면이 잘 맞으면 잠가 두세요. 잠그면 장면 순서 · 시간 · 영상이 실수로 바뀌지 않아요.<br>(5단계 최종 편집에서는 일부러 고칠 수 있어요)</p>
        <button class="btn main big next" data-a="lockNext">🔒 잠그고 다음 단계로 ▶</button>`}`;
  };

  /* ═════════ 4. 자막 ═════════ */
  BODY[4] = function () {
    const p = S.p, L = p.lines || [], c = p.cap;
    if (!L.length) return `<div class="note red">가사가 없어요. 1단계에서 가사를 넣어 주세요.</div><button class="btn" data-a="go" data-v="1">🎵 1단계로</button>`;
    const nT = L.filter(l => l.s != null).length;
    return `<div data-pv></div>
      ${nT === L.length ? '<div class="note blue">✅ 모든 줄에 시간이 들어 있어요. ▶ 로 확인하고, 어긋난 줄만 아래 「줄마다 다듬기」에서 고치세요.</div>' : ''}
      <div class="tap">
        <div class="muted" id="tapCnt"></div>
        <div class="now" id="tapNow"></div>
        <div class="nx" id="tapNx"></div>
        <button class="tapbtn" data-a="tap" id="tapBtn">👆 톡! 이 줄 시작</button>
        <div class="row" style="margin-top:8px"><button class="btn main" data-a="tapStart">▶ ${nT && nT < L.length ? '이어서 맞추기' : '처음부터 맞추기'}</button><button class="btn" data-a="tapBack">↩ 한 줄 뒤로</button><button class="btn" data-a="tapEnd">✋ 여기서 자막 끄기</button></div>
        <p class="muted">노래를 들으며 <b>노란 줄을 부르기 시작할 때 톡</b>. 반주만 나오는 부분(간주)에서는 ✋ 를 누르면 자막이 꺼져요.</p>
      </div>
      <details class="sub"><summary><b>🔧 줄마다 다듬기 (${nT}/${L.length}줄 맞춤)</b></summary>
        <div class="lines">${L.map((l, i) => `<div class="ln" id="ln${i}"><span class="t${l.s == null ? ' no' : ''}">${l.s == null ? '--:--' : fmt(l.s)}</span><span class="x" data-a="lnText" data-v="${i}">${esc(l.t)}</span><button class="btn sm" data-a="lnNudge" data-v="${i}:-0.1">−</button><button class="btn sm" data-a="lnNudge" data-v="${i}:0.1">＋</button><button class="btn sm" data-a="lnNow" data-v="${i}">⏱</button><button class="btn sm main" data-a="lnPlay" data-v="${i}">▶</button></div>`).join('')}</div>
        <p class="muted">− ＋ : 0.1초씩 · ⏱ : 지금 재생 위치로 · 글자를 누르면 고치기</p>
      </details>
      <div class="sub"><h3>🎨 자막 모양</h3>
        <div class="cards">
          ${[['karaoke', '🎤', '노래방', '부르는 대로 색이 차요'], ['two', '📝', '노래방 두 줄', '다음 줄도 미리 보여요'], ['line', '💬', '한 줄', '깔끔한 흰 글씨'], ['none', '🚫', '자막 없음', '']].map(a => `<button class="card${c.style === a[0] ? ' on' : ''}" data-a="capStyle" data-v="${a[0]}"><span class="e">${a[1]}</span>${a[2]}<small>${a[3]}</small></button>`).join('')}
        </div>
        <div class="field"><label>위치</label><div class="chips">${[['bottom', '⬇ 아래'], ['middle', '⏺ 가운데'], ['top', '⬆ 위']].map(a => chip('capPos', a[0], c.pos === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>크기</label><div class="chips">${[[.8, '작게'], [1, '보통'], [1.25, '크게']].map(a => chip('capSize', a[0], c.size === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>채우는 색</label><div class="chips">${[['#ffe14d', '🟡'], ['#7dd3fc', '🔵'], ['#f9a8d4', '🩷'], ['#86efac', '🟢'], ['#fca5a5', '🔴']].map(a => chip('capColor', a[0], c.color === a[0], a[1])).join('')}</div></div>
      </div>
      ${nextBtn(4, '✅ 다음 단계로 ▶ 최종 편집')}`;
  };
  function tapShow(t) {
    const L = S.p.lines || [], k = S.tapK, now = $('tapNow'); if (!now) return;
    $('tapCnt').textContent = k < L.length ? `${k + 1} / ${L.length} 줄 · 👇 이 줄이 들리면 톡` : `✅ ${L.length}줄 다 맞췄어요`;
    now.textContent = k < L.length ? L[k].t : '🎉 다 맞췄어요! ▶ 로 확인해 보세요';
    $('tapNx').textContent = L[k + 1] ? '다음: ' + L[k + 1].t : '';
    const cur = MV.lineAt(S.p, t); document.querySelectorAll('.ln.cur').forEach(e => e.classList.remove('cur')); const r = $('ln' + cur); if (r && S.p.lines[cur].s != null) r.classList.add('cur');
  }
  function linesChanged() { S.player.refresh(); if (!S.player.playing()) S.player.draw(); save(); }

  /* ═════════ 5. 최종 편집 ═════════ */
  BODY[5] = function () {
    return `<div data-pv></div>
      <div class="note blue">아래 줄(🎬 화면 · 🎵 음악 · 💬 자막 · ✨ 효과)에서 고칠 것을 누르세요. 빈 곳을 누르면 그 위치로 가요.</div>
      <div class="tl" id="tl"><div class="in" id="tlIn"></div></div>
      <div class="zoom"><button class="btn sm" data-a="zoom" data-v="-1">🔍−</button><button class="btn sm" data-a="zoom" data-v="1">🔍＋</button><span class="muted">타임라인 크기</span></div>
      <div class="panel" id="panel">${panel()}</div>
      <div class="sub"><h3>💾 MP4로 저장</h3>
        <div class="chips">${chip('q', 720, S.q === 720, '720p (빠르게)')}${chip('q', 1080, S.q === 1080, '1080p (선명하게)')}</div>
        <p class="muted">만드는 동안 화면을 켜 두세요. 3분 노래는 몇 분 걸려요.</p>
        <button class="btn pink big" data-a="export" id="expBtn">💾 뮤직비디오 만들기</button>
        <div id="expBox"></div>
      </div>`;
  };
  const COLORS = ['#7c3aed', '#db2777', '#2563eb', '#0d9488', '#ea580c', '#4f46e5'];
  function tlBuild() {
    const p = S.p, inn = $('tlIn'); if (!inn) return;
    const dur = p.song.dur, px = S.zoom, W = Math.ceil(dur * px) + 40, CL = MV.capLines(p);
    let h = `<div class="ruler" style="width:${W}px">${Array.from({ length: Math.floor(dur / 10) + 1 }, (_, k) => `<span style="position:absolute;left:${k * 10 * px}px">${fmt0(k * 10)}</span>`).join('')}</div>`;
    const trk = (y, lab, inner) => `<div class="trk" style="top:${y}px;width:${W}px">${inner}<span class="lab">${lab}</span></div>`;
    h += trk(16, '🎬', p.scenes.map((s, i) => `<div class="blk${S.sel && S.sel.k === 'sc' && S.sel.i === i ? ' sel' : ''}" data-tl="sc:${i}" style="left:${s.s * px}px;width:${(s.e - s.s) * px}px;background:${s.file ? COLORS[i % COLORS.length] : '#475569'}">${i + 1}${s.fx ? ' ✨' : ''}</div>`).join(''));
    h += trk(56, '🎵', `<div class="blk${S.sel && S.sel.k === 'mu' ? ' sel' : ''}" data-tl="mu:0" style="left:0;width:${dur * px}px;background:#0891b2">🎵 ${esc(p.song.name)}</div>`);
    h += trk(96, '💬', CL.map(c => `<div class="blk${S.sel && S.sel.k === 'ly' && S.sel.i === c.i ? ' sel' : ''}" data-tl="ly:${c.i}" style="left:${c.s * px}px;width:${Math.max(6, (c.e - c.s) * px)}px;background:#ca8a04">${esc(c.t)}</div>`).join(''));
    const fx = p.fx, F = [];
    if (fx.fadeIn) F.push([0, fx.fadeIn, '어둠→']); if (fx.intro) F.push([.3, 4, '제목']); if (fx.outro && fx.outroText) F.push([dur - 5, dur, '엔딩 글']); if (fx.fadeOut) F.push([dur - fx.fadeOut, dur, '→어둠']);
    h += trk(136, '✨', `<div class="blk" data-tl="fx:0" style="left:0;width:${dur * px}px;background:#1e293b;color:#94a3b8">${fx.film !== 'none' ? '🎞 ' + ({ cinema: '시네마 띠', vintage: '빈티지', vivid: '선명하게' }[fx.film] || '') : ''}</div>` + F.map(f => `<div class="blk${S.sel && S.sel.k === 'fx' ? ' sel' : ''}" data-tl="fx:0" style="left:${f[0] * px}px;width:${Math.max(8, (f[1] - f[0]) * px)}px;background:#9333ea">${f[2]}</div>`).join(''));
    h += `<div class="ph" id="tlPh"></div>`;
    inn.style.width = W + 'px'; inn.innerHTML = h; tlHead(S.player.time());
  }
  function tlHead(t) { const ph = $('tlPh'), tl = $('tl'); if (!ph) return; const x = t * S.zoom; ph.style.left = x + 'px'; if (S.player.playing() && (x < tl.scrollLeft + 20 || x > tl.scrollLeft + tl.clientWidth - 40)) tl.scrollLeft = x - 40; }
  const nud = (a, v, list) => list.map(d => `<button class="btn sm" data-a="${a}" data-v="${v}:${d}">${d > 0 ? '+' : ''}${d}</button>`).join('');
  function panel() {
    const p = S.p, s = S.sel;
    if (!s) return '<p class="muted" style="margin:0">👆 위 타임라인에서 장면 · 음악 · 자막 · 효과를 눌러 고치세요.</p>';
    if (s.k === 'sc') {
      const i = s.i, sc = p.scenes[i]; if (!sc) return '';
      return `<h4>🎬 장면 ${i + 1} · ${fmt(sc.s)} ~ ${fmt(sc.e)} (${(sc.e - sc.s).toFixed(1)}초)</h4>
        ${i > 0 ? `<div class="row"><span class="lbl">시작 옮기기</span>${nud('scB', i, [-0.5, -0.1, 0.1, 0.5])}</div>` : ''}
        ${i < p.scenes.length - 1 ? `<div class="row"><span class="lbl">끝 옮기기</span>${nud('scB', i + 1, [-0.5, -0.1, 0.1, 0.5])}</div>` : ''}
        ${sc.kind === 'video' ? `<div class="row"><span class="lbl">영상 시작점</span>${nud('scOff', i, [-1, -0.5, 0.5, 1])}<span class="muted">${(sc.off || 0).toFixed(1)}초부터</span></div>` : ''}
        <div class="row"><span class="lbl">효과</span><div class="chips">${[['', '기본'], ['zoomin', '🔍 확대'], ['zoomout', '🔎 축소'], ['still', '⏸ 고정'], ['bw', '⚫ 흑백'], ['warm', '🌅 따뜻하게'], ['bright', '☀️ 밝게']].map(a => chip('scFx', i + ':' + a[0], (sc.fx || '') === a[0], a[1])).join('')}</div></div>
        ${i > 0 ? `<div class="row"><span class="lbl">넘어올 때</span><div class="chips">${[['', '기본'], ['cut', '✂️ 컷'], ['fade', '🌫 페이드'], ['flash', '⚡ 번쩍']].map(a => chip('scTr', i + ':' + a[0], (sc.tr || '') === a[0], a[1])).join('')}</div></div>` : ''}
        <div class="row"><button class="btn sm" data-a="scPlay" data-v="${i}">▶ 이 장면</button><button class="btn sm" data-a="split" data-v="${i}">✂️ 지금 위치에서 나누기</button>${i > 0 ? `<button class="btn sm" data-a="merge" data-v="${i}">🔗 앞 장면과 합치기</button>` : ''}<button class="btn sm" data-a="scPut5" data-v="${i}">📂 바꾸기</button></div>`;
    }
    if (s.k === 'ly') {
      const l = p.lines[s.i]; if (!l) return '';
      return `<h4>💬 자막 ${s.i + 1}번 줄</h4><p style="margin:4px 0;font-weight:800">${esc(l.t)}</p>
        <div class="row"><span class="lbl">시작 ${l.s != null ? fmt(l.s) : ''}</span>${nud('lyS', s.i, [-0.5, -0.1, 0.1, 0.5])}<button class="btn sm" data-a="lnNow" data-v="${s.i}">⏱ 지금</button></div>
        <div class="row"><span class="lbl">끝 ${l.e != null ? fmt(l.e) : '(자동)'}</span>${nud('lyE', s.i, [-0.5, -0.1, 0.1, 0.5])}<button class="btn sm" data-a="lyEauto" data-v="${s.i}">자동</button></div>
        <div class="row"><button class="btn sm" data-a="lnText" data-v="${s.i}">✏️ 글 고치기</button><button class="btn sm main" data-a="lnPlay" data-v="${s.i}">▶ 들어보기</button><button class="btn sm ghost" data-a="lyOff" data-v="${s.i}">🚫 이 줄 빼기</button></div>`;
    }
    if (s.k === 'mu') {
      const f = p.fx;
      return `<h4>🎵 음악</h4>
        <div class="row"><span class="lbl">소리 크기</span><div class="chips">${[[.6, '작게'], [.8, '조금 작게'], [1, '그대로'], [1.2, '크게']].map(a => chip('vol', a[0], f.vol === a[0], a[1])).join('')}</div></div>
        <div class="row"><span class="lbl">끝 작아지기</span><div class="chips">${[[0, '없음'], [1.5, '1.5초'], [2.5, '2.5초'], [4, '4초']].map(a => chip('fadeOut', a[0], f.fadeOut === a[0], a[1])).join('')}</div></div>
        <p class="muted">끝 작아지기는 화면이 어두워지는 것과 함께 돼요. 소리 크기는 저장한 영상에 들어가요.</p>`;
    }
    const f = p.fx;
    return `<h4>✨ 효과</h4>
      <div class="row"><span class="lbl">처음 제목</span><div class="chips">${chip('intro', 1, f.intro, '켜기')}${chip('intro', 0, !f.intro, '끄기')}</div></div>
      ${f.intro ? `<div class="field"><input type="text" id="fIntro" value="${esc(f.introText || '')}" placeholder="제목 (비우면 뮤비 제목)"></div><div class="field"><input type="text" id="fIntroSub" value="${esc(f.introSub || '')}" placeholder="작은 글 (예: 노래 · 부른 사람)"></div>` : ''}
      <div class="row"><span class="lbl">엔딩 글</span><div class="chips">${chip('outro', 1, f.outro, '켜기')}${chip('outro', 0, !f.outro, '끄기')}</div></div>
      ${f.outro ? `<div class="field"><input type="text" id="fOutro" value="${esc(f.outroText || '')}" placeholder="예: 들어 주셔서 감사합니다"></div>` : ''}
      <div class="row"><span class="lbl">처음 밝아지기</span><div class="chips">${[[0, '없음'], [1, '1초'], [2, '2초']].map(a => chip('fadeIn', a[0], f.fadeIn === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">끝 어두워지기</span><div class="chips">${[[0, '없음'], [1.5, '1.5초'], [2.5, '2.5초'], [4, '4초']].map(a => chip('fadeOut', a[0], f.fadeOut === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">필름 느낌</span><div class="chips">${[['none', '없음'], ['cinema', '🎞 시네마 띠'], ['vintage', '📼 빈티지'], ['vivid', '🌈 선명하게']].map(a => chip('film', a[0], f.film === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">장면 넘김</span><div class="chips">${[['cut', '✂️ 컷'], ['fade', '🌫 페이드'], ['flash', '⚡ 번쩍']].map(a => chip('trans', a[0], f.trans === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">사진 천천히 확대</span><div class="chips">${chip('zoomImg', 1, f.zoom, '켜기')}${chip('zoomImg', 0, !f.zoom, '끄기')}</div></div>`;
  }
  function editRefresh(keepPanel) { S.player.refresh(); if (!S.player.playing()) S.player.seek(S.player.time()); tlBuild(); if (!keepPanel) $('panel').innerHTML = panel(); save(); }
  function moveBoundary(i, d) {   // i번 장면의 시작 = i-1번 장면의 끝
    const sc = S.p.scenes, a = sc[i - 1], b = sc[i]; if (!a || !b) return;
    const v = clamp(+(b.s + d).toFixed(2), a.s + .5, b.e - .5); b.s = v; a.e = v;
  }

  async function doExport() {
    const p = S.p; if (S.busy) return; if (!p.scenes.some(s => s.file)) return toast('장면이 비어 있어요');
    S.busy = true; S.player.pause(); const box = $('expBox'), btn = $('expBtn'), ctl = {};
    btn.disabled = true; box.innerHTML = `<div class="prog"><i id="expBar"></i></div><p class="muted" id="expMsg">준비 중…</p><button class="btn sm ghost" id="expStop">■ 그만</button>`;
    $('expStop').onclick = () => { ctl.aborted = true; };
    let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch (e) { /* 없어도 됨 */ }
    try {
      const r = await MV.exportMp4(p, S.q, (f, m) => { const b = $('expBar'), t = $('expMsg'); if (b) b.style.width = Math.round(f * 100) + '%'; if (t) t.textContent = m; }, ctl);
      const url = URL.createObjectURL(r.blob), name = (p.title || 'BK뮤비').replace(/[\\/:*?"<>|]/g, '') + '.mp4';
      p.exported = Date.now(); save();
      box.innerHTML = `<div class="note blue">✅ 다 만들었어요! (${r.W}x${r.H} · ${(r.blob.size / 1048576).toFixed(1)}MB)${r.warning ? '<br>⚠️ ' + r.warning : ''}</div>
        <video src="${url}" controls playsinline style="width:100%;border-radius:12px;background:#000"></video>
        <div class="row" style="margin-top:8px"><a class="btn main" href="${url}" download="${esc(name)}">⬇️ 휴대폰에 저장</a><button class="btn" id="expShare">📤 보내기</button></div>`;
      $('expShare').onclick = async () => { try { const f = new File([r.blob], name, { type: 'video/mp4' }); if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: p.title }); else toast('이 휴대폰은 바로 보내기가 안 돼요 · ⬇️ 저장 후 보내 주세요'); } catch (e) { /* 취소 */ } };
      $('sts5').textContent = status(5); $('st5').classList.add('done');
    } catch (e) { box.innerHTML = `<div class="note red">⚠️ ${esc(e.message || e)}</div>`; }
    finally { S.busy = false; if ($('expBtn')) $('expBtn').disabled = false; if (lock) try { lock.release(); } catch (e) { /* 괜찮음 */ } S.player.seek(S.player.time()); }
  }

  /* ═════════ 누르기 처리 ═════════ */
  async function act(a, v, el) {
    const p = S.p;
    switch (a) {
      case 'home': return home();
      case 'newP': { const np = MV.newProject(); await MV.putProject(np); return openP(np.id); }
      case 'openP': return openP(v);
      case 'delP': { const q = await MV.getProject(v); if (q && confirm(`「${q.title || '제목 없음'}」을(를) 지울까요?\n(이 뮤비에 넣은 노래 · 영상도 BK뮤비 안에서 지워져요)`)) { await MV.delProject(q); home(); } return; }
      case 'go': return go(v);
      case 'pp': return S.player.toggle();
      /* 1 */
      case 'pickSong': { const [f] = await pickFiles('audio/*,.mp3,.m4a,.wav'); if (f) await setSong(f, f.name); return; }
      case 'musicBox': return showMusicBox();
      case 'boxPick': { const o = S.box[+v]; if (o) await setSong(o.blob, o.name || (o.title + '.mp3'), o.lyrics, o.title); return; }
      case 'lyrApply': { p.lyricsRaw = $('fLyr').value; const r = applyLyrics(); save(); render(); return toast(r.lines.length ? `📝 가사 ${r.lines.length}줄${r.timed ? ' · 시간도 같이 들어갔어요' : ''}` : '가사가 비어 있어요'); }
      case 'lyrAI': p.lyricsRaw = $('fLyr').value; save(); return copyOpen(lyrAIText(), 'https://gemini.google.com/app', '📋 복사했어요 · Gemini에서 ① ＋로 MP3 올리기 ② 붙여넣기 ③ 보내기');
      case 'ratio': p.ratio = v; await S.player.setProject(p, S.song); save(); return render();
      /* 2 */
      case 'clipLen': if (p.locked) return toast('🔒 잠겨 있어요'); if (p.scenes.some(s => s.file) && !confirm('장면 길이를 바꾸면 장면 칸 수가 바뀌어요. 넣은 영상은 앞에서부터 그대로 둘게요. 바꿀까요?')) return; p.clipLen = +v; p.scenes = MV.planScenes(p); save(); return render();
      case 'mode': p.mode = v; save(); return render();
      case 'style': p.look.style = v; save(); return render();
      case 'planAI': return copyOpen(planAIText(), 'https://gemini.google.com/app', '📋 요청 글을 복사했어요 · Gemini에 붙여넣고 보내기');
      case 'planIn': { const n = parsePlan($('fPlan').value); save(); render(); return toast(n ? `✅ 장면 글 ${n}개를 넣었어요` : '⚠️ 「S1: …」 모양의 줄을 못 찾았어요', 3500); }
      case 'flow': return g.open(FLOW_URL, '_blank');
      case 'scCopy': return copyOpen(sceneText(+v), null, `📋 장면 ${+v + 1} 글을 복사했어요 · ${p.mode === 'image' ? '그림 AI' : 'Flow'}에 붙여넣기`);
      case 'scPut': case 'scPut5': { if (a === 'scPut' && p.locked) return toast('🔒 잠겨 있어요'); const [f] = await pickFiles('video/*,image/*'); if (!f) return; await putScene(+v, f); save(); if (a === 'scPut5') editRefresh(); else render(); S.player.seek(p.scenes[+v].s); return toast(`📂 장면 ${+v + 1}에 넣었어요 · ▶ 로 들어 보세요`); }
      case 'bulk': {
        if (p.locked) return toast('🔒 잠겨 있어요');
        const fs = (await pickFiles('video/*,image/*', true)).sort((x, y) => x.name.localeCompare(y.name, 'ko', { numeric: true })); if (!fs.length) return;
        let slots = p.scenes.map((s, i) => s.file ? -1 : i).filter(i => i >= 0);
        if (!slots.length) { if (!confirm('빈 칸이 없어요. 1번 장면부터 바꿔 넣을까요?')) return; slots = p.scenes.map((s, i) => i); }
        toast('📥 넣는 중…', 9000); let n = 0; for (const f of fs) { if (n >= slots.length) break; await putScene(slots[n++], f); }
        save(); render(); return toast(`📥 ${n}개를 넣었어요${fs.length > n ? ` (칸이 모자라 ${fs.length - n}개는 빠졌어요)` : ''}`, 4000);
      }
      case 'scPlay': { const sc = p.scenes[+v]; if (!sc) return; S.pv.scrollIntoView({ behavior: 'smooth', block: 'center' }); return S.player.play(sc.s, sc.e); }
      case 'scOk': p.scenes[+v].ok = !p.scenes[+v].ok; save(); return render();
      case 'scEdit': { const sc = p.scenes[+v], t = prompt(`장면 ${+v + 1} 글 (비우면 가사로 자동)`, sc.prompt || ''); if (t != null) { sc.prompt = t.trim(); save(); render(); } return; }
      /* 3 */
      case 'playAll': S.pv.scrollIntoView({ behavior: 'smooth', block: 'center' }); return S.player.play(0);
      case 'lockNext': { const empty = p.scenes.filter(s => !s.file).length; if (empty && !confirm(`빈 장면이 ${empty}개 있어요. 그래도 잠글까요?`)) return; p.locked = Date.now(); save(); toast('🔒 잠갔어요'); return go(4); }
      case 'unlock': if (confirm('잠금을 풀까요? 장면을 다시 바꿀 수 있게 돼요.')) { p.locked = false; save(); render(); } return;
      /* 4 */
      case 'tapStart': {
        const L = p.lines, nT = L.filter(l => l.s != null).length;
        let fresh = nT === 0;
        if (nT === L.length) { if (!confirm('처음부터 다시 맞출까요? 맞춘 시간이 지워져요.')) return; fresh = true; }
        else if (nT && !confirm('이어서 맞출까요?\n(「취소」를 누르면 처음부터 다시 맞출지 물어봐요)')) { if (!confirm('처음부터 다시 맞출까요? 맞춘 시간이 지워져요.')) return; fresh = true; }
        if (fresh) { L.forEach(l => { l.s = null; l.e = null; }); S.tapK = 0; linesChanged(); render(); return S.player.play(0); }
        S.tapK = L.findIndex(l => l.s == null); const prev = L[S.tapK - 1]; tapShow(0); return S.player.play(prev ? Math.max(0, prev.s - .5) : 0);
      }
      case 'tap': {
        const L = p.lines, k = S.tapK; if (!S.player.playing()) return S.player.play();
        if (k >= L.length) return toast('✅ 다 맞췄어요');
        const t = +Math.max(0, S.player.time() - .15).toFixed(2); L[k].s = t; L[k].e = null; if (L[k - 1] && L[k - 1].e != null && L[k - 1].e > t) L[k - 1].e = null;
        S.tapK = k + 1; linesChanged(); tapShow(S.player.time()); const tb = $('tapBtn'); if (tb) { tb.style.filter = 'brightness(1.4)'; setTimeout(() => tb.style.filter = '', 120); }
        if (S.tapK >= L.length) { toast('🎉 다 맞췄어요! ▶ 로 확인해 보세요', 3500); $('sts4').textContent = status(4); }
        return;
      }
      case 'tapBack': { const L = p.lines; if (S.tapK <= 0) return S.player.play(0); S.tapK--; L[S.tapK].s = null; L[S.tapK].e = null; linesChanged(); const prev = L[S.tapK - 1]; tapShow(0); return S.player.play(prev ? Math.max(0, prev.s - .3) : 0); }
      case 'tapEnd': { const l = p.lines[S.tapK - 1]; if (!l || l.s == null) return toast('먼저 줄을 톡 해 주세요'); l.e = +Math.max(l.s + .3, S.player.time()).toFixed(2); linesChanged(); return toast('✋ 자막을 껐어요 · 다음 줄이 들리면 톡'); }
      case 'lnNudge': { const [i, d] = v.split(':'), l = p.lines[+i]; l.s = +Math.max(0, (l.s == null ? S.player.time() : l.s) + +d).toFixed(2); linesChanged(); const r = el.closest('.ln'); if (r) r.querySelector('.t').textContent = fmt(l.s), r.querySelector('.t').classList.remove('no'); return S.player.seek(Math.max(0, l.s)); }
      case 'lnNow': { const l = p.lines[+v]; l.s = +S.player.time().toFixed(2); linesChanged(); if (p.step === 5) return editRefresh(); return render(); }
      case 'lnPlay': { const l = p.lines[+v]; if (l.s == null) return toast('아직 시간이 없어요'); return S.player.play(Math.max(0, l.s - .8)); }
      case 'lnText': { const l = p.lines[+v], t = prompt('자막 글 고치기', l.t); if (t != null && t.trim()) { l.t = t.trim(); linesChanged(); if (p.step === 5) editRefresh(); else render(); } return; }
      case 'capStyle': p.cap.style = v; linesChanged(); return render();
      case 'capPos': p.cap.pos = v; linesChanged(); return render();
      case 'capSize': p.cap.size = +v; linesChanged(); return render();
      case 'capColor': p.cap.color = v; linesChanged(); return render();
      /* 5 */
      case 'zoom': S.zoom = clamp(S.zoom * (+v > 0 ? 1.5 : 1 / 1.5), 3, 80); return tlBuild();
      case 'scB': { const [i, d] = v.split(':'); moveBoundary(+i, +d); return editRefresh(); }
      case 'scOff': { const [i, d] = v.split(':'), sc = p.scenes[+i], m = MV.mediaGet(sc.file); sc.off = +clamp((sc.off || 0) + +d, 0, Math.max(0, ((m && m.dur) || 8) - .5)).toFixed(2); return editRefresh(); }
      case 'scFx': { const [i, f] = v.split(':'); p.scenes[+i].fx = f; return editRefresh(); }
      case 'scTr': { const [i, f] = v.split(':'); p.scenes[+i].tr = f; return editRefresh(); }
      case 'split': { const i = +v, sc = p.scenes[i], t = S.player.time(); if (t < sc.s + .5 || t > sc.e - .5) return toast('▶ 재생 위치를 이 장면 안(가운데쪽)으로 옮긴 뒤 눌러 주세요', 3500); const nw = Object.assign({}, sc, { id: 's' + Date.now().toString(36), s: +t.toFixed(2), off: +((sc.off || 0) + (t - sc.s)).toFixed(2), tr: 'cut' }); sc.e = nw.s; p.scenes.splice(i + 1, 0, nw); S.sel = { k: 'sc', i: i + 1 }; toast('✂️ 나눴어요 · 뒤쪽 장면 영상을 바꿀 수 있어요'); return editRefresh(); }
      case 'merge': { const i = +v, a2 = p.scenes[i - 1], b = p.scenes[i]; if (!confirm(`장면 ${i}과(와) 장면 ${i + 1}을(를) 합칠까요? (${i + 1}번 영상은 빠져요)`)) return; a2.e = b.e; p.scenes.splice(i, 1); if (b.file && !p.scenes.some(o => o.file === b.file)) MV.delFile(b.file); S.sel = { k: 'sc', i: i - 1 }; return editRefresh(); }
      case 'lyS': { const [i, d] = v.split(':'), l = p.lines[+i]; l.s = +Math.max(0, l.s + +d).toFixed(2); editRefresh(); return S.player.seek(l.s); }
      case 'lyE': { const [i, d] = v.split(':'), l = p.lines[+i], c = MV.capLines(p).find(q => q.i === +i); l.e = +Math.max(l.s + .3, (l.e != null ? l.e : c ? c.e : l.s + 3) + +d).toFixed(2); editRefresh(); return S.player.seek(Math.max(l.s, l.e - 1)); }
      case 'lyEauto': p.lines[+v].e = null; return editRefresh();
      case 'lyOff': if (confirm('이 줄을 자막에서 뺄까요? (4단계에서 다시 맞출 수 있어요)')) { p.lines[+v].s = null; p.lines[+v].e = null; S.sel = null; editRefresh(); } return;
      case 'vol': p.fx.vol = +v; S.player.audio.volume = Math.min(1, p.fx.vol); return editRefresh();
      case 'fadeOut': p.fx.fadeOut = +v; return editRefresh();
      case 'fadeIn': p.fx.fadeIn = +v; return editRefresh();
      case 'intro': p.fx.intro = v === '1'; return editRefresh();
      case 'outro': p.fx.outro = v === '1'; return editRefresh();
      case 'film': p.fx.film = v; return editRefresh();
      case 'trans': p.fx.trans = v; return editRefresh();
      case 'zoomImg': p.fx.zoom = v === '1'; return editRefresh();
      case 'q': S.q = +v; return render();
      case 'export': return doExport();
    }
  }

  document.addEventListener('click', e => {
    const tl = e.target.closest('#tlIn');
    if (tl && S.p) {
      const r = tl.getBoundingClientRect(), t = clamp((e.clientX - r.left) / S.zoom, 0, S.p.song.dur), b = e.target.closest('[data-tl]');
      if (b) { const [k, i] = b.dataset.tl.split(':'); S.sel = { k, i: +i }; tlBuild(); $('panel').innerHTML = panel(); }
      S.player.seek(t); return;
    }
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    e.preventDefault(); act(b.dataset.a, b.dataset.v, b).catch(err => toast('⚠️ ' + (err && err.message || err), 4000));
  });
  document.addEventListener('change', e => {
    const p = S.p; if (!p) return; const id = e.target.id, v = e.target.value;
    if (id === 'fTitle') { p.title = v.trim(); $('title').textContent = '🎬 ' + (p.title || 'BK뮤비'); }
    else if (id === 'fLyr') p.lyricsRaw = v;
    else if (id === 'fMood') p.look.mood = v.trim();
    else if (id === 'fHero') p.look.hero = v.trim();
    else if (id === 'fIntro') p.fx.introText = v.trim();
    else if (id === 'fIntroSub') p.fx.introSub = v.trim();
    else if (id === 'fOutro') p.fx.outroText = v.trim();
    else return;
    save(); if (/^fIntro|^fOutro/.test(id)) { tlBuild(); S.player.draw(); }
  });
  document.addEventListener('play', e => { if (e.target.id === 'songAu' && S.player) S.player.pause(); }, true);
  document.addEventListener('toggle', e => { if (e.target.tagName === 'DETAILS' && e.target.open) tapShow(S.player ? S.player.time() : 0); }, true);

  g.addEventListener('DOMContentLoaded', () => {
    $('homeBtn').addEventListener('click', () => home());
    home();
    // 노래 미리 듣기 칸: 열 때 파일 연결
    new MutationObserver(() => { const au = $('songAu'); if (au && !au.src && S.song) { au.src = URL.createObjectURL(S.song); } }).observe($('app'), { childList: true, subtree: true });
  });
  if ('serviceWorker' in navigator) g.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})(window);
