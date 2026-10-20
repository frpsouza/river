// render/retro.js — MODO RETRO OCEANO: PIXEL ART EM 240×320
// Mesma lógica do modo oceano, desenhada em resolução baixa de verdade (240×320, ampliada
// sem suavização pela página). Duas técnicas:
//   1. Sprites pequenos em pixel art feita à mão (procedural, com contorno escuro automático)
//      e QUADROS INTERMEDIÁRIOS para o movimento ficar fluido: o jato tem 9 quadros de
//      inclinação das asas, caças e navios 32 rotações (e os caças quadros de parafuso),
//      rotores, hélices e gomos de balão giram em quadros.
//   2. O resto (mar, ilhas, nuvens, porta-aviões, chefes, explosões) é desenhado em 1× e o
//      quadro inteiro é "pixelizado": cada pixel vai para a cor mais próxima de uma paleta fixa
//      de 32 cores, com pontilhado ordenado (Bayer 4×4) nas transparências e degradês.
// O HUD e os textos usam uma fonte bitmap 5×7 própria (sem acentos, como nos jogos antigos).
//
// Usa: todos os módulos de lógica do oceano e as funções vetoriais de render/.
'use strict';

// ---------- paleta e quantização ----------
const RPAL = ['#0c0f1c', '#26334f', '#3a3f58', '#5c6378', '#9097a8', '#c4c9d4', '#ffffff', '#d6e2f0',
  '#1d5fae', '#17498a', '#2a6fc4', '#5e9ce0', '#9fe0ff', '#4fd1e0', '#3fb6c9',
  '#22622d', '#2f7a3a', '#3f9a4a', '#7dc95e', '#e9d8a6', '#f5ecc8', '#7a5a3c',
  '#e5484d', '#b8363b', '#ff9d9a', '#ff8a3d', '#ffc93c', '#c9901c', '#ffe58a', '#fff3b0', '#3b63e0', '#2c4bb5'];
const RGBP = RPAL.map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));
const LUT = new Uint8Array(32768);                     // cor de 15 bits → índice da paleta mais próxima
for (let i = 0; i < 32768; i++) {
  const r = ((i >> 10) & 31) * 8.2, g = ((i >> 5) & 31) * 8.2, b = (i & 31) * 8.2;
  let best = 0, bd = 1e9;
  RGBP.forEach(([R, G, B], k) => { const d = (r - R) ** 2 * 0.3 + (g - G) ** 2 * 0.59 + (b - B) ** 2 * 0.11; if (d < bd) { bd = d; best = k; } });
  LUT[i] = best;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v - 7.5) * 1.5);

