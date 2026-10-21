// render/pico-ocean.js — MODO "OCEAN - PICO-8": o oceano em 128×128 com a paleta de 16 cores
// A lógica é a MESMA do modo oceano (área de 240×320); aqui ela é desenhada a 0,4× numa área de
// jogo de 96×128 pixels, com uma coluna de HUD de 32 px à direita (placar, vida, altitude,
// power-ups e bombas). Duas técnicas, como no Retro Ocean:
//   1. Unidades pequenas em pixel art feita à mão, só com as 16 cores: jato (5 quadros), caças e
//      navios vistos de cima (16 rotações "vizinho mais próximo"), helicóptero (2 quadros de
//      rotor), balão (gomos girando), balsa de combustível, power-ups, tiros e mísseis.
//   2. O que é grande (mar, ilhas, porta-aviões, chefes, nuvens, explosões) é desenhado em vetor
//      reduzido e o quadro é "pixelizado" na paleta do PICO-8, com pontilhado ordenado (Bayer 4×4).
//
// Usa: lógica do oceano (ocean/*), desenho vetorial do oceano (render/ocean.js, terrain.js,
// effects.js), utilidades do retro (rotSprite, BAYER) e do PICO-8 (P8, p8, put, px8, ptxt…).
'use strict';

const PO_S = 0.4, PO_W = 96;                             // escala (240×320 → 96×128) e largura da área de jogo

// ---------- pixelização na paleta do PICO-8 ----------
let P8LUT = null;                                        // cor de 15 bits → índice da paleta (pesos perceptuais)
function quantizeP8(w, h) {
  if (!P8LUT) {
    P8LUT = new Uint8Array(32768);
    for (let i = 0; i < 32768; i++) {
      const r = ((i >> 10) & 31) * 8.2, g = ((i >> 5) & 31) * 8.2, b = (i & 31) * 8.2;
      let best = 0, bd = 1e9;
      P8RGB.forEach(([R, G, B], k) => { const d = (r - R) ** 2 * 0.3 + (g - G) ** 2 * 0.59 + (b - B) ** 2 * 0.11; if (d < bd) { bd = d; best = k; } });
      P8LUT[i] = best;
    }
  }
  const img = ctx.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
    const o = BAYER[(y & 3) * 4 + (x & 3)];
    const r = clamp(d[i] + o, 0, 255), g = clamp(d[i + 1] + o, 0, 255), b = clamp(d[i + 2] + o, 0, 255);
    const c = P8RGB[P8LUT[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)]];
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

// ---------- sprites vistos de cima (base virada para a direita) ----------
const FIGHTER_P8 = ['...8.....', '....88...', '5..8888..', '58888c887', '5..2222..', '....22...', '...2.....'];
const SHIPTOP_P8 = ['.8888888888...', '8666666776688.', '86666667766888', '8666666776688.', '.2222222222...'];
const BULLET_P8 = [['.9.', '979', '.9.'], ['.8.', '878', '.8.']];
const rot16 = a => ((Math.round(a / (Math.PI * 2) * 16) % 16) + 16) % 16;
function p8rot(key, rows, ang) {                         // 16 rotações, pixels duros, guardadas em cache
  const k = rot16(ang), id = key + '@' + k;
  let s = P8C.get(id);
  if (!s) { s = rotSprite(p8(key, rows), k / 16 * Math.PI * 2); P8C.set(id, s); }
  return s;
}
function heliTopP8(dir, f) {                             // 11×11: fuselagem, cauda e rotor (2 quadros: × e +)
  const g = Array.from({ length: 11 }, () => Array(11).fill('.')), set = (x, y, c) => { if (x >= 0 && x < 11 && y >= 0 && y < 11) g[y][x] = c; };
  for (let x = 3; x <= 7; x++) set(x, 5, '1');
  for (let x = 4; x <= 6; x++) { set(x, 4, '1'); set(x, 6, '1'); }
  set(3, 5, 'c'); set(4, 5, 'c');                       // cabine na frente (à esquerda)
  for (let x = 8; x <= 10; x++) set(x, 5, '1');
  set(10, 4, '5'); set(10, 6, '5');                      // rotor de cauda
  for (let r = -4; r <= 4; r++) { if (f) { set(5 + r, 5 - r, 'a'); set(5 + r, 5 + r, 'a'); } else { set(5 + r, 5, 'a'); set(5, 5 + r, 'a'); } }
  set(5, 5, '0');
  return p8('htop' + f, g.map(r => r.join('')), dir > 0);
}
function balloonTopP8(hue, f) {                          // 7×7: gomos que giram (2 quadros), sombra embaixo/direita
  const rows = [];
  for (let y = 0; y < 7; y++) {
    let row = '';
    for (let x = 0; x < 7; x++) {
      const d = Math.hypot(x - 3, y - 3); if (d > 3.4) { row += '.'; continue; }
      const gore = Math.floor((Math.atan2(y - 3, x - 3) + f * Math.PI / 4 + Math.PI * 4) / (Math.PI / 4)) % 2;
      row += x === 3 && y === 3 ? '4' : x + y >= 8 ? (gore ? '6' : hue ? '4' : '2') : (gore ? '7' : hue ? '9' : '8');
    }
    rows.push(row);
  }
  return p8('btop' + hue + f, rows);
}

