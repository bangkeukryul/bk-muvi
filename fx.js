/*! fx.js — ✨ 효과 모음 (BK에딧 fx.js 복사 · BK쇼츠 효과를 옮긴 것)
 * 🔤 글자 스타일 13가지 · 😀 스티커 · ✨ 화면 효과 · 🎨 색감 · 🔀 장면 전환 · 🔔 효과음(프로그램이 만드는 소리) · 🫥 모자이크
 */
(function (g) {
'use strict';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const back = t => { t = clamp(t, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

/* ── 글꼴 ── */
const FONTS = { noto: '"Noto Sans KR"', blackhan: '"Black Han Sans"', jua: '"Jua"', gowunbatang: '"Gowun Batang"', nanumpen: '"Nanum Pen Script"', gaegu: '"Gaegu"', dohyeon: '"Do Hyeon"' };
const fam = id => (FONTS[id] || FONTS.noto) + ', "Noto Sans KR", sans-serif';
async function loadFonts(items) {
  const ids = new Set(['noto']); for (const it of items || []) { const s = CAPS[it.st]; if (s) ids.add(s.font); }
  const txt = (items || []).map(i => i.t || '').join('') || '가';
  try { await Promise.all([...ids].map(id => document.fonts.load(`900 60px ${FONTS[id] || FONTS.noto}`, txt.slice(0, 300)))); } catch (e) { /* 기본 글꼴 */ }
}

/* ── 🔤 글자 스타일 (BK쇼츠와 같은 13가지) ── */
const CAPS = {
  basic:    { n: '기본', font: 'noto', fill: '#ffffff', stroke: '#000000', sw: .16, y: .84, anim: 'fade' },
  variety:  { n: '예능 노랑', font: 'blackhan', fill: '#ffe14d', stroke: '#111111', sw: .22, outer: '#ff4d6d', y: .76, anim: 'pop', tilt: -3 },
  variety2: { n: '예능 분홍', font: 'jua', fill: '#ffffff', stroke: '#ff3d7f', sw: .22, y: .76, anim: 'bounce' },
  bubble:   { n: '말풍선', font: 'jua', fill: '#222222', box: 'bubble', y: .2, anim: 'pop' },
  news:     { n: '뉴스 띠', font: 'noto', fill: '#ffffff', box: 'band', y: .87, anim: 'slide' },
  box:      { n: '반투명 상자', font: 'noto', fill: '#ffffff', box: 'dark', y: .84, anim: 'fade' },
  memory:   { n: '추억 명조', font: 'gowunbatang', fill: '#fffaf0', shadow: 1, y: .8, anim: 'slowfade' },
  hand:     { n: '손글씨', font: 'nanumpen', fill: '#ffffff', shadow: 1, y: .8, anim: 'fade', big: 1.25 },
  cute:     { n: '귀여운', font: 'gaegu', fill: '#ffffff', stroke: '#ff8fb1', sw: .2, y: .8, anim: 'bounce' },
  neon:     { n: '네온', font: 'dohyeon', fill: '#e0fbff', glow: '#22d3ee', y: .8, anim: 'fade' },
  typing:   { n: '타자기', font: 'noto', fill: '#ffffff', box: 'dark', y: .84, anim: 'type' },
  cinema:   { n: '영화 자막', font: 'noto', fill: '#ffffff', shadow: 1, y: .9, anim: 'fade', small: .78 },
  price:    { n: '가격 강조', font: 'blackhan', fill: '#ffffff', box: 'red', y: .78, anim: 'pop' },
};
const ANIMS = { '': '스타일대로', fade: '스르르', pop: '톡 튀어나옴', bounce: '통통', slide: '옆에서 쓱', slowfade: '천천히', type: '한 글자씩', none: '그대로' };
const COLORS = { '': '스타일대로', '#ffffff': '⚪ 흰색', '#ffe14d': '🟡 노랑', '#ff4d6d': '🔴 빨강', '#ff8fb1': '🩷 분홍', '#7dd3fc': '🔵 하늘', '#86efac': '🟢 연두', '#111111': '⚫ 검정' };
function wrap(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) { let line = ''; for (const ch of para) { const t = line + ch; if (x.measureText(t).width > maxW && line) { out.push(line); line = ch; } else line = t; } out.push(line); }
  return out;
}
function rrect(x, a, b, w, h, r) { x.beginPath(); if (x.roundRect) x.roundRect(a, b, w, h, r); else x.rect(a, b, w, h); }
function drawCaption(x, W, H, it, t) {
  if (!it.t || !it.t.trim()) return;
  const S = CAPS[it.st] || CAPS.basic, anim = it.anim || S.anim, el = t - it.start, left = it.start + it.dur - t;
  const fs = Math.round(Math.min(W, H) * .078 * (it.size || 1) * (S.big || 1) * (S.small || 1)), lh = fs * 1.3;
  let text = it.t;
  if (anim === 'type') { const n = Math.floor(clamp(el / Math.max(.4, text.length * .06), 0, 1) * text.length); text = text.slice(0, Math.max(1, n)); }
  x.save(); x.font = `900 ${fs}px ${fam(S.font)}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  const L = wrap(x, text, W * .86), cx = W * (it.x == null ? .5 : it.x), cy = H * (it.y == null ? S.y : it.y) - (L.length - 1) * lh / 2;
  let a = Math.min(1, clamp(left / .25, 0, 1)), sc = 1, dx = 0, dy = 0;
  const p = clamp(el / (anim === 'slowfade' ? 1 : .35), 0, 1);
  if (anim === 'fade' || anim === 'slowfade' || anim === 'type') a *= p;
  else if (anim === 'pop') { sc = .55 + .45 * back(p); a *= clamp(p * 3, 0, 1); }
  else if (anim === 'bounce') { dy = -Math.abs(Math.sin(el * 5)) * fs * .18 * clamp(1.6 - el, 0, 1); a *= clamp(p * 3, 0, 1); }
  else if (anim === 'slide') { dx = (1 - easeOut(p)) * W * .4; a *= p; }
  x.globalAlpha = a; x.translate(cx + dx, cy + (L.length - 1) * lh / 2 + dy); x.scale(sc, sc); if (S.tilt) x.rotate(S.tilt * Math.PI / 180); x.translate(-cx, -(cy + (L.length - 1) * lh / 2));
  const tw = Math.max(...L.map(l => x.measureText(l).width)), bh = L.length * lh + fs * .45, bx = cx - tw / 2 - fs * .5, by = cy - lh / 2 - fs * .22;
  if (S.box === 'band') { x.fillStyle = 'rgba(17,24,39,.88)'; x.fillRect(0, by, W, bh); x.fillStyle = '#e11d48'; x.fillRect(0, by, fs * .35, bh); }
  else if (S.box === 'dark') { x.fillStyle = 'rgba(0,0,0,.62)'; rrect(x, bx, by, tw + fs, bh, fs * .3); x.fill(); }
  else if (S.box === 'red') { x.fillStyle = '#dc2626'; rrect(x, bx, by, tw + fs, bh, fs * .3); x.fill(); }
  else if (S.box === 'bubble') { x.fillStyle = '#ffffff'; rrect(x, bx, by, tw + fs, bh, fs * .6); x.fill(); x.beginPath(); x.moveTo(cx - fs * .4, by + bh - 2); x.lineTo(cx, by + bh + fs * .55); x.lineTo(cx + fs * .3, by + bh - 2); x.fill(); }
  const fill = it.col || S.fill;
  L.forEach((l, i) => {
    const y = cy + i * lh;
    if (S.glow) { x.shadowColor = S.glow; x.shadowBlur = fs * .6; x.fillStyle = fill; x.fillText(l, cx, y); x.fillText(l, cx, y); x.shadowBlur = 0; }
    if (S.shadow) { x.shadowColor = 'rgba(0,0,0,.75)'; x.shadowBlur = fs * .18; x.shadowOffsetY = fs * .05; }
    x.lineJoin = 'round';
    if (S.outer) { x.lineWidth = fs * (S.sw + .14); x.strokeStyle = S.outer; x.strokeText(l, cx, y); }
    if (S.stroke) { x.lineWidth = fs * S.sw; x.strokeStyle = S.stroke; x.strokeText(l, cx, y); }
    x.fillStyle = fill; x.fillText(l, cx, y); x.shadowBlur = 0; x.shadowOffsetY = 0;
  });
  x.restore();
}

/* ── 😀 스티커 ── */
const EMOJI = ['😂', '🤣', '😍', '🥹', '😭', '😎', '🤩', '😱', '👍', '👏', '🙏', '❤️', '💕', '🔥', '✨', '🎉', '🎂', '🍻', '☕', '🌸', '⭐', '💯', '❗', '❓', '👉', '👆', '💰', '📍', '📞', '🎁', '🏆', '🙌',
  /* 🖥 PC에서 더한 이모지 */
  '🥰', '😘', '🤗', '😊', '😇', '🥳', '😢', '🤔', '💪', '🤝', '👋', '✌️', '💖', '💗', '💝', '🧡', '💛', '💚', '💙', '💜', '🌹', '🌷', '🌻', '🌼', '🍀', '🌈', '☀️', '🌙', '❄️', '🎵', '🎶', '🎤',
  '🎸', '🎹', '🥁', '🎺', '🎊', '🎈', '🎀', '🎆', '🎇', '💐', '🍰', '🥂', '🍾', '🏠', '🚗', '✈️', '📸', '💌', '🙇', '👑', '💎', '🌟', '💫', '⚡', '👀', '💬', '🆗', '✅', '⭕', '❌'];
/* 🎨 꾸밈 스티커 — 프로그램이 직접 그림 (인터넷 없이 · 저작권 걱정 없이). [이름, 글씨 넣기?, 기본 글씨] */
const DECOR = { heart: ['❤️ 빨간 하트'], hearts: ['💕 하트 셋'], flower: ['🌸 분홍 꽃'], sunflower: ['🌻 해바라기'], sparkle: ['✨ 반짝이'], star: ['⭐ 금빛 별'], crown: ['👑 왕관'], balloon: ['🎈 풍선'],
  confetti: ['🎉 꽃가루 팡'], notes: ['🎵 음표'], arrow: ['➡️ 빨간 화살표'], ring: ['⭕ 강조 동그라미'],
  bubble: ['💬 말풍선', 1, '사랑해요'], think: ['💭 생각 풍선', 1, '보고 싶다…'], ribbon: ['🎀 리본 띠', 1, '축하합니다'], bang: ['💥 팡! 글씨', 1, '최고!'] };
/* 🌀 스티커 움직임 */
const MOTIONS = { '': '그대로', bounce: '통통', twinkle: '반짝반짝', shake: '흔들흔들', float: '둥실둥실', spin: '빙글빙글', beat: '두근두근' };
function motion(x, mo, el, base) {
  if (mo === 'bounce') x.translate(0, -Math.abs(Math.sin(el * 5)) * base * .25);
  else if (mo === 'twinkle') { const s = 1 + .12 * Math.sin(el * 9); x.scale(s, s); x.globalAlpha *= .7 + .3 * (.5 + .5 * Math.sin(el * 9)); }
  else if (mo === 'shake') x.rotate(Math.sin(el * 14) * .14);
  else if (mo === 'float') x.translate(Math.sin(el * 1.6) * base * .08, Math.sin(el * 2.2) * base * .12);
  else if (mo === 'spin') x.rotate(el * 2.4);
  else if (mo === 'beat') { const ph = (el % .8) / .8, s = 1 + .14 * Math.max(0, Math.sin(ph * Math.PI * 2)) * (ph < .5 ? 1 : 0); x.scale(s, s); }
}
function petal5(x, r, col, mid) { x.fillStyle = col; for (let i = 0; i < 5; i++) { x.save(); x.rotate(i * Math.PI * 2 / 5); x.beginPath(); x.ellipse(0, -r * .55, r * .32, r * .5, 0, 0, 7); x.fill(); x.restore(); } x.fillStyle = mid; x.beginPath(); x.arc(0, 0, r * .26, 0, 7); x.fill(); }
function spark4(x, r) { x.beginPath(); x.moveTo(0, -r); x.quadraticCurveTo(r * .12, -r * .12, r, 0); x.quadraticCurveTo(r * .12, r * .12, 0, r); x.quadraticCurveTo(-r * .12, r * .12, -r, 0); x.quadraticCurveTo(-r * .12, -r * .12, 0, -r); x.fill(); }
function drawDecor(x, k, s, txt, el) {
  x.lineJoin = 'round'; x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = s * .08;
  const textIn = (t, fs, col, y = 0, f = 'jua') => { x.shadowBlur = 0; x.font = `${fs}px ${fam(f)}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(t, 0, y); };
  switch (k) {
    case 'heart': { const g2 = x.createLinearGradient(0, -s * .6, 0, s * .4); g2.addColorStop(0, '#ff5a7a'); g2.addColorStop(1, '#d6123c'); x.fillStyle = g2; heartPath(x, 0, s * .05, s * .62); x.fill(); x.shadowBlur = 0; x.fillStyle = '#ffffff88'; x.beginPath(); x.ellipse(-s * .2, -s * .22, s * .09, s * .05, -.6, 0, 7); x.fill(); break; }
    case 'hearts': [[-s * .38, s * .1, .36, '#ff7aa8'], [s * .3, -s * .18, .3, '#ff4f86'], [s * .05, s * .32, .24, '#ffb3cd']].forEach(([hx, hy, r, c]) => { x.fillStyle = c; heartPath(x, hx, hy, s * r); x.fill(); }); break;
    case 'flower': petal5(x, s * .62, '#ff8fb8', '#ffd84d'); break;
    case 'sunflower': { x.fillStyle = '#ffc61a'; for (let i = 0; i < 14; i++) { x.save(); x.rotate(i * Math.PI / 7); x.beginPath(); x.ellipse(0, -s * .42, s * .1, s * .22, 0, 0, 7); x.fill(); x.restore(); } x.fillStyle = '#6b3d13'; x.beginPath(); x.arc(0, 0, s * .26, 0, 7); x.fill(); break; }
    case 'sparkle': x.fillStyle = '#fff8c4'; spark4(x, s * .55); x.fillStyle = '#fff'; x.save(); x.translate(s * .45, -s * .35); spark4(x, s * .2); x.restore(); x.save(); x.translate(-s * .4, s * .38); spark4(x, s * .14); x.restore(); break;
    case 'star': { const g2 = x.createRadialGradient(0, -s * .1, 0, 0, 0, s * .6); g2.addColorStop(0, '#fff1a8'); g2.addColorStop(1, '#f5b301'); x.fillStyle = g2; starPath(x, 0, 0, s * .6); x.fill(); x.shadowBlur = 0; x.lineWidth = s * .04; x.strokeStyle = '#d18b00'; x.stroke(); break; }
    case 'crown': { x.fillStyle = '#f7c325'; x.beginPath(); x.moveTo(-s * .55, s * .3); x.lineTo(-s * .55, -s * .25); x.lineTo(-s * .28, s * .02); x.lineTo(0, -s * .4); x.lineTo(s * .28, s * .02); x.lineTo(s * .55, -s * .25); x.lineTo(s * .55, s * .3); x.closePath(); x.fill(); x.shadowBlur = 0; x.fillStyle = '#e1342f'; [[-s * .3, s * .17], [0, s * .17], [s * .3, s * .17]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, s * .07, 0, 7); x.fill(); }); break; }
    case 'balloon': { x.strokeStyle = '#555'; x.lineWidth = s * .02; x.beginPath(); x.moveTo(0, s * .25); x.quadraticCurveTo(s * .1, s * .5, -s * .05, s * .75); x.stroke(); x.fillStyle = '#ff3b4e'; x.beginPath(); x.ellipse(0, -s * .15, s * .34, s * .42, 0, 0, 7); x.fill(); x.shadowBlur = 0; x.fillStyle = '#ffffff77'; x.beginPath(); x.ellipse(-s * .12, -s * .32, s * .06, s * .1, -.4, 0, 7); x.fill(); break; }
    case 'confetti': { const C = ['#ff4f86', '#ffc61a', '#4fc3ff', '#7c3aed', '#22c55e', '#ff8a3d']; x.shadowBlur = 0; for (let i = 0; i < 22; i++) { const a = i * 2.4, d = s * (.15 + .5 * ((i * 37 % 11) / 11)) * Math.min(1, .3 + el * 3); x.save(); x.translate(Math.cos(a) * d, Math.sin(a) * d); x.rotate(a + el * 4); x.fillStyle = C[i % 6]; x.fillRect(-s * .05, -s * .025, s * .1, s * .05); x.restore(); } break; }
    case 'notes': { x.fillStyle = '#7c3aed'; x.font = `900 ${s * .9}px "Segoe UI Symbol",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('♪', -s * .25, s * .05); x.fillStyle = '#ec4899'; x.fillText('♫', s * .28, -s * .1); break; }
    case 'arrow': { x.fillStyle = '#ef2b2b'; x.beginPath(); x.moveTo(-s * .55, -s * .12); x.lineTo(s * .1, -s * .12); x.lineTo(s * .1, -s * .32); x.lineTo(s * .6, 0); x.lineTo(s * .1, s * .32); x.lineTo(s * .1, s * .12); x.lineTo(-s * .55, s * .12); x.closePath(); x.fill(); break; }
    case 'ring': { x.shadowBlur = 0; x.strokeStyle = '#ff2d2d'; x.lineWidth = s * .08; x.beginPath(); x.ellipse(0, 0, s * .62, s * .45, -.08, .2, Math.PI * 2 + .05); x.stroke(); break; }
    case 'bubble': case 'think': {
      const t = txt || DECOR[k][2], fs = s * .3; x.font = `${fs}px ${fam('jua')}`; const w = Math.max(s * .9, x.measureText(t).width + fs * 1.4), h = fs * 2.1;
      x.fillStyle = '#fff'; x.strokeStyle = '#1e1b4b'; x.lineWidth = s * .035;
      if (k === 'bubble') { rrect(x, -w / 2, -h / 2, w, h, h * .45); x.fill(); x.stroke(); x.beginPath(); x.moveTo(-w * .2, h / 2 - x.lineWidth); x.lineTo(-w * .3, h / 2 + fs * .8); x.lineTo(-w * .02, h / 2 - x.lineWidth); x.fill(); x.stroke(); }
      else { x.beginPath(); x.ellipse(0, 0, w / 2, h / 2 * 1.05, 0, 0, 7); x.fill(); x.stroke(); [[-w * .32, h * .7, fs * .3], [-w * .42, h * 1.0, fs * .17]].forEach(([a, b, r]) => { x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); x.stroke(); }); }
      textIn(t, fs, '#1e1b4b', fs * .05); break; }
    case 'ribbon': {
      const t = txt || DECOR[k][2], fs = s * .3; x.font = `${fs}px ${fam('jua')}`; const w = x.measureText(t).width + fs * 2, h = fs * 1.7;
      x.fillStyle = '#c81e5a'; [[-1], [1]].forEach(([d]) => { x.beginPath(); x.moveTo(d * w / 2, -h * .3); x.lineTo(d * (w / 2 + fs * 1.1), -h * .3); x.lineTo(d * (w / 2 + fs * .7), h * .2); x.lineTo(d * (w / 2 + fs * 1.1), h * .7); x.lineTo(d * w / 2, h * .7); x.closePath(); x.fill(); });
      x.fillStyle = '#ff4f86'; rrect(x, -w / 2, -h / 2, w, h, h * .15); x.fill(); textIn(t, fs, '#fff', fs * .05); break; }
    case 'bang': {
      const t = txt || DECOR[k][2], fs = s * .34; x.font = `${fs}px ${fam('blackhan')}`; const r = Math.max(s * .6, x.measureText(t).width * .75 + fs * .5);
      x.fillStyle = '#ffe14d'; x.strokeStyle = '#e1342f'; x.lineWidth = s * .05; x.beginPath(); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12, rr = i % 2 ? r * .72 : r; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * .72); } x.closePath(); x.fill(); x.stroke();
      textIn(t, fs, '#e1342f', fs * .05, 'blackhan'); break; }
  }
}
const BADGES = { price: ['💰 가격표', '#fde047', '#b91c1c', '9,900원'], sale: ['🔥 할인', '#dc2626', '#ffffff', '50% 할인'], new: ['🆕 NEW', '#16a34a', '#ffffff', 'NEW'], best: ['🏆 BEST', '#f59e0b', '#ffffff', 'BEST'],
  open: ['🎉 오픈', '#ec4899', '#ffffff', 'OPEN'], pin: ['📍 위치', '#ffffff', '#111827', '📍 우리 매장'], phone: ['📞 전화', '#ffffff', '#111827', '📞 010-0000-0000'], text: ['🔤 글씨 상자', '#111827', '#ffffff', '여기에 글씨'], bk: ['🅑 BK 로고', '', '', 'BK AGENT'] };
let LOGO = null;
function logo() { if (!LOGO) { LOGO = new Image(); LOGO.src = (g.BKE_BASE || '') + 'icon-192.png'; } return LOGO; }
function drawSticker(x, W, H, it, t) {
  const el = t - it.start, left = it.start + it.dur - t, p = clamp(el / .3, 0, 1);
  const sc = (.5 + .5 * back(p)) * (it.size || 1), a = Math.min(clamp(p * 3, 0, 1), clamp(left / .25, 0, 1));
  let px0 = it.x == null ? .5 : it.x, py0 = it.y == null ? .3 : it.y;
  if (it.path && it.path.length) {   // 🎯 사람 따라가기 · 📍 위치 기억: 시간마다 자리를 부드럽게 이어서
    const P = it.path, L = P[P.length - 1];
    if (t <= P[0][0]) { px0 = P[0][1]; py0 = P[0][2]; } else if (t >= L[0]) { px0 = L[1]; py0 = L[2]; }
    else { let i = 1; while (i < P.length && P[i][0] < t) i++; const a = P[i - 1], b = P[i], k = (t - a[0]) / Math.max(1e-3, b[0] - a[0]); px0 = a[1] + (b[1] - a[1]) * k; py0 = a[2] + (b[2] - a[2]) * k; }
  }
  const cx = W * px0, cy = H * py0, base = Math.min(W, H) * .16;
  x.save(); x.globalAlpha = a; x.translate(cx, cy); x.scale(sc, sc);
  if (it.mo) motion(x, it.mo, el, base);
  if (it.d) drawDecor(x, it.d, base * 1.25, it.t, el);
  else if (it.e) { x.font = `${base}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.e, 0, 0); }
  else if (it.b === 'bk') { const im = logo(), s2 = base * 1.3; if (im.complete && im.naturalWidth) { x.save(); rrect(x, -s2 / 2, -s2 / 2, s2, s2, s2 * .22); x.clip(); x.drawImage(im, -s2 / 2, -s2 / 2, s2, s2); x.restore(); } }
  else {
    const B = BADGES[it.b] || BADGES.text, fs = base * .42, label = it.t || B[3];
    x.font = `900 ${fs}px ${fam(it.b === 'price' || it.b === 'sale' ? 'blackhan' : 'noto')}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const w = x.measureText(label).width + fs * 1.2, h = fs * 1.7;
    x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = fs * .3; x.fillStyle = B[1]; rrect(x, -w / 2, -h / 2, w, h, h * .3); x.fill(); x.shadowBlur = 0;
    if (it.b === 'price') { x.lineWidth = fs * .12; x.strokeStyle = '#b91c1c'; x.stroke(); }
    x.fillStyle = B[2]; x.fillText(label, 0, fs * .05);
  }
  x.restore();
}

/* ── ✨ 화면 효과 ── */
const EFX = { punch: '💥 확 줌인', shake: '🫨 흔들림', flash: '⚡ 번쩍', vignette: '🌑 가장자리 어둡게', grain: '🎞 옛날 필름', mirror: '↔️ 좌우 뒤집기', heart: '💗 하트 날리기', confetti: '🎊 꽃가루', snow: '❄️ 눈 내림', petal: '🌸 꽃잎', slowzoom: '🔭 천천히 다가가기', lightleak: '🌅 빛 번짐', bokeh: '🫧 보케 불빛', rain: '🌧 비 내림', stars: '🌟 별 반짝', glow: '💡 뽀얀 빛', heartbeat: '💓 두근 줌', bars: '🎞 영화 띠' };
const EFX_DUR = { punch: .8, flash: .5, shake: 1 };
const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** 장면을 그리기 전에 화면을 움직이는 효과 (줌 · 흔들림 · 뒤집기) */
function preTransform(x, W, H, list, t) {
  for (const it of list) {
    const el = t - it.start;
    if (it.k === 'punch') { const s = 1 + .22 * easeOut(el / .18) * (1 - clamp((el - it.dur + .3) / .3, 0, 1)); x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2); }
    else if (it.k === 'shake') { const k = Math.min(W, H) * .025 * (1 - clamp(el / it.dur, 0, 1) * .5); x.translate(Math.sin(el * 63) * k, Math.cos(el * 51) * k); }
    else if (it.k === 'mirror') { x.translate(W, 0); x.scale(-1, 1); }
    else if (it.k === 'slowzoom') { const s2 = 1 + .12 * clamp(el / Math.max(.5, it.dur), 0, 1); x.translate(W / 2, H / 2); x.scale(s2, s2); x.translate(-W / 2, -H / 2); }
    else if (it.k === 'heartbeat') { const ph = (el % .8) / .8, s2 = 1 + .05 * Math.max(0, Math.sin(ph * Math.PI * 2)) * (ph < .5 ? 1 : 0); x.translate(W / 2, H / 2); x.scale(s2, s2); x.translate(-W / 2, -H / 2); }
  }
}
let NOISE = null;
function noise() { if (NOISE) return NOISE; NOISE = document.createElement('canvas'); NOISE.width = NOISE.height = 160; const c = NOISE.getContext('2d'), d = c.createImageData(160, 160); for (let i = 0; i < d.data.length; i += 4) { const v = Math.random() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 40; } c.putImageData(d, 0, 0); return NOISE; }
/** 장면 위에 덮는 효과 (번쩍 · 테두리 · 필름 · 날리기) */
function overlay(x, W, H, it, t) {
  const el = t - it.start, a = Math.min(clamp(el / .3, 0, 1), clamp((it.start + it.dur - t) / .3, 0, 1));
  x.save();
  if (it.k === 'flash') { x.globalAlpha = clamp(1 - el / .45, 0, 1); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); }
  else if (it.k === 'vignette') { const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .3, W / 2, H / 2, Math.hypot(W, H) * .62); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${.75 * a})`); x.fillStyle = gr; x.fillRect(0, 0, W, H); }
  else if (it.k === 'grain') {
    x.globalAlpha = a; x.globalCompositeOperation = 'multiply'; x.fillStyle = 'rgba(180,140,80,.35)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    const n = noise(), f = Math.floor(t * 24); x.globalAlpha = .55 * a; x.drawImage(n, -(rnd(f) * 80), -(rnd(f + 9) * 80), W + 160, H + 160);
    x.globalAlpha = .35 * a; x.strokeStyle = '#fff'; x.lineWidth = 1.5; for (let i = 0; i < 2; i++) { const sx = rnd(f * 3 + i) * W; x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + 4, H); x.stroke(); }
  }
  else if (it.k === 'lightleak') { x.globalAlpha = .55 * a; x.globalCompositeOperation = 'screen'; const cx = W * (.2 + .6 * (.5 + .5 * Math.sin(el * .7))), gr = x.createRadialGradient(cx, H * .3, 0, cx, H * .3, Math.max(W, H) * .7); gr.addColorStop(0, 'rgba(255,170,90,.9)'); gr.addColorStop(.5, 'rgba(255,90,120,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
  else if (it.k === 'glow') { x.globalAlpha = .35 * a; x.globalCompositeOperation = 'screen'; x.fillStyle = 'rgba(255,240,230,.6)'; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; }
  else if (it.k === 'bars') { const bh = H * .11 * a; x.fillStyle = '#000'; x.fillRect(0, 0, W, bh); x.fillRect(0, H - bh, W, bh); }
  else if (it.k === 'bokeh') { x.globalCompositeOperation = 'screen'; for (let i = 0; i < 18; i++) { const px = (rnd(i * 3) + Math.sin(el * .3 + i) * .03) * W, py = ((rnd(i * 7) - el * .02 * (1 + rnd(i))) % 1 + 1) % 1 * H, r = Math.min(W, H) * (.03 + rnd(i * 5) * .06); const gr = x.createRadialGradient(px, py, 0, px, py, r); gr.addColorStop(0, `rgba(255,${200 + Math.round(rnd(i) * 55)},150,${.5 * a})`); gr.addColorStop(1, 'rgba(255,220,150,0)'); x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill(); } x.globalCompositeOperation = 'source-over'; }
  else if (it.k === 'rain') { x.globalAlpha = .5 * a; x.strokeStyle = '#dbeafe'; x.lineWidth = Math.max(1, W / 400); for (let i = 0; i < 70; i++) { const px = rnd(i * 13) * W, py = ((rnd(i * 5) + el * (1.2 + rnd(i))) % 1) * H, l = H * .05; x.beginPath(); x.moveTo(px, py); x.lineTo(px - l * .2, py + l); x.stroke(); } x.fillStyle = 'rgba(30,41,59,.18)'; x.fillRect(0, 0, W, H); }
  else if (it.k === 'stars') { x.textAlign = 'center'; x.textBaseline = 'middle'; for (let i = 0; i < 16; i++) { const tw = .5 + .5 * Math.sin(el * 4 + i * 1.7); x.globalAlpha = a * tw; x.font = `${Math.min(W, H) * (.03 + rnd(i * 9) * .03)}px "Noto Color Emoji",sans-serif`; x.fillText('✨', rnd(i * 11) * W, rnd(i * 17) * H * .7); } }
  else if (it.k === 'heart' || it.k === 'confetti' || it.k === 'snow' || it.k === 'petal') {
    const N = it.k === 'snow' ? 40 : 26, up = it.k === 'heart', sz = Math.min(W, H) * (it.k === 'snow' ? .022 : .05), cols = ['#ff4d6d', '#ffe14d', '#7dd3fc', '#86efac', '#c4b5fd', '#fdba74'];
    x.globalAlpha = a; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let i = 0; i < N; i++) {
      const sp = .12 + rnd(i * 7) * .2, ph = rnd(i * 3), yy = ((ph + el * sp) % 1.15) - .08, px = (rnd(i * 11) + Math.sin(el * (1 + rnd(i)) + i) * .04) * W, py = (up ? 1 - yy : yy) * H;
      if (it.k === 'heart') { x.font = `${sz * (1 + rnd(i * 5))}px "Noto Color Emoji",sans-serif`; x.fillText('💗', px, py); }
      else if (it.k === 'petal') { x.font = `${sz * (.8 + rnd(i * 5) * .6)}px "Noto Color Emoji",sans-serif`; x.fillText('🌸', px, py); }
      else if (it.k === 'snow') { x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, sz * (.4 + rnd(i * 5)), 0, 7); x.fill(); }
      else { x.save(); x.translate(px, py); x.rotate(el * 3 + i); x.fillStyle = cols[i % cols.length]; x.fillRect(-sz * .3, -sz * .15, sz * .6, sz * .3); x.restore(); }
    }
  }
  x.restore();
}

