/* mv-ui.js — BK뮤드 화면: 내 뮤비 목록 · 큰 단계 6개 (노래 만들기 → 노래 넣기 → 장면 → 잠금 → 자막 → 최종 편집)
 *  - 지금 단계만 펼쳐 보이고, 다 하면 「✅ 다음 단계로 ▶」
 *  - 바꿀 때마다 휴대폰에 자동 저장 (IndexedDB 'bk-muvi')
 */
(function (g) {
  'use strict';
  const MV = g.MV, esc = MV.esc, fmt = MV.fmt, fmt0 = MV.fmt0, clamp = MV.clamp;
  const $ = id => document.getElementById(id);
  const S = { p: null, song: null, player: null, tapK: 0, sel: null, zoom: 14, q: 720, busy: false };
  const STAGES = [
    { n: 1, e: '🎼', t: '만들기', h: '내 노래 만들기 (수노)' },
    { n: 2, e: '🎵', t: '넣기', h: '노래 · 가사 · 장면 넣기' },
    { n: 3, e: '🎬', t: '맞추기', h: '노래 · 장면 맞추기' },
    { n: 4, e: '✨', t: '효과', h: '효과 넣기' },
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

  /* ═════════ 📲 앱 설치 (크롬이 설치할 수 있다고 알려 줄 때만 버튼이 켜져요) ═════════ */
  let INST = null;
  const standalone = () => { try { return g.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } };
  g.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INST = e; if (!S.p) installBox(); });
  g.addEventListener('appinstalled', () => { INST = null; toast('📲 설치했어요 · 홈 화면의 BK뮤드 아이콘으로 여세요', 4000); installBox(); });
  async function installBox() {
    const el = $('instBox'); if (!el) return;
    if (standalone()) { el.innerHTML = ''; return; }
    let have = false; try { if (navigator.getInstalledRelatedApps) have = (await navigator.getInstalledRelatedApps()).length > 0; } catch (e) { /* 모름 */ }
    if (INST) { el.innerHTML = `<button class="btn ok big" data-a="install">📲 BK뮤드 앱 설치하기</button>`; return; }
    el.innerHTML = `<details class="note"${have ? ' open' : ''}><summary><b>📲 ${have ? '이 휴대폰에 BK뮤드 앱이 이미 있어요' : '설치 버튼이 안 보이나요?'}</b></summary>
      <p style="margin:6px 0">크롬은 앱이 <b>이미 설치돼 있으면</b> 설치 버튼을 보여 주지 않고, 덮어쓰기도 안 돼요. 홈 화면에서 지운 건 <b>아이콘만</b> 지운 거라 앱은 남아 있어요. 아래처럼 앱을 지우면 여기에 <b>📲 설치하기</b> 버튼이 나와요.</p>
      <ol style="padding-left:20px;margin:4px 0">
        <li>홈 화면에서 <b>위로 쓸어 올려 「앱스 화면」(모든 앱)</b>을 여세요 → <b>BK뮤드</b> 아이콘을 길게 누르기 → <b>설치 삭제</b></li>
        <li>안 보이면: <b>설정 → 애플리케이션 → 맨 위 🔍 돋보기</b>에 <b>BK뮤드</b> 입력 → 누르기 → <b>삭제</b></li>
        <li>그래도 없으면: 크롬에서 「클릭하여 앱 열기」로 앱을 연 뒤 <b>최근 앱 버튼(|||)</b> → BK뮤드 화면 위의 <b>작은 아이콘</b> 누르기 → <b>애플리케이션 정보 → 삭제</b></li>
        <li>크롬을 닫았다가 이 주소를 다시 열면 <b>📲 설치하기</b> 버튼이 나와요</li>
      </ol>
      <p class="muted" style="margin:4px 0">✅ 라이선스 · 카드함 · 만든 뮤비는 크롬 안에 있어서 앱을 지워도 그대로예요. ⚠️ 크롬 「쿠키 및 사이트 데이터 삭제」는 하지 마세요.</p></details>`;
  }

  /* ═════════ 고르기 창: 누르면 아래에서 올라와요 (기존 BK 앱처럼) ═════════ */
  function sheet(title, html) {
    let o = $('sheet'); if (!o) { o = document.createElement('div'); o.id = 'sheet'; o.className = 'sheetBg'; o.addEventListener('click', e => { if (e.target === o) sheetClose(); }); document.body.appendChild(o); }
    o.innerHTML = `<div class="sheetBox"><div class="sheetHd"><b>${title}</b><button type="button" class="btn sm ghost" data-a="sheetX">✕ 닫기</button></div><div class="sheetBd">${html}</div></div>`;
    o.classList.remove('hide'); document.body.style.overflow = 'hidden';
  }
  function sheetClose() { const o = $('sheet'); if (o) { o.classList.add('hide'); o.innerHTML = ''; } document.body.style.overflow = ''; }

  /* ═════════ 관리자 확인 ═════════ */
  function isAdmin() { try { return localStorage.getItem('bkAdmin') === '1'; } catch (e) { return false; } }

  /* ═════════ 내 뮤비 목록 ═════════ */
  async function home() {
    if (S.player) { S.player.stop(); }
    MV.dropAll(); S.p = null; setTitle(null); $('homeBtn').classList.add('hide');
    const root = $('app');
    if (!isAdmin()) { root.innerHTML = `<div class="gate"><div class="e">🛠</div><h2>관리자 전용 (준비 중)</h2><p class="muted">BK뮤드는 아직 관리자만 쓸 수 있어요.<br>다른 BK 앱에서 관리자 모드를 켠 휴대폰에서 열어 주세요.</p></div>`; return; }
    const list = await MV.listProjects().catch(() => []), PER = 10, pages = Math.max(1, Math.ceil(list.length / PER));
    S.page = clamp(S.page || 1, 1, pages);
    const cont = list.find(p => !p.exported) || null;   // 가장 최근에 만지던 (아직 저장 안 한) 뮤비
    const stName = p => { const n = clamp(p.step || 1, 1, STAGES.length); return STAGES[n - 1].e + ' ' + STAGES[n - 1].t; };
    const shown = list.slice((S.page - 1) * PER, S.page * PER);
    root.innerHTML = `
      <div class="note blue" style="margin-top:14px">🎬 <b>BK뮤드 — 오늘은 무엇을 만들까요?</b><br>🎵 <b>뮤직비디오</b>: 노래 한 곡 → 뮤직비디오 한 편 · 🎭 <b>드라마</b>: Flow 클립 여러 개 → 드라마 한 편<br><span class="muted">🎵 뮤직비디오 순서:</span> ① 🎼 노래 만들기 → ② 🎵 노래 넣기 → ③ 🎬 노래 · 장면 맞추기 → ④ ✨ 효과 → ⑤ ✂️ 최종 편집 순서로 차례차례 만들어요.</div>
      <div id="instBox"></div>
      <button class="btn main big homeBig" data-a="newP">＋ 새로 만들기<small>🎵 뮤직비디오 · 🎭 드라마 중에서 골라요</small></button>
      ${cont ? `<button class="btn pink big homeBig" data-a="openP" data-v="${cont.id}">▶ 이어 만들기<small>「${esc(cont.title || '제목 없음')}」 · ${stName(cont)} 단계부터</small></button>` : ''}
      ${list.length ? `<h3 style="margin:18px 0 0">📂 내 작품 <span class="muted">${list.length}개</span></h3>` : ''}
      <div class="plist">${list.length ? shown.map(p => `
        <div class="pitem"><div style="font-size:1.6rem">${p.kind === 'drama' ? '🎭' : '🎵'}${p.exported ? '<small>✅</small>' : ''}</div>
          <div class="bd"><b>${esc(p.title || '(제목 없음)')}</b><span class="muted">${p.song ? fmt0(p.song.dur) + ' · ' : ''}장면 ${(p.scenes || []).filter(s => s.file).length}/${(p.scenes || []).length} · ${p.exported ? '완성' : stName(p) + ' 단계'} · ${new Date(p.at).toLocaleDateString('ko-KR')}</span></div>
          <button class="btn sm main" data-a="openP" data-v="${p.id}">열기</button>
          <button class="btn sm ghost" data-a="delP" data-v="${p.id}">🗑</button></div>`).join('') : '<p class="muted" style="text-align:center">아직 만든 작품이 없어요.</p>'}</div>
      ${pages > 1 ? `<div class="pager">${S.page > 1 ? `<button data-a="page" data-v="${S.page - 1}">◀</button>` : ''}${Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === S.page ? 'on' : ''}" data-a="page" data-v="${i + 1}">${i + 1}</button>`).join('')}${S.page < pages ? `<button data-a="page" data-v="${S.page + 1}">▶</button>` : ''}</div>` : ''}`;
    installBox();
  }

  async function openP(id) {
    const p = await MV.getProject(id); if (!p) return toast('작품을 찾을 수 없어요');
    if (!p.v) { p.step = (p.step || 1) + 1; p.v = 2; }
    if (p.v === 2) { if (p.step >= 6) p.step++; p.v = 3; }
    if (p.v === 3) { p.step = ({ 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 5 })[p.step] || 1; p.v = 4; MV.putProject(p); }
    MV.fixFx(p);
    MV.TL.reset(); S.p = p; S.sel = null; S.tapK = Math.max(0, (p.lines || []).findIndex(l => l.s == null)); if (S.tapK < 0) S.tapK = (p.lines || []).length;
    S.song = p.song ? await MV.getFile(p.song.file) : null;
    $('homeBtn').classList.remove('hide');
    buildEditor();
  }

  /* ═════════ 작품 화면: 큰 단계 카드 (BK에딧 첫 화면 모양) → 누르면 그 단계 화면 ═════════ */
  function buildEditor() {
    const root = $('app');
    root.innerHTML = `<div id="hub"></div><div id="stage" class="hide"></div>`;
    if (!S.pv) {
      S.pv = document.createElement('div');
      S.pv.innerHTML = `<div class="pv" id="pvWrap"><canvas id="pvCv"></canvas></div>
        <div class="tp"><button class="btn sm main" data-a="pp" id="ppBtn">▶</button><input type="range" id="pvSeek" min="0" max="1000" value="0"><span class="tm" id="pvTm">0:00</span></div>`;
      S.player = new MV.Player(S.pv.querySelector('#pvCv'), { onTime: onTime });
      S.pv.querySelector('#pvSeek').addEventListener('input', e => { if (!S.p || !S.p.song) return; S.player.seek(e.target.value / 1000 * S.p.song.dur); });
    }
    S.player.audio.volume = Math.min(1, S.p.fx.vol || 1);
    if (S.p.song && S.song) S.player.setProject(S.p, S.song);
    S.view = 'hub'; S.subs = {};
    render();
  }
  function onTime(t) {
    if (!S.pv) return; const d = (S.p && S.p.song && S.p.song.dur) || 1;
    const sk = S.pv.querySelector('#pvSeek'); if (sk && document.activeElement !== sk) sk.value = Math.round(t / d * 1000);
    S.pv.querySelector('#pvTm').textContent = fmt0(t) + ' / ' + fmt0(d);
    S.pv.querySelector('#ppBtn').textContent = S.player.playing() ? '⏸' : '▶';
    if (S.view !== 'stage') return;
    if (S.p.step === 3) tapShow(t);
    MV.TL.onTime(t);
    if (S.p.step === 5) tlHead(t);
    if (S.p.step === 4 && $('fxNow')) $('fxNow').textContent = fmt(t);
  }

  function done(n) {
    if (g.BKDRAMA && S.p && S.p.kind === 'drama') { const r = g.BKDRAMA.done(S.p, n); if (r !== undefined) return r; }
    const p = S.p, sc = p.scenes || [];
    if (n === 1) return !!(p.song || (p.mk && p.mk.out && p.mk.out.lyrics));
    if (n === 2) return !!(p.song && (p.lines || []).length);
    if (n === 3) return !!p.locked || (p.scenes.length > 0 && p.scenes.every(x => x.pin));
    if (n === 4) return !!p.fxSeen;
    if (n === 5) return !!p.exported;
  }
  function status(n) {
    if (g.BKDRAMA && S.p && S.p.kind === 'drama') { const r = g.BKDRAMA.status(S.p, n); if (r !== undefined) return r; }
    const p = S.p, sc = p.scenes || [], L = p.lines || [];
    if (n === 1) return p.mk && p.mk.out && p.mk.out.title ? '🎵 ' + p.mk.out.title : (p.song ? '건너뜀' : '');
    if (n === 2) return p.song ? `${fmt0(p.song.dur)} · 가사 ${L.length}줄` : '';
    if (n === 3) return sc.length ? `장면 ${sc.filter(s => s.file).length}/${sc.length} · 자막 ${L.filter(l => l.s != null).length}/${L.length}${p.locked ? ' · 🔒' : ''}` : '';
    if (n === 4) { const k = (p.efx || []).length + (p.stk || []).length + (p.sfx || []).length; return p.fxSeen || k ? `효과 ${k}개` : ''; }
    if (n === 5) return p.exported ? 'MP4 저장함' : '';
  }
  const DESC = { 1: '장르 · 주제 · 이야기 → AI 가사 · 스타일 → 수노에서 노래 만들기', 2: '노래(MP3) · 가사 · 화면 모양 · 장면 그림 1~N 넣기', 3: '① 자막(가사 톡톡) · ② 화면(장면 길이 · 순서) · ③ 잠금(장면마다 확인하고 고정)', 4: '장면 전환 · 색감 · 화면 효과 · 스티커 · 효과음 · 제목', 5: '화면 · 음악 · 자막 · 효과 줄로 다듬고 MP4 저장' };
  function nextTodo() { for (const s of STAGES) if (!done(s.n)) return s.n; return STAGES.length; }
  function renderHub() {
    if (g.BKDRAMA) g.BKDRAMA.labels(STAGES, DESC, S.p);
    const p = S.p, nx = nextTodo(), nd = STAGES.filter(s => done(s.n)).length;
    $('hub').innerHTML = `
      <div class="hubTop"><input type="text" id="fTitle2" value="${esc(p.title)}" placeholder="🏷 뮤비 제목"><div class="prog"><i style="width:${Math.round(nd / STAGES.length * 100)}%"></i></div><span class="muted">${STAGES.length}단계 중 ${nd}단계 끝 · 위에서부터 차례로 해요</span></div>
      <div class="modes">${STAGES.map(s => `
        <button type="button" class="mode g${s.n}${s.n === nx ? ' todo' : ''}" data-a="open" data-v="${s.n}">
          <span class="ic">${done(s.n) ? '✅' : s.e}</span><b>${s.n}. ${s.h}</b>
          <small>${status(s.n) ? '<span class="stt">' + esc(status(s.n)) + '</span> · ' : ''}${DESC[s.n]}</small>
          ${s.n === nx ? '<i class="todoTag">👉 지금 할 차례</i>' : ''}</button>`).join('')}</div>`;
  }
  /* ═════════ 🖥 PC 넓은 화면 (1024px 이상이면 저절로) ═════════ */
  const isPC = () => g.matchMedia && g.matchMedia('(min-width: 1024px)').matches;
  function pcMark() { document.body.classList.toggle('pc', isPC()); }
  pcMark(); let pcWas = isPC();
  g.addEventListener('resize', () => { pcMark(); if (isPC() !== pcWas) { pcWas = isPC(); if (S.p && S.view !== 'hub' && $('stage') && $('stage').innerHTML) renderStage(); } });
  function pcSide(n) {
    return `<aside id="pcSide"><div id="pcPv">${S.p.song ? '' : `<div class="pcNoPv">${S.p.kind === 'drama' ? '🎞 클립을 넣으면' : '🎵 노래를 넣으면'} 여기에 미리 보기가 나와요</div>`}</div>
      <div class="pcSteps">${STAGES.map(s => `<button type="button" class="${s.n === n ? 'on' : ''}" data-a="open" data-v="${s.n}">${done(s.n) ? '✅' : s.e} ${s.n}. ${s.t}</button>`).join('')}</div>
      <p class="muted pcKeys">⌨️ 스페이스 = 재생/멈춤 · ← → = 0.1초 (Shift = 1초) · Ctrl+Z = 되돌리기</p></aside>`;
  }
  g.addEventListener('keydown', e => {
    if (!isPC() || !S.p || !S.player || S.view === 'hub') return; const t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.code === 'Space') { e.preventDefault(); return S.player.toggle(); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const d = (e.shiftKey ? 1 : .1) * (e.key === 'ArrowLeft' ? -1 : 1), T = S.player.total ? S.player.total() : (S.p.song ? S.p.song.dur : 0); return S.player.seek(clamp(S.player.time() + d, 0, T)); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && (S.p.step === 3 || S.p.step === 5)) { e.preventDefault(); return MV.TL.act(e.shiftKey ? 'tlRedo' : 'tlUndo'); }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y') && (S.p.step === 3 || S.p.step === 5)) { e.preventDefault(); return MV.TL.act('tlRedo'); }
  });
  function renderStage() {
    if (g.BKDRAMA) g.BKDRAMA.labels(STAGES, DESC, S.p);
    const p = S.p, n = p.step, st = STAGES[n - 1], el = $('stage');
    const keep = {}; el.querySelectorAll('details').forEach(d => { const k = (d.querySelector('summary') || {}).textContent; if (k) keep[k.replace(/\d+/g, '#')] = d.open; });
    el.innerHTML = `<div class="stHead"><button class="btn sm ghost" data-a="hub">◀ 전체 단계</button><div class="stT"><span>${n} / ${STAGES.length}</span><b>${st.e} ${st.h}</b></div></div>${isPC() ? '<div class="pcGrid"><div class="pcMain">' : ''}<div class="stBody">${(g.BKDRAMA && g.BKDRAMA.body(S.p, n)) || BODY[n]()}</div>
      <div class="stNav">${n > 1 ? `<button class="btn ghost" data-a="open" data-v="${n - 1}">◀ ${STAGES[n - 2].e} ${STAGES[n - 2].t}</button>` : '<span></span>'}${n < STAGES.length ? `<button class="btn main" data-a="open" data-v="${n + 1}" data-next="1">다음: ${STAGES[n].e} ${STAGES[n].t} ▶</button>` : `<button class="btn main" data-a="hub">✅ 전체 단계로</button>`}</div>`;
    /* 작은 단계(소단계): data-sub 묶음이 2개 이상이면 위에 번호 버튼 · 하나씩 보여 주기 */
    const subs = [...el.querySelectorAll('.stBody [data-sub]')];
    if (subs.length > 1) {
      let k = clamp(S.subs[n] || 0, 0, subs.length - 1); S.subs[n] = k;
      const bar = document.createElement('div'); bar.className = 'subbar';
      bar.innerHTML = subs.map((d, i) => `<button type="button" class="${i === k ? 'on' : ''}" data-a="sub" data-v="${i}">${esc(d.dataset.sub)}</button>`).join('');
      subs[0].parentNode.insertBefore(bar, subs[0]);
      subs.forEach((d, i) => { d.classList.toggle('hide', i !== k); if (i < subs.length - 1) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn big subnext'; b.dataset.a = 'sub'; b.dataset.v = i + 1; b.textContent = `다음: ${subs[i + 1].dataset.sub} ▶`; d.appendChild(b); } });
    }
    el.querySelectorAll('details').forEach(d => { const k = ((d.querySelector('summary') || {}).textContent || '').replace(/\d+/g, '#'); if (k in keep) d.open = keep[k]; });
    if (isPC()) { const gd = el.querySelector('.pcGrid'), mn = el.querySelector('.pcMain'), nav = el.querySelector('.stNav'); if (gd && mn) { if (nav) mn.appendChild(nav); gd.insertAdjacentHTML('beforeend', pcSide(n)); } }
    const slot = isPC() ? (p.song ? $('pcPv') : null) : el.querySelector('[data-pv]');
    if (slot && p.song) { slot.appendChild(S.pv); S.pv.querySelector('#pvWrap').classList.toggle('v916', p.ratio === '9:16'); S.player.refresh(); S.player.draw(); onTime(S.player.time()); }
    else if (S.player) { S.player.pause(); if (S.pv.parentNode) S.pv.remove(); }
    MV.TL.afterRender();
    if (n === 5) showLast();
    if (n === 3) tapShow(S.player ? S.player.time() : 0);
  }
  /* 상단 바: 🎬 + 🎵 뮤직비디오 / 🎭 드라마 표시 + 제목 */
  function setTitle(p) { const d = p && p.kind === 'drama'; $('title').innerHTML = p ? `🎬 <span class="kTag ${d ? 'dr' : 'mv'}">${d ? '🎭 드라마' : '🎵 뮤직비디오'}</span> <span class="tName">${esc(p.title || '제목 없음')}</span>` : '🎬 BK뮤드'; }
  function render() {
    const p = S.p; if (!p) return;
    setTitle(p);
    const hub = S.view !== 'stage';
    $('hub').classList.toggle('hide', !hub); $('stage').classList.toggle('hide', hub);
    if (hub) { if (S.player) S.player.pause(); if (S.pv && S.pv.parentNode) S.pv.remove(); renderHub(); } else renderStage();
  }
  function go(n) {
    const p = S.p; n = +n;
    if (p.kind === 'drama') { if (n > 2 && !(p.scenes || []).length) { toast('🎞 먼저 ② 클립 넣기에서 클립을 넣어 주세요', 3000); n = 2; } }
    else { if (n > 2 && !p.song) { toast('🎵 먼저 노래를 넣어 주세요'); n = 2; }
      if (n === 3 && !p.scenes.length) p.scenes = MV.planScenes(p); }
    const was = S.view; p.step = n; S.view = 'stage'; save(); render();
    if (was !== 'stage') { try { history.pushState({ mv: 1 }, ''); } catch (e) { /* 괜찮음 */ } }
    g.scrollTo(0, 0);
  }
  function toHub() { S.view = 'hub'; render(); g.scrollTo(0, 0); }
  g.addEventListener('popstate', () => { if (S.p && S.view === 'stage') toHub(); });
  const nextBtn = () => '';

  /* ═════════ 1. 노래 ═════════ */
  const BODY = {};
  BODY[1] = () => MV.SONG ? MV.SONG.body() : '<p class="muted">불러오는 중…</p>';
  BODY[2] = function () {
    const p = S.p, L = p.lines || [], timed = L.filter(l => l.s != null).length;
    if (p.song && !(p.scenes || []).length) { p.scenes = MV.planScenes(p); save(); }
    return `
      <div class="field"><label>🏷 뮤비 제목 (노래 제목)</label><input type="text" id="fTitle" value="${esc(p.title)}" placeholder="예: 봄날의 약속"></div>
      <div class="sub" data-sub="① 노래"><h3>🎵 노래 넣기</h3>
        ${p.song ? `<div class="song"><div class="ic">🎧</div><div style="flex:1;min-width:0"><b>${esc(p.song.name)}</b><div class="muted">길이 ${fmt0(p.song.dur)}</div><audio controls preload="none" id="songAu"></audio></div></div>` : '<p class="muted">아직 노래가 없어요.</p>'}
        <div class="row" style="margin-top:8px"><button class="btn main" data-a="pickSong">📂 내 MP3 고르기</button><button class="btn" data-a="musicBox">🎼 BK뮤직 노래함에서</button></div>
        <div id="boxList"></div>
        <p class="muted">✍️ 새 노래를 만들려면 <a href="${MUSIC_URL}" target="_blank" rel="noopener">BK뮤직</a>에서 만들어 「💾 내 노래함」에 노래 파일까지 저장한 뒤, 여기서 「🎼 BK뮤직 노래함에서」를 누르세요.</p>
        <div class="note">⚠️ 다른 가수의 노래는 <b>내가 가진 MP3</b>만 쓸 수 있어요. 유튜브에 올리면 저작권 신고가 들어올 수 있어요.</div>
      </div>
      <div class="sub" data-sub="② 가사"><h3>📝 가사</h3>
        <div class="field"><textarea id="fLyr" placeholder="가사를 붙여 넣으세요 (한 줄씩)&#10;[00:15] 처럼 시간이 붙어 있으면 자막 시간도 같이 들어가요">${esc(p.lyricsRaw)}</textarea></div>
        <div class="row"><button class="btn main" data-a="lyrApply">✅ 가사 넣기</button><button class="btn" data-a="lyrAI">🤖 MP3로 가사 · 시간 받기 (Gemini)</button></div>
        <div class="row"><button class="btn sm ghost" data-a="lyrClear">🧹 가사 칸 비우기</button></div>
        <p class="muted">${L.length ? `가사 ${L.length}줄 들어 있어요${timed ? ` · 시간 맞춘 줄 ${timed}줄` : ''}` : '가사를 넣으면 장면마다 그 시간의 가사가 보여요.'}<br>🤖 버튼: 요청 글이 복사되고 Gemini가 열려요 → ＋로 MP3 올리기 → 붙여넣기 → 보내기 → 받은 답을 위 칸에 붙여넣고 「✅ 가사 넣기」</p>
      </div>
      <div class="sub" data-sub="③ 장면"><div class="pvStick" data-pv></div><h3>📐 화면 모양</h3>
        <div class="cards"><button class="card${p.ratio === '16:9' ? ' on' : ''}" data-a="ratio" data-v="16:9"><span class="e">🖥</span>가로 16:9<small>유튜브 뮤직비디오</small></button><button class="card${p.ratio === '9:16' ? ' on' : ''}" data-a="ratio" data-v="9:16"><span class="e">📱</span>세로 9:16<small>쇼츠 · 릴스</small></button></div>
      ${p.song ? scnPart(p) : '<p class="muted">노래를 넣으면 필요한 장면 수가 나와요.</p>'}</div>
      ${nextBtn(2, '✅ 다음 단계로 ▶ 장면 만들기')}`;
  };
  async function setSong(blob, name, lyrics, title) {
    const p = S.p, dur = await MV.mediaDur(blob);
    if (!dur) return toast('⚠️ 노래 파일을 읽을 수 없어요 (MP3 · M4A · WAV)', 4000);
    const id = await MV.putFile(blob, name);
    if (p.song && p.song.file) MV.delFile(p.song.file);
    const changed = !p.song || Math.abs(p.song.dur - dur) > .5;
    p.song = { file: id, name, dur, full: dur }; S.song = blob; MV.TL.reset();
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
    const p = S.p, own = MV.parseLyrics(p.lyricsRaw || '').lines.map(l => l.t).join('\n').trim();
    return `[BK뮤드 · 노래 「${p.title || '제목 없음'}」 가사 받기]\n(이 메시지와 함께 노래 MP3 파일 하나를 첨부했어요)\n` +
      '첨부한 노래(MP3)를 듣고 가사를 들리는 대로 받아 적어 주세요.\n- 한 줄씩 나눠서, 줄마다 맨 앞에 그 줄을 부르기 시작하는 시간을 [분:초] 형식으로 붙여 주세요. 예: [00:15] 첫 줄 가사\n- 반주만 나오는 부분(간주)은 쓰지 마세요.\n- 한 줄은 화면 자막에 맞게 15자 안팎으로 짧게 나눠 주세요.\n- 인사말이나 설명 없이 시간과 가사만 써 주세요.' +
      (own ? '\n\n아래는 원래 가사예요. 이 글자 그대로 쓰고 시간만 맞춰 주세요:\n' + own : '');
  }
  function lyrAISheet() {
    const t = lyrAIText();
    sheet('🤖 MP3로 가사 · 시간 받기', `<ol class="steps1">
        <li>Gemini에서 <b>✏️ 새 채팅</b>을 누르고, 입력칸에 <b>예전 글이 남아 있으면 길게 눌러 전부 지우기 🧹</b></li>
        <li><b>＋ → 「${esc(S.p.title || '이 노래')}」 MP3 하나만</b> 올리기</li>
        <li>아래 <b>📋 복사 + Gemini 열기</b> → 입력칸에 <b>붙여넣기 → 보내기</b></li>
        <li>받은 답을 <b>통째로 복사</b> → BK뮤드 가사 칸에 붙여넣기 → <b>✅ 가사 넣기</b></li></ol>
      <div class="field"><label>📋 복사되는 요청 글 <span class="muted">(맨 위에 노래 제목이 있어요)</span></label><textarea readonly style="min-height:150px;font-size:.82rem">${esc(t)}</textarea></div>
      <button class="btn main big" data-a="lyrAIgo">📋 복사 + Gemini 열기</button>
      <p class="muted">${S.p.lyricsRaw && S.p.lyricsRaw.trim() ? '가사 칸에 있는 가사도 함께 보내서 시간만 맞춰 달라고 해요.' : '가사 칸이 비어 있어서 <b>MP3만 듣고 가사를 뽑아 달라고</b> 해요.'}</p>`);
  }
  async function showMusicBox() {
    const el = $('boxList'); el.innerHTML = '<p class="muted">불러오는 중…</p>';
    const a = await MV.musicBox();
    if (!a.length) { el.innerHTML = `<div class="note">BK뮤직 「내 노래함」에 노래 파일이 없어요. <a href="${MUSIC_URL}" target="_blank" rel="noopener">BK뮤직</a>에서 노래 파일을 노래함에 저장해 주세요.</div>`; return; }
    S.box = a;
    el.innerHTML = `<div class="boxlist">${a.map((o, i) => `<button data-a="boxPick" data-v="${i}">🎵 <b>${esc(o.title || o.name)}</b> <span class="muted">${o.dur ? fmt0(o.dur) : ''}${o.lyrics ? ' · 가사 있음' : ''}</span></button>`).join('')}</div>`;
  }

  /* ═════════ 2. 장면 ═════════ */
  const KR = p => !(p.look && p.look.kr === false);
  const KR_LINE = '등장인물은 모두 한국 사람, 배경은 한국 (한국 거리 · 한국 집 · 한국 자연, 간판과 글씨는 한글).';
  const GPT_URL = 'https://chatgpt.com/', GEM_URL = 'https://gemini.google.com/app';
  const ratioKo = p => p.ratio === '9:16' ? '세로 9:16' : '가로 16:9';
  function sceneText(i) {
    const p = S.p, sc = p.scenes[i], ly = MV.sceneLines(p, sc), lk = p.look || {}, vid = p.mode !== 'image';
    const what = sc.prompt || (ly.length ? `가사 「${ly.join(' / ')}」의 감정을 담은 장면` : (i === 0 ? '노래가 시작되는 첫 장면, 분위기를 보여 주는 풍경' : '가사 없이 반주만 나오는 부분, 분위기를 이어 주는 장면'));
    return [`[장면 ${i + 1} / ${p.scenes.length} · ${p.title || 'BK뮤드'}]`, KR(p) ? KR_LINE : '', `${lk.style || '실사 시네마틱'} 스타일, ${ratioKo(p)} 화면.`,
      lk.mood ? `전체 분위기: ${lk.mood}.` : '', (!vid && lk.heroImg) ? '' : (lk.hero ? `주인공: ${lk.hero}.` : ''), !vid ? '주인공이 나오는 장면이면 이 대화방의 주인공(사진 속 사람)과 같은 얼굴 · 머리 · 옷으로 그려 주세요. 나이 · 성별 · 얼굴을 바꾸지 마세요.' : (lk.hero ? '모든 장면에서 같은 얼굴 · 같은 옷.' : ''),
      `장면: ${what}`,
      vid ? `${Math.round(sc.e - sc.s)}초 길이, 카메라가 천천히 움직이는 영화 같은 장면.` : `고화질 그림 한 장 (${ratioKo(p)}).`,
      '화면에 글자 · 자막 · 로고를 넣지 마세요.' + (vid ? ' 대사나 말소리 없이.' : '')].filter(Boolean).join('\n');
  }
  /* ChatGPT 「그림 방」 시작 글 — 주인공 새로 만들기 */
  function lyricsPlain(max) { const t = MV.parseLyrics(S.p.lyricsRaw || '').lines.map(l => l.t).join('\n').trim() || (S.p.lines || []).map(l => l.t).join('\n'); return t.length > max ? t.slice(0, max) + '\n…' : t; }
  function heroText() {
    const p = S.p, lk = p.look || {}, ly = lyricsPlain(1500);
    return [`[BK뮤드 「${p.title || '뮤직비디오'}」 그림 방]`, '이 대화방에서 뮤직비디오 그림을 차례로 만들 거예요. 먼저 이 노래의 주인공을 정하고 그려 주세요.',
      ly ? `\n[가사]\n${ly}\n` : '', `노래 분위기: ${lk.mood || '가사에 어울리게'} · 그림 느낌: ${lk.style || '실사 시네마틱'} · 화면: ${ratioKo(p)}`, KR(p) ? '등장인물은 한국 사람, 배경은 한국.' : '',
      lk.hero ? `주인공 조건 (꼭 지켜 주세요): ${lk.hero}` : '',
      '\n해 주실 일:', '① 가사를 읽고 노래에 어울리는 주인공을 한국어 한 줄로 정해 주세요 (나이대 · 성별 · 얼굴 느낌 · 머리 · 옷). 「주인공: …」 모양으로 한 줄만.',
      '② 그 주인공을 그림 한 장으로 그려 주세요 (얼굴과 옷이 잘 보이는 상반신, 자연스러운 표정, 글자 · 로고 없이).',
      '③ 앞으로 이 대화방에 보내는 장면 글마다, 주인공이 나오면 이 주인공과 같은 얼굴 · 머리 · 옷으로 그림을 한 장씩 그려 주세요.'].filter(Boolean).join('\n');
  }
  function heroDescText() { return '이 사진 속 사람을 뮤직비디오 주인공으로 쓸 거예요. 나이대 · 성별 · 얼굴 느낌 · 머리 · 옷을 한국어 한 줄로만 써 주세요. 예: 40대 한국 여성, 어깨 길이 웨이브 머리, 남색 정장과 스카프'; }
  /* ChatGPT 「그림 방」 시작 글 — 내 사진을 주인공으로 */
  function heroShareText() {
    const p = S.p, lk = p.look || {};
    return [`[BK뮤드 「${p.title || '뮤직비디오'}」 그림 방]`, '첨부한 사진 속 사람이 뮤직비디오 주인공이에요.', '얼굴 · 머리 · 옷을 그대로 유지해서, 제가 이 대화방에 보내는 장면 글마다 그림을 한 장씩 그려 주세요.',
      `${lk.style || '실사 시네마틱'} 스타일, ${ratioKo(p)}.`, KR(p) ? '등장인물은 한국 사람, 배경은 한국.' : '', '글자 · 로고는 넣지 않기.', '지금은 「알겠어요」라고만 대답하고, 장면 글을 받으면 그려 주세요.'].filter(Boolean).join('\n');
  }
  function planAIText() {
    const p = S.p, lk = p.look || {}, vid = p.mode !== 'image', N = p.scenes.length;
    return `[BK뮤드 「${p.title || '제목 없음'}」 장면 기획 요청]\n노래 길이 ${fmt0(p.song.dur)}로 뮤직비디오를 만들어요. ${vid ? `구글 Flow로 ${p.clipLen}초짜리 영상 ${N}개` : `ChatGPT로 그림 ${N}장`}을 만들 거예요. 당신은 기획만 해 주세요 (그림은 그리지 마세요).\n` +
      `그림 느낌: ${lk.style || '실사 시네마틱'} · 화면: ${ratioKo(p)}${lk.mood ? `\n전체 분위기: ${lk.mood}` : ''}` + (lk.heroImg ? `\n주인공: 첨부한 사진 속 사람이에요${lk.hero ? ` (${lk.hero})` : ''}. 장면 설명에 나이 · 성별 · 얼굴 · 머리 · 옷을 새로 정하지 말고 그냥 「주인공」이라고만 써 주세요.` : (lk.hero ? `\n주인공: ${lk.hero}` : '')) + `\n\n` +
      `아래에 장면마다 그 시간에 나오는 가사를 적었어요. 노래 전체가 하나의 이야기처럼 이어지게, 장면마다 ${vid ? 'Flow에 넣을 영상' : 'ChatGPT에 넣을 그림'} 설명을 한국어 한두 문장으로 써 주세요.\n` +
      (KR(p) ? '- 모든 장면은 한국 사람 · 한국 배경으로 (한국 거리 · 집 · 자연, 간판은 한글)\n' : '') +
      `- 노래 구조(전주 · 1절 · 후렴 · 2절 · 브리지 · 후주)와 가사 흐름에 맞춰 장면을 나눠 주세요\n- 가사의 감정과 맞게 (밝은 부분은 밝게, 슬픈 부분은 차분하게)\n- 같은 주인공 · 같은 옷 · 같은 장소 느낌이 이어지게\n- 주인공이 안 나오는 장면(풍경 · 물건 · 손 · 뒷모습 · 거리)도 3~4장면에 1번꼴로 섞어 주세요\n` + (vid ? '' : `- 후렴이 반복되는 곳은 앞의 후렴 그림을 다시 써도 돼요. 그럴 땐 설명 대신 「장면 6 다시 쓰기」처럼 한 줄만 써 주세요 (새로 그릴 그림 수를 줄여요)\n`) + `${vid ? '- 카메라 움직임도 넣기 (천천히 다가가기, 옆으로 흐르기 등)\n' : ''}- 화면에 글자 · 자막 · 로고는 넣지 않기\n` +
      `- 인사말 없이, 장면마다 아래 모양으로만 써 주세요 (장면 하나씩 복사하기 좋게):\n### 장면 1\n(설명)\n### 장면 2\n(설명)\n\n` +
      p.scenes.map((sc, i) => { const ly = MV.sceneLines(p, sc); return `장면 ${i + 1} (${fmt0(sc.s)}~${fmt0(sc.e)}) 가사: ${ly.length ? ly.join(' / ') : (i === 0 ? '(전주)' : '(반주만)')}`; }).join('\n');
  }
  function parsePlan(t) {
    let n = 0, want = -1; const S2 = S.p.scenes;
    String(t || '').replace(/\r/g, '').split('\n').forEach(l => {
      const x = l.replace(/\*\*|__|`/g, '').trim(); if (!x) return;
      const rr = x.match(/^[-#•\s]*(?:S|장면|scene|씬)\s*(\d{1,3})\b.*?(?:=|→|:)\s*(?:S|장면)\s*(\d{1,3})\s*(?:번)?\s*(?:그림)?\s*(?:다시|재사용|반복|같은)/i);
      if (rr && x.length <= 40 && S2[+rr[1] - 1] && S2[+rr[2] - 1] && +rr[1] !== +rr[2]) { const sc = S2[+rr[1] - 1]; sc.reuse = +rr[2] - 1; sc.prompt = `♻ 장면 ${rr[2]} 그림 다시 쓰기`; n++; want = -1; return; }
      const m = x.match(/^[-#•]*\s*(?:S|장면|scene|씬)\s*(\d{1,3})\s*(?:\([^)]*\))?\s*(?:[.:)\]：\-—]\s*(.*))?$/i) || x.match(/^(\d{1,3})\s*[.)]\s*(.+)$/);
      if (m && S2[+m[1] - 1]) { const r = (m[2] || '').replace(/^가사\s*[:：].*$/, '').trim(); if (r.length > 3) { S2[+m[1] - 1].prompt = r; S2[+m[1] - 1].prompt0 = r; S2[+m[1] - 1].reuse = null; n++; want = -1; } else want = +m[1] - 1; return; }
      if (want >= 0 && x.length > 3 && !/^가사\s*[:：]/.test(x)) { const rm = x.length <= 30 && x.match(/^[♻\s(]*(?:장면|S)\s*(\d{1,3})\s*(?:번)?\s*(?:그림)?\s*(?:을|를)?\s*(?:다시\s*(?:쓰기|사용)|재사용|반복\s*사용|그대로\s*쓰기)[.)\s]*$/); if (rm && S2[+rm[1] - 1] && +rm[1] - 1 !== want) { S2[want].reuse = +rm[1] - 1; S2[want].prompt = `♻ 장면 ${rm[1]} 그림 다시 쓰기`; } else { S2[want].prompt = x.replace(/^(설명|장면)\s*[:：]\s*/, ''); S2[want].prompt0 = S2[want].prompt; S2[want].reuse = null; } n++; want = -1; }
    });
    applyReuse();
    return n;
  }

  /* ═════════ 3. 🎬 노래 · 장면 맞추기 = ① 채우기(한 번에) · ② 장면 · ③ 음악(자막) · ④ 잠금 ═════════ */
  function heroBox(p) {
    const lk = p.look || {}, vid = p.mode !== 'image', tab = lk.heroTab || (lk.heroImg ? 'photo' : 'make');
    const img = `<div class="hL">${lk.heroThumb ? `<img src="${lk.heroThumb}" alt="">` : '<div class="heroNo">🧑<small>주인공 없음</small></div>'}${lk.heroLock ? '<span class="cpd ok">🔒 고정됨</span>' : ''}</div>`;
    const lockRow = lk.heroThumb ? `<div class="row">${lk.heroLock ? '<button class="btn sm ghost" data-a="heroLock" data-v="0">🔓 풀기</button>' : '<button class="btn sm ok" data-a="heroLock" data-v="1">🔒 이 사진으로 고정</button>'}<button class="btn sm ghost" data-a="heroSave">⬇ 저장</button></div>` : '';
    const desc = `<div class="field" style="margin:8px 0 0"><label>✏️ 주인공 설명 한 줄 <span class="muted">${tab === 'photo' ? '(사진과 같게)' : '(비워 두면 ChatGPT가 가사 보고 정해요)'}</span></label><input type="text" id="fHero" value="${esc(lk.hero)}" placeholder="예: 40대 한국 여성, 어깨 길이 웨이브 머리, 남색 정장"></div>`;
    return `<div class="chips" style="margin-bottom:8px">${chip('heroTab', 'make', tab === 'make', '🎨 새로 만들기 (ChatGPT)')}${chip('heroTab', 'photo', tab === 'photo', '📂 내 사진 쓰기')}</div>` + (tab === 'make' ? `
      <div class="heroBox2">${img}<div class="hR">
        <button class="btn main" data-a="heroCopy">📋 가사 넣어서 ChatGPT로 주인공 만들기</button>
        <ol class="steps1"><li>ChatGPT <b>새 방</b>에 붙여넣기 → 보내기 (마음에 들 때까지 「다시」)</li><li>ChatGPT가 준 <b>「주인공: …」 한 줄</b>을 아래 칸에 붙여넣기</li><li>그림 ⬇ 내려받기 → 아래 버튼으로 등록 → 🔒 고정</li><li>그 ChatGPT 방은 닫지 마세요 — <b>그 방이 그림 방</b>이에요</li></ol>
        <button type="button" class="pickBig" data-a="heroPut">📂 만든 주인공 그림 고르기</button>${lockRow}</div></div>${desc}`
      : `
      <div class="heroBox2">${img}<div class="hR">
        <button type="button" class="pickBig" data-a="heroPut">📂 여기를 눌러<br><b>내 사진에서 주인공 고르기</b></button>
        <div class="row"><button class="btn sm" data-a="heroLib">🗂 보관함</button><button class="btn sm" data-a="heroScene">🖼 장면 그림</button></div>${lockRow}
        ${lk.heroThumb ? `<button class="btn sm" data-a="heroDesc">📤 Gemini에 사진 보내서 설명 받기</button>${vid ? '' : '<button class="btn sm pink" data-a="heroShare">📤 ChatGPT에 주인공 보내기 (그림 방 시작)</button>'}` : ''}
      </div></div>${desc}`) +
      `<p class="muted" style="margin:6px 0 0">${vid ? 'Flow에서 이 사진을 <b>재료(참고 이미지)</b>로 넣으면 같은 사람이 나와요.' : 'ChatGPT <b>한 대화방(그림 방)</b>에서 주인공 → 장면 1 → 2 … 차례로 만들면 얼굴이 덜 틀어져요.'}</p>`;
  }
  function scnPart(p) {
    const sc = p.scenes, lk = p.look || (p.look = {}), L = !!p.locked, filled = sc.filter(s => s.file).length, vid = p.mode !== 'image', dis = L ? ' disabled' : '', k = Math.min((p.cpNext || 0) + 1, sc.length), np = sc.filter(s => s.prompt).length;
    return `<div class="note blue">🎵 ${fmt0(p.song.dur)} 노래 → <b>${vid ? `영상 ${sc.length}개` : `그림 ${sc.length}장`}</b>${vid ? ` (한 영상 ${p.clipLen}초)` : ''}</div>
      <details class="grp" open><summary>🧑 ① 주인공 ${lk.heroLock ? '<span class="cpd ok">🔒</span>' : ''}</summary>${heroBox(p)}</details>
      <details class="grp" open><summary>🛠 ② 만드는 방법 · 분위기</summary>
        <div class="chips">${chip('mode', 'image', !vid, '🖼 그림 · 사진 (기본 · ChatGPT)')}${chip('mode', 'video', vid, '🎬 영상 (Flow)')}</div>
        ${vid ? `<div class="field"><label>⏱ 영상 길이</label><div class="chips">${[8, 10, 16, 20, 24, 30].map(v => chip('clipLen', v, p.clipLen === v, v + '초')).join('')}</div></div>`
          : `<div class="field"><label>🖼 그림 장 수</label><div class="row cnt"><button class="btn sm" data-a="picN" data-v="-1"${dis}>－</button><b>${sc.length}장</b><button class="btn sm" data-a="picN" data-v="1"${dis}>＋</button><span class="muted">한 장 약 ${(p.song.dur / Math.max(1, sc.length)).toFixed(1)}초 · 기본 최대 20장${sc.some(x => x.reuse != null) ? ` · ♻ ${sc.filter(x => x.reuse != null).length}칸 다시 쓰기 → 새로 그릴 그림 ${sc.length - sc.filter(x => x.reuse != null).length}장` : ''}</span></div></div>`}
        <div class="field"><label>🎨 그림 느낌</label><div class="chips">${STYLES.map(s2 => chip('style', s2, lk.style === s2, s2)).join('')}</div></div>
        <div class="field"><label>💭 노래 분위기</label><input type="text" id="fMood" value="${esc(lk.mood)}" placeholder="예: 봄 햇살, 그리움, 따뜻한 재회"></div>
        <div class="field"><label>🇰🇷 한국 사람 · 한국 배경</label><div class="chips">${chip('kr', 1, KR(p), '켜기 (기본)')}${chip('kr', 0, !KR(p), '끄기')}</div></div>
      </details>
      <details class="grp"${np ? '' : ' open'}><summary>📝 ③ Gemini에게 기획 요청 ${np ? `<span class="cpd ok">${np}/${sc.length}</span>` : ''}</summary>
        <p class="muted">Gemini는 <b>기획(장면 글)만</b> 해요. 버튼 → 붙여넣고 보내기 → 받은 답을 <b>통째로 복사</b> → 「📋 붙여넣기 + 넣기」</p>
        <button class="btn main big" data-a="planAI">${lk.heroImg ? '📤 주인공 사진과 함께 Gemini에 기획 요청' : '📋 기획 요청 복사 + Gemini 열기'}</button>
        ${lk.heroImg ? '<p class="muted" style="margin:4px 0 0">공유 창에서 <b>Gemini</b>를 고르세요. 글이 빠졌으면 붙여넣기 (복사해 뒀어요).</p>' : ''}
        <div class="field"><textarea id="fPlan" placeholder="### 장면 1&#10;…" style="min-height:70px"></textarea></div>
        <div class="row"><button class="btn main" data-a="planPaste">📋 붙여넣기 + 넣기</button><button class="btn" data-a="planIn">✅ 장면 글 넣기</button></div>
      </details>
      <details class="grp" open><summary>${vid ? '🎬 ④ Flow에서 차례로 만들기' : '🖼 ④ ChatGPT 그림 방에서 차례로 만들기'}</summary>
        <div class="nextCp"><div class="muted">지금 복사할 장면 <b>${k} / ${sc.length}</b> · 복사함 ${sc.filter(s2 => s2.cp).length}개</div>
          ${(() => { let j = k - 1; const sk = []; while (sc[j] && sc[j].reuse != null && j < sc.length - 1) { sk.push(j + 1); j++; } return `<button class="btn main big" data-a="cpNext">📋 장면 ${j + 1} 글 복사</button>${sk.length ? `<p class="muted" style="margin:4px 0 0">♻ ${sk.join(' · ')}번은 앞 그림을 다시 써서 건너뛰어요 (초록 ♻ 표시를 누르면 바꾸거나 지울 수 있어요)</p>` : ''}`; })()}
          <div class="row"><button class="btn sm ghost" data-a="cpBack">◀ 앞 장면</button>${vid ? '<button class="btn sm" data-a="flow">🌊 Flow 열기</button>' : '<button class="btn sm" data-a="gptOpen">💬 ChatGPT 열기 (처음 한 번)</button>'}<button class="btn sm ghost" data-a="cpReset">↺ 처음부터</button></div>
          ${vid ? '' : `<p class="muted" style="margin:6px 0 0">🔁 같은 그림 방으로 돌아가려면 휴대폰 <b>최근 앱 버튼(|||) → ChatGPT</b>. 「ChatGPT 열기」를 또 누르면 새 방이 열릴 수 있어요.</p>
          <div class="row">${lk.heroThumb ? `<button class="btn sm" data-a="scShare">📤 장면 ${k} 글 + 주인공 사진 같이 보내기</button>` : ''}<button class="btn sm ghost" data-a="gemDraw">🆘 ChatGPT 한도일 때만: Gemini로 그리기</button></div>`}
        </div>
      </details>
      <details class="grp" open><summary>🎞 ⑤ ${vid ? '영상' : '그림'} 1~${sc.length} 넣기 · 채움 ${filled}/${sc.length}</summary>
        <div class="row"><button class="btn main" data-a="bulk"${dis}>📥 한꺼번에 고르기 → 1번부터 차례로</button><button class="btn" data-a="libOpen"${dis}>🗂 내 보관함에서</button></div>
        ${trayList().length ? `<div class="tray"><b>🗂 서랍</b>${trayList().map(o => `<button type="button" data-a="trayPick" data-v="${esc(o.file)}">${o.thumb ? `<img src="${o.thumb}" alt="">` : '🎞'}<i>${o.uses.length}번</i></button>`).join('')}</div>` : ''}
        <p class="muted">칸마다 그 시간에 나올 가사가 같이 보여요 (자막 시간을 맞추기 전에는 대략). 초록 <b>♻ ○번 그림</b> 표시 = 새로 그리지 않고 ○번 장면 그림을 한 번 더 쓰는 칸이에요 (후렴 등). 📋 복사 · 📥 넣기 때 건너뛰고 그 그림이 저절로 들어가요. <b>표시를 누르면</b> 다른 번호로 바꾸거나 지울 수 있어요.</p>
        <div class="grid">${sc.map((s2, i) => { const ly = MV.sceneLines(p, s2); return `
          <div class="sc${s2.ok ? ' ok' : ''}">
            <button class="th${p.ratio === '9:16' ? ' v916' : ''}" data-a="scPlay" data-v="${i}">${s2.thumb ? `<img src="${s2.thumb}" alt="">` : (s2.file ? '🎞' : '비어 있음')}<span class="k">${i + 1}</span></button>
            <div class="bd"><div class="hd">장면 ${i + 1} · ${fmt0(s2.s)}~${fmt0(s2.e)}${s2.reuse != null ? ` <button type="button" class="cpd re" data-a="reuseSheet" data-v="${i}">♻ ${s2.reuse + 1}번 그림 다시 씀 ✎</button>` : ''}${s2.cp ? ' <span class="cpd">📋</span>' : ''}${s2.file ? ' <span class="cpd ok">✅</span>' : ''}</div>
              <div class="ly">🎤 ${ly.length ? esc(ly.join(' / ')) : '<span class="muted">(반주)</span>'}</div>
              <div class="pr">✏️ ${s2.prompt ? esc(s2.prompt) : '장면 글 없음 → 가사로 자동'}</div>
              <div class="row"><button class="btn sm main" data-a="scCopy" data-v="${i}">📋 글</button><button class="btn sm" data-a="scPut" data-v="${i}"${dis}>📂 ${s2.file ? '바꾸기' : '넣기'}</button><button class="btn sm" data-a="trayFor" data-v="${i}"${dis}>🗂 서랍</button>${s2.file ? `<button class="btn sm ghost" data-a="scDel" data-v="${i}"${dis}>🗑</button>` : ''}<button class="btn sm" data-a="scPlay" data-v="${i}">▶</button><button class="btn sm ghost" data-a="scEdit" data-v="${i}">✏️</button></div>
            </div></div>`; }).join('')}</div>
      </details>`;
  }
  function sceneTapped(p, sc) { const T = MV.lineTimes(p); let any = 0, all = 1; (p.lines || []).forEach((l, i) => { if (T[i].s >= sc.s - .3 && T[i].s < sc.e - .3) { any = 1; if (l.s == null) all = 0; } }); return any && all; }
  function fillPart(p) {
    const sc = p.scenes, L = p.lines || [], nT = L.filter(l => l.s != null).length, first = Math.max(0, sc.findIndex(s => !s.file || !sceneTapped(p, s)));
    return `<div class="fillTop">${p.look && p.look.heroThumb ? `<img class="heroMini" src="${p.look.heroThumb}" alt="">` : ''}<div class="muted">장면을 누르면 <b>그 장면 창</b>이 떠요. 사진 · 영상 넣기, 자막 톡, 노래를 <b>한 번에</b> 맞추고 <b>다음 장면 ▶</b></div></div>
      ${sc.some(s => s.prompt) ? '' : '<div class="note">🤖 장면 글이 아직 없어요. <button class="btn sm" data-a="sub" data-v="1">② 장면에서 먼저 받기 ▶</button></div>'}
      <div class="strip">${sc.map((s, i) => `<button type="button" class="stp${p.ratio === '9:16' ? ' v916' : ''}" data-a="win" data-v="${i}">${s.thumb ? `<img src="${s.thumb}" alt="">` : '<i>빈칸</i>'}<span class="k">${i + 1}</span><span class="bdg">${s.file ? '✅' : ''}${s.cp ? '📋' : ''}${sceneTapped(p, s) ? '🎤' : ''}</span></button>`).join('')}</div>
      <p class="muted">채움 ${sc.filter(s => s.file).length}/${sc.length} · 자막 ${nT}/${L.length}줄 · ✅ 넣음 📋 글 복사함 🎤 자막 맞춤</p>
      <button class="btn main big" data-a="win" data-v="${first}">▶ 장면 ${first + 1}부터 맞추기</button>`;
  }
  function capPart(p) {
    const L = p.lines || [], c = p.cap;
    if (!L.length) return `<div class="note red">가사가 없어요. 2단계에서 가사를 넣어 주세요.</div><button class="btn" data-a="go" data-v="2">🎵 2단계로</button>`;
    const nT = L.filter(l => l.s != null).length;
    return `${nT === L.length ? '<div class="note blue">✅ 모든 줄에 시간이 들어 있어요. ▶ 로 확인하고, 어긋난 줄만 「줄마다 다듬기」에서 고치세요.</div>' : ''}
      <div class="tap">
        <div class="muted tapCnt"></div><div class="now tapNow"></div><div class="nx tapNx"></div>
        <button class="tapbtn" data-a="tap">👆 톡! 이 줄 시작</button>
        <div class="row" style="margin-top:8px"><button class="btn main" data-a="tapStart">▶ ${nT && nT < L.length ? '이어서 맞추기' : '처음부터 맞추기'}</button><button class="btn" data-a="tapBack">↩ 한 줄 뒤로</button><button class="btn" data-a="tapEnd">✋ 자막 끄기</button></div>
        <p class="muted">노래 전체를 쭉 들으며 <b>노란 줄을 부르기 시작할 때 톡</b>. 간주에서는 ✋</p>
      </div>
      <details class="grp"><summary>🔧 줄마다 다듬기 (${nT}/${L.length}줄 맞춤)</summary>
        <div class="lines">${L.map((l, i) => `<div class="ln" id="ln${i}"><span class="t${l.s == null ? ' no' : ''}">${l.s == null ? '--:--' : fmt(l.s)}</span><span class="x" data-a="lnText" data-v="${i}">${esc(l.t)}</span><button class="btn sm" data-a="lnNudge" data-v="${i}:-0.1">−</button><button class="btn sm" data-a="lnNudge" data-v="${i}:0.1">＋</button><button class="btn sm" data-a="lnNow" data-v="${i}">⏱</button><button class="btn sm main" data-a="lnPlay" data-v="${i}">▶</button></div>`).join('')}</div>
        <p class="muted">− ＋ : 0.1초씩 · ⏱ : 지금 재생 위치로 · 글자를 누르면 고치기</p>
      </details>
      <details class="grp"><summary>🎨 자막 모양</summary>
        <div class="cards">
          ${[['karaoke', '🎤', '노래방', '부르는 대로 색이 차요'], ['two', '📝', '노래방 두 줄', '다음 줄도 미리 보여요'], ['line', '💬', '한 줄', '깔끔한 흰 글씨'], ['none', '🚫', '자막 없음', '']].map(a => `<button class="card${c.style === a[0] ? ' on' : ''}" data-a="capStyle" data-v="${a[0]}"><span class="e">${a[1]}</span>${a[2]}<small>${a[3]}</small></button>`).join('')}
        </div>
        <div class="field"><label>노란색 차는 속도</label><div class="chips">${chip('capSpeed', 'normal', (c.speed || 'normal') === 'normal', '보통 (부르는 대로)')}${chip('capSpeed', 'fast', c.speed === 'fast', '⚡ 조금 빨리 (빠른 노래)')}</div></div>
        <div class="field"><label>위치</label><div class="chips">${[['bottom', '⬇ 아래'], ['middle', '⏺ 가운데'], ['top', '⬆ 위']].map(a => chip('capPos', a[0], c.pos === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>크기</label><div class="chips">${[[.8, '작게'], [1, '보통'], [1.25, '크게']].map(a => chip('capSize', a[0], c.size === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>글꼴</label><div class="chips">${[['noto', '본고딕'], ['blackhan', '검은고딕'], ['jua', '주아'], ['dohyeon', '도현'], ['gowunbatang', '명조'], ['nanumpen', '손글씨']].map(a => chip('capFont', a[0], (c.font || 'noto') === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>채우는 색</label><div class="chips">${[['#ffe14d', '🟡'], ['#7dd3fc', '🔵'], ['#f9a8d4', '🩷'], ['#86efac', '🟢'], ['#fca5a5', '🔴']].map(a => chip('capColor', a[0], c.color === a[0], a[1])).join('')}</div></div>
        <p class="muted">긴 가사는 저절로 두 줄로 나눠 보여 줘요.</p>
      </details>`;
  }
  function lockPart(p) {
    const sc = p.scenes, nP = sc.filter(x => x.pin).length, nx = sc.findIndex(x => !x.pin), L = p.lines || [], nT = L.filter(l => l.s != null).length, empty = sc.filter(x => !x.file).length;
    return `<div class="note ${nP === sc.length ? 'blue' : ''}">🔒 장면 ${sc.length}개 중 <b>${nP}개 고정</b>${nx >= 0 ? ` · 다음은 <b>${nx + 1}번</b>` : ' · 🎉 다 고정했어요'} · 자막 ${nT}/${L.length}줄${empty ? ` · ⚠️ 빈 장면 ${empty}개` : ''}</div>
      <p class="muted" style="margin:4px 0">장면마다 <b>▶ 이 장면만</b>으로 그림 · 노래 · 자막이 잘 맞는지 보고, 잘 맞으면 <b>🔒 고정</b>. 고정한 장면은 ① 자막 · ② 화면에서 안 바뀌어요. 시간이 없으면 하던 데까지만 고정하고, 다음에 이어서 하면 돼요.</p>
      <div class="row">${nx >= 0 ? `<button class="btn main" data-a="lkNext">▶ 다음 안 한 장면 (${nx + 1}번)</button>` : ''}<button class="btn" data-a="playAll">▶ 처음부터 끝까지</button></div>
      <div class="lkList">${sc.map((x, i) => { const ly = MV.sceneLines(p, x); return `<div class="lk${x.pin ? ' on' : ''}" id="lk${i}">
        <button type="button" class="th${p.ratio === '9:16' ? ' v916' : ''}" data-a="lkPlay" data-v="${i}">${x.thumb ? `<img src="${x.thumb}" alt="">` : (x.file ? '🎞' : '비어 있음')}<span class="k">${i + 1}</span></button>
        <div class="bd"><div class="hd">장면 ${i + 1} <span class="muted">${fmt0(x.s)}~${fmt0(x.e)} · ${(x.e - x.s).toFixed(1)}초</span></div>
          <div class="ly">🎤 ${ly.length ? esc(ly.join(' / ')) : '<span class="muted">(반주)</span>'}</div>
          ${x.prompt ? `<div class="pr">✏️ ${esc(x.prompt)}</div>` : ''}
          <div class="row"><button class="btn sm main" data-a="lkPlay" data-v="${i}">▶ 이 장면만</button><button class="btn sm ${x.pin ? 'pinOn' : 'pinBtn'}" data-a="lkPin" data-v="${i}">${x.pin ? '✅ 고정됨 (누르면 풀기)' : '🔒 고정'}</button></div></div></div>`; }).join('')}</div>
      <div class="row" style="margin-top:10px"><button class="btn sm ghost" data-a="lkAll">🔒 전부 고정</button><button class="btn sm ghost" data-a="lkNone">🔓 전부 풀기</button></div>
      ${nP === sc.length && sc.length ? '<button class="btn main big next" data-a="go" data-v="4">✨ 다음 단계: 효과 ▶</button>' : ''}`;
  }
  BODY[3] = function () {
    const p = S.p;
    if (p.locked) { p.scenes.forEach(x => x.pin = true); p.locked = false; save(); }
    return `<div class="pvStick s3" data-pv></div>
      <div data-sub="① 자막">${capPart(p)}</div>
      <div data-sub="② 화면">${MV.TL.fillPart()}</div>
      <div data-sub="③ 잠금">${lockPart(p)}</div>`;
  };
  async function putScene(i, f) {
    const p = S.p, sc = p.scenes[i]; if (!sc || !f) return;
    const kind = /^video/.test(f.type) ? 'video' : 'image', id = await MV.putFile(f, f.name);
    if (sc.file && !p.scenes.some((o, k) => k !== i && o.file === sc.file)) MV.delFile(sc.file);
    Object.assign(sc, { file: id, kind, name: f.name, ok: false, off: 0, thumb: await thumbOf(f) }); sc.auto = false;
    applyReuse();
  }
  /* ♻ 다시 쓰기: 「장면 14 = 장면 6」 칸에 6번 그림을 저절로 */
  function applyReuse() { const S2 = S.p.scenes; S2.forEach(x => { if (x.reuse == null || x.pin) return; const src = S2[x.reuse]; if (!src || !src.file) return; if (x.file && !x.auto) return; Object.assign(x, { file: src.file, kind: src.kind, name: src.name, thumb: src.thumb, off: 0, auto: true }); }); }
  /* 🗂 서랍: 넣은 그림 · 몇 번 씀 */
  function trayList() { const m = new Map(); S.p.scenes.forEach((x, i) => { if (!x.file) return; const o = m.get(x.file) || { file: x.file, kind: x.kind, name: x.name, thumb: x.thumb, uses: [] }; o.uses.push(i + 1); m.set(x.file, o); }); return [...m.values()]; }
  function traySheet(i) {
    const L = trayList(); if (!L.length) return toast('🗂 서랍이 비어 있어요 · 먼저 그림을 넣어 주세요', 3000);
    sheet(i == null ? '🗂 서랍 (넣은 그림)' : `🗂 서랍 → 장면 ${i + 1}에 넣기`, `<p class="muted">${i == null ? '그림을 누르면 넣을 장면을 골라요.' : `누른 그림이 장면 ${i + 1}에 들어가요 (같은 그림 다시 쓰기).`}</p>
      <div class="libGrid big">${L.map(o => `<button type="button" data-a="${i == null ? 'trayPick' : 'trayPut'}" data-v="${i == null ? esc(o.file) : i + ':' + esc(o.file)}">${o.thumb ? `<img src="${o.thumb}" alt="">` : '🎞'}<b>${o.uses.length}</b><i>${o.uses.length}번 씀 · ${o.uses.slice(0, 4).join(',')}${o.uses.length > 4 ? '…' : ''}</i></button>`).join('')}</div>`);
  }
  function trayPut(i, fileId) { const S2 = S.p.scenes, sc = S2[i], o = trayList().find(x => x.file === fileId); if (!sc || !o) return; if (sc.file && sc.file !== fileId && !S2.some((x, k) => k !== i && x.file === sc.file)) MV.delFile(sc.file); Object.assign(sc, { file: o.file, kind: o.kind, name: o.name, thumb: o.thumb, off: 0, auto: false }); applyReuse(); }
  async function setHero(f) {
    const p = S.p; if (p.look.heroImg) MV.delFile(p.look.heroImg);
    p.look.heroImg = await MV.putFile(f, f.name || '주인공.jpg'); p.look.heroThumb = await thumbOf(f); p.look.heroLock = false;
    const photo = (p.look.heroTab || 'photo') === 'photo'; if (photo && p.look.hero) { p.look.heroOld = p.look.hero; p.look.hero = ''; }
    save(); render();
    toast(photo ? '🧑 사진을 넣었어요 · 예전 주인공 설명은 지웠어요 (사진과 다를 수 있어서) · 맞으면 🔒 고정' : '🧑 주인공 그림을 넣었어요 · 맞으면 🔒 고정', 4500);
  }
  function lnLocked(i) { const p = S.p, l = p.lines[i]; if (!l || l.s == null) return false; const x = p.scenes[MV.sceneAt(p, l.s)]; return !!(x && x.pin); }
  function lnGuard(i) { if (lnLocked(i)) { toast('🔒 이 줄은 고정한 장면 안에 있어요 · ③ 잠금에서 그 장면을 풀고 고쳐 주세요', 3500); return true; } return false; }
  function pinned(i) { const c = S.p && S.p.scenes[i]; if (c && c.pin) { toast(`🔒 장면 ${i + 1}은(는) 고정돼 있어요 · ③ 잠금이나 ② 화면에서 「고정 풀기」`, 3500); return true; } return false; }
  function delScene(i) {
    const p = S.p, sc = p.scenes[i]; if (!sc || !sc.file) return;
    if (!p.scenes.some((o, k) => k !== i && o.file === sc.file)) MV.delFile(sc.file);
    Object.assign(sc, { file: null, kind: null, name: '', ok: false, off: 0, thumb: '' });
  }

  /* ═════════ 🗂 내 보관함 (BK쇼츠 · BK에딧 공용)에서 골라 차례로 넣기 ═════════ */
  let LIB = { list: [], sel: [], start: 0 };
  async function libPick(start, max) {
    LIB = { list: await MV.libList(), sel: [], start: start || 0, max: max || 999 };
    if (!LIB.list.length) return toast('🗂 보관함이 비어 있어요 (BK쇼츠 · BK에딧에서 담은 사진이 여기 보여요)', 4000);
    libSheet();
  }
  function libSheet() {
    sheet('🗂 내 보관함', `<p class="muted">누른 순서대로 <b>${LIB.start + 1}번 칸부터</b> 차례로 들어가요 · ${LIB.sel.length}개 고름</p>
      <div class="libGrid">${LIB.list.map(o => { const k = LIB.sel.indexOf(o.id); return `<button type="button" class="${k >= 0 ? 'on' : ''}" data-a="libTog" data-v="${esc(o.id)}">${o.th ? `<img src="${o.th}" alt="">` : (o.kind === 'video' ? '🎞' : '🖼')}${k >= 0 ? `<b>${k + 1}</b>` : ''}${o.kind === 'video' ? '<i>🎞</i>' : ''}</button>`; }).join('')}</div>
      <button class="btn main big" data-a="libGo"${LIB.sel.length ? '' : ' disabled'}>✅ 고른 ${LIB.sel.length}개 넣기</button>`);
  }

  /* ═════════ 🎬 장면 하나씩 창 (미리 보기 + 자막 톡 + 넣기 · 빼기 · ◀ ▶) ═════════ */
  function winLines(p, sc) {
    const T = MV.lineTimes(p), out = [];
    (p.lines || []).forEach((l, i) => { if (T[i].s >= sc.s - .3 && T[i].s < sc.e - .3) out.push(i); });
    if (!out.length) { const k = S.tapK; if ((p.lines || [])[k] && T[k].s < sc.e + 2 && T[k].s > sc.s - 4) out.push(k); }
    return out;
  }
  function winHtml() {
    const p = S.p, i = S.win, sc = p.scenes[i], N = p.scenes.length, vid = p.mode !== 'image', Lk = !!p.locked, li = winLines(p, sc);
    return `<div class="scwBox">
      <div class="scwHd"><button type="button" class="btn sm ghost" data-a="winGo" data-v="${i - 1}"${i ? '' : ' disabled'}>◀</button><b>장면 ${i + 1} / ${N} <span class="muted">${fmt0(sc.s)}~${fmt0(sc.e)}</span></b><button type="button" class="btn sm ghost" data-a="winGo" data-v="${i + 1}"${i < N - 1 ? '' : ' disabled'}>▶</button><button type="button" class="btn sm" data-a="winX">✕ 닫기</button></div>
      <div id="scwPv"></div>
      <div class="row"><button class="btn main" data-a="winPlay">▶ 이 장면 재생</button><button class="btn ghost" data-a="winPlay" data-v="again">↩ 다시</button></div>
      <div class="scwLy">${li.length ? li.map(k => { const l = p.lines[k]; return `<div class="wl${k === S.tapK ? ' nxt' : ''}" data-li="${k}"><span class="t${l.s == null ? ' no' : ''}">${l.s == null ? '--:--' : fmt(l.s)}</span>${esc(l.t)}</div>`; }).join('') : '<div class="muted">(이 장면은 반주예요)</div>'}</div>
      <div class="tap" style="margin:6px 0"><div class="now tapNow" style="font-size:1rem;min-height:1.6em"></div>
        <button class="tapbtn" data-a="tap" style="padding:14px">👆 톡! 이 줄 시작</button>
        <div class="row" style="margin-top:6px"><button class="btn sm" data-a="tapBack">↩ 한 줄 뒤로</button><button class="btn sm" data-a="tapEnd">✋ 자막 끄기</button></div></div>
      <div class="row"><button class="btn sm main" data-a="scCopy" data-v="${i}">📋 ${vid ? 'Flow' : '그림'} 글 복사</button><button class="btn sm" data-a="scPut" data-v="${i}"${Lk ? ' disabled' : ''}>📂 ${sc.file ? '바꾸기' : '넣기'}</button>${sc.file ? `<button class="btn sm ghost" data-a="scDel" data-v="${i}"${Lk ? ' disabled' : ''}>🗑 빼기</button>` : ''}<button class="btn sm ${sc.ok ? 'ok' : 'ghost'}" data-a="scOk" data-v="${i}">👍</button></div>
      <div class="scwNav"><button class="btn ghost" data-a="winGo" data-v="${i - 1}"${i ? '' : ' disabled'}>◀ 앞 장면</button><button class="btn main" data-a="winNext"${i < N - 1 ? '' : ' disabled'}>다음 장면 ▶</button></div>
    </div>`;
  }
  function winRender() {
    let o = $('scw'); if (!o) { o = document.createElement('div'); o.id = 'scw'; o.className = 'sheetBg'; o.addEventListener('click', e => { if (e.target === o) winClose(); }); document.body.appendChild(o); }
    o.innerHTML = winHtml(); o.classList.remove('hide'); document.body.style.overflow = 'hidden';
    const slot = $('scwPv'); if (slot && S.pv) { slot.appendChild(S.pv); S.pv.querySelector('#pvWrap').classList.toggle('v916', S.p.ratio === '9:16'); S.player.draw(); }
    tapShow(S.player.time());
  }
  async function winOpen(i, play) {
    const p = S.p; i = clamp(+i, 0, p.scenes.length - 1); S.win = i; winRender();
    const sc = p.scenes[i]; if (play) await S.player.play(Math.max(0, sc.s - (i ? .2 : 0)), sc.e + .25); else await S.player.seek(sc.s + .05);
  }
  function winClose() { const o = $('scw'); if (o) { o.classList.add('hide'); o.innerHTML = ''; } document.body.style.overflow = ''; S.win = null; if (S.player) S.player.pause(); if (S.view === 'stage') renderStage(); }
  function winLy() { if (S.win == null || !$('scw')) return; const box = document.querySelector('#scw .scwLy'); if (!box) return; const t = document.createElement('div'); t.innerHTML = winHtml(); const nb = t.querySelector('.scwLy'); if (nb) box.innerHTML = nb.innerHTML; }
  function tapShow(t) {
    const L = S.p.lines || [], k = S.tapK;
    document.querySelectorAll('.tapCnt').forEach(e => { e.textContent = k < L.length ? `${k + 1} / ${L.length} 줄 · 👇 이 줄이 들리면 톡` : `✅ ${L.length}줄 다 맞췄어요`; });
    document.querySelectorAll('.tapNow').forEach(e => { e.textContent = k < L.length ? (S.win != null ? '👇 ' : '') + L[k].t : '🎉 다 맞췄어요! ▶ 로 확인해 보세요'; });
    document.querySelectorAll('.tapNx').forEach(e => { e.textContent = L[k + 1] ? '다음: ' + L[k + 1].t : ''; });
    const cur = MV.lineAt(S.p, t); document.querySelectorAll('.ln.cur,.wl.cur').forEach(e => e.classList.remove('cur'));
    const r = $('ln' + cur); if (r && L[cur] && L[cur].s != null) r.classList.add('cur');
    document.querySelectorAll('.wl').forEach(e => { const n = +e.dataset.li; e.classList.toggle('cur', n === cur && L[n] && L[n].s != null); e.classList.toggle('nxt', n === k); });
  }
  function linesChanged() { S.player.refresh(); if (!S.player.playing()) S.player.draw(); save(); }

  /* ═════════ 5. 최종 편집 ═════════ */
  BODY[5] = function () {
    return `<div class="pvStick dark" data-pv></div>
      <div data-sub="① 다듬기"><div class="edHost">${MV.TL.editPart()}</div></div>
      <div class="sub" data-sub="② 저장"><h3>💾 MP4로 저장</h3>
        <div class="chips">${chip('q', 720, S.q === 720, '720p (빠르게)')}${chip('q', 1080, S.q === 1080, '1080p (선명하게)')}</div>
        <p class="muted">만드는 동안 화면을 켜 두세요. 3분 노래는 몇 분 걸려요.</p>
        <button class="btn pink big" data-a="export" id="expBtn">💾 뮤직비디오 만들기</button>
        <div id="expBox"></div>
        <div id="lastBox"></div>
      </div>`;
  };
  /* ═════════ 6. ✨ 효과 (BK에딧 · BK쇼츠 효과 모음 fx.js) ═════════ */
  const FXL = { len: 3, pos: 'mc', size: 1, mo: '' };
  const POS = { tl: [.2, .18], tc: [.5, .18], tr: [.8, .18], ml: [.2, .5], mc: [.5, .5], mr: [.8, .5], bl: [.2, .78], bc: [.5, .78], br: [.8, .78] };
  const tnow = () => +(S.player ? S.player.time() : 0).toFixed(2);
  function itemRows(kind) {
    const p = S.p, F = g.BKFX, A = p[kind] || [];
    if (!A.length) return '<p class="muted">아직 없어요.</p>';
    return `<div class="lines">${A.map((it, i) => {
      const name = kind === 'efx' ? F.EFX[it.k] : kind === 'sfx' ? F.SFX[it.k] : (it.d ? ((F.DECOR[it.d] || ['🎨'])[0] + (it.t ? ' · ' + it.t : '')) : it.e || (it.b === 'bk' ? '🅑 BK 로고' : '🔤 ' + (it.t || ''))) + (it.mo && F.MOTIONS ? ' · ' + F.MOTIONS[it.mo] : '');
      const tm = kind === 'sfx' ? fmt(it.at) : `${fmt(it.start)}~${fmt(it.start + it.dur)}`;
      return `<div class="ln${kind === 'stk' ? ' stkLn' : ''}"><span class="t">${tm}</span><span class="x">${esc(name)}${kind === 'stk' && it.path ? ' · 🎯 따라감' : ''}</span><button class="btn sm" data-a="itPlay" data-v="${kind}:${i}">▶</button>${kind === 'stk' && g.BKTRACK && isAdmin() ? `<button class="btn sm" data-trk="${i}">🎯 따라가기</button><button class="btn sm ghost" data-pin="${i}">📍 자리</button>${it.path ? `<button class="btn sm ghost" data-trkoff="${i}">↩</button>` : ''}` : ''}<button class="btn sm ghost" data-a="itDel" data-v="${kind}:${i}">🗑</button></div>`; }).join('')}</div>`;
  }
  const MORE = {};
  function more(a, list, cur, n, title) {
    MORE[a] = { title, html: () => `<div class="chips">${list.map(([k, t]) => chip(a, k, cur === k, t)).join('')}</div>` };
    const top = list.slice(0, n); if (cur != null && !top.some(x => x[0] === cur)) { const c = list.find(x => x[0] === cur); if (c) top.unshift(c); }
    return `<div class="chips">${top.map(([k, t]) => chip(a, k, cur === k, t)).join('')}${list.length > top.length ? `<button type="button" class="chip moreChip" data-a="moreSheet" data-v="${a}">＋ 더 보기 (${list.length})</button>` : ''}</div>`;
  }
  BODY[4] = function () {
    const p = S.p, f = p.fx, F = g.BKFX; if (!F) return '<p class="muted">효과를 불러오는 중…</p>';
    const nCh = (p.lines || []).filter(l => l.sec === 'chorus' && l.s != null).length;
    return `<div class="pvStick" data-pv></div>
      <div class="note blue">📍 지금 위치 <b id="fxNow">${fmt(tnow())}</b> — 화면 효과 · 스티커 · 효과음은 <b>지금 위치</b>에 들어가요. 미리 보기 아래 막대로 위치를 옮기세요.</div>
      <div data-sub="① 전환">
        <p class="muted">장면이 바뀔 때 넘어가는 모양 (모든 장면)</p>
        ${more('fxTrans', Object.entries(F.TRANS), f.trans || 'fade', 5, '🔀 장면 전환')}
        <div class="field"><label>넘어가는 시간</label><div class="chips">${[[.3, '⚡ 빠르게'], [.6, '보통'], [1, '🐢 천천히']].map(a => chip('fxTdur', a[0], f.tdur === a[0], a[1])).join('')}</div></div>
        <div class="row"><button class="btn" data-a="fxMix">🎲 장면마다 골고루 섞기</button><button class="btn ghost" data-a="fxMixOff">↩ 모두 같게</button></div>
        <p class="muted">장면 하나만 바꾸려면 7단계 편집에서 그 장면을 누르세요.</p>
      </div>
      <div data-sub="② 색감">
        <div class="field"><label>🎨 색감 (모든 장면)</label>${more('fxColor', Object.entries(F.FILTERS).map(([k, v]) => [k, v[0]]), f.color || 'none', 5, '🎨 색감')}</div>
        <div class="field"><label>🎞 필름 느낌</label><div class="chips">${[['none', '없음'], ['cinema', '🎞 시네마 띠'], ['vintage', '📼 빈티지'], ['vivid', '🌈 선명하게']].map(a => chip('film', a[0], f.film === a[0], a[1])).join('')}</div></div>
        <div class="field"><label>🖼 사진 천천히 확대</label><div class="chips">${chip('zoomImg', 1, f.zoom, '켜기')}${chip('zoomImg', 0, !f.zoom, '끄기')}</div></div>
      </div>
      <div data-sub="③ 효과">
        <div class="field"><label>얼마 동안</label><div class="chips">${[[1, '1초'], [3, '3초'], [5, '5초'], [10, '10초'], [0, '노래 끝까지']].map(a => chip('fxLen', a[0], FXL.len === a[0], a[1])).join('')}</div></div>
        <p class="muted">👇 누르면 📍 지금 위치에 들어가요</p>
        ${more('efxAdd', Object.entries(F.EFX), null, 6, '✨ 화면 효과')}
        <div class="sub"><h3>🎤 후렴에 맞춰 한 번에</h3>
          ${nCh ? `<div class="row"><button class="btn" data-a="efxChorus" data-v="punch">💥 후렴마다 확 줌인</button><button class="btn" data-a="efxChorus" data-v="flash">⚡ 후렴마다 번쩍</button></div>` : '<p class="muted">가사에 [Chorus] 표시가 있고 자막 시간을 맞추면 후렴마다 한 번에 넣을 수 있어요.</p>'}
        </div>
        <div class="sub"><h3>들어간 화면 효과</h3>${itemRows('efx')}</div>
      </div>
      <div data-sub="④ 스티커">
        <div class="field"><label>위치</label><div class="pos9">${Object.keys(POS).map(k => `<button type="button" class="${FXL.pos === k ? 'on' : ''}" data-a="fxPos" data-v="${k}"></button>`).join('')}</div></div>
        <div class="field"><label>크기 · 얼마 동안</label><div class="chips">${[[.7, '작게'], [1, '보통'], [1.5, '크게']].map(a => chip('fxSize', a[0], FXL.size === a[0], a[1])).join('')} ${[[2, '2초'], [3, '3초'], [5, '5초']].map(a => chip('fxLen', a[0], FXL.len === a[0], a[1])).join('')}</div></div>
        <p class="muted">👇 누르면 📍 지금 위치에 들어가요</p>
        <div class="emo">${F.EMOJI.slice(0, 8).map(e => `<button type="button" data-a="stkAdd" data-v="${e}">${e}</button>`).join('')}</div><button class="btn sm moreBtn" data-a="moreSheet" data-v="stk">＋ 스티커 더 보기 (${F.EMOJI.length})</button>
        <div class="field"><label>🌀 움직임 <span class="muted">(새로 넣는 스티커에)</span></label><div class="chips">${Object.entries(F.MOTIONS || {}).map(a => chip('fxMo', a[0], FXL.mo === a[0], a[1])).join('')}</div></div>
        ${F.DECOR ? `<p class="muted" style="margin:10px 0 4px">🎨 꾸밈 스티커 — 💬 말풍선 · 💭 생각 풍선 · 🎀 리본 · 💥 팡은 글씨를 넣을 수 있어요. 넣은 뒤 아래 목록의 <b>🎯 따라가기</b>로 사람을 따라가게 해요</p><div class="chips decorChips">${Object.entries(F.DECOR).map(a => `<button type="button" class="chip" data-a="stkAdd" data-v="d:${a[0]}">${a[1][0]}</button>`).join('')}</div>` : ''}
        <div class="row" style="margin-top:6px"><button class="btn" data-a="stkAdd" data-v="b:text">🔤 글씨 상자</button><button class="btn" data-a="stkAdd" data-v="b:bk">🅑 BK 로고</button></div>
        <div class="sub"><h3>들어간 스티커</h3>${itemRows('stk')}</div>
      </div>
      <div data-sub="⑤ 소리">
        <p class="muted">👇 누르면 소리를 들려주고 📍 지금 위치에 들어가요 (앱이 직접 만드는 소리라 저작권 걱정 없어요)</p>
        ${more('sfxAdd', Object.entries(F.SFX), null, 6, '🔔 효과음')}
        <div class="field"><label>효과음 크기</label><div class="chips">${[[.4, '작게'], [.8, '보통'], [1.2, '크게']].map(a => chip('sfxVol', a[0], f.sfxVol === a[0], a[1])).join('')}</div></div>
        <div class="sub"><h3>들어간 효과음</h3>${itemRows('sfx')}</div>
      </div>
      <div data-sub="⑥ 처음·끝">${startEnd()}</div>`;
  };
  function startEnd() {
    const f = S.p.fx;
    return `<div class="row"><span class="lbl">처음 제목</span><div class="chips">${chip('intro', 1, f.intro, '켜기')}${chip('intro', 0, !f.intro, '끄기')}</div></div>
      ${f.intro ? `<div class="field"><input type="text" id="fIntro" value="${esc(f.introText || '')}" placeholder="제목 (비우면 뮤비 제목)"></div><div class="field"><input type="text" id="fIntroSub" value="${esc(f.introSub || '')}" placeholder="작은 글 (예: 노래 · 부른 사람)"></div>` : ''}
      <div class="row"><span class="lbl">엔딩 글</span><div class="chips">${chip('outro', 1, f.outro, '켜기')}${chip('outro', 0, !f.outro, '끄기')}</div></div>
      ${f.outro ? `<div class="field"><input type="text" id="fOutro" value="${esc(f.outroText || '')}" placeholder="예: 들어 주셔서 감사합니다"></div>` : ''}
      <div class="row"><span class="lbl">처음 밝아지기</span><div class="chips">${[[0, '없음'], [1, '1초'], [2, '2초']].map(a => chip('fadeIn', a[0], f.fadeIn === a[0], a[1])).join('')}</div></div>
      <div class="row"><span class="lbl">끝 어두워지기</span><div class="chips">${[[0, '없음'], [1.5, '1.5초'], [2.5, '2.5초'], [4, '4초']].map(a => chip('fadeOut', a[0], f.fadeOut === a[0], a[1])).join('')}</div></div>`;
  }
  function fxRefresh() { S.player.refresh(); if (!S.player.playing()) S.player.seek(S.player.time()); save(); if (S.p.step === 5 || S.p.step === 3) { MV.TL.refreshView(); MV.TL.reSheet(); } else renderStage(); }
  function fxAct(a, v) {
    if (a === 'moreSheet') { if (v === 'stk') return sheet('😀 스티커', `<div class="emo">${g.BKFX.EMOJI.map(e => `<button type="button" data-a="stkAdd" data-v="${e}">${e}</button>`).join('')}</div>`); const M = MORE[v]; return M ? sheet(M.title, M.html()) : null; }
    if (/^(fxTrans|fxColor|efxAdd|sfxAdd|stkAdd)$/.test(a)) sheetClose();
    if (!/^(fx|efx|stk|sfx|it)/.test(a)) return null;
    const p = S.p, F = g.BKFX, dur = p.song ? p.song.dur : 0, t = tnow();
    switch (a) {
      case 'fxTrans': p.fx.trans = v; return fxRefresh();
      case 'fxTdur': p.fx.tdur = +v; return fxRefresh();
      case 'fxMix': { const K = ['fade', 'zoom', 'slide', 'white', 'circle', 'wipe', 'blur', 'up', 'black']; p.scenes.forEach((s, i) => { s.tr = i ? K[(i * 5) % K.length] : ''; }); toast('🎲 장면마다 다른 전환을 넣었어요'); return fxRefresh(); }
      case 'fxMixOff': p.scenes.forEach(s => { s.tr = ''; }); toast('↩ 모든 장면을 같은 전환으로'); return fxRefresh();
      case 'fxColor': p.fx.color = v; return fxRefresh();
      case 'fxLen': FXL.len = +v; return renderStage();
      case 'fxPos': FXL.pos = v; return renderStage();
      case 'fxSize': FXL.size = +v; return renderStage();
      case 'fxMo': FXL.mo = v; return renderStage();
      case 'efxAdd': { const d = FXL.len ? Math.min(FXL.len, dur - t) : dur - t; p.efx.push({ k: v, start: t, dur: F.EFX_DUR[v] && FXL.len > F.EFX_DUR[v] ? F.EFX_DUR[v] : Math.max(.3, d) }); toast(`${F.EFX[v]} · ${fmt(t)}에 넣었어요`); return fxRefresh(); }
      case 'efxChorus': { const L = p.lines || []; let n = 0; L.forEach((l, i) => { if (l.sec === 'chorus' && l.s != null && (!L[i - 1] || L[i - 1].sec !== 'chorus')) { p.efx.push({ k: v, start: l.s, dur: F.EFX_DUR[v] || .8 }); n++; } }); toast(n ? `🎤 후렴 ${n}곳에 넣었어요` : '후렴을 못 찾았어요'); return fxRefresh(); }
      case 'stkAdd': { const [x, y] = POS[FXL.pos], it = { start: t, dur: Math.min(FXL.len || 3, dur - t), x, y, size: FXL.size };
        if (v.startsWith('b:')) { it.b = v.slice(2); if (it.b === 'text') { const tx = prompt('상자에 넣을 글씨', ''); if (!tx) return; it.t = tx; } }
        else if (v.startsWith('d:')) { it.d = v.slice(2); const D = F.DECOR[it.d]; if (D && D[1]) { const tx = prompt('넣을 글씨', D[2] || ''); if (tx === null) return; it.t = tx || D[2]; } } else it.e = v;
        if (FXL.mo) it.mo = FXL.mo;
        p.stk.push(it); toast('😀 스티커를 넣었어요 · ' + fmt(t)); return fxRefresh(); }
      case 'sfxAdd': S.player.sfx(v); p.sfx.push({ k: v, at: t }); p.sfx.sort((a2, b2) => a2.at - b2.at); toast(`${F.SFX[v]} · ${fmt(t)}에 넣었어요`); return fxRefresh();
      case 'sfxVol': p.fx.sfxVol = +v; return fxRefresh();
      case 'itDel': { const [k, i] = v.split(':'); p[k].splice(+i, 1); if (S.sel && S.sel.k === k) S.sel = null; return fxRefresh(); }
      case 'itPlay': { const [k, i] = v.split(':'), it = p[k][+i]; const st = k === 'sfx' ? it.at : it.start; return S.player.play(Math.max(0, st - 1), st + (k === 'sfx' ? 2 : Math.min(it.dur, 6)) + .5); }
    }
    return null;
  }
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
    const EC = { efx: '#9333ea', stk: '#db2777', sfx: '#ca8a04' };
    h += trk(136, '✨', `<div class="blk" data-tl="fx:0" style="left:0;width:${dur * px}px;background:#1e293b;color:#94a3b8"></div>` + F.map(f => `<div class="blk${S.sel && S.sel.k === 'fx' ? ' sel' : ''}" data-tl="fx:0" style="left:${f[0] * px}px;width:${Math.max(8, (f[1] - f[0]) * px)}px;background:#475569">${f[2]}</div>`).join('')
      + (p.efx || []).map((e, i) => `<div class="blk${S.sel && S.sel.k === 'efx' && S.sel.i === i ? ' sel' : ''}" data-tl="efx:${i}" style="left:${e.start * px}px;width:${Math.max(10, e.dur * px)}px;background:${EC.efx};height:16px">${(g.BKFX.EFX[e.k] || '').split(' ')[0]}</div>`).join('')
      + (p.stk || []).map((e, i) => `<div class="blk${S.sel && S.sel.k === 'stk' && S.sel.i === i ? ' sel' : ''}" data-tl="stk:${i}" style="left:${e.start * px}px;width:${Math.max(10, e.dur * px)}px;background:${EC.stk};top:17px;height:17px">${e.e || '🔤'}</div>`).join('')
      + (p.sfx || []).map((e, i) => `<div class="blk${S.sel && S.sel.k === 'sfx' && S.sel.i === i ? ' sel' : ''}" data-tl="sfx:${i}" style="left:${e.at * px}px;width:14px;background:${EC.sfx};top:17px;height:17px;padding:0">🔔</div>`).join(''));
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
        ${i > 0 ? `<div class="row"><span class="lbl">넘어올 때</span><div class="chips">${[['', '기본']].concat(Object.entries(g.BKFX.TRANS)).map(a => chip('scTr', i + ':' + a[0], (sc.tr || '') === a[0], a[1])).join('')}</div></div>` : ''}
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
    if (s.k === 'efx' || s.k === 'stk' || s.k === 'sfx') {
      const it = (p[s.k] || [])[s.i]; if (!it) return '';
      const F = g.BKFX, name = s.k === 'efx' ? F.EFX[it.k] : s.k === 'sfx' ? F.SFX[it.k] : (it.e || '🔤 ' + (it.t || 'BK 로고'));
      return `<h4>${esc(name)} · ${s.k === 'sfx' ? fmt(it.at) : fmt(it.start) + ' ~ ' + fmt(it.start + it.dur)}</h4>
        <div class="row"><span class="lbl">위치 옮기기</span>${nud('itMove', s.k + ':' + s.i, [-1, -0.2, 0.2, 1])}</div>
        ${s.k === 'sfx' ? '' : `<div class="row"><span class="lbl">길이</span>${nud('itLen', s.k + ':' + s.i, [-1, -0.5, 0.5, 1])}</div>`}
        <div class="row"><button class="btn sm main" data-a="itPlay" data-v="${s.k}:${s.i}">▶ 보기</button><button class="btn sm ghost" data-a="itDel" data-v="${s.k}:${s.i}">🗑 빼기</button></div>`;
    }
    return `<h4>🎬 처음 · 끝</h4>${startEnd()}<div class="row" style="margin-top:8px"><button class="btn sm" data-a="open" data-v="4">✨ 다른 효과는 4단계에서</button></div>`;
  }
  function editRefresh() { S.player.refresh(); if (!S.player.playing()) S.player.seek(S.player.time()); save(); MV.TL.refreshView(); MV.TL.reSheet(); }
  function moveBoundary(i, d) {   // i번 장면의 시작 = i-1번 장면의 끝
    const sc = S.p.scenes, a = sc[i - 1], b = sc[i]; if (!a || !b) return;
    const v = clamp(+(b.s + d).toFixed(2), a.s + .5, b.e - .5); b.s = v; a.e = v;
  }

  function download(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  /* 🎞 마지막으로 만든 영상 (BK뮤드 안에 보관 · 화면을 옮겨도 남아요) */
  async function showLast() {
    const box = $('lastBox'), p = S.p; if (!box || !p) return;
    if (!p.mp4 || !p.mp4.file) { box.innerHTML = ''; return; }
    if (S.lastId !== p.mp4.file) { const bl = await MV.getFile(p.mp4.file); if (!bl) { box.innerHTML = ''; return; } S.lastBlob = bl; S.lastId = p.mp4.file; if (S.lastUrl) URL.revokeObjectURL(S.lastUrl); S.lastUrl = URL.createObjectURL(bl); }
    const m = p.mp4, d = new Date(m.at);
    box.innerHTML = `<div class="lastMv"><h3>🎞 마지막으로 만든 영상</h3>
      <div class="note blue">✅ <b>${esc(m.name)}</b> · ${m.W}x${m.H} · ${(m.size / 1048576).toFixed(1)}MB · ${d.toLocaleDateString('ko-KR')} ${d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}${m.warning ? '<br>⚠️ ' + esc(m.warning) : ''}<br>📂 휴대폰 <b>내 파일 → 다운로드</b> 폴더에 저장돼요 (갤러리 「Download」 앨범)</div>
      <video src="${S.lastUrl}" controls playsinline style="width:100%;max-height:50vh;border-radius:12px;background:#000"></video>
      <div class="row" style="margin-top:8px"><button class="btn main" data-a="mp4Save">⬇️ 휴대폰에 다시 저장</button><button class="btn" data-a="mp4Share">📤 보내기</button></div></div>`;
  }
  async function doExport() {
    const p = S.p; if (S.busy) return; if (!p.scenes.some(s => s.file)) return toast('장면이 비어 있어요');
    { const D = p.song.dur, nOv = p.scenes.filter(s => s.s >= D - .01).length; if (p.scenes[p.scenes.length - 1].e > D + .05 && !confirm(`⚠️ 장면이 노래보다 ${(p.scenes[p.scenes.length - 1].e - D).toFixed(1)}초 길어요.\n노래 끝 뒤 장면${nOv ? ` ${nOv}개` : ''}는 빠지고 저장돼요. 그대로 저장할까요?`)) return; }
    S.busy = true; S.player.pause(); const box = $('expBox'), btn = $('expBtn'), ctl = {};
    btn.disabled = true; box.innerHTML = `<div class="prog"><i id="expBar"></i></div><p class="muted" id="expMsg">준비 중…</p><button class="btn sm ghost" id="expStop">■ 그만</button>`;
    $('expStop').onclick = () => { ctl.aborted = true; };
    let lock = null; try { lock = await navigator.wakeLock.request('screen'); } catch (e) { /* 없어도 됨 */ }
    try {
      const r = await MV.exportMp4(p, S.q, (f, m) => { const b = $('expBar'), t = $('expMsg'); if (b) b.style.width = Math.round(f * 100) + '%'; if (t) t.textContent = m; }, ctl);
      const name = (p.title || 'BK뮤드').replace(/[\\/:*?"<>|]/g, '') + '.mp4';
      const id = await MV.putFile(r.blob, name); if (p.mp4 && p.mp4.file) MV.delFile(p.mp4.file);
      p.mp4 = { file: id, name, size: r.blob.size, at: Date.now(), W: r.W, H: r.H, warning: r.warning || '' }; p.exported = Date.now(); save();
      S.lastBlob = r.blob; S.lastId = id; if (S.lastUrl) URL.revokeObjectURL(S.lastUrl); S.lastUrl = URL.createObjectURL(r.blob);
      download(S.lastUrl, name);
      box.innerHTML = ''; showLast();
      toast(`📂 내 파일 → 다운로드에 「${name}」로 저장했어요`, 6000);
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
      case 'install': if (!INST) return installBox(); INST.prompt(); try { await INST.userChoice; } catch (e) { /* 취소 */ } INST = null; return installBox();
      case 'page': S.page = +v; await home(); return g.scrollTo(0, 0);
      case 'delP': { const q = await MV.getProject(v); if (q && confirm(`「${q.title || '제목 없음'}」을(를) 지울까요?\n(이 뮤비에 넣은 노래 · 영상도 BK뮤드 안에서 지워져요)`)) { await MV.delProject(q); home(); } return; }
      case 'go': return go(v);
      case 'open': sheetClose(); if (el && el.dataset.next && p.step === 4) { p.fxSeen = 1; save(); } return go(v);
      case 'hub': return toHub();
      case 'sheetX': sheetClose(); if (S.view === 'stage' && p.step === 1) render(); return;
      case 'sub': S.subs[p.step] = +v; renderStage(); { const b = document.querySelector('.subbar'); if (b) b.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return;
      case 'pp': return S.player.toggle();
      /* 1 */
      case 'pickSong': { const [f] = await pickFiles('audio/*,.mp3,.m4a,.wav'); if (f) await setSong(f, f.name); return; }
      case 'musicBox': return showMusicBox();
      case 'boxPick': { const o = S.box[+v]; if (o) await setSong(o.blob, o.name || (o.title + '.mp3'), o.lyrics, o.title); return; }
      case 'lyrApply': { p.lyricsRaw = $('fLyr').value; const r = applyLyrics(); save(); render(); return toast(r.lines.length ? `📝 가사 ${r.lines.length}줄${r.timed ? ' · 시간도 같이 들어갔어요' : ''}` : '가사가 비어 있어요'); }
      case 'lyrAI': p.lyricsRaw = $('fLyr').value; save(); return lyrAISheet();
      case 'lyrAIgo': sheetClose(); return copyOpen(lyrAIText(), 'https://gemini.google.com/app', '📋 복사했어요 · Gemini에서 ✏️ 새 채팅 → 예전 글 지우기 → ＋ MP3 → 붙여넣기 → 보내기');
      case 'lyrClear': { if (!confirm('가사 칸과 들어 있는 가사를 모두 비울까요? (맞춘 자막 시간도 지워져요)')) return; p.lyricsRaw = ''; p.lines = []; S.tapK = 0; save(); if (S.player) S.player.refresh(); render(); return toast('🧹 가사 칸을 비웠어요'); }
      case 'ratio': p.ratio = v; await S.player.setProject(p, S.song); save(); return render();
      /* 2 */
      case 'clipLen': if (p.locked) return toast('🔒 잠겨 있어요'); if (p.scenes.some(s => s.file) && !confirm('장면 길이를 바꾸면 장면 칸 수가 바뀌어요. 넣은 영상은 앞에서부터 그대로 둘게요. 바꿀까요?')) return; p.clipLen = +v; p.scenes = MV.planScenes(p); save(); return render();
      case 'mode': { if (p.locked) return toast('🔒 잠겨 있어요'); const was = p.mode; p.mode = v; if (v === 'video' && ![8, 10, 16, 20, 24, 30].includes(p.clipLen)) p.clipLen = 8; const n0 = p.scenes.length; const nw = MV.planScenes(Object.assign({}, p, { scenes: [] })).length;
        if (nw < n0 && p.scenes.slice(nw).some(x => x.file) && !confirm(`장면이 ${n0}개 → ${nw}개로 줄어요. 뒤쪽에 넣은 그림 · 영상은 빠져요. 바꿀까요?`)) { p.mode = was; return render(); } p.scenes = MV.planScenes(p); save(); return render(); }
      case 'picN': { if (p.locked) return toast('🔒 잠겨 있어요'); const n = clamp(p.scenes.length + +v, 2, 200); if (n < p.scenes.length && p.scenes[p.scenes.length - 1].file && !confirm(`${p.scenes.length}번 칸의 그림이 빠져요. 줄일까요?`)) return; p.picN = n; p.scenes = MV.planScenes(p); save(); render(); if (n > 20 && +v > 0) toast('⚠️ 20장이 넘으면 ChatGPT 한도에 걸릴 수 있어요 · 후렴은 ♻ 다시 쓰기를 써 보세요', 4500); return; }
      case 'gptOpen': return g.open(GPT_URL, '_blank');
      case 'gemDraw': { const k = clamp(p.cpNext || 0, 0, p.scenes.length - 1); return copyOpen(sceneText(k), GEM_URL, `📋 장면 ${k + 1} 글 복사 · Gemini 그림에는 ✦ 마크가 들어가요`); }
      case 'heroShare': { const bl = await MV.getFile(p.look.heroImg); if (!bl) return toast('주인공 사진이 없어요'); const t = heroShareText(); await MV.copy(t); try { const f2 = new File([bl], '주인공.jpg', { type: bl.type || 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f2] })) { await navigator.share({ files: [f2], text: t }); return toast('📤 ChatGPT를 고르세요 · 글이 빠졌으면 붙여넣기 (복사해 뒀어요)', 5000); } } catch (e) { if (e && e.name === 'AbortError') return; } return toast('이 휴대폰은 바로 보내기가 안 돼요 · ⬇ 저장 후 ChatGPT에서 ＋로 올리고 붙여넣기', 5000); }
      case 'scShare': { const k = clamp(p.cpNext || 0, 0, p.scenes.length - 1), bl = await MV.getFile(p.look.heroImg); const t = sceneText(k) + '\n(첨부한 사진 속 주인공과 같은 얼굴 · 머리 · 옷으로)'; await MV.copy(t); p.scenes[k].cp = 1; p.cpNext = Math.min(k + 1, p.scenes.length - 1); save(); render();
        try { const f2 = new File([bl], '주인공.jpg', { type: bl.type || 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f2] })) await navigator.share({ files: [f2], text: t }); else toast('📋 글을 복사했어요 · 사진은 ChatGPT에서 ＋로 올려 주세요', 4000); } catch (e) { /* 취소 */ } return; }
      case 'heroTab': p.look.heroTab = v; save(); return render();
      case 'heroDesc': { const bl = await MV.getFile(p.look.heroImg); if (!bl) return; const t = heroDescText(); await MV.copy(t); try { const f2 = new File([bl], '주인공.jpg', { type: bl.type || 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f2] })) { await navigator.share({ files: [f2], text: t }); return toast('📤 Gemini를 고르세요 · 받은 한 줄을 「주인공 설명」 칸에 붙여넣기', 5000); } } catch (e) { if (e && e.name === 'AbortError') return; } return copyOpen(t, GEM_URL, '📋 복사했어요 · Gemini에서 ＋로 사진 올리고 붙여넣기'); }
      case 'heroLib': { const list = await MV.libList(); if (!list.length) return toast('🗂 보관함이 비어 있어요', 3000); return sheet('🗂 보관함에서 주인공 고르기', `<div class="libGrid big">${list.filter(o => o.kind === 'image').map(o => `<button type="button" data-a="heroLibGo" data-v="${esc(o.id)}">${o.th ? `<img src="${o.th}" alt="">` : '🖼'}</button>`).join('')}</div>`); }
      case 'heroLibGo': { sheetClose(); const f2 = await MV.libGet(v); if (!f2) return; return setHero(f2); }
      case 'heroScene': { const list = p.scenes.map((x, i) => [x, i]).filter(a2 => a2[0].file && a2[0].kind === 'image'); if (!list.length) return toast('그림을 넣은 장면이 아직 없어요'); return sheet('🖼 장면 그림에서 주인공 고르기', `<div class="libGrid big">${list.map(([x, i]) => `<button type="button" data-a="heroSceneGo" data-v="${i}"><img src="${x.thumb}" alt=""><b>${i + 1}</b></button>`).join('')}</div>`); }
      case 'heroSceneGo': { sheetClose(); const bl = await MV.getFile(p.scenes[+v].file); if (bl) return setHero(bl); return; }
      case 'style': p.look.style = v; save(); return render();
      case 'planAI': if (p.look.heroImg) { const t = planAIText(), bl = await MV.getFile(p.look.heroImg); await MV.copy(t); try { const f2 = new File([bl], '주인공.jpg', { type: bl.type || 'image/jpeg' }); if (navigator.canShare && navigator.canShare({ files: [f2] })) { await navigator.share({ files: [f2], text: t }); return toast('📤 Gemini를 고르세요 · 글이 빠졌으면 붙여넣기', 5000); } } catch (e) { if (e && e.name === 'AbortError') return; } }
        return copyOpen(planAIText(), GEM_URL, '📋 요청 글을 복사했어요 · Gemini에 붙여넣고 보내기');
      case 'planIn': { const n = parsePlan($('fPlan').value); save(); render(); return toast(n ? `✅ 장면 글 ${n}개를 넣었어요` : '⚠️ 「S1: …」 모양의 줄을 못 찾았어요', 3500); }
      case 'flow': return g.open(FLOW_URL, '_blank');
      case 'win': return winOpen(v, false);
      case 'winGo': return winOpen(v, true);
      case 'winNext': return winOpen(S.win + 1, true);
      case 'winPlay': { const sc = p.scenes[S.win]; return S.player.play(Math.max(0, sc.s - (S.win ? .2 : 0)), sc.e + .25); }
      case 'winX': return winClose();
      case 'scDel': if (p.locked) return toast('🔒 잠겨 있어요'); if (pinned(+v)) return; if (!confirm(`장면 ${+v + 1}의 사진 · 영상을 뺄까요? (칸과 시간은 그대로예요)`)) return; delScene(+v); save(); if (S.win != null) { winRender(); S.player.seek(p.scenes[+v].s + .05); } else render(); return toast('🗑 뺐어요');
      case 'heroPut': { if (p.look.heroLock && !confirm('고정한 주인공 사진을 바꿀까요?')) return; const [f2] = await pickFiles('image/*'); if (!f2) return; return setHero(f2); }
      case 'heroLock': p.look.heroLock = v === '1'; save(); render(); return toast(v === '1' ? '🔒 이 사진으로 주인공을 고정했어요' : '🔓 고정을 풀었어요');
      case 'heroSave': { const bl = await MV.getFile(p.look.heroImg); if (!bl) return toast('사진을 찾을 수 없어요'); const u = URL.createObjectURL(bl), a2 = document.createElement('a'); a2.href = u; a2.download = (p.title || 'BK뮤드') + '_주인공.' + ((bl.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')); document.body.appendChild(a2); a2.click(); a2.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); return toast('⬇ 휴대폰에 저장했어요 · Flow 재료에서 고르세요', 4000); }
      case 'capSpeed': p.cap.speed = v; linesChanged(); return render();
      case 'kr': p.look.kr = v === '1'; save(); return render();
      case 'heroCopy': p.look.heroTab = 'make'; save(); return copyOpen(heroText(), GPT_URL, '📋 주인공 그림 글을 복사했어요 · Flow(이미지)에 붙여넣기');
      case 'planPaste': { let t = ''; try { t = await navigator.clipboard.readText(); } catch (e) { /* 직접 */ } if (!t) { toast('칸을 길게 눌러 「붙여넣기」 후 「✅ 장면 글 넣기」를 눌러 주세요', 4000); return $('fPlan').focus(); } $('fPlan').value = t; const n = parsePlan(t); save(); render(); return toast(n ? `✅ 장면 글 ${n}개를 넣었어요` : '⚠️ 장면 글(S1: …)을 못 찾았어요 · Gemini 답을 통째로 복사했는지 봐 주세요', 4000); }
      case 'cpNext': { const N = p.scenes.length; let k = clamp(p.cpNext || 0, 0, N - 1); const skipped = []; while (p.scenes[k] && p.scenes[k].reuse != null && k < N - 1) { skipped.push(k + 1); k++; }
        p.scenes[k].cp = 1; let nx = Math.min(k + 1, N - 1); while (p.scenes[nx] && p.scenes[nx].reuse != null && nx < N - 1) nx++; p.cpNext = k + 1 >= N ? k : nx; save();
        await copyOpen(sceneText(k), null, `📋 장면 ${k + 1} 글 복사${skipped.length ? ` (${skipped.join(' · ')}번은 ♻ 다시 쓰기라 건너뜀)` : ''} · ${p.mode === 'image' ? '최근 앱(|||) → ChatGPT 그림 방에 붙여넣기' : 'Flow에 붙여넣기'}${k + 1 >= N ? ' · 마지막 장면이에요' : ''}`); return render(); }
      case 'cpBack': { let k = Math.max(0, (p.cpNext || 0) - 1); while (k > 0 && p.scenes[k].reuse != null) k--; p.cpNext = k; save(); return render(); }
      case 'reuseSheet': { const i = +v, x = p.scenes[i]; if (!x) return; return sheet(`♻ 장면 ${i + 1} — 앞 그림 다시 쓰기`, `<p>이 칸은 <b>새 그림을 그리지 않고</b>, <b>장면 ${x.reuse + 1}</b> 그림을 한 번 더 써요. (후렴처럼 같은 가사가 다시 나올 때 Gemini가 정해 줘요)</p><ul class="muted" style="margin:6px 0 10px;padding-left:18px"><li>📋 글 복사할 때 이 칸은 건너뛰어요.</li><li>📥 한꺼번에 넣을 때 장면 ${x.reuse + 1} 그림이 저절로 들어가요.</li></ul><p><b>✎ 다른 장면 그림으로 바꾸기</b></p><div class="numGrid">${p.scenes.map((y, j) => j === i ? '' : `<button type="button" class="${x.reuse === j ? 'on' : ''}" data-a="reuseSet" data-v="${i}:${j}">${j + 1}</button>`).join('')}</div><div class="row" style="margin-top:12px"><button class="btn main" data-a="reuseOff" data-v="${i}">🗑 ♻ 표시 지우기 (이 장면도 새로 그리기)</button></div>`); }
      case 'reuseSet': { sheetClose(); const [i, j] = v.split(':').map(Number), x = p.scenes[i]; if (!x || !p.scenes[j]) return; if (x.auto && x.file) { x.file = null; x.kind = null; x.thumb = ''; x.name = ''; x.auto = false; } x.reuse = j; x.prompt = `♻ 장면 ${j + 1} 그림 다시 쓰기`; applyReuse(); save(); render(); return toast(`♻ 장면 ${i + 1}은 이제 장면 ${j + 1} 그림을 써요`); }
      case 'reuseOff': { sheetClose(); const x = p.scenes[+v]; if (!x) return; if (x.auto && x.file) { x.file = null; x.kind = null; x.thumb = ''; x.name = ''; } x.reuse = null; x.auto = false; x.prompt = x.prompt0 || ''; save(); render(); return toast(`♻ 풀었어요 · 장면 ${+v + 1}도 새로 그려요`); }
      case 'cpReset': if (confirm('복사 표시를 지우고 장면 1부터 다시 할까요?')) { p.scenes.forEach(s => { s.cp = 0; }); p.cpNext = 0; save(); render(); } return;
      case 'scCopy': p.scenes[+v].cp = 1; p.cpNext = Math.min(+v + 1, p.scenes.length - 1); save(); if (S.win == null) setTimeout(render, 50); return copyOpen(sceneText(+v), null, `📋 장면 ${+v + 1} 글을 복사했어요 · ${p.mode === 'image' ? 'ChatGPT 그림 방' : 'Flow'}에 붙여넣기`);
      case 'scPut': case 'scPut5': { if (a === 'scPut' && p.locked) return toast('🔒 잠겨 있어요'); if (pinned(+v)) return; const [f] = await pickFiles('video/*,image/*'); if (!f) return; await putScene(+v, f); save(); if (a === 'scPut5') editRefresh(); else if (S.win != null) winRender(); else render(); S.player.seek(p.scenes[+v].s + .05); return toast(`📂 장면 ${+v + 1}에 넣었어요 · ▶ 로 들어 보세요`); }
      case 'bulk': {
        if (p.locked) return toast('🔒 잠겨 있어요');
        const fs = (await pickFiles('video/*,image/*', true)).sort((x, y) => x.name.localeCompare(y.name, 'ko', { numeric: true })); if (!fs.length) return;
        let slots = p.scenes.map((s, i) => s.file || s.reuse != null ? -1 : i).filter(i => i >= 0);
        if (!slots.length) { if (!confirm('빈 칸이 없어요. 1번 장면부터 바꿔 넣을까요?')) return; slots = p.scenes.map((s, i) => s.reuse != null || s.pin ? -1 : i).filter(i => i >= 0); }
        toast('📥 넣는 중…', 9000); let n = 0; for (const f of fs) { if (n >= slots.length) break; await putScene(slots[n++], f); }
        applyReuse(); save(); render(); const nr = p.scenes.filter(x => x.reuse != null).length; return toast(`📥 ${n}개를 넣었어요${nr ? ` · ♻ 다시 쓰기 ${nr}칸은 저절로` : ''}${fs.length > n ? ` (칸이 모자라 ${fs.length - n}개는 빠졌어요)` : ''}`, 4500);
      }
      case 'mp4Save': if (!S.lastUrl) return; download(S.lastUrl, p.mp4.name); return toast(`📂 내 파일 → 다운로드에 「${p.mp4.name}」로 저장했어요`, 5000);
      case 'mp4Share': { try { const f2 = new File([S.lastBlob], p.mp4.name, { type: 'video/mp4' }); if (navigator.canShare && navigator.canShare({ files: [f2] })) await navigator.share({ files: [f2], title: p.title }); else toast('이 휴대폰은 바로 보내기가 안 돼요 · ⬇️ 저장 후 보내 주세요'); } catch (e) { /* 취소 */ } return; }
      case 'tray': return traySheet(null);
      case 'trayFor': if (p.locked) return toast('🔒 잠겨 있어요'); return traySheet(+v);
      case 'trayPut': { sheetClose(); const [i, fid] = [v.slice(0, v.indexOf(':')), v.slice(v.indexOf(':') + 1)]; if (pinned(+i)) return; trayPut(+i, fid); save(); if (S.p.step === 5 || S.p.step === 3) editRefresh(); else render(); return toast(`♻ 장면 ${+i + 1}에 넣었어요`); }
      case 'trayPick': { const o = trayList().find(x => x.file === v); return sheet('🗂 이 그림을 넣을 장면', `<p class="muted">지금 ${o.uses.length}번 씀 (${o.uses.join(', ')}번)</p><div class="numGrid">${p.scenes.map((x, i) => `<button type="button" class="${x.file === v ? 'on' : ''}" data-a="trayPut" data-v="${i}:${esc(v)}">${i + 1}${x.reuse != null ? '♻' : ''}${x.file && x.file !== v ? '·' : ''}</button>`).join('')}</div>`); }
      case 'libOpen': { const k = p.scenes.findIndex(x => !x.file); return libPick(k < 0 ? 0 : k); }
      case 'libTog': { const k = LIB.sel.indexOf(v); if (k >= 0) LIB.sel.splice(k, 1); else if (LIB.sel.length < LIB.max) LIB.sel.push(v); return libSheet(); }
      case 'libGo': { sheetClose(); toast('🗂 넣는 중…', 9000); let n = 0; for (const id of LIB.sel) { const k = LIB.start + n; if (!p.scenes[k]) break; const f = await MV.libGet(id); if (f) { await putScene(k, f); n++; } } save(); if (S.p.step === 5 || S.p.step === 3) editRefresh(); else render(); return toast(`🗂 ${n}개를 ${LIB.start + 1}번부터 넣었어요`); }
      case 'scPlay': { const sc = p.scenes[+v]; if (!sc) return; S.pv.scrollIntoView({ behavior: 'smooth', block: 'center' }); return S.player.play(sc.s, sc.e); }
      case 'scOk': p.scenes[+v].ok = !p.scenes[+v].ok; save(); return S.win != null ? winRender() : render();
      case 'scEdit': { const sc = p.scenes[+v], t = prompt(`장면 ${+v + 1} 글 (비우면 가사로 자동)`, sc.prompt || ''); if (t != null) { sc.prompt = t.trim(); save(); render(); } return; }
      /* 3 */
      case 'playAll': S.pv.scrollIntoView({ behavior: 'smooth', block: 'center' }); return S.player.play(0);
      case 'lkPlay': { const x = p.scenes[+v]; if (!x) return; S.lkCur = +v; S.pv.scrollIntoView({ behavior: 'smooth', block: 'start' }); return S.player.play(x.s, x.e - .02); }
      case 'lkPin': { const i = +v, x = p.scenes[i]; if (!x) return; x.pin = !x.pin; if (!x.pin) p.locked = false; save(); const y = scrollY; render(); scrollTo(0, y); return toast(x.pin ? `🔒 장면 ${i + 1} 고정 · 그림 · 시간 · 자막이 안 바뀌어요` : `🔓 장면 ${i + 1} 고정을 풀었어요`); }
      case 'lkNext': { const i = p.scenes.findIndex(x => !x.pin); if (i < 0) return toast('🎉 다 고정했어요'); const c = $('lk' + i); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); const x = p.scenes[i]; return S.player.play(x.s, x.e - .02); }
      case 'lkAll': if (!confirm('장면을 전부 고정할까요?')) return; p.scenes.forEach(x => x.pin = true); save(); render(); return toast('🔒 전부 고정했어요');
      case 'lkNone': if (!confirm('고정을 전부 풀까요?')) return; p.scenes.forEach(x => x.pin = false); p.locked = false; save(); render(); return toast('🔓 전부 풀었어요');
      case 'lockNext': { const empty = p.scenes.filter(s => !s.file).length; if (empty && !confirm(`빈 장면이 ${empty}개 있어요. 그래도 잠글까요?`)) return; p.locked = Date.now(); save(); toast('🔒 잠갔어요'); return go(4); }
      case 'unlock': if (confirm('잠금을 풀까요? 장면을 다시 바꿀 수 있게 돼요.')) { p.locked = false; save(); render(); } return;
      /* 4 */
      case 'tapStart': {
        const L = p.lines, nT = L.filter(l => l.s != null).length;
        let fresh = nT === 0;
        if (nT === L.length) { if (!confirm('처음부터 다시 맞출까요? 맞춘 시간이 지워져요.')) return; fresh = true; }
        else if (nT && !confirm('이어서 맞출까요?\n(「취소」를 누르면 처음부터 다시 맞출지 물어봐요)')) { if (!confirm('처음부터 다시 맞출까요? 맞춘 시간이 지워져요.')) return; fresh = true; }
        if (fresh) { L.forEach((l, i) => { if (!lnLocked(i)) { l.s = null; l.e = null; } }); S.tapK = Math.max(0, L.findIndex(l => l.s == null)); linesChanged(); render(); const pv = L[S.tapK - 1]; return S.player.play(pv && pv.s != null ? Math.max(0, pv.s - .5) : 0); }
        S.tapK = L.findIndex(l => l.s == null); const prev = L[S.tapK - 1]; tapShow(0); return S.player.play(prev ? Math.max(0, prev.s - .5) : 0);
      }
      case 'tap': {
        const L = p.lines, k = S.tapK; if (!S.player.playing()) { if (S.win != null) { const sc = p.scenes[S.win]; return S.player.play(Math.max(0, sc.s - (S.win ? .2 : 0)), sc.e + .25); } return S.player.play(); }
        if (k >= L.length) return toast('✅ 다 맞췄어요');
        const t = +Math.max(0, S.player.time() - .15).toFixed(2); { const x = p.scenes[MV.sceneAt(p, t)]; if (x && x.pin) return toast(`🔒 지금은 고정한 장면 ${MV.sceneAt(p, t) + 1}번 안이에요 · 고정 안 한 곳에서 톡`, 2500); } L[k].s = t; L[k].e = null; if (L[k - 1] && L[k - 1].e != null && L[k - 1].e > t) L[k - 1].e = null;
        S.tapK = k + 1; linesChanged(); winLy(); tapShow(S.player.time()); if (el) { el.style.filter = 'brightness(1.4)'; setTimeout(() => el.style.filter = '', 120); }
        if (S.tapK >= L.length) { toast('🎉 다 맞췄어요! ▶ 로 확인해 보세요', 3500); }
        return;
      }
      case 'tapBack': { const L = p.lines; if (S.tapK <= 0) return S.player.play(0); if (lnGuard(S.tapK - 1)) return; S.tapK--; L[S.tapK].s = null; L[S.tapK].e = null; linesChanged(); winLy(); const prev = L[S.tapK - 1]; tapShow(0); return S.player.play(prev ? Math.max(0, prev.s - .3) : 0); }
      case 'tapEnd': { const l = p.lines[S.tapK - 1]; if (!l || l.s == null) return toast('먼저 줄을 톡 해 주세요'); l.e = +Math.max(l.s + .3, S.player.time()).toFixed(2); linesChanged(); return toast('✋ 자막을 껐어요 · 다음 줄이 들리면 톡'); }
      case 'lnNudge': { const [i, d] = v.split(':'), l = p.lines[+i]; if (lnGuard(+i)) return; l.s = +Math.max(0, (l.s == null ? S.player.time() : l.s) + +d).toFixed(2); linesChanged(); const r = el.closest('.ln'); if (r) r.querySelector('.t').textContent = fmt(l.s), r.querySelector('.t').classList.remove('no'); return S.player.seek(Math.max(0, l.s)); }
      case 'lnNow': { if (lnGuard(+v)) return; const l = p.lines[+v]; l.s = +S.player.time().toFixed(2); linesChanged(); if (p.step === 5) return editRefresh(); return render(); }
      case 'lnPlay': { const l = p.lines[+v]; if (l.s == null) return toast('아직 시간이 없어요'); return S.player.play(Math.max(0, l.s - .8)); }
      case 'lnText': { if (lnGuard(+v)) return; const l = p.lines[+v], t = prompt('자막 글 고치기', l.t); if (t != null && t.trim()) { l.t = t.trim(); linesChanged(); if (p.step === 5) editRefresh(); else render(); } return; }
      case 'capStyle': p.cap.style = v; linesChanged(); return render();
      case 'capPos': p.cap.pos = v; linesChanged(); return render();
      case 'capSize': p.cap.size = +v; linesChanged(); return render();
      case 'capColor': p.cap.color = v; linesChanged(); return render();
      case 'capFont': p.cap.font = v; try { await document.fonts.load(`900 30px ${g.BKFX.fam(v)}`, '가나다'); } catch (e) { /* 기본 */ } linesChanged(); return render();
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
      case 'lyOff': if (lnGuard(+v)) return; if (confirm('이 줄을 자막에서 뺄까요? (3단계 ① 자막에서 다시 맞출 수 있어요)')) { p.lines[+v].s = null; p.lines[+v].e = null; S.sel = null; editRefresh(); } return;
      case 'vol': p.fx.vol = +v; S.player.audio.volume = Math.min(1, p.fx.vol); return editRefresh();
      case 'fadeOut': p.fx.fadeOut = +v; return fxRefresh();
      case 'fadeIn': p.fx.fadeIn = +v; return fxRefresh();
      case 'intro': p.fx.intro = v === '1'; return fxRefresh();
      case 'outro': p.fx.outro = v === '1'; return fxRefresh();
      case 'film': p.fx.film = v; return fxRefresh();
      case 'trans': p.fx.trans = v; return editRefresh();
      case 'zoomImg': p.fx.zoom = v === '1'; return fxRefresh();
      case 'q': S.q = +v; return render();
      case 'export': return doExport();
      case 'itMove': { const [k, i, d] = v.split(':'), it = p[k][+i]; if (k === 'sfx') it.at = +clamp(it.at + +d, 0, p.song.dur).toFixed(2); else it.start = +clamp(it.start + +d, 0, p.song.dur - .3).toFixed(2); return fxRefresh(); }
      case 'itLen': { const [k, i, d] = v.split(':'), it = p[k][+i]; it.dur = +clamp(it.dur + +d, .3, p.song.dur - it.start).toFixed(2); return fxRefresh(); }
      default: if (fxAct(a, v) !== null) return; if (MV.TL.has(a)) return MV.TL.act(a, v, el); if (MV.SONG) return MV.SONG.act(a, v, el);
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
    const p = S.p; if (!p) return; if (MV.SONG && MV.SONG.change(e)) return; if (MV.TL.change(e)) return; const id = e.target.id, v = e.target.value;
    if (id === 'fTitle' || id === 'fTitle2') { p.title = v.trim(); setTitle(p); }
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

  MV.UI = { traySheet, setSong, S, toast, save, render, renderStage, go, copyOpen, chip, applyLyrics, sheet, sheetClose, pickFiles, thumbOf, putScene, delScene, tapShow, libPick, act: (a, v, el) => act(a, v, el), get p() { return S.p; } };
  g.addEventListener('DOMContentLoaded', () => {
    $('homeBtn').addEventListener('click', () => { if (S.p && !confirm('🏠 홈(내 작품 목록)으로 갈까요?\n지금까지 한 것은 저절로 저장돼요. 「이어 만들기」로 다시 열 수 있어요.')) return; home(); });
    home();
    // 노래 미리 듣기 칸: 열 때 파일 연결
    new MutationObserver(() => { const au = $('songAu'); if (au && !au.src && S.song) { au.src = URL.createObjectURL(S.song); } }).observe($('app'), { childList: true, subtree: true });
  });
  if ('serviceWorker' in navigator) g.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
})(window);