// ---------- quadro ----------
function drawPicoOcean() {
  const S = PO_S, [shx, shy] = shakeXY(), zs = 1 - 0.28 * smooth(altT), ext = VIEW_H * (1 / zs - 1) / 2;
  ctx.imageSmoothingEnabled = false;
  const air = () => ctx.setTransform(S, 0, 0, S, shx * S, shy * S);                                  // coordenadas da lógica
  const surf = () => ctx.setTransform(S * zs, 0, 0, S * zs, S * (W / 2 * (1 - zs) + shx), S * (VIEW_H / 2 * (1 - zs) + shy));   // superfície (encolhe no alto)
  const pix = () => ctx.setTransform(1, 0, 0, 1, 0, 0);                                                // pixels da tela
  const SP = (x, y) => [S * (W / 2 + (x - W / 2) * zs + shx), S * (VIEW_H / 2 + (y - VIEW_H / 2) * zs + shy)];   // superfície → pixel
  const AP = (x, y) => [S * (x + shx), S * (y + shy)];                                                 // ar → pixel
  // mar, ilhas, sombras das nuvens e porta-aviões: vetor (pixelizado no fim)
  air(); ctx.fillStyle = P8[12]; ctx.fillRect(-20, -20, W + 40, VIEW_H + 40);   // o mar já na cor 12 (o azul do oceano não tem par na paleta)
  surf();
  const g0 = Math.max(0, Math.floor((scroll - ext) / BH) - 1), g1 = Math.floor((scroll + VIEW_H + ext) / BH) + 1;
  for (let ph = 0; ph < 6; ph++) for (let g = g0; g <= g1; g++) drawTerrain(getBlock(g), ph);
  drawCloudShadows();
  const surface = [];
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (sy > VIEW_H + ext || sy < -40 - ext) continue;
    if (o.type === 'carrier') drawCarrier(o.x, sy, o.dir, o); else surface.push([o, sy]);
  }
  // unidades da superfície em pixel art
  pix();
  for (const [o, sy] of surface) {
    const [cx, cy] = SP(o.x + o.w / 2, sy + o.h / 2);
    if (o.type === 'fuel') put(p8('fuel', FUEL_P8), cx, cy);
    else if (o.type === 'pu') put(puP8(o.kind, frame % 30 < 6), cx, cy + Math.round(Math.sin(frame * 0.08 + o.phase)));
    else if (o.type === 'ship') {
      put(p8rot('shipT', SHIPTOP_P8, -(o.hdg !== undefined ? o.hdg : (o.dir > 0 ? 0 : Math.PI))), cx, cy);
      const gp = shipGun(o), [gx, gy] = SP(gp.x, gp.y);                // canhão: acende ao disparar
      px8(gx, gy, 1, 1, o.gunFlash > 0 ? 10 : 0);
    }
    else if (o.type === 'heli') {
      const s = heliTopP8(o.dir, (frame >> 2) % 2), k = o.alt || 1;
      px8(cx + 4 * k - 2, cy + 5 * k, 4, 1, 1);                         // sombra
      ctx.drawImage(s, Math.round(cx - s.width * k / 2), Math.round(cy - s.height * k / 2), Math.round(s.width * k), Math.round(s.height * k));
    }
    else if (o.type === 'balloon') { px8(cx + 4, cy + 6, 4, 1, 1); put(balloonTopP8(o.hue, (frame >> 3) % 2), cx, cy); }
    else if (o.type === 'plane' && o.active) put(p8rot('fighter', FIGHTER_P8, o.dir > 0 ? 0 : Math.PI), cx, cy);
  }
  // no alto: névoa e a camada de nuvens abaixo do jato
  if (altT > 0) { air(); ctx.fillStyle = 'rgba(205,225,245,' + (0.32 * altT).toFixed(3) + ')'; ctx.fillRect(0, 0, W, VIEW_H); drawCloudDeck(altT); drawClouds(altT, true); }
  // ar: caças e chefe
  pix();
  for (const f of fliers) {
    if (!f.alive || f.t < 0) continue;
    const [x, y] = AP(f.x, f.y);
    px8(x + 3 + 7 * altT, y + 5 + 10 * altT, 3, 1, 1);                   // sombra
    put(p8rot('fighter', FIGHTER_P8, f.ang), x, y);
  }
  if (boss) { air(); drawBoss(boss); }
  // tiros: os comuns em pixel; foguetes e minas em vetor
  for (const sh of shells) {
    const sy = VIEW_H - (sh.Y - scroll);
    if (sh.kind) { air(); drawShell(sh, sy); }
    else { pix(); const [x, y] = AP(sh.x, sy), f = (frame >> 2) % 2; put(p8('bul' + f, BULLET_P8[f]), x, y); }
  }
  pix();
  for (const m of missiles) { const [x, y] = AP(m.x, VIEW_H - (m.Y + 8 - scroll)); px8(x, y, 1, 3, pw.rapid > 0 ? 7 : 10); px8(x, y, 1, 1, 7); }
  // jato: sombra (mais longe quanto mais alto), looping/mergulho, escudo
  if (state === 'play') {
    const lvl = clamp(Math.round(bank * 2), -2, 2), [jx, jy] = AP(px + PW / 2, VIEW_H - py - PH / 2);
    const [sx, sy] = AP(px + PW / 2 + 7 + 22 * altT, VIEW_H - py - PH * 0.35 + 9 + 34 * altT);
    put(jetShadowP8(lvl), sx, sy);
    if (!((safeT > 0 || hurtT > 0) && frame % 10 < 5)) {
      const mp = maneuverPose(), s = jetP8(lvl);
      ctx.save(); ctx.translate(Math.round(jx), Math.round(jy + mp.dy * S)); ctx.scale(mp.sx * mp.s, mp.sy * mp.s);
      ctx.drawImage(s, -Math.round(s.width / 2), -Math.round(s.height / 2)); ctx.restore();
    }
    if (pw.shield > 0 && !(pw.shield < 90 && frame % 10 < 5)) ringP8(jx, jy, 7 + (frame >> 3) % 2, 12);
  }
  // explosões e nuvens baixas (por cima de tudo no rasante), em vetor
  air(); fxNoLabel = true; fx.forEach(drawExplosion); fxNoLabel = false;
  drawClouds(1 - altT);
  pix(); quantizeP8(PO_W, 128);
  drawPicoOceanHud();
}