/* ── 🎨 색감 ── */
const FILTERS = { none: ['원본', ''], warm: ['따뜻하게', 'sepia(.22) saturate(1.18) brightness(1.04)'], old: ['옛날 사진', 'sepia(.6) contrast(.94) brightness(1.03) saturate(.75)'], bw: ['흑백', 'grayscale(1) contrast(1.12)'],
  vivid: ['선명하게', 'saturate(1.45) contrast(1.08)'], cool: ['시원하게', 'saturate(1.1) hue-rotate(-12deg) brightness(1.04)'], film: ['필름 감성', 'contrast(1.1) saturate(.85) sepia(.15)'], soft: ['뽀얗게', 'brightness(1.1) contrast(.9) saturate(.95)'], dark: ['어둡고 진하게', 'brightness(.88) contrast(1.15)'] };

/* ── 🔀 장면 전환 (들어오는 장면에 붙어요) ── */
const TRANS = { cut: '바로', fade: '스르르', black: '검은 화면', white: '하얀 번쩍', slide: '옆으로 밀기', up: '위로 밀기', zoom: '줌 확대', wipe: '닦아내기', circle: '동그랗게 열기', heart: '💗 하트로 열기', spin: '빙글', blur: '흐릿하게', glitch: '지지직',
  /* 🖥 BK뮤비 PC에서 더한 전환 */
  slideL: '왼쪽에서 밀기', down: '아래로 밀기', push: '밀어내기', pushUp: '위로 밀어내기', zoomIn: '작게→크게', wipeL: '왼쪽으로 닦기', wipeUp: '위로 닦기', diag: '대각선 닦기',
  circleOut: '동그랗게 닫기', star: '⭐ 별로 열기', diamond: '💎 마름모 열기', blinds: '가로 블라인드', vblinds: '세로 블라인드', shutter: '셔터 열기', doors: '문 열기',
  bolt: '⚡ 번쩍', lightleak: '🌅 빛 번짐', rgb: '🌈 색 갈라짐', pixel: '▦ 모자이크', flip: '뒤집기', bounce: '통통 떨어지기', squares: '네모 조각', dissolve: '모래알', filmburn: '🎞 필름 타기', sparkle: '✨ 반짝 나타나기' };
