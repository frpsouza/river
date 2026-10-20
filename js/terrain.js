// terrain.js — GERAÇÃO PROCEDURAL DO RIO
// Inspirado na estrutura do jogo original: o rio é dividido em seções de 16 blocos; cada bloco
// sorteia largura e posição do rio (e às vezes uma ilha); o último bloco é a ponte.
// Os blocos são gerados sob demanda (getBlock) e guardados em `blocks`.
//
//   lineAt(Y) ...... dado um Y do mundo, devolve o bloco e a linha (0–31) correspondentes
//   genBlock(g) .... cria o bloco g, emendando suavemente com o bloco anterior
//   waterFree(...) . verdadeiro se um retângulo cabe inteiro na água (sem margem nem ilha)
//
// Usa: config.js, util.js. Chama spawnObjs() (objects.js) ao criar cada bloco.
'use strict';

let blocks, rng, seed;

function lineAt(Yw) {
  const g = Math.floor(Yw / BH);
  const b = getBlock(g);
  const i = clamp(Math.floor((Yw - g * BH) / LINE), 0, LINES - 1);
  return { b, i };
}

function getBlock(g) {
  if (g < 0) g = 0;
  while (blocks.length <= g) genBlock(blocks.length);
  return blocks[g];
}

function genBlock(g) {
  const b = g % BLOCKS_PER_SECTION, s = (g / BLOCKS_PER_SECTION) | 0;
  const prev = g > 0 ? blocks[g - 1] : { endC: W / 2, endW: 160 };
  const blk = {
    g, b, s,
    L: new Float32Array(LINES), R: new Float32Array(LINES),
    IL: new Float32Array(LINES).fill(-1), IR: new Float32Array(LINES).fill(-1),
    bridge: b === BLOCKS_PER_SECTION - 1, broken: false,
    land: s % 2 ? LAND_LIGHT : LAND_DARK,
    seed: (rng() * 4294967296) | 0, objs: [],
  };
  if (isOcean()) {                             // oceano: mar aberto, sem ponte (ocean.js)
    blk.bridge = false;
    genOceanBlock(blk);
    blocks.push(blk); genCliffs(blk, null); spawnObjs(blk);
    return blk;
  }
  let tw, tc;
  if (g === 0) { tw = 160; tc = W / 2; }
  else if (blk.bridge) { tw = 64; tc = prev.endC; }
  else {
    // id aleatório do bloco -> largura e posição do rio
    // dificuldade 0..1 (seção 0 a 8): no começo o rio é largo; trechos estreitos só aparecem depois
    const d = Math.min(s, 8) / 8;
    const wMin = 150 - 80 * d;                               // 150 px no início, 70 px na dificuldade máxima
    tw = wMin + (264 - wMin) * Math.pow(rng(), 1 + d);
    if (b === BLOCKS_PER_SECTION - 2) tw = 94;            // afunila antes da ponte
    if (b < CALM_BLOCKS) tw = Math.max(tw, 180);          // zona de respiro: largo
    // rio SIMÉTRICO: centralizado, as duas margens alargam e estreitam juntas. De vez em quando
    // um "episódio" de assimetria (1 a 3 blocos) desvia o rio para um lado e depois ele volta
    // ao centro — quebra o ritmo. Nunca na zona de respiro nem perto da ponte.
    const pa = prev.asym;
    let asym = pa && pa.left > 0 ? { left: pa.left - 1, off: pa.off } : null;
    if (!asym && b >= CALM_BLOCKS && b < BLOCKS_PER_SECTION - 3 && rng() < 0.14 + 0.12 * d)
      asym = { left: Math.floor(rng() * 3), off: (rng() < 0.5 ? -1 : 1) * (28 + rng() * 45) };
    if (b >= BLOCKS_PER_SECTION - 3) asym = null;
    blk.asym = asym;
    tc = clamp(W / 2 + (asym ? asym.off : 0), 12 + tw / 2, W - 12 - tw / 2);
    // as margens só podem andar MAXD px por bloco, para o jato conseguir seguir o rio
    const pL = prev.endC - prev.endW / 2, pR = prev.endC + prev.endW / 2;
    const open = b < CALM_BLOCKS ? 60 : MAXD;             // na zona de respiro as margens abrem mais depressa
    let tL = clamp(tc - tw / 2, pL - open, pL + MAXD), tR = clamp(tc + tw / 2, pR - MAXD, pR + open);
    if (b === BLOCKS_PER_SECTION - 2 && tR - tL > 100) { const m = (tL + tR) / 2; tL = m - 47; tR = m + 47; }
    const minW = b === BLOCKS_PER_SECTION - 2 ? 64 : Math.max(64, wMin - 2 * MAXD * 0.5);
    if (tR - tL < minW) { const m = (tL + tR) / 2; tL = m - minW / 2; tR = m + minW / 2; }
    tL = clamp(tL, 12, W - 12 - minW); tR = clamp(tR, tL + minW, W - 12);
    tc = (tL + tR) / 2; tw = tR - tL;
  }
  blk.endC = tc; blk.endW = tw;
  const t0 = blk.bridge ? 0 : 1, span = blk.bridge ? 9 : b === 0 ? 16 : 30;   // saindo da ponte, abre rápido
  for (let i = 0; i < LINES; i++) {
    const t = smooth(clamp((i - t0) / span, 0, 1));
    const c = prev.endC + (tc - prev.endC) * t;
    const w = prev.endW + (tw - prev.endW) * t;
    blk.L[i] = c - w / 2; blk.R[i] = c + w / 2;
  }
  // ilha
  // ilhas: raras no começo, mais frequentes com a dificuldade; pequenas
  const dI = Math.min(s, 8) / 8;
  if (!blk.bridge && g > 1 && b >= CALM_BLOCKS && tw >= 150 && prev.endW >= 150 && rng() < 0.1 + 0.45 * dI) {
    const maxIW = Math.min(tw, prev.endW) - 96;
    if (maxIW >= 16) {
      const iw = 16 + rng() * (Math.min(maxIW, 34 + 26 * dI) - 16);   // 16–34 px no início, até 60 px depois
      const hl = 6 + rng() * 5;                                        // meia-altura: 6–11 linhas (24–44 px)
      for (let i = Math.ceil(15.5 - hl); i <= Math.floor(15.5 + hl); i++) {
        const u = (i - 15.5) / hl;                        // elipse: cantos arredondados
        const half = iw / 2 * Math.sqrt(Math.max(0, 1 - u * u * u * u));
        const ic = (blk.L[i] + blk.R[i]) / 2;
        blk.IL[i] = ic - half; blk.IR[i] = ic + half;
      }
    }
  }
  blocks.push(blk);   // antes de gerar objetos, que consultam o próprio bloco
  genCliffs(blk, g > 0 ? blocks[g - 1] : null);       // paredões de rocha, só no modo moderno (cliffs.js)
  spawnObjs(blk);
  return blk;
}

function waterFree(x0, x1, Ybot, Ytop) {
  for (let Y = Ybot; Y <= Ytop; Y += LINE) {
    const { b, i } = lineAt(Y);
    if (x0 < b.L[i] + 2 || x1 > b.R[i] - 2) return false;
    if (b.IR[i] > b.IL[i] && x1 > b.IL[i] - 2 && x0 < b.IR[i] + 2) return false;
  }
  return true;
}

const sectionOf = y => Math.floor(y / BH / BLOCKS_PER_SECTION);
