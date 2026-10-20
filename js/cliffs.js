// cliffs.js — PAREDÕES DE ROCHA DO MODO MODERNO (geração e colisão)
// No modo moderno o jato voa por cima das margens, mas em alguns trechos a beira do
// rio vira um paredão de rocha alto demais para sobrevoar. O paredão acompanha a
// margem: é uma faixa de largura variável (blk.cliffL / blk.cliffR, uma por linha)
// colada na água, do lado da terra. Onde há paredão dos dois lados, o rio vira um
// cânion e o jogador é obrigado a voar sobre a água.
//
// Os paredões só aparecem a partir da seção CLIFF_FROM e ficam mais frequentes e mais
// largos com a dificuldade. Abrem-se antes de cada ponte e continuam de um bloco para
// o seguinte sem degraus (a largura final de um bloco é a inicial do próximo).
//
//   genCliffs(blk, prev) ...... calcula as faixas de um bloco (sempre iguais para o mesmo bloco)
//   cliffHit(x0, x1, Yb, Yt) .. o retângulo (do jato, de um objeto…) encosta em algum paredão?
//
// Usa: config.js, util.js. É chamada por genBlock() (terrain.js).
'use strict';

const CLIFF_FROM = 2;                                 // seção a partir da qual surgem paredões

function genCliffs(blk, prev) {
  blk.cliffL = new Float32Array(LINES); blk.cliffR = new Float32Array(LINES);
  if (mode !== 'modern' || blk.s < CLIFF_FROM) return;
  const r = mulberry32(blk.seed ^ 0x6d7a11);
  const d = Math.min(blk.s - CLIFF_FROM, 6) / 6;      // 0 → 1 nas seis seções seguintes
  const closing = blk.bridge || blk.b === BLOCKS_PER_SECTION - 2;   // abre o cânion antes da ponte
  for (const left of [true, false]) {
    const arr = left ? blk.cliffL : blk.cliffR;
    const start = prev ? (left ? prev.cliffL : prev.cliffR)[LINES - 1] : 0;
    const land = i => left ? blk.L[i] : W - blk.R[i];   // terra disponível na linha i
    let target = 0;
    const want = start > 0 ? r() < 0.75 : r() < 0.22 + 0.4 * d;   // continua um paredão ou começa outro
    const width = 14 + r() * (12 + 18 * d);
    if (!closing && want) target = Math.min(width, land(LINES - 1) - 8);
    if (target < 8) target = 0;
    const ph = r() * 6.28;
    for (let i = 0; i < LINES; i++) {
      let w = start + (target - start) * smooth(i / (LINES - 1));
      if (w < 2) { arr[i] = 0; continue; }
      // borda recortada (rocha), zero nas pontas do bloco para emendar sem degrau
      w += Math.sin(Math.PI * i / (LINES - 1)) * (Math.sin(i * 1.9 + ph) + Math.sin(i * 0.7 + ph * 2)) * 1.6 * (w / 20);
      arr[i] = clamp(w, 0, Math.max(0, land(i) - 2));
    }
  }
}

function cliffHit(x0, x1, Ybot, Ytop) {
  for (let Y = Ybot; Y <= Ytop; Y += LINE) {
    const { b, i } = lineAt(Y);
    const cl = b.cliffL[i], cr = b.cliffR[i];
    if (cl > 0 && x0 < b.L[i] && x1 > b.L[i] - cl) return true;
    if (cr > 0 && x1 > b.R[i] && x0 < b.R[i] + cr) return true;
  }
  return false;
}
