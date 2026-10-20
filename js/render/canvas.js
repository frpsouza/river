// render/canvas.js — CANVAS E PRIMITIVAS DE DESENHO
// O canvas é desenhado em resolução 2× (SCALE) para as formas vetoriais ficarem nítidas.
//   poly, ell, rrect ... polígono, elipse e retângulo arredondado preenchidos
//   mix ................ mistura duas cores (usado no sombreamento das asas do jato)
//   PAL ................ paleta de cores da água e da terra
'use strict';

const SCALE = 2;

const cv = document.getElementById('c'), ctx = cv.getContext('2d');

cv.width = W * SCALE; cv.height = SCREEN_H * SCALE;

// O modo retro desenha em 240×320 reais (sem suavização) e a página só amplia os pixels.
// Troca o tamanho do canvas quando entra/sai do retro; a tela de título é sempre a normal.
// Idem para o PICO-8 (128×128). O oceano usa a mesma área do retro (240×320), desenhada
// em vetor a 2× (480×640). Devolve qual renderizador usar: 'retro', 'pico' ou '' (vetorial).
const SCREENS = {                                    // [w, h, css w, css h, pixelado?, renderizador]
  retro: [240, 320, 480, 640, true, 'retro'],
  pico:  [128, 128, 512, 512, true, 'pico'],
  ocean: [240 * SCALE, 320 * SCALE, 480, 640, false, ''],
};
let screenOn = null;
function syncCanvas() {
  const want = state !== 'title' && SCREENS[mode] ? mode : '';
  if (want !== screenOn) {
    screenOn = want;
    const P = SCREENS[want];
    cv.width = P ? P[0] : W_NORMAL * SCALE; cv.height = P ? P[1] : SCREEN_H * SCALE;
    const touch = document.body.classList.contains('touch');
    cv.style.width = P && !touch ? P[2] + 'px' : ''; cv.style.height = P && !touch ? P[3] + 'px' : '';
    cv.style.aspectRatio = P ? P[2] + ' / ' + P[3] : '';
    cv.style.imageRendering = P && P[4] ? 'pixelated' : '';
  }
  if (state === 'title') W = W_NORMAL;
  return want ? SCREENS[want][5] : '';
}

const mix = (c1, c2, t) => {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const ch = sh => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
};

const poly = (pts, fill) => {
  ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
};

const ell = (x, y, rx, ry, fill) => {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill();
};

const rrect = (x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
};

const PAL = {
  water: '#2b44c2',
  dark: { land: '#2f7a3a', bush: '#22622d', bushHi: '#3f9a4a' },
  light: { land: '#62b04a', bush: '#3f8d36', bushHi: '#7dc95e' },
};