// ---------- HUD (pixels puros da paleta, depois da pixelização) ----------
function drawPicoOceanHud() {
  const S = PO_S;
  // rótulos dos efeitos (power-ups, bônus), subindo
  for (const e of fx) if (e.label) {
    const age = e.life - e.t, w = e.label.length * 4 - 1; if (age > e.life * 0.8 && frame % 4 < 2) continue;
    ptxt(e.label, clamp(e.x * S, w / 2 + 1, PO_W - 1 - w / 2), Math.round((VIEW_H - (e.y - scroll) - 18 - age * 0.45) * S), p8idx(e.labelCol || '#ffffff'), 'center');
  }
  // barra do chefe, no topo da área de jogo
  if (boss) {
    const B = boss, bf = Math.max(0, B.hp / B.maxHp);
    px8(2, 1, PO_W - 4, 4, 0); px8(3, 2, Math.round((PO_W - 6) * bf), 2, bf > 0.3 ? 8 : 9);
    const st = B.kind === 'gunship' && B.shield > 0 ? ' SHIELD' : B.kind === 'airship' && B.turrets.some(t => t.hp > 0) ? ' ARMORED' : B.kind === 'interceptor' && B.mode === 'dash' ? ' UNTOUCHABLE' : '';
    const name = BOSS_INFO[B.kind].name + (B.dying ? ' DOWN!' : st);
    px8(2, 6, name.length * 4 + 1, 7, 0); ptxt(name, 3, 7, B.dying ? 10 : 7);
  }
  // aviso de troca de altitude
  if (altMsg > 0 && frame % 8 < 6) {
    const t = altText.replace(/\s+/g, ' '), w = t.length * 4 - 1;
    px8(PO_W / 2 - w / 2 - 2, 20, w + 4, 9, 0); ptxt(t, PO_W / 2, 22, altTarget ? 12 : 10, 'center');
  }
  // coluna da direita: placar, vida, altitude, power-ups e bombas
  px8(PO_W, 0, 128 - PO_W, 128, 0); px8(PO_W, 0, 1, 128, 5);
  ptxt(String(score).padStart(6, '0'), 99, 2, 7);
  const f = clamp(hp / 100, 0, 1), low = f < 0.25;
  ptxt('♥', 99, 9, 8);
  px8(103, 9, 23, 5, 1);
  if (!(low && frame % 20 < 10)) px8(103, 9, Math.max(1, Math.round(23 * f)), 5, f > 0.5 ? 11 : f > 0.25 ? 10 : 8);
  ptxt(altTarget ? '▲ HIGH' : '▼ LOW', 99, 17, 12);
  let iy = 26;
  for (const k of ['shield', 'triple', 'rapid']) {
    if (pw[k] <= 0) continue;
    ctx.drawImage(puMiniP8(k), 99, iy); px8(106, iy + 2, Math.max(1, Math.round(20 * pw[k] / PU[k].dur)), 1, parseInt(PU_P8C[k][0], 16));
    iy += 7;
  }
  ptxt('PICO-8', 112, 104, 13, 'center');
  // bombas: alinhadas à direita, a contagem anda para a esquerda (4 por linha) e sobe de linha
  const per = 4, nb = Math.max(bombs, 1);
  for (let i = 0; i < nb; i++) ctx.drawImage(bombP8(i < bombs), 121 - (i % per) * 7, 121 - Math.floor(i / per) * 7);
  // fim de jogo
  if (state === 'over') {
    px8(4, 34, PO_W - 8, 44, 0); px8(5, 35, PO_W - 10, 42, 1);
    ptxt('GAME OVER', PO_W / 2, 39, 10, 'center');
    ptxt(String(score).padStart(6, '0'), PO_W / 2, 48, 7, 'center');
    ptxt('SPACE: BACK', PO_W / 2, 58, 12, 'center');
    ptxt('▲▼ SCROLL', PO_W / 2, 67, 6, 'center');
  }
}
