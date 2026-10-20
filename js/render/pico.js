// render/pico.js — MODO "CLASSIC - PICO-8": o clássico em 128×128 com a paleta de 16 cores
// A lógica é a do modo clássico rodando numa escala interna 2× (256×224 unidades); aqui tudo
// é desenhado pela metade, direto em pixels: área de jogo de 128×112 e HUD de 16 px embaixo.
// Cada linha do mapa (2 unidades) vira exatamente 1 pixel, então margens, ilhas e pontes são
// desenhadas linha a linha, nítidas. Os sprites são pixel art pequena feita à mão, só com as
// 16 cores da paleta; o jato tem 5 quadros de inclinação e o helicóptero 2 de rotor.
// Textos numa fonte 3×5 própria.
//
// Usa: lógica do clássico (terrain, objects, update…) e getDeco (render/terrain.js).
'use strict';

// paleta de 16 cores do PICO-8 (índices 0–15)
const P8 = ['#000000', '#1d2b53', '#7e2553', '#008751', '#ab5236', '#5f574f', '#c2c3c7', '#fff1e8',
            '#ff004d', '#ffa300', '#ffec27', '#00e436', '#29adff', '#83769c', '#ff77a8', '#ffccaa'];
const P8RGB = P8.map(h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)));
const p8near = hex => {                                  // cor qualquer → cor mais próxima da paleta
  const [r, g, b] = [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16) || 0);
  let best = 0, bd = 1e9;
  P8RGB.forEach(([R, G, B], k) => { const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = k; } });
  return P8[best];
};
const PICO_VIEW = 112;                                   // altura da área de jogo em pixels

const px8 = (x, y, w, h, c) => { ctx.fillStyle = P8[c]; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };

// grade de dígitos hexadecimais (índice da paleta) → canvas; '.' é transparente
function p8sprite(rows) {
  const h = rows.length, w = rows[0].length, c = mkCanvas(w, h), x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, X) => { if (ch !== '.') { x.fillStyle = P8[parseInt(ch, 16)]; x.fillRect(X, y, 1, 1); } }));
  return c;
}
const flipped = s => { const c = mkCanvas(s.width, s.height), x = c.getContext('2d'); x.translate(s.width, 0); x.scale(-1, 1); x.drawImage(s, 0, 0); return c; };
const P8C = new Map();
const p8 = (key, rows, flip) => { const k = key + (flip ? '<' : ''); let s = P8C.get(k); if (!s) { s = p8sprite(rows); if (flip) s = flipped(s); P8C.set(k, s); } return s; };
const put = (s, cx, cy) => ctx.drawImage(s, Math.round(cx - s.width / 2), Math.round(cy - s.height / 2));
const putB = (s, cx, by) => ctx.drawImage(s, Math.round(cx - s.width / 2), Math.round(by - s.height));   // apoiado no chão

