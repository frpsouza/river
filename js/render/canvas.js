// render/canvas.js — CANVAS E PRIMITIVAS DE DESENHO
// O canvas é desenhado em resolução 2× (SCALE) para as formas vetoriais ficarem nítidas.
//   poly, ell, rrect ... polígono, elipse e retângulo arredondado preenchidos
//   mix ................ mistura duas cores (usado no sombreamento das asas do jato)
//   PAL ................ paleta de cores da água e da terra
'use strict';

const SCALE = 2;

const cv = document.getElementById('c'), ctx = cv.getContext('2d');

cv.width = W * SCALE; cv.height = SCREEN_H * SCALE;

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