/* 장르 · 분위기 묶음 (자동으로 맞추기 · 장르 스타일에서 씀) */
const TRANS_SETS = { soft: ['fade', 'blur', 'lightleak', 'dissolve', 'zoomIn', 'sparkle'], fun: ['slide', 'slideL', 'push', 'bounce', 'spin', 'flip', 'squares', 'star'], strong: ['bolt', 'white', 'glitch', 'rgb', 'zoom', 'shutter', 'pushUp'], classic: ['fade', 'black', 'wipe', 'circle', 'filmburn', 'doors'] };
function starPath(x, cx, cy, r) { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); }
function heartPath(x, cx, cy, s) { x.beginPath(); x.moveTo(cx, cy + s * .35); x.bezierCurveTo(cx - s * 1.1, cy - s * .35, cx - s * .45, cy - s * 1.05, cx, cy - s * .45); x.bezierCurveTo(cx + s * .45, cy - s * 1.05, cx + s * 1.1, cy - s * .35, cx, cy + s * .35); x.closePath(); }
/** prev: 앞 장면 마지막 그림(없으면 검은 화면) · cur: 이번 장면 그림 · p: 0→1 */
function transition(x, W, H, kind, prev, cur, p) {
  const e = easeOut(p);
  const P = () => { if (prev) x.drawImage(prev, 0, 0, W, H); else { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); } };
  x.save();
  switch (kind) {
    case 'black': case 'white': { const c = kind === 'black' ? '#000' : '#fff'; if (p < .5) { P(); x.globalAlpha = p * 2; } else { x.drawImage(cur, 0, 0); x.globalAlpha = (1 - p) * 2; } x.fillStyle = c; x.fillRect(0, 0, W, H); break; }
    case 'slide': P(); x.drawImage(cur, (1 - e) * W, 0); break;
    case 'up': P(); x.drawImage(cur, 0, (1 - e) * H); break;
    case 'zoom': { P(); x.globalAlpha = e; const s = 1.35 - .35 * e; x.translate(W / 2, H / 2); x.scale(s, s); x.drawImage(cur, -W / 2, -H / 2); break; }
    case 'wipe': P(); x.beginPath(); x.rect(0, 0, W * e, H); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'circle': P(); x.beginPath(); x.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * e, 0, 7); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'heart': P(); heartPath(x, W / 2, H / 2, Math.max(W, H) * 1.15 * e); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'spin': { P(); x.globalAlpha = e; x.translate(W / 2, H / 2); x.rotate((1 - e) * Math.PI); x.scale(.2 + .8 * e, .2 + .8 * e); x.drawImage(cur, -W / 2, -H / 2); break; }
    case 'blur': { P(); x.globalAlpha = e; x.filter = `blur(${Math.round((1 - e) * 24)}px)`; x.drawImage(cur, 0, 0); break; }
    case 'glitch': { const n = 14, hh = H / n; for (let i = 0; i < n; i++) { const src = rnd(i + Math.floor(p * 20) * 3) < p ? cur : (prev || cur), off = (rnd(i * 9 + Math.floor(p * 30)) - .5) * W * .12 * (1 - p); x.drawImage(src, 0, i * hh, W, hh, off, i * hh, W, hh); } break; }
    /* ── 🖥 BK뮤비 PC에서 더한 전환 ── */
    case 'slideL': P(); x.drawImage(cur, -(1 - e) * W, 0); break;
    case 'down': P(); x.drawImage(cur, 0, -(1 - e) * H); break;
    case 'push': if (prev) x.drawImage(prev, -e * W, 0, W, H); x.drawImage(cur, (1 - e) * W, 0); break;
    case 'pushUp': if (prev) x.drawImage(prev, 0, -e * H, W, H); x.drawImage(cur, 0, (1 - e) * H); break;
    case 'zoomIn': { P(); x.globalAlpha = e; const s = .6 + .4 * e; x.translate(W / 2, H / 2); x.scale(s, s); x.drawImage(cur, -W / 2, -H / 2); break; }
    case 'wipeL': P(); x.beginPath(); x.rect(W * (1 - e), 0, W * e, H); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'wipeUp': P(); x.beginPath(); x.rect(0, H * (1 - e), W, H * e); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'diag': { P(); const d = (W + H) * e; x.beginPath(); x.moveTo(0, 0); x.lineTo(d, 0); x.lineTo(d - H, H); x.lineTo(0, H); x.closePath(); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'circleOut': { x.drawImage(cur, 0, 0); if (prev) { x.beginPath(); x.arc(W / 2, H / 2, Math.hypot(W, H) / 2 * (1 - e), 0, 7); x.clip(); x.drawImage(prev, 0, 0, W, H); } break; }
    case 'star': P(); starPath(x, W / 2, H / 2, Math.max(W, H) * 1.3 * e); x.clip(); x.drawImage(cur, 0, 0); break;
    case 'diamond': { P(); const r = (W + H) * .6 * e; x.beginPath(); x.moveTo(W / 2, H / 2 - r); x.lineTo(W / 2 + r, H / 2); x.lineTo(W / 2, H / 2 + r); x.lineTo(W / 2 - r, H / 2); x.closePath(); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'blinds': { P(); const n = 10, hh = H / n; x.beginPath(); for (let i = 0; i < n; i++) x.rect(0, i * hh, W, hh * e); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'vblinds': { P(); const n = 12, ww = W / n; x.beginPath(); for (let i = 0; i < n; i++) x.rect(i * ww, 0, ww * e, H); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'shutter': { P(); const hw = W / 2 * e; x.beginPath(); x.rect(W / 2 - hw, 0, hw * 2, H); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'doors': { x.drawImage(cur, 0, 0); if (prev) { const o = W / 2 * e; x.drawImage(prev, 0, 0, W / 2, H, -o, 0, W / 2, H); x.drawImage(prev, W / 2, 0, W / 2, H, W / 2 + o, 0, W / 2, H); } break; }
    case 'bolt': { if (p < .35) P(); else x.drawImage(cur, 0, 0); const k = 1 - Math.abs(p - .35) / .65; x.globalAlpha = clamp(k * 1.2, 0, 1); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); break; }
    case 'lightleak': { P(); x.globalAlpha = e; x.drawImage(cur, 0, 0); x.globalAlpha = Math.sin(p * Math.PI) * .85; x.globalCompositeOperation = 'screen'; const gx = W * (-.3 + 1.6 * p), gr = x.createRadialGradient(gx, H * .4, 0, gx, H * .4, Math.max(W, H) * .7); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(.35, '#ffb36b'); gr.addColorStop(.7, '#ff5e8a55'); gr.addColorStop(1, '#0000'); x.fillStyle = gr; x.fillRect(0, 0, W, H); break; }
    case 'rgb': { const src = p < .5 ? (prev || cur) : cur, k = Math.sin(p * Math.PI) * W * .03; x.globalCompositeOperation = 'lighter'; x.globalAlpha = .55; x.drawImage(src, -k, 0, W, H); x.drawImage(src, k, 0, W, H); x.globalAlpha = .6; x.drawImage(src, 0, k * .5, W, H); break; }
    case 'pixel': { const src = p < .5 ? (prev || cur) : cur, b = Math.max(1, Math.round(Math.sin(p * Math.PI) * 40)); if (b <= 1) { x.drawImage(src, 0, 0, W, H); break; } const sw = Math.max(1, Math.round(W / b)), sh = Math.max(1, Math.round(H / b)); if (!PIX || PIX.width !== sw || PIX.height !== sh) { PIX = document.createElement('canvas'); PIX.width = sw; PIX.height = sh; } PIX.getContext('2d').drawImage(src, 0, 0, sw, sh); x.imageSmoothingEnabled = false; x.drawImage(PIX, 0, 0, W, H); x.imageSmoothingEnabled = true; break; }
    case 'flip': { const half = p < .5, s = Math.abs(Math.cos(p * Math.PI)); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.translate(W / 2, 0); x.scale(Math.max(.001, s), 1); x.drawImage(half ? (prev || cur) : cur, -W / 2, 0, W, H); break; }
    case 'bounce': { P(); const b = p < .6 ? (p / .6) ** 2 : 1 - Math.sin((p - .6) / .4 * Math.PI) * .12 * (1 - p); x.drawImage(cur, 0, -(1 - Math.min(1, b)) * H + (b > 1 ? 0 : 0)); break; }
    case 'squares': { P(); const n = 8, m = Math.ceil(n * H / W), cw = W / n, ch = H / m; x.beginPath(); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (rnd(i * 31 + j * 7) < p * 1.15) x.rect(i * cw, j * ch, cw + 1, ch + 1); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'dissolve': { P(); const n = 40, m = Math.ceil(n * H / W), cw = W / n, ch = H / m; x.beginPath(); for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) if (rnd(i * 131 + j * 17 + 5) < p * 1.05) x.rect(i * cw, j * ch, cw + 1, ch + 1); x.clip(); x.drawImage(cur, 0, 0); break; }
    case 'filmburn': { P(); x.globalAlpha = clamp((p - .3) / .5, 0, 1); x.drawImage(cur, 0, 0); x.globalAlpha = Math.sin(p * Math.PI); x.globalCompositeOperation = 'screen'; const gr = x.createRadialGradient(W * .75, H * .2, 0, W * .75, H * .2, Math.max(W, H) * (.3 + p)); gr.addColorStop(0, '#fffbe6'); gr.addColorStop(.4, '#ff9a3c'); gr.addColorStop(1, '#a3120000'); x.fillStyle = gr; x.fillRect(0, 0, W, H); break; }
    case 'sparkle': { P(); x.globalAlpha = e; x.drawImage(cur, 0, 0); x.globalAlpha = Math.sin(p * Math.PI); x.fillStyle = '#fff'; for (let i = 0; i < 26; i++) { const sx = rnd(i * 3 + 1) * W, sy = rnd(i * 7 + 2) * H, r = Math.min(W, H) * (.008 + rnd(i) * .018) * (1 + Math.sin(p * 12 + i)); x.beginPath(); x.moveTo(sx, sy - r * 2); x.lineTo(sx + r * .4, sy); x.lineTo(sx, sy + r * 2); x.lineTo(sx - r * .4, sy); x.closePath(); x.fill(); x.beginPath(); x.moveTo(sx - r * 2, sy); x.lineTo(sx, sy + r * .4); x.lineTo(sx + r * 2, sy); x.lineTo(sx, sy - r * .4); x.closePath(); x.fill(); } break; }
    default: P(); x.globalAlpha = e; x.drawImage(cur, 0, 0);
  }
  x.restore();
}

/* ── 🫥 모자이크 (영역을 작게 줄였다가 크게 → 네모 무늬) ── */
let MOS = null, PIX = null;
function mosaic(x, W, H, it) {
  const w = Math.max(8, W * (it.w || .3)), h = Math.max(8, H * (it.h || .18)), sx = clamp(W * (it.x == null ? .5 : it.x) - w / 2, 0, W - w), sy = clamp(H * (it.y == null ? .4 : it.y) - h / 2, 0, H - h);
  const blk = Math.max(4, Math.round(Math.min(W, H) * (it.px || .03)));
  if (!MOS) MOS = document.createElement('canvas');
  MOS.width = Math.max(1, Math.round(w / blk)); MOS.height = Math.max(1, Math.round(h / blk));
  const m = MOS.getContext('2d'); m.imageSmoothingEnabled = true; m.drawImage(x.canvas, sx, sy, w, h, 0, 0, MOS.width, MOS.height);
  x.save(); x.imageSmoothingEnabled = false; x.drawImage(MOS, 0, 0, MOS.width, MOS.height, sx, sy, w, h); x.restore();
}

/* ── 🔔 효과음 (프로그램이 직접 만드는 소리 — 저작권 걱정 없음 · BK쇼츠와 같은 소리) ── */
const SFX = { clap: '👏 박수', boing: '🌀 띠용', pop: '💥 뿅', dun: '🥁 두둥', ding: '🔔 딩동댕', buzz: '❌ 땡', whoosh: '💨 휙', tada: '🎉 짜잔', shutter: '📸 찰칵', roll: '🥁 두구두구', sparkle: '✨ 반짝', heart: '💗 두근' };
const SFX_LEN = { clap: 1.3, boing: .9, pop: .3, dun: 1.4, ding: 1.4, buzz: .7, whoosh: .6, tada: 1.5, shutter: .2, roll: 2.5, sparkle: .8, heart: 1.2 };
function nbuf(oc, d) { const n = Math.max(1, Math.ceil(oc.sampleRate * d)), b = oc.createBuffer(1, n, oc.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return b; }
function env(g2, t, a, d, pk) { g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(pk, t + a); g2.gain.exponentialRampToValueAtTime(.0008, t + a + d); }
function osc(oc, dst, type, f0, f1, t, d, pk) { const o = oc.createOscillator(), g2 = oc.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + d); env(g2, t, .006, d, pk); o.connect(g2); g2.connect(dst); o.start(t); o.stop(t + d + .1); return o; }
function nz(oc, dst, t, d, pk, type, f, q) { const s = oc.createBufferSource(); s.buffer = nbuf(oc, d + .1); const fl = oc.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1500, t); fl.Q.value = q || 1; const g2 = oc.createGain(); env(g2, t, .002, d, pk); s.connect(fl); fl.connect(g2); g2.connect(dst); s.start(t); s.stop(t + d + .1); return fl; }
function sfx(oc, dst, k, t) {
  if (k === 'clap') { for (let i = 0; i < 14; i++) nz(oc, dst, t + i * .085 + rnd(i) * .04, .08, .55, 'bandpass', 1200 + rnd(i + 3) * 900, 1.3); }
  else if (k === 'boing') { const o = oc.createOscillator(), g2 = oc.createGain(), l = oc.createOscillator(), lg = oc.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(560, t + .14); o.frequency.exponentialRampToValueAtTime(170, t + .75); l.frequency.value = 14; lg.gain.value = 26; l.connect(lg); lg.connect(o.frequency); env(g2, t, .01, .75, .55); o.connect(g2); g2.connect(dst); o.start(t); l.start(t); o.stop(t + .9); l.stop(t + .9); }
  else if (k === 'pop') osc(oc, dst, 'sine', 380, 1400, t, .13, .7);
  else if (k === 'dun') { osc(oc, dst, 'sine', 130, 42, t, .45, 1); osc(oc, dst, 'sine', 120, 38, t + .38, .9, 1); nz(oc, dst, t + .38, .25, .25, 'lowpass', 400, .7); }
  else if (k === 'ding') { [[784, 0], [659, .3], [1047, .6]].forEach(([f, d]) => { osc(oc, dst, 'sine', f, 0, t + d, .7, .45); osc(oc, dst, 'sine', f * 2, 0, t + d, .35, .1); }); }
  else if (k === 'buzz') { osc(oc, dst, 'square', 140, 0, t, .55, .22); osc(oc, dst, 'sawtooth', 147, 0, t, .55, .15); }
  else if (k === 'whoosh') { const fl = nz(oc, dst, t, .5, .7, 'bandpass', 300, 1.6); fl.frequency.exponentialRampToValueAtTime(3200, t + .45); }
  else if (k === 'tada') { [523, 659, 784, 1047].forEach((f, i) => osc(oc, dst, 'triangle', f, 0, t + i * .08, i === 3 ? 1.1 : .3, .35)); [523, 659, 784].forEach(f => osc(oc, dst, 'triangle', f, 0, t + .32, 1, .18)); }
  else if (k === 'shutter') { nz(oc, dst, t, .035, .9, 'highpass', 2500, .7); nz(oc, dst, t + .09, .05, .7, 'highpass', 1800, .7); }
  else if (k === 'roll') { for (let i = 0; i < 26; i++) nz(oc, dst, t + i * .048, .045, .2 + i * .02, 'bandpass', 1800, .8); nz(oc, dst, t + 1.3, 1.1, .7, 'highpass', 4000, .5); osc(oc, dst, 'sine', 110, 50, t + 1.3, .5, .8); }
  else if (k === 'sparkle') { for (let i = 0; i < 9; i++) osc(oc, dst, 'sine', 1800 + rnd(i * 4) * 2600, 0, t + i * .055, .28, .16); }
  else if (k === 'heart') { [0, .2, .75, .95].forEach(d => osc(oc, dst, 'sine', 75, 45, t + d, .18, .9)); }
}

g.BKFX = { CAPS, ANIMS, COLORS, EMOJI, DECOR, MOTIONS, BADGES, EFX, EFX_DUR, FILTERS, TRANS, TRANS_SETS, SFX, SFX_LEN, drawCaption, drawSticker, preTransform, overlay, transition, mosaic, sfx, loadFonts, fam };
})(window);