// ---------- sprites (pixel art original) ----------
const PJET = {                                           // jato: 5 quadros de inclinação (-2..2)
  0: ['....a....', '....a....', '...aaa...', '...a1a...', '..aaaaa..', '.9aaaaaa.', '99aaaaaaa', '...aaa...', '..9aaa9..', '...8.8...'],
  1: ['....a....', '....a....', '...aaa...', '...aa1...', '..aaaaa..', '.aaaaaa9.', 'aaaaaaa9.', '...aaa...', '..aaa9...', '...8.8...'],
  2: ['....a....', '....a....', '...aaa...', '...aa1...', '.aaaaa9..', 'aaaaaa9..', 'aaaaaa9..', '...aa9...', '..aaa9...', '...8.8...'],
};
const jetP8 = lvl => p8('jet' + Math.abs(lvl), PJET[Math.abs(lvl)], lvl < 0);
const SHIP_P8 = ['...........0......', '.........07770.....', '..5.....0777770....', '888888888888888888.', '.88222222222222888.', '..2222222222222288..'];
const HELI_P8 = [['..aaaaaaaaaa..', '......0.......'], ['.....aaaa.....', '......0.......']];
const HELI_BODY = ['...11111......', '..1cc11111111a', '..1c11111111..', '...11111......', '...0...0......', '..0000000.....'];
const PLANE_P8 = ['...d........', '..dd........', 'd66666666667', 'd66666666667', '..dd........', '...d........'];
const HOUSE_P8 = {
  house1: ['......111.........', '....1111111.......', '..11111111111...3.', '.1111111111111.333', '..7777777776...333', '..7cc77c7776...333', '..7cc77c7776....4.', '..777774477.....4.', '..777774477.....4.'],
  house2: ['......888.........', '....8888888.......', '..88888888888...3.', '.8888888888888.333', '..7777777776...333', '..7cc77c7776...333', '..7cc77c7776....4.', '..777774477.....4.', '..777774477.....4.'],
};
const TANK_P8 = ['...333....', '..3333300.', '.33333333.', '555555555.', '.0.0.0.0..'];
const FUEL_P8 = ['.8888.', '888888', '777777', '777777', '888888', '888888', '777777', '777777', '888888', '888888', '777777', '.7777.'];
const BALLOON_P8 = [['...8888...', '..877888..', '.88777888.', '.88777888.', '.88777888.', '..877888..', '...8778...', '....78....', '...5..5...', '...5..5...', '...4444...', '...4444...'],
                    ['...9999...', '..9aa999..', '.99aaa999.', '.99aaa999.', '.99aaa999.', '..9aa999..', '...9aa9...', '....a9....', '...5..5...', '...5..5...', '...4444...', '...4444...']];
const TREE_P8 = { round: ['.t.', 'ttt', 'ttt', '.4.'], pine: ['.t.', '.t.', 'ttt', 'ttt', '.4.'] };
const treeP8 = (pine, land) => { const t = land === LAND_LIGHT ? '3' : 'b'; const key = 'tree' + pine + t; return p8(key, TREE_P8[pine ? 'pine' : 'round'].map(r => r.replace(/t/g, t))); };
const COW_P8 = ['777.', '707.', '.5.5'];