function quantize() {
  const img = ctx.getImageData(0, 0, W, VIEW_H), d = img.data;
  for (let y = 0, i = 0; y < VIEW_H; y++) for (let x = 0; x < W; x++, i += 4) {
    const o = BAYER[(y & 3) * 4 + (x & 3)];
    const r = clamp(d[i] + o, 0, 255), g = clamp(d[i + 1] + o, 0, 255), b = clamp(d[i + 2] + o, 0, 255);
    const c = RGBP[LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- utilidades de sprite ----------
const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// grade de caracteres → canvas; '.' é transparente. Contorno escuro automático em volta.
function gridSprite(grid, cols, outline = '#0c0f1c') {
  const h = grid.length, w = grid[0].length, c = mkCanvas(w + 2, h + 2), x = c.getContext('2d');
  const on = (gx, gy) => gy >= 0 && gy < h && gx >= 0 && gx < w && grid[gy][gx] !== '.';
  for (let y = -1; y <= h; y++) for (let X = -1; X <= w; X++) {
    if (on(X, y)) { x.fillStyle = cols[grid[y][X]]; x.fillRect(X + 1, y + 1, 1, 1); }
    else if (outline && (on(X - 1, y) || on(X + 1, y) || on(X, y - 1) || on(X, y + 1))) { x.fillStyle = outline; x.fillRect(X + 1, y + 1, 1, 1); }
  }
  return c;
}
// rotação "vizinho mais próximo" (mantém os pixels duros); sy: achatamento vertical (parafuso)
function rotSprite(src, ang, sy = 1) {
  const w = src.width, h = src.height, D = Math.ceil(Math.hypot(w, h)) + 2, out = mkCanvas(D, D);
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data, oc = out.getContext('2d'), od = oc.createImageData(D, D);
  const ca = Math.cos(-ang), sa = Math.sin(-ang);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
    const dx = x - D / 2 + 0.5, dy = y - D / 2 + 0.5;
    const ux = dx * ca - dy * sa, uy = (dx * sa + dy * ca) / (Math.abs(sy) < 0.2 ? 0.2 * Math.sign(sy || 1) : sy);
    const X = Math.floor(ux + w / 2), Y = Math.floor(uy + h / 2);
    if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
    const si = (Y * w + X) * 4, oi = (y * D + x) * 4;
    if (sd[si + 3] < 128) continue;
    od.data[oi] = sd[si]; od.data[oi + 1] = sd[si + 1]; od.data[oi + 2] = sd[si + 2]; od.data[oi + 3] = 255;
  }
  oc.putImageData(od, 0, 0);
  return out;
}
const SPR_CACHE = new Map();
const cached = (key, make) => { let s = SPR_CACHE.get(key); if (!s) { s = make(); SPR_CACHE.set(key, s); } return s; };
const blitC = (s, cx, cy) => ctx.drawImage(s, Math.round(cx - s.width / 2), Math.round(cy - s.height / 2));
const ROT = 32, angIdx = a => ((Math.round(a / (Math.PI * 2) * ROT) % ROT) + ROT) % ROT;

// ---------- jato do jogador: 9 quadros de inclinação ----------
const JET_COLS = { Y: '#ffc93c', D: '#c9901c', L: '#ffe58a', B: '#3b63e0', C: '#9fe0ff', O: '#ff8a3d', F: '#fff3b0', R: '#e5484d' };
function jetSprite(level, fl) {                       // level -4..4 (asa direita desce quando > 0)
  return cached('jet' + level + fl, () => {
    const b = level / 4, w = 17, h = 20, g = Array.from({ length: h }, () => Array(w).fill('.')), cx = 8;
    const set = (x, y, ch) => { if (x >= 0 && x < w && y >= 0 && y < h) g[y][x] = ch; };
    const spanR = Math.round(7 * (1 - 0.4 * Math.max(0, b)) * (1 + 0.15 * Math.max(0, -b)));
    const spanL = Math.round(7 * (1 - 0.4 * Math.max(0, -b)) * (1 + 0.15 * Math.max(0, b)));
    const colR = b > 0.3 ? 'D' : b < -0.3 ? 'L' : 'Y', colL = b < -0.3 ? 'D' : b > 0.3 ? 'L' : 'Y';
    // asas enflechadas (linhas 8 a 12)
    [[8, 2], [9, 4], [10, 6], [11, 7], [12, 7]].forEach(([y, reach]) => {
      for (let k = 1; k <= Math.min(reach, spanL); k++) set(cx - 1 - k, y, k === spanL && y >= 10 ? 'R' : colL);
      for (let k = 1; k <= Math.min(reach, spanR); k++) set(cx + 1 + k, y, k === spanR && y >= 10 ? 'R' : colR);
    });
    // estabilizadores (linhas 15 e 16)
    for (const y of [15, 16]) { set(cx - 2, y, colL); set(cx - 3, y, colL); set(cx + 2, y, colR); set(cx + 3, y, colR); }
    // fuselagem: claro à esquerda, sombra à direita
    for (let y = 0; y < 18; y++) {
      const hw = y < 2 ? 0 : 1;
      for (let x = cx - hw; x <= cx + hw; x++) set(x, y, x > cx ? 'D' : x < cx ? 'L' : 'Y');
    }
    const k = Math.round(b);                                     // cabine desliza para o lado da curva
    set(cx + k, 4, 'C'); set(cx + k, 5, 'B'); set(cx + k, 6, 'B');
    set(cx, 18, fl ? 'F' : 'O'); set(cx, 19, fl ? 'O' : '.');    // chama (2 quadros)
    return gridSprite(g.map(r => r.join('')), JET_COLS);
  });
}

// ---------- caça inimigo: base virada para a direita, 32 rotações × 5 quadros de parafuso ----------
const FIGHTER_GRID = [
  '....RR.......',
  '....rRR......',
  '.....rRR.....',
  'K....rrRR....',
  'KRRRRRRRRRCC.',
  'KrrrrrrrrrrrW',
  'K....PPrr....',
  '.....PPr.....',
  '....PPr......',
  '....PP.......'];
const FIGHTER_COLS = { R: '#e5484d', r: '#b8363b', P: '#ff9d9a', K: '#3a3f58', C: '#9fe0ff', W: '#ffffff' };
const fighterBase = () => cached('fighterBase', () => gridSprite(FIGHTER_GRID, FIGHTER_COLS));
function fighterSprite(ang, roll) { const a = angIdx(ang); return cached('f' + a + '_' + roll, () => rotSprite(fighterBase(), a / ROT * Math.PI * 2, [1, 0.5, 0.2, -0.5, -1][roll])); }

// ---------- navio: casco visto de cima, 32 rumos ----------
function shipBase() {
  return cached('shipBase', () => {
    const L = 41, H = 12, g = [];
    for (let y = 0; y < H; y++) {
      let row = '';
      const e = Math.abs(y - (H - 1) / 2) / ((H - 1) / 2);         // 0 no centro, 1 na borda
      const len = L - Math.round(e * e * 10);                        // proa afilada à direita
      for (let x = 0; x < L; x++) {
        if (x >= len || (x === 0 && e > 0.8)) { row += '.'; continue; }
        const deck = y > 1 && y < H - 2 && x > 1 && x < len - 3;
        row += deck ? (x > 10 && x < 20 && y > 2 && y < H - 3 ? (x === 18 ? 'K' : 'W') : 'c') : (y >= H / 2 ? 'd' : 'R');
      }
      g.push(row);
    }
    return gridSprite(g, { R: '#e5484d', d: '#b8363b', c: '#e9d8a6', W: '#ffffff', K: '#26334f' });
  });
}
const shipSprite = ang => { const a = angIdx(ang); return cached('ship' + a, () => rotSprite(shipBase(), a / ROT * Math.PI * 2)); };

// ---------- helicóptero de cima: 4 quadros de rotor ----------
function heliSprite(dir, f) {
  return cached('heli' + dir + f, () => {
    const c = mkCanvas(29, 29), x = c.getContext('2d'), cx = 14, cy = 14;
    const body = gridSprite(['..BBBBB......', '.BBCCBBBbbbbY', 'BBCCBBBBbbbbY', '.BbbbbbB.....', '..bbbbb......'],
      { B: '#3b63e0', b: '#2c4bb5', C: '#bfe3ff', Y: '#ffb547' });
    x.save(); if (dir > 0) { x.translate(29, 0); x.scale(-1, 1); } x.drawImage(body, cx - 7, cy - 3); x.restore();
    x.fillStyle = '#ffb547';                                         // pás: linhas de pixels (Bresenham simples)
    for (const off of [0, Math.PI / 2]) {
      const a = f * Math.PI / 8 + off;
      for (let r = -11; r <= 11; r++) x.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
    x.fillStyle = '#26334f'; x.fillRect(cx - 1, cy - 1, 2, 2);
    return c;
  });
}

// ---------- balão de cima: 4 quadros de gomos girando ----------
function balloonSprite(hue, f) {
  return cached('bal' + hue + f, () => {
    const r = 11, c = mkCanvas(2 * r + 3, 2 * r + 3), x = c.getContext('2d'), cx = r + 1, cy = r + 1;
    for (let y = -r; y <= r; y++) for (let X = -r; X <= r; X++) {
      const d = Math.hypot(X, y); if (d > r + 0.3) continue;
      const a = Math.atan2(y, X) + f * Math.PI / 16;
      const gore = Math.floor((a + Math.PI * 4) / (Math.PI / 4)) % 2;
      let col = gore ? '#f5f2ea' : hue ? '#ffb547' : '#e5484d';
      if (X + y > r * 0.6) col = gore ? '#c4c9d4' : hue ? '#c9901c' : '#b8363b';   // sombra embaixo/direita
      if (d > r - 0.8) col = '#0c0f1c';
      x.fillStyle = col; x.fillRect(cx + X, cy + y, 1, 1);
    }
    x.fillStyle = '#7a5a3c'; x.fillRect(cx - 2, cy - 2, 4, 4);
    return c;
  });
}

// ---------- balsa de combustível, power-ups, tiros, míssil ----------
const fuelSprite = () => cached('fuel', () => gridSprite([
  'cccccccccccccccc', 'cRRRRccccccRRRRc', 'cRrrRcccccRRrrRc', 'cRrFRcccccRRFrRc', 'cRRRRccccccRRRRc', 'cccccccccccccccc',
  'cccccccccccccccc', 'cRRRRccccccRRRRc', 'cRrrRcccccRRrrRc', 'cRrFRcccccRRFrRc', 'cRRRRccccccRRRRc', 'cccccccccccccccc'].flatMap(r => [r, r]).slice(0, 26),
  { c: '#ddd8cc', R: '#e5484d', r: '#b8363b', F: '#ffffff' }));
const PU_ICON = {
  shield: ['.#####.', '.#####.', '.#####.', '..###..', '...#...'],
  triple: ['#.#.#', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  rapid: ['..#..', '.###.', '#.#.#', '..#..', '.###.'],
  bomb: ['...#.', '.###.', '#####', '#####', '.###.'],
  life: ['..#..', '..#..', '#####', '..#..', '..#..'],
};
function puSprite(kind, lit) {
  return cached('pu' + kind + lit, () => {
    const def = PU[kind], g = [];
    for (let y = 0; y < 12; y++) {
      let row = '';
      for (let x = 0; x < 12; x++) {
        const corner = (x === 0 || x === 11) && (y === 0 || y === 11);
        if (corner) { row += '.'; continue; }
        const ic = PU_ICON[kind], iy = y - Math.floor((12 - ic.length) / 2), ix = x - Math.floor((12 - ic[0].length) / 2);   // ícone centralizado
        const icon = iy >= 0 && iy < ic.length && ix >= 0 && ix < ic[0].length && ic[iy][ix] === '#';
        row += icon ? 'W' : lit && (x === 1 || y === 1) ? 'L' : x >= 6 ? 'd' : 'c';
      }
      g.push(row);
    }
    return gridSprite(g, { c: def.col, d: def.dark, W: '#ffffff', L: '#fff3b0' });
  });
}
const bulletSprite = f => cached('bul' + f, () => gridSprite(f ? ['.rrr.', 'roOor', 'rOWOr', 'roOor', '.rrr.'] : ['.ooo.', 'oOOOo', 'OOWOO', 'oOOOo', '.ooo.'],
  { r: '#e5484d', o: '#ff8a3d', O: '#ffc93c', W: '#ffffff' }, '#26334f'));

// ---------- fonte bitmap 5×7 ----------
const FONT = {
  'A': '.###.|#...#|#...#|#####|#...#|#...#|#...#', 'B': '####.|#...#|#...#|####.|#...#|#...#|####.', 'C': '.###.|#...#|#....|#....|#....|#...#|.###.',
  'D': '####.|#...#|#...#|#...#|#...#|#...#|####.', 'E': '#####|#....|#....|####.|#....|#....|#####', 'F': '#####|#....|#....|####.|#....|#....|#....',
  'G': '.###.|#...#|#....|#.###|#...#|#...#|.####', 'H': '#...#|#...#|#...#|#####|#...#|#...#|#...#', 'I': '.###.|..#..|..#..|..#..|..#..|..#..|.###.',
  'J': '..###|...#.|...#.|...#.|#..#.|#..#.|.##..', 'K': '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', 'L': '#....|#....|#....|#....|#....|#....|#####',
  'M': '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', 'N': '#...#|##..#|#.#.#|#..##|#...#|#...#|#...#', 'O': '.###.|#...#|#...#|#...#|#...#|#...#|.###.',
  'P': '####.|#...#|#...#|####.|#....|#....|#....', 'Q': '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', 'R': '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
  'S': '.####|#....|#....|.###.|....#|....#|####.', 'T': '#####|..#..|..#..|..#..|..#..|..#..|..#..', 'U': '#...#|#...#|#...#|#...#|#...#|#...#|.###.',
  'V': '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..', 'W': '#...#|#...#|#...#|#.#.#|#.#.#|#.#.#|.#.#.', 'X': '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
  'Y': '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', 'Z': '#####|....#|...#.|..#..|.#...|#....|#####',
  '0': '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', '1': '..#..|.##..|..#..|..#..|..#..|..#..|.###.', '2': '.###.|#...#|....#|...#.|..#..|.#...|#####',
  '3': '####.|....#|....#|.###.|....#|....#|####.', '4': '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', '5': '#####|#....|####.|....#|....#|#...#|.###.',
  '6': '.###.|#....|#....|####.|#...#|#...#|.###.', '7': '#####|....#|...#.|..#..|.#...|.#...|.#...', '8': '.###.|#...#|#...#|.###.|#...#|#...#|.###.',
  '9': '.###.|#...#|#...#|.####|....#|....#|.###.', ' ': '.....|.....|.....|.....|.....|.....|.....', '.': '.....|.....|.....|.....|.....|.##..|.##..',
  '!': '..#..|..#..|..#..|..#..|..#..|.....|..#..', '+': '.....|..#..|..#..|#####|..#..|..#..|.....', '-': '.....|.....|.....|#####|.....|.....|.....',
  ':': '.....|.##..|.##..|.....|.##..|.##..|.....', '(': '...#.|..#..|.#...|.#...|.#...|..#..|...#.', ')': '.#...|..#..|...#.|...#.|...#.|..#..|.#...',
  '/': '....#|....#|...#.|..#..|.#...|#....|#....', '%': '##..#|##.#.|...#.|..#..|.#...|.#.##|#..##', '·': '.....|.....|.....|..#..|.....|.....|.....',
  '▲': '.....|..#..|.###.|#####|.....|.....|.....', '▼': '.....|.....|#####|.###.|..#..|.....|.....', '♥': '.....|.#.#.|#####|#####|.###.|..#..|.....',
  '×': '.....|#...#|.#.#.|..#..|.#.#.|#...#|.....',
};
const fontKey = ch => { const c = ch.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return FONT[c] ? c : c === '—' ? '-' : ' '; };
function ptext(str, x, y, col = '#ffffff', align = 'left', shadow = '#0c0f1c') {
  const chars = [...String(str)].map(fontKey), wpx = chars.length * 6 - 1;
  let sx = Math.round(align === 'center' ? x - wpx / 2 : align === 'right' ? x - wpx : x);
  for (const pass of shadow ? [1, 0] : [0]) {
    ctx.fillStyle = pass ? shadow : col;
    chars.forEach((c, k) => FONT[c].split('|').forEach((row, ry) => {
      for (let rx = 0; rx < 5; rx++) if (row[rx] === '#') ctx.fillRect(sx + k * 6 + rx + pass, y + ry + pass, 1, 1);
    }));
  }
  return wpx;
}
const prect = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// ---------- quadro completo ----------
function drawRetro() {
  const [shx, shy] = shakeXY();                                   // tremor de tela (bomba)
  ctx.setTransform(1, 0, 0, 1, shx, shy); ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = OCEAN_WATER; ctx.fillRect(-20, -20, W + 40, VIEW_H + 40);
  const zs = 1 - 0.28 * smooth(altT), ext = VIEW_H * (1 / zs - 1) / 2;
  if (zs < 1) { ctx.save(); ctx.translate(W / 2, VIEW_H / 2); ctx.scale(zs, zs); ctx.translate(-W / 2, -VIEW_H / 2); }
  const g0 = Math.max(0, Math.floor((scroll - ext) / BH) - 1), g1 = Math.floor((scroll + VIEW_H + ext) / BH) + 1;
  for (let ph = 0; ph < 6; ph++) for (let g = g0; g <= g1; g++) drawTerrain(getBlock(g), ph);
  drawCloudShadows();
  // superfície
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (sy > VIEW_H + ext || sy < -40 - ext) continue;
    const cx = o.x + o.w / 2, cy = sy + o.h / 2;
    if (o.type === 'carrier') drawCarrier(o.x, sy, o.dir, o);
    else if (o.type === 'fuel') blitC(fuelSprite(), cx, cy);
    else if (o.type === 'pu') blitC(puSprite(o.kind, frame % 30 < 6), cx, cy + Math.round(Math.sin(frame * 0.08 + o.phase) * 1.5));
    else if (o.type === 'ship') {
      const rot = -(o.hdg !== undefined ? o.hdg : (o.dir > 0 ? 0 : Math.PI));
      blitC(shipSprite(rot), cx, cy);
      const gp = shipGun(o), aim = Math.atan2(VIEW_H - py - PH / 2 - gp.y, px + PW / 2 - gp.x);
      ctx.fillStyle = '#26334f';                                       // canhão: linha de pixels mirando o jato
      for (let r = 0; r <= 6; r++) ctx.fillRect(Math.round(gp.x + Math.cos(aim) * r), Math.round(gp.y + Math.sin(aim) * r), 1, 1);
      prect(gp.x - 1, gp.y - 1, 3, 3, '#5c6378');
      if (o.gunFlash > 0) prect(gp.x + Math.cos(aim) * 8 - 1, gp.y + Math.sin(aim) * 8 - 1, 3, 3, '#fff3b0');
    }
    else if (o.type === 'heli') {
      const s = heliSprite(o.dir > 0 ? 1 : -1, (frame >> 1) % 4), k = o.alt || 1;
      ell(cx + 10 * k, cy + 12 * k, 7 * k, 3 * k, 'rgba(0,0,30,.25)');
      ctx.drawImage(s, Math.round(cx - s.width * k / 2), Math.round(cy - s.height * k / 2), Math.round(s.width * k), Math.round(s.height * k));
    }
    else if (o.type === 'balloon') { ell(cx + 14, cy + 20, 8, 4, 'rgba(0,0,30,.18)'); blitC(balloonSprite(o.hue, (frame >> 3) % 8), cx, cy); }
    else if (o.type === 'plane' && o.active) blitC(fighterSprite(o.dir > 0 ? 0 : Math.PI, 0), cx, cy);
  }
  if (zs < 1) ctx.restore();
  if (altT > 0) { ctx.fillStyle = 'rgba(205,225,245,' + (0.32 * altT).toFixed(3) + ')'; ctx.fillRect(0, 0, W, VIEW_H); drawCloudDeck(altT); drawClouds(altT, true); }
  // ar: caças (com parafuso), chefe
  for (const f of fliers) {
    if (!f.alive || f.t < 0) continue;
    const rp = (f.t + f.rollPh) % 200, roll = rp < 26 ? [0, 1, 2, 3, 4, 3, 2, 1][Math.floor(rp / 26 * 8)] : 0;
    ell(f.x + 10 + 18 * altT, f.y + 16 + 26 * altT, 6, 2, 'rgba(0,0,30,.2)');
    blitC(fighterSprite(f.ang, roll), f.x, f.y);
  }
  if (boss) drawBoss(boss);
  // tiros
  for (const sh of shells) {
    const sy = VIEW_H - (sh.Y - scroll);
    if (sh.kind) drawShell(sh, sy); else blitC(bulletSprite((frame >> 2) % 2), sh.x, sy);
  }
  for (const m of missiles) { const my = VIEW_H - (m.Y + 8 - scroll); prect(m.x, my, 2, 7, pw.rapid > 0 ? '#ffe58a' : '#ffc93c'); prect(m.x, my, 2, 2, '#ffffff'); }
  // jato
  if (state === 'play') {
    ell(px + PW / 2 + 7 + 22 * altT, VIEW_H - py - PH * 0.35 + 9 + 34 * altT, PW * 0.4, 3, 'rgba(0,0,30,.25)');
    if (!((safeT > 0 || hurtT > 0) && frame % 10 < 5)) {
      const mp = maneuverPose(), js = jetSprite(clamp(Math.round(bank * 4), -4, 4), frame % 4 < 2 ? 1 : 0);
      const jcx = Math.round(px + PW / 2), jcy = Math.round(VIEW_H - py - PH / 2 + mp.dy);
      ctx.save(); ctx.translate(jcx, jcy); ctx.scale(mp.sx * mp.s, mp.sy * mp.s);   // looping / mergulho
      ctx.drawImage(js, -Math.round(js.width / 2), -Math.round(js.height / 2)); ctx.restore();
    }
    drawShield(px + PW / 2, VIEW_H - py - PH / 2);
  }
  fxNoLabel = true; fx.forEach(drawExplosion); fxNoLabel = false;
  drawClouds(1 - altT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  quantize();                                                     // tudo vira paleta de 32 cores + pontilhado
  drawRetroHud();
}

// ---------- HUD em pixel (depois da quantização, cores puras da paleta) ----------
function drawRetroHud() {
  // rótulos dos efeitos (power-ups, bônus): fonte bitmap subindo
  for (const e of fx) if (e.label) {
    const age = e.life - e.t; if (age > e.life * 0.8 && frame % 4 < 2) continue;
    ptext(e.label, e.x, Math.round(VIEW_H - (e.y - scroll) - 18 - age * 0.45), e.labelCol, 'center');
  }
  // HUD embaixo: placar à esquerda, vida no meio, bombas à direita (6 por linha; mais linhas para cima)
  const by = VIEW_H - 11, PER = 6, nb = Math.max(bombs, 1), rows = Math.ceil(nb / PER);
  prect(0, by - 2, W, 13, 'rgba(12,15,28,.7)');
  for (let r = 1; r < rows; r++) { const cnt = Math.min(PER, nb - r * PER); prect(W - 6 - cnt * 9, by - 2 - r * 11, cnt * 9 + 6, 11, 'rgba(12,15,28,.7)'); }
  ptext(String(score).padStart(6, '0'), 3, by, '#ffffff');
  // bombas: alinhadas à direita, a contagem sobe de linha
  for (let i = 0; i < nb; i++) {
    const r = Math.floor(i / PER), k = i % PER, bx = W - 8 - k * 9, y = by + 1 - r * 11, on = i < bombs;
    prect(bx - 3, y, 7, 6, on ? '#e5484d' : '#3a3f58'); prect(bx - 2, y - 1, 5, 8, on ? '#e5484d' : '#3a3f58');
    prect(bx - 2, y + 1, 2, 2, on ? '#ff9d9a' : '#5c6378'); prect(bx + 1, y - 3, 1, 2, '#f5ecc8');
  }
  // vida: entre o placar e as bombas da linha de baixo
  const f = hp / 100, hx = 50, hw = Math.max(30, W - hx - 12 - Math.min(PER, nb) * 9);
  ptext('♥', hx - 9, by, '#e5484d');
  prect(hx, by + 1, hw + 2, 6, '#0c0f1c'); prect(hx + 1, by + 2, hw, 4, '#26334f');
  if (f > 0) prect(hx + 1, by + 2, Math.max(1, hw * f), 4, f > 0.5 ? '#3f9a4a' : f > 0.25 ? '#ffc93c' : (frame % 20 < 10 ? '#e5484d' : '#ff9d9a'));
  if (f > 0) prect(hx + 1, by + 2, Math.max(1, hw * f), 1, '#ffffff');
  // modo e altitude, acima do placar
  ptext('RETRO ' + (altTarget ? '▲ HIGH' : '▼ LOW'), 3, by - 11, '#4fd1e0');
  // power-ups ativos, acima da barra de vida
  let ix = hx + 50;
  for (const k of ['shield', 'triple', 'rapid']) {
    if (pw[k] <= 0) continue;
    const sp = puSprite(k, false), iy = by - 4 - sp.height; ctx.drawImage(sp, ix, iy);
    prect(ix + 1, iy + sp.height, (sp.width - 2) * pw[k] / PU[k].dur, 1, PU[k].col);
    ix += sp.width + 2;
  }
  // aviso de altitude
  if (altMsg > 0 && frame % 8 < 6) { prect(W / 2 - 66, 22, 132, 12, '#0c0f1c'); ptext(altText.replace(/\s+/g, ' '), W / 2, 25, altTarget ? '#9fe0ff' : '#ffc93c', 'center', null); }
  // barra do chefe
  if (boss) {
    const B = boss, bw = W - 40, bf = Math.max(0, B.hp / B.maxHp);
    prect(20, 3, bw, 5, '#0c0f1c'); prect(21, 4, (bw - 2) * bf, 3, bf > 0.3 ? '#e5484d' : '#ff8a3d');
    const st = B.kind === 'gunship' && B.shield > 0 ? ' · SHIELD' : B.kind === 'airship' && B.turrets.some(t => t.hp > 0) ? ' · ARMORED' : B.kind === 'interceptor' && B.mode === 'dash' ? ' · UNTOUCHABLE' : '';
    ptext(BOSS_INFO[B.kind].name + st, 21, 10, '#ffffff');
  }
  // fim de jogo
  if (state === 'over') {
    prect(14, 104, W - 28, 78, '#0c0f1c'); prect(15, 105, W - 30, 76, '#26334f');
    ptext('GAME OVER', W / 2, 114, '#ffc93c', 'center');
    ptext(String(score).padStart(6, '0') + ' POINTS', W / 2, 130, '#ffffff', 'center');
    ptext('SPACE TO RETURN', W / 2, 146, '#9fe0ff', 'center');
    ptext('▲▼ SCROLL  -/+ SPEED', W / 2, 160, '#c4c9d4', 'center');
    ptext('SPEED ' + (overSpeed / 1.1).toFixed(2) + '×', W / 2, 170, '#c4c9d4', 'center');
  }
}
