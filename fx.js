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
const EMOJI = ['😂', '🤣', '😍', '🥹', '😭', '😎', '🤩', '😱', '👍', '👏', '🙏', '❤️', '💕', '🔥', '✨', '🎉', '🎂', '🍻', '☕', '🌸', '⭐', '💯', '❗', '❓', '👉', '👆', '💰', '📍', '📞', '🎁', '🏆', '🙌'];
const BADGES = { price: ['💰 가격표', '#fde047', '#b91c1c', '9,900원'], sale: ['🔥 할인', '#dc2626', '#ffffff', '50% 할인'], new: ['🆕 NEW', '#16a34a', '#ffffff', 'NEW'], best: ['🏆 BEST', '#f59e0b', '#ffffff', 'BEST'],
  open: ['🎉 오픈', '#ec4899', '#ffffff', 'OPEN'], pin: ['📍 위치', '#ffffff', '#111827', '📍 우리 매장'], phone: ['📞 전화', '#ffffff', '#111827', '📞 010-0000-0000'], text: ['🔤 글씨 상자', '#111827', '#ffffff', '여기에 글씨'], bk: ['🅑 BK 로고', '', '', 'BK AGENT'] };
let LOGO = null;
function logo() { if (!LOGO) { LOGO = new Image(); LOGO.src = (g.BKE_BASE || '') + 'icon-192.png'; } return LOGO; }
function drawSticker(x, W, H, it, t) {
  const el = t - it.start, left = it.start + it.dur - t, p = clamp(el / .3, 0, 1);
  const sc = (.5 + .5 * back(p)) * (it.size || 1), a = Math.min(clamp(p * 3, 0, 1), clamp(left / .25, 0, 1));
  const cx = W * (it.x == null ? .5 : it.x), cy = H * (it.y == null ? .3 : it.y), base = Math.min(W, H) * .16;
  x.save(); x.globalAlpha = a; x.translate(cx, cy); x.scale(sc, sc);
  if (it.e) { x.font = `${base}px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(it.e, 0, 0); }
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
const EFX = { punch: '💥 확 줌인', shake: '🫨 흔들림', flash: '⚡ 번쩍', vignette: '🌑 가장자리 어둡게', grain: '🎞 옛날 필름', mirror: '↔️ 좌우 뒤집기', heart: '💗 하트 날리기', confetti: '🎊 꽃가루', snow: '❄️ 눈 내림', petal: '🌸 꽃잎' };
const EFX_DUR = { punch: .8, flash: .5, shake: 1 };
const rnd = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
/** 장면을 그리기 전에 화면을 움직이는 효과 (줌 · 흔들림 · 뒤집기) */
function preTransform(x, W, H, list, t) {
  for (const it of list) {
    const el = t - it.start;
    if (it.k === 'punch') { const s = 1 + .22 * easeOut(el / .18) * (1 - clamp((el - it.dur + .3) / .3, 0, 1)); x.translate(W / 2, H / 2); x.scale(s, s); x.translate(-W / 2, -H / 2); }
    else if (it.k === 'shake') { const k = Math.min(W, H) * .025 * (1 - clamp(el / it.dur, 0, 1) * .5); x.translate(Math.sin(el * 63) * k, Math.cos(el * 51) * k); }
    else if (it.k === 'mirror') { x.translate(W, 0); x.scale(-1, 1); }
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
const TRANS = { cut: '바로', fade: '스르르', black: '검은 화면', white: '하얀 번쩍', slide: '옆으로 밀기', up: '위로 밀기', zoom: '줌 확대', wipe: '닦아내기', circle: '동그랗게 열기', heart: '💗 하트로 열기', spin: '빙글', blur: '흐릿하게', glitch: '지지직' };
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
    default: P(); x.globalAlpha = e; x.drawImage(cur, 0, 0);
  }
  x.restore();
}

/* ── 🫥 모자이크 (영역을 작게 줄였다가 크게 → 네모 무늬) ── */
let MOS = null;
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

g.BKFX = { CAPS, ANIMS, COLORS, EMOJI, BADGES, EFX, EFX_DUR, FILTERS, TRANS, SFX, SFX_LEN, drawCaption, drawSticker, preTransform, overlay, transition, mosaic, sfx, loadFonts, fam };
})(window);
