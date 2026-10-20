// mountains.js — MONTANHAS DO MODO MODERNO (geração e colisão)
// No modo moderno o jato voa por cima das margens; o perigo em terra passa a ser as
// montanhas. Elas só aparecem a partir da seção MTN_FROM, e ficam mais frequentes e
// mais altas com a dificuldade.
//
// Cada montanha é um ou dois "picos" vistos de lado (como as casas): um triângulo com
// base no chão (Y do mundo) e altura h. A colisão usa esse mesmo triângulo.
//
//   genMountains(blk) ......... cria os picos de um bloco (sempre iguais para o mesmo bloco)
//   peakHit(x, Y) ............. o ponto (x, Y do mundo) está dentro de algum pico?
//   mountainHit(x0, x1, Yb, Yt)  algum ponto do jato (bico, asas, cauda) toca um pico?
//
// Usa: config.js, util.js. É chamada por genBlock() (terrain.js).
'use strict';

const MTN_FROM = 2;                                   // seção a partir da qual surgem montanhas

function genMountains(blk) {
  const peaks = [];
  if (mode !== 'modern' || blk.s < MTN_FROM || blk.bridge) return peaks;
  const r = mulberry32(blk.seed ^ 0x6d7a11);
  const d = Math.min(blk.s - MTN_FROM, 6) / 6;        // 0 → 1 nas seis seções seguintes
  for (const left of [true, false]) {
    if (r() > 0.3 + 0.45 * d) continue;
    const i0 = 2 + Math.floor(r() * 9);                 // linha da base dentro do bloco
    const h = Math.min(24 + r() * (16 + 22 * d), (LINES - 1 - i0) * LINE);
    const hw = h * (0.7 + r() * 0.35);                  // meia-largura da base
    // a base inteira precisa estar em terra
    let room = 1e9;
    for (let i = i0; i <= Math.min(LINES - 1, i0 + 4); i++)
      room = Math.min(room, left ? blk.L[i] : W - blk.R[i]);
    if (room < hw + 10) continue;
    const x = left ? r() * (room - hw - 6) : W - r() * (room - hw - 6);
    const Y = blk.g * BH + i0 * LINE;
    const side = r() < 0.5 ? -1 : 1;
    peaks.push({ x: x + side * hw * 0.55, Y: Y + 2, hw: hw * 0.6, h: h * 0.62, back: true });   // pico de trás
    peaks.push({ x, Y, hw, h });
  }
  return peaks;
}

function peakHit(x, Y) {
  const g = Math.floor(Y / BH);
  for (let k = g - 1; k <= g; k++) {
    if (k < 0 || k >= blocks.length) continue;
    for (const p of blocks[k].mtns) {
      const up = Y - p.Y;
      if (up < 0 || up > p.h) continue;
      if (Math.abs(x - p.x) <= p.hw * (1 - up / p.h)) return true;
    }
  }
  return false;
}

function mountainHit(x0, x1, Ybot, Ytop) {
  const cx = (x0 + x1) / 2, wingY = Ybot + (Ytop - Ybot) * 0.35;
  return peakHit(cx, Ytop) || peakHit(cx, Ybot + 1) || peakHit(x0 + 2, wingY) || peakHit(x1 - 2, wingY) || peakHit(cx, wingY);
}