// ---------- fonte 3×5 ----------
const F35 = {
  '0': '777|505|505|505|777', '1': '220|020|020|020|777', '2': '777|005|777|500|777', '3': '777|005|077|005|777', '4': '505|505|777|005|005',
  '5': '777|500|777|005|777', '6': '777|500|777|505|777', '7': '777|005|005|005|005', '8': '777|505|777|505|777', '9': '777|505|777|005|777',
  'A': '777|505|777|505|505', 'B': '770|505|770|505|770', 'C': '777|500|500|500|777', 'D': '770|505|505|505|770', 'E': '777|500|770|500|777',
  'F': '777|500|770|500|500', 'G': '777|500|505|505|777', 'H': '505|505|777|505|505', 'I': '777|020|020|020|777', 'J': '777|020|020|020|770',
  'K': '505|505|770|505|505', 'L': '500|500|500|500|777', 'M': '777|777|505|505|505', 'N': '770|505|505|505|505', 'O': '077|505|505|505|770',
  'P': '777|505|777|500|500', 'Q': '077|505|505|770|007', 'R': '777|505|770|505|505', 'S': '077|500|777|005|770', 'T': '777|020|020|020|020',
  'U': '505|505|505|505|077', 'V': '505|505|505|777|020', 'W': '505|505|505|777|777', 'X': '505|505|020|505|505', 'Y': '505|505|777|020|777',
  'Z': '777|005|020|500|777', ' ': '000|000|000|000|000', ':': '000|020|000|020|000', '/': '005|005|020|500|500', '+': '000|020|777|020|000',
  '-': '000|000|777|000|000', '.': '000|000|000|000|020', '!': '020|020|020|000|020', '▲': '000|020|777|000|000', '▼': '000|777|020|000|000',
};
function ptxt(str, x, y, c = 7, align = 'left') {
  const s = [...String(str).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
  const w = s.length * 4 - 1;
  let sx = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
  ctx.fillStyle = P8[c];
  s.forEach((ch, k) => (F35[ch] || F35[' ']).split('|').forEach((row, ry) => [...row].forEach((v, rx) => { if (v !== '0') ctx.fillRect(sx + k * 4 + rx, y + ry, 1, 1); })));
  return w;
}

// ---------- quadro ----------
function drawPico() {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
  const sY = Y => (VIEW_H - (Y - scroll)) / 2;            // mundo → linha de pixel
  // terreno, uma linha de pixel por linha do mapa
  for (let r = 0; r < PICO_VIEW; r++) {
    const Y = scroll + VIEW_H - 2 * r - 1, { b, i } = lineAt(Y);
    const land = b.land === LAND_LIGHT ? 11 : 3, edge = b.land === LAND_LIGHT ? 3 : 1;
    const L = Math.round(b.L[i] / 2), R = Math.round(b.R[i] / 2);
    px8(0, r, 128, 1, 12);
    const gi = b.g * LINES + i, h = Math.imul(gi, 2654435761) >>> 0;   // marolas fixas por linha
    if (h % 7 === 0) { const wx = L + 3 + (h >>> 8) % Math.max(1, R - L - 8); px8(wx, r, 3, 1, 7); }
    px8(0, r, L, 1, land); px8(R, r, 128 - R, 1, land);
    px8(L - 1, r, 1, 1, edge); px8(R, r, 1, 1, edge);                  // beirada
    if (b.IR[i] > b.IL[i]) { const a = Math.round(b.IL[i] / 2), c = Math.round(b.IR[i] / 2); px8(a, r, c - a, 1, 3); px8(a, r, 1, 1, 1); px8(c - 1, r, 1, 1, 1); }
    if (b.bridge && i >= 10 && i <= 21) {                              // estrada e ponte
      px8(0, r, 128, 1, i === 10 || i === 21 ? 6 : 5);
      if (i === 15) for (let x = 0; x < 128; x += 6) if (x < L - 2 || x > R + 1) px8(x, r, 3, 1, 10);
      if (!b.broken) { px8(L - 1, r, R - L + 2, 1, i === 10 || i === 21 ? 0 : 4); }
      else px8(L, r, R - L, 1, 12);
    }
  }
  // decoração das margens (árvores, campos, vacas) — só nos blocos visíveis
  const g0 = Math.max(0, Math.floor(scroll / BH) - 1), g1 = Math.floor((scroll + VIEW_H) / BH) + 1;
  for (let g = g0; g <= g1; g++) {
    const blk = getBlock(g), deco = getDeco(blk), yr = i => sY(blk.g * BH + i * LINE + 1);
    for (const f of deco.fields) {
      const x0 = f.x0 / 2, x1 = f.x1 / 2, y0 = yr(f.b), y1 = yr(f.a);
      px8(x0, y0, x1 - x0, y1 - y0, blk.land === LAND_LIGHT ? 3 : 11);
      for (let x = x0; x < x1; x += 3) { px8(x, y0 - 1, 1, 1, 4); px8(x, y1, 1, 1, 4); }
    }
    for (const d of deco.items) {
      if (d.kind === 'cow') putB(p8('cow' + (d.dir > 0), COW_P8, d.dir > 0), d.x / 2, yr(d.i));
      else putB(treeP8(d.kind === 'pine', blk.land), d.x / 2, yr(d.i));
    }
  }
  // objetos
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive) continue;
    const top = sY(o.Y + o.h), cx = (o.x + o.w / 2) / 2, by = top + o.h / 2, cy = top + o.h / 4;
    if (top > PICO_VIEW || by < -10) continue;
    if (o.type === 'fuel') putB(p8('fuel', FUEL_P8), cx, by);
    else if (o.type === 'ship') putB(p8('ship', SHIP_P8, o.dir > 0), cx, by);
    else if (o.type === 'house') putB(p8(o.spr, HOUSE_P8[o.spr]), cx, by);
    else if (o.type === 'tank') putB(p8('tank', TANK_P8, o.aim < 0), cx, by);
    else if (o.type === 'balloon') putB(p8('bal' + o.hue, BALLOON_P8[o.hue ? 1 : 0]), cx, by + Math.round(Math.sin(frame * 0.05 + o.phase)));
    else if (o.type === 'plane' && o.active) put(p8('plane', PLANE_P8, o.dir < 0), cx, cy);
    else if (o.type === 'heli') {
      const s = p8('heli' + ((frame >> 2) % 2), HELI_P8[(frame >> 2) % 2].concat(HELI_BODY), o.dir > 0), k = o.alt || 1;
      ctx.drawImage(s, Math.round(cx - s.width * k / 2), Math.round(by - s.height * k), Math.round(s.width * k), Math.round(s.height * k));
    }
  }
  // projéteis dos tanques e mísseis
  for (const sh of shells) { const y = sY(sh.Y); px8(sh.x / 2 - 1, y - 1, 2, 2, frame % 6 < 3 ? 9 : 8); }
  for (const m of missiles) px8(m.x / 2, sY(m.Y + 8), 1, 4, 10);
  // explosões em pixel: círculos que esfriam (branco → amarelo → laranja → vermelho) e faíscas
  for (const e of fx) {
    const cx = e.x / 2, cy = sY(e.y), age = e.life - e.t;
    for (const [R, dur, delay, dx = 0] of e.fire || []) {
      const a = age - delay; if (a < 0 || a > dur) continue;
      const q = a / dur, rad = Math.max(1, R / 2 * (0.4 + 0.6 * Math.sqrt(q)));
      const col = [7, 10, 9, 8, 2][Math.min(4, Math.floor(q * 5))];
      ctx.fillStyle = P8[col]; ctx.beginPath(); ctx.arc(Math.round(cx + dx / 2), Math.round(cy), Math.round(rad), 0, Math.PI * 2); ctx.fill();
    }
    for (const p of e.parts) {
      if (age < p.delay || age - p.delay > p.life) continue;
      ctx.fillStyle = p8near(p.col); ctx.fillRect(Math.round(cx + p.x / 2), Math.round(cy + p.y / 2), 1, 1);
    }
  }
  // jato
  if (state === 'play') put(jetP8(clamp(Math.round(bank * 2), -2, 2)), (px + PW / 2) / 2, (VIEW_H - py - PH / 2) / 2);
  drawPicoHud();
}

function drawPicoHud() {
  px8(0, PICO_VIEW, 128, 16, 0);
  px8(0, PICO_VIEW, 128, 1, 5);
  ptxt(String(score).padStart(6, '0'), 2, 115, 7);
  // vidas (o jato em jogo não conta)
  const n = Math.min(lives - (state === 'play' ? 1 : 0), 5);
  for (let k = 0; k < n; k++) ctx.drawImage(jetP8(0), 126 - (k + 1) * 6, 114, 5, 5);   // mini-jatos
  // combustível: E [■■■■■■····] F, vermelho e piscando quando está no fim
  const f = clamp(fuel / 100, 0, 1), low = f < 0.25;
  ptxt('E', 2, 121, 6); ptxt('F', 47, 121, 6);
  px8(6, 121, 40, 5, 1);
  if (!(low && frame % 20 < 10)) px8(6, 121, Math.round(40 * f), 5, low ? 8 : 10);
  px8(6 + Math.round(40 * f), 120, 1, 7, 7);
  ptxt('PICO-8', 126, 121, 13, 'right');
  if (state === 'over') {
    px8(14, 34, 100, 44, 0); px8(15, 35, 98, 42, 1);
    ptxt('GAME OVER', 64, 39, 10, 'center');
    ptxt(String(score).padStart(6, '0'), 64, 48, 7, 'center');
    ptxt('SPACE: BACK', 64, 58, 12, 'center');
    ptxt('▲▼ SCROLL -/+ SPEED', 64, 67, 6, 'center');
  }
}
