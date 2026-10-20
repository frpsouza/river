// River Raid clone — mapas gerados proceduralmente, sprites extraídos de river.png
// Estrutura (conforme river-raid-comentarios.md): seção = 16 blocos, o último é a ponte;
// cada bloco tem 32 linhas, um id aleatório define o formato do rio (com ou sem ilhas)
// e um objeto aleatório (combustível, navio, helicóptero ou casa).
'use strict';

const W = 304, VIEW_H = 320, PANEL_H = 48;
const LINE = 2, LINES = 32, BH = LINE * LINES;      // bloco: 32 linhas de 2px = 64px
const BLOCKS_PER_SECTION = 16;
const MAXD = 40;
const smooth = t => t * t * (3 - 2 * t);               // curva suave (sem degraus)
const PLAYER_Y = 6;                                   // jato rente ao painel de placar
const PW = 15, PH = 16;
const WATER = '#2d32b8', LAND_DARK = '#355f18', LAND_LIGHT = '#6e9c42';

// ---------- util ----------
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- terreno ----------
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
    tc = 12 + tw / 2 + rng() * (W - 24 - tw);
    // as margens só podem andar MAXD px por bloco, para o jato conseguir seguir o rio
    const pL = prev.endC - prev.endW / 2, pR = prev.endC + prev.endW / 2;
    let tL = clamp(tc - tw / 2, pL - MAXD, pL + MAXD), tR = clamp(tc + tw / 2, pR - MAXD, pR + MAXD);
    if (b === BLOCKS_PER_SECTION - 2 && tR - tL > 100) { const m = (tL + tR) / 2; tL = m - 47; tR = m + 47; }
    const minW = b === BLOCKS_PER_SECTION - 2 ? 64 : Math.max(64, wMin - 2 * MAXD * 0.5);
    if (tR - tL < minW) { const m = (tL + tR) / 2; tL = m - minW / 2; tR = m + minW / 2; }
    tL = clamp(tL, 12, W - 12 - minW); tR = clamp(tR, tL + minW, W - 12);
    tc = (tL + tR) / 2; tw = tR - tL;
  }
  blk.endC = tc; blk.endW = tw;
  const t0 = blk.bridge ? 0 : 1, span = blk.bridge ? 9 : 30;
  for (let i = 0; i < LINES; i++) {
    const t = smooth(clamp((i - t0) / span, 0, 1));
    const c = prev.endC + (tc - prev.endC) * t;
    const w = prev.endW + (tw - prev.endW) * t;
    blk.L[i] = c - w / 2; blk.R[i] = c + w / 2;
  }
  // ilha
  if (!blk.bridge && g > 1 && tw >= 150 && prev.endW >= 150 && rng() < 0.5) {
    const maxIW = Math.min(tw, prev.endW) - 96;
    if (maxIW >= 24) {
      const iw = 24 + rng() * (Math.min(maxIW, 90) - 24);
      for (let i = 3; i <= 28; i++) {
        const u = (i - 15.5) / 12.5;                      // elipse: cantos arredondados
        const half = iw / 2 * Math.sqrt(Math.max(0, 1 - u * u * u * u));
        const ic = (blk.L[i] + blk.R[i]) / 2;
        blk.IL[i] = ic - half; blk.IR[i] = ic + half;
      }
    }
  }
  blocks.push(blk);   // antes de gerar objetos, que consultam o próprio bloco
  spawnObjs(blk);
  return blk;
}

function waterFree(x0, x1, Ybot, Ytop) {
  for (let Y = Ybot; Y <= Ytop; Y += LINE) {
    const { b, i } = lineAt(Y);
    if (x0 < b.L[i] + 2 || x1 > b.R[i] - 2) return false;
    if (b.IL[i] >= 0 && x1 > b.IL[i] - 2 && x0 < b.IR[i] + 2) return false;
  }
  return true;
}

function spawnObjs(blk) {
  blk.objs = [];
  if (blk.g < 2) return;
  const r = mulberry32(blk.seed);
  const base = blk.g * BH;
  if (blk.bridge) {
    // tanque atravessando a ponte pela estrada (dá para acertar enquanto está sobre o rio)
    if (r() < 0.6) {
      const dir = r() < 0.5 ? 1 : -1;
      blk.objs.push({ type: 'tank', onRoad: true, x: dir > 0 ? 4 : W - 30, Y: base + 12 * LINE, w: 26, h: 14,
        alive: true, dir, aim: dir, vx: 0.5 + Math.min(blk.s, 8) * 0.05, minX: 0, maxX: W - 26 });
    }
    return;
  }
  const k = r();
  const type = k < 0.26 ? 'fuel' : k < 0.46 ? 'ship' : k < 0.66 ? 'heli' : k < 0.78 ? 'house' : k < 0.9 ? 'tank' : 'balloon';
  const dims = { fuel: [18, 28], ship: [36, 12], heli: [20, 14], house: [36, 23], tank: [26, 14], balloon: [16, 24] }[type];
  const [w, h] = dims;
  for (let tries = 0; tries < 30; tries++) {
    const yi = 3 + Math.floor(r() * (LINES - 6 - h / LINE));
    const Y = base + yi * LINE;
    if (type === 'house' || type === 'tank') {
      const left = r() < 0.5;
      let lmin = 1e9, rmax = -1e9;
      for (let y = Y; y <= Y + h; y += LINE) {
        const { b, i } = lineAt(y);
        lmin = Math.min(lmin, b.L[i]); rmax = Math.max(rmax, b.R[i]);
      }
      let x = null;
      if (left && lmin >= 52) x = 6 + r() * (lmin - w - 12);
      else if (!left && W - rmax >= 52) x = rmax + 6 + r() * (W - rmax - w - 12);
      if (x === null) continue;
      if (type === 'house') blk.objs.push({ type, x, Y, w, h, alive: true, spr: r() < 0.5 ? 'house1' : 'house2' });
      else {
        // tanque na margem: patrulha em terra e atira para o lado do rio
        const minX = left ? 4 : rmax + 6, maxX = left ? lmin - w - 6 : W - w - 4;
        blk.objs.push({ type, x, Y, w, h, alive: true, dir: r() < 0.5 ? -1 : 1, aim: left ? 1 : -1,
          vx: 0.35, minX, maxX, cool: 40 + r() * 80 });
      }
      break;
    }
    const x = 14 + r() * (W - 28 - w);
    if (!waterFree(x, x + w, Y, Y + h)) continue;
    if (type === 'balloon') {
      blk.objs.push({ type, x, Y, w, h, alive: true, dir: r() < 0.5 ? -1 : 1, vx: 0.25 + r() * 0.2,
        hue: r() < 0.5 ? 0 : 1, phase: r() * 6.28 });
      break;
    }
    blk.objs.push({ type, x, Y, w, h, alive: true, dir: r() < 0.5 ? -1 : 1,
      vx: type === 'ship' ? 0.6 + Math.min(blk.s, 10) * 0.06 : 0.9 + Math.min(blk.s, 10) * 0.08,
      moving: type !== 'fuel' && r() < 0.8 });
    break;
  }
  // avião inimigo ocasional: cruza a tela quando o jogador se aproxima
  if (blk.g > 3 && r() < 0.18)
    blk.objs.push({ type: 'plane', x: -100, Y: base + 24 * LINE, w: 20, h: 10, alive: true,
      dir: r() < 0.5 ? -1 : 1, active: false, vx: 2.2 + Math.min(blk.s, 10) * 0.1 });
}

// ---------- estado do jogo ----------
let bank = 0;
let shells = [];
let state, scroll, px, fuel, lives, score, nextLife, checkpoint, missile, fx, dyingT, keys, frame, audio;

function newGame() {
  seed = (Math.random() * 1e9) | 0;
  rng = mulberry32(seed);
  blocks = [];
  score = 0; lives = 3; nextLife = 10000;
  checkpoint = 0;
  respawn();
}

function respawn() {
  for (let g = checkpoint; g < blocks.length; g++) {
    blocks[g].broken = false;
    spawnObjs(blocks[g]);
  }
  scroll = checkpoint * BH;
  const { b, i } = lineAt(scroll + PLAYER_Y);
  px = (b.L[i] + b.R[i]) / 2 - PW / 2;
  fuel = 100; missile = null; fx = []; dyingT = 0; shells = [];
  bank = 0;
  state = 'play';
}

// ---------- som ----------
function beep(freq, dur, type = 'square', vol = 0.04) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(audio.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.stop(audio.currentTime + dur);
  } catch (e) { /* sem áudio */ }
}

const sectionOf = y => Math.floor(y / BH / BLOCKS_PER_SECTION);

function addScore(n) {
  score += n;
  if (score >= nextLife) { nextLife += 10000; lives++; beep(880, 0.3); }
}

function boom(x, y, big) {
  fx.push({ x, y, t: big ? 50 : 14, big });
  beep(big ? 90 : 160, big ? 0.6 : 0.2, 'sawtooth', 0.06);
}

function kill() {
  if (state !== 'play') return;
  state = 'dying'; dyingT = 70;
  boom(px + PW / 2, scroll + PLAYER_Y + PH / 2, true);
}

// ---------- atualização ----------
function update() {
  frame++;
  if (state === 'title') { if (keys.Enter || keys[' ']) { newGame(); } return; }
  if (state === 'over') { if (keys.Enter) state = 'title'; return; }

  fx.forEach(e => e.t--);
  fx = fx.filter(e => e.t > 0);

  if (state === 'dying') {
    if (--dyingT <= 0) {
      if (--lives <= 0) state = 'over'; else respawn();
    }
    return;
  }

  // controles
  const lvl = 1 + Math.min(sectionOf(scroll), 8) * 0.07;       // fica mais rápido a cada seção
  const sp = (keys.ArrowUp || keys.w ? 1.9 : keys.ArrowDown || keys.s ? 0.6 : 1.1) * lvl;
  const steer = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  px += steer * 2;
  bank += (steer - bank) * 0.18;                 // inclinação suave das asas
  scroll += sp;
  if ((keys[' '] || keys.z) && !missile) {
    missile = { x: px + PW / 2 - 1, Y: scroll + PLAYER_Y + PH };
    beep(700, 0.08, 'square', 0.03);
  }

  // combustível
  fuel -= 0.04 * (sp > 1.5 * lvl ? 1.2 : 1);
  if (fuel < 25 && frame % 20 === 0) beep(300, 0.05, 'square', 0.02);
  if (fuel <= 0) { fuel = 0; kill(); return; }

  // colisão com terreno e ponte
  const pBot = scroll + PLAYER_Y, pTop = pBot + PH;
  for (let Y = pBot; Y <= pTop; Y += LINE) {
    const { b, i } = lineAt(Y);
    if (px < b.L[i] || px + PW > b.R[i]) { kill(); return; }
    if (b.IL[i] >= 0 && px + PW > b.IL[i] && px < b.IR[i]) { kill(); return; }
    if (b.bridge && !b.broken && i >= 10 && i <= 21) { kill(); return; }
  }
  // checkpoint ao passar pela ponte
  const sec = Math.floor(pBot / BH / BLOCKS_PER_SECTION);
  const bridgeTop = (sec * BLOCKS_PER_SECTION + 15) * BH + 22 * LINE;
  if (pBot > bridgeTop && checkpoint < (sec + 1) * BLOCKS_PER_SECTION) checkpoint = (sec + 1) * BLOCKS_PER_SECTION;

  // objetos visíveis
  const g0 = Math.floor(scroll / BH) - 1, g1 = Math.floor((scroll + VIEW_H) / BH) + 2;
  getBlock(g1 + 2);
  const px0 = px + 2, px1 = px + PW - 2;
  for (let g = Math.max(0, g0); g <= g1; g++) {
    for (const o of blocks[g].objs) {
      if (!o.alive) continue;
      const sy = VIEW_H - (o.Y + o.h - scroll);
      if (o.type === 'plane') {
        if (!o.active && sy < 150 && sy > 0) { o.active = true; o.x = o.dir > 0 ? -o.w : W; }
        if (o.active) {
          o.x += o.dir * o.vx;
          if (o.x < -o.w - 4 || o.x > W + 4) o.alive = false;
        }
      } else if (o.type === 'tank') {
        if (sy > -30 && sy < VIEW_H) {
          o.x += o.dir * o.vx;
          if (o.x < o.minX || o.x > o.maxX) { o.dir = -o.dir; o.x = clamp(o.x, o.minX, o.maxX); }
          if (o.onRoad) {
            o.aim = o.dir;
            const b = blocks[g], cx = o.x + o.w / 2;
            if (b.broken && cx > b.L[16] && cx < b.R[16]) { o.alive = false; boom(cx, o.Y + o.h / 2); }
          } else if (sy > 40 && sy < VIEW_H - 30 && --o.cool <= 0) {
            // atira na direção do rio
            o.cool = 110 + Math.random() * 90;
            shells.push({ x: o.aim > 0 ? o.x + o.w + 2 : o.x - 2, Y: o.Y + o.h / 2, vx: o.aim * 1.8 });
            beep(220, 0.06, 'square', 0.02);
          }
        }
      } else if (o.type === 'balloon') {
        o.x += o.dir * o.vx;
        if (o.x < 4 || o.x > W - o.w - 4) o.dir = -o.dir;
      } else if (o.moving && sy > -20 && sy < VIEW_H) {
        const nx = o.x + o.dir * o.vx;
        if (waterFree(nx, nx + o.w, o.Y, o.Y + o.h)) o.x = nx; else o.dir = -o.dir;
      }
      if (!o.alive) continue;
      // colisão com jogador
      if (px1 > o.x + 1 && px0 < o.x + o.w - 1 && pTop > o.Y + 1 && pBot < o.Y + o.h - 1) {
        if (o.type === 'fuel') { fuel = Math.min(100, fuel + 1); if (frame % 4 === 0) beep(500, 0.03, 'sine', 0.03); }
        else if (o.type !== 'house') { o.alive = false; boom(o.x + o.w / 2, o.Y + o.h / 2); kill(); return; }
        else { kill(); return; }
      }
    }
  }

  // projéteis dos tanques
  for (const sh of shells) {
    sh.x += sh.vx;
    if (sh.x > px + 1 && sh.x < px + PW - 1 && sh.Y > pBot && sh.Y < pTop) { sh.dead = true; kill(); }
  }
  shells = shells.filter(sh => !sh.dead && sh.x > -6 && sh.x < W + 6 && sh.Y > scroll - 10);
  if (state !== 'play') return;

  // míssil
  if (missile) {
    missile.Y += 9;
    const my0 = missile.Y, my1 = missile.Y + 8;
    let hit = missile.Y > scroll + VIEW_H;
    const { b, i } = lineAt(my1);
    if (missile.x < b.L[i] || missile.x > b.R[i] || (b.IL[i] >= 0 && missile.x > b.IL[i] && missile.x < b.IR[i])) hit = true;
    if (!hit) {
      for (let g = Math.max(0, g0); g <= g1 && !hit; g++) for (const o of blocks[g].objs) {
        if (!o.alive || o.type === 'house') continue;
        if (missile.x + 2 > o.x && missile.x < o.x + o.w && my1 > o.Y && my0 < o.Y + o.h) {
          o.alive = false; hit = true;
          addScore({ fuel: 80, ship: 30, heli: 60, plane: 100, tank: 250, balloon: 60 }[o.type]);
          boom(o.x + o.w / 2, o.Y + o.h / 2);
          break;
        }
      }
    }
    // a ponte é testada depois dos objetos, para o tanque sobre ela poder ser atingido
    if (!hit && b.bridge && !b.broken && i >= 10 && i <= 21) {
      b.broken = true; hit = true; addScore(500);
      boom(b.endC, b.g * BH + 16 * LINE, true);
    }
    if (hit) missile = null;
  }
}

// ---------- desenho (vetorial / flat design) ----------
const SCALE = 2;
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
cv.width = W * SCALE; cv.height = (VIEW_H + PANEL_H) * SCALE;

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
  water: '#2a3db3',
  dark: { land: '#2e6b2f', bush: '#245a28', bushHi: '#3f8d3f' },
  light: { land: '#5fa443', bush: '#4c8d37', bushHi: '#85c75a' },
};

function shoreStroke(pts, w, color) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]);
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'butt'; ctx.stroke();
}

function drawTerrain(blk, phase) {        // fase 0: água/sombras, 1: terra, 2: luz, arbustos e ilha
  const yAt = i => VIEW_H - (blk.g * BH + i * LINE + LINE / 2 - scroll);
  const yBot = VIEW_H - (blk.g * BH - scroll) + 1, yTop = VIEW_H - ((blk.g + 1) * BH - scroll) - 1;
  const pal = blk.land === LAND_LIGHT ? PAL.light : PAL.dark;
  const edge = (arr, ext) => {                    // ext: sobreposição só para o preenchimento opaco
    const pts = [[arr[0], yBot - 1 + ext]];
    for (let i = 0; i < LINES; i++) pts.push([arr[i], yAt(i)]);
    pts.push([arr[LINES - 1], yTop + 1 - ext]);
    return pts;
  };
  const eL = edge(blk.L, 1), eR = edge(blk.R, 1), sL = edge(blk.L, 0), sR = edge(blk.R, 0);
  const bankPoly = (pts, wall) => {
    ctx.beginPath(); ctx.moveTo(wall, pts[0][1]);
    pts.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(wall, pts[pts.length - 1][1]); ctx.closePath();
  };
  if (phase === 0) {
  // água rasa + sombra na beirada
  for (const pts of [sL, sR]) {
    shoreStroke(pts, 12, 'rgba(120,170,255,.20)');
    shoreStroke(pts, 6, 'rgba(8,12,70,.38)');
  }
  // ondas (dashes claros) — só em água livre, posições estáveis por bloco
  const r = mulberry32(blk.seed ^ 0x51ed27);
  ctx.lineCap = 'round';
  for (let k = 0; k < 7; k++) {
    const i = Math.floor(r() * LINES), len = 8 + r() * 12, x = r() * W;
    if (x < blk.L[i] + 8 || x + len > blk.R[i] - 8) continue;
    if (blk.IL[i] >= 0 && x + len > blk.IL[i] - 8 && x < blk.IR[i] + 8) continue;
    ctx.strokeStyle = 'rgba(255,255,255,.13)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(x, yAt(i)); ctx.lineTo(x + len, yAt(i)); ctx.stroke();
  }
  return;
  }
  if (phase === 1) {
    for (const [pts, wall] of [[eL, 0], [eR, W]]) { bankPoly(pts, wall); ctx.fillStyle = pal.land; ctx.fill(); }
    return;
  }
  // margens
  for (const [pts, sp, wall] of [[eL, sL, 0], [eR, sR, W]]) {
    ctx.save(); bankPoly(pts, wall); ctx.clip();
    shoreStroke(sp, 13, 'rgba(255,255,255,.10)');         // faixa de luz junto à água
    shoreStroke(sp, 5, 'rgba(255,255,255,.14)');
    ctx.restore();
  }
  // arbustos com sombreamento flat
  const r = mulberry32(blk.seed ^ 0x2b7e15);
  for (let k = 0; k < 9; k++) {
    const i = Math.floor(r() * LINES), left = r() < 0.5, rad = 2.8 + r() * 3.4, t = r();
    const x = left ? 4 + t * (blk.L[i] - 16) : blk.R[i] + 12 + t * (W - blk.R[i] - 16);
    if ((left && blk.L[i] < 24) || (!left && W - blk.R[i] < 24)) continue;
    const y = yAt(i);
    ell(x + 1.2, y + 1.6, rad, rad * 0.8, 'rgba(0,0,0,.18)');
    ell(x, y, rad, rad, pal.bush);
    ell(x - rad * 0.28, y - rad * 0.3, rad * 0.58, rad * 0.58, pal.bushHi);
  }
  // ilha
  if (blk.IL[15] >= 0) {
    let first = -1, last = -1;
    for (let i = 0; i < LINES; i++) if (blk.IL[i] >= 0) { if (first < 0) first = i; last = i; }
    const pts = [];
    for (let i = first; i <= last; i++) pts.push([blk.IL[i], yAt(i)]);
    for (let i = last; i >= first; i--) pts.push([blk.IR[i], yAt(i)]);
    const ring = pts.concat([pts[0]]);
    shoreStroke(ring, 12, 'rgba(120,170,255,.20)');
    shoreStroke(ring, 6, 'rgba(8,12,70,.38)');
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); pts.forEach(q => ctx.lineTo(q[0], q[1])); ctx.closePath();
    ctx.fillStyle = PAL.dark.land; ctx.fill();
    ctx.save(); ctx.clip();
    shoreStroke(ring, 12, 'rgba(255,255,255,.10)');
    shoreStroke(ring, 4, 'rgba(255,255,255,.14)');
    ctx.restore();
    const cx = (blk.IL[15] + blk.IR[15]) / 2, wI = blk.IR[15] - blk.IL[15];
    for (const [dx, dy, rd] of [[-0.18, 12, 4.4], [0.16, 18, 3.6], [0.02, 14.5, 3]]) {
      const x = cx + dx * wI, y = yAt(dy);
      ell(x + 1, y + 1.4, rd, rd * 0.8, 'rgba(0,0,0,.2)');
      ell(x, y, rd, rd, PAL.dark.bush); ell(x - rd * 0.28, y - rd * 0.3, rd * 0.58, rd * 0.58, PAL.dark.bushHi);
    }
  }
}

function drawBridge(blk) {
  const yTop = VIEW_H - ((blk.g * BH + 22 * LINE) - scroll), yBot = yTop + 12 * LINE;
  const Lm = blk.L[16], Rm = blk.R[16], h = yBot - yTop;
  const road = (x0, x1) => {
    if (x1 <= x0) return;
    ctx.fillStyle = '#6b7280'; ctx.fillRect(x0, yTop, x1 - x0, h);
    ctx.fillStyle = '#9aa1ad'; ctx.fillRect(x0, yTop, x1 - x0, 3);
    ctx.fillStyle = '#4a5060'; ctx.fillRect(x0, yBot - 3, x1 - x0, 3);
    ctx.fillStyle = '#f5c542';
    for (let x = x0 - ((x0 % 18) + 18) % 18; x < x1; x += 18) ctx.fillRect(Math.max(x, x0), yTop + h / 2 - 0.7, Math.min(10, x1 - Math.max(x, x0)), 1.4);
  };
  road(0, Lm); road(Rm, W);
  if (!blk.broken) {
    ctx.fillStyle = 'rgba(8,12,70,.35)'; ctx.fillRect(Lm - 2, yTop + 5, Rm - Lm + 4, h);   // sombra na água
    ctx.fillStyle = '#8f6c3b'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, h);
    ctx.fillStyle = '#a98450'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, 3);
    ctx.fillStyle = '#6a4d27'; ctx.fillRect(Lm - 3, yBot - 3, Rm - Lm + 6, 3);
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let x = Lm; x < Rm; x += 6) ctx.fillRect(x, yTop + 3, 1, h - 6);
    ctx.fillStyle = '#3a2b17'; ctx.fillRect(Lm - 3, yTop, Rm - Lm + 6, 1); ctx.fillRect(Lm - 3, yBot - 1, Rm - Lm + 6, 1);
  } else {
    ctx.fillStyle = '#3a2b17';
    poly([Lm, yTop, Lm + 6, yTop + h / 2, Lm, yBot], '#3a2b17');
    poly([Rm, yTop, Rm - 6, yTop + h / 2, Rm, yBot], '#3a2b17');
  }
}

function groundShadow(cx, cy, rx, ry) { ell(cx, cy, rx, ry, 'rgba(0,0,30,.22)'); }

function drawFuel(x, y) {
  ctx.save(); ctx.translate(x, y);
  groundShadow(11, 27.5, 9, 2.4);
  rrect(0, 0, 18, 28, 3); ctx.save(); ctx.clip();
  for (let k = 0; k < 4; k++) { ctx.fillStyle = k % 2 ? '#f3efe6' : '#dd433d'; ctx.fillRect(0, k * 7, 18, 7); }
  ctx.fillStyle = '#2a3a9c'; ctx.font = 'bold 6.6px Arial, sans-serif'; ctx.textAlign = 'center';
  for (let k = 0; k < 4; k++) ctx.fillText('FUEL'[k], 9, k * 7 + 5.6);
  const g = ctx.createLinearGradient(0, 0, 18, 0);
  g.addColorStop(0, 'rgba(255,255,255,.38)'); g.addColorStop(0.35, 'rgba(255,255,255,0)');
  g.addColorStop(0.65, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,40,.34)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 18, 28);
  ctx.restore();
  rrect(0.3, 0.3, 17.4, 27.4, 3); ctx.strokeStyle = 'rgba(0,0,30,.45)'; ctx.lineWidth = 0.7; ctx.stroke();
  ctx.restore();
}

function drawHeli(x, y, dir) {
  ctx.save(); ctx.translate(x + (dir > 0 ? 20 : 0), y); if (dir > 0) ctx.scale(-1, 1);
  ell(10, 13.4, 8, 1.6, 'rgba(0,0,30,.2)');
  // hélice
  const L = frame % 6 < 3 ? 9.5 : 5.5;
  ctx.strokeStyle = '#f2b134'; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(9 - L, 2.2); ctx.lineTo(9 + L, 2.2); ctx.stroke();
  ctx.strokeStyle = '#222'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(9, 2.2); ctx.lineTo(9, 4.4); ctx.stroke();
  // cauda
  poly([13, 6.8, 20, 6.2, 20, 8.1, 13, 9.3], '#27449f');
  poly([18.4, 6.4, 20, 3.4, 20.3, 6.4], '#e9a23b');
  // corpo
  ell(9, 8, 6.6, 3.7, '#2f56c9');
  ctx.save(); ctx.beginPath(); ctx.ellipse(9, 8, 6.6, 3.7, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#1f3585'; ctx.fillRect(0, 8.4, 20, 5);
  ctx.restore();
  ell(8.2, 6.4, 4, 1.1, 'rgba(255,255,255,.26)');
  ell(5.2, 7.4, 2.7, 2, '#bfe6ff'); ell(4.6, 6.8, 1.2, 0.8, 'rgba(255,255,255,.8)');
  // esquis
  ctx.strokeStyle = '#1c1c28'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(3, 12.6); ctx.lineTo(14, 12.6); ctx.moveTo(5.5, 10.8); ctx.lineTo(5.5, 12.6); ctx.moveTo(11.5, 10.8); ctx.lineTo(11.5, 12.6); ctx.stroke();
  ctx.restore();
}

function drawShip(x, y, dir) {
  ctx.save(); ctx.translate(x + (dir > 0 ? 36 : 0), y); if (dir > 0) ctx.scale(-1, 1);
  ell(18, 11.3, 18, 1.8, 'rgba(255,255,255,.22)');
  poly([0, 4.6, 34, 4.6, 31, 10.6, 5, 10.6], '#b8352a');
  poly([5, 8.4, 31.4, 8.4, 31, 10.6, 5, 10.6], '#7e211c');
  poly([0.5, 4.6, 34, 4.6, 34, 5.8, 1.5, 5.8], '#d8d2c2');
  ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(3, 6.4, 27, 0.8);
  // superestrutura
  ctx.fillStyle = '#eceff4'; ctx.fillRect(19, 1.8, 11, 2.8);
  ctx.fillStyle = '#c3c8d4'; ctx.fillRect(19, 3.4, 11, 1.2);
  ctx.fillStyle = '#2a3a5c'; for (let k = 0; k < 4; k++) ctx.fillRect(20.2 + k * 2.6, 2.4, 1.6, 0.9);
  ctx.fillStyle = '#2b2f3a'; ctx.fillRect(24, 0, 3.2, 1.8);
  ctx.fillStyle = '#d04a3a'; ctx.fillRect(24, 0.3, 3.2, 0.6);
  ctx.fillStyle = '#4a4e5c'; ctx.fillRect(8, 3.3, 4.5, 1.3); ctx.fillRect(12, 3.6, 3, 0.6);
  ctx.strokeStyle = '#444'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(16.5, 4.6); ctx.lineTo(16.5, 0.6); ctx.stroke();
  ctx.restore();
}

function drawPlane(x, y, dir) {
  ctx.save(); ctx.translate(x + (dir < 0 ? 20 : 0), y + Math.sin(frame * 0.3) * 0.4); if (dir < 0) ctx.scale(-1, 1);
  poly([12, 3.6, 5, 0, 2.5, 0, 6.5, 3.8], '#9bdcf7');           // asa de cima
  poly([12, 6.4, 5, 10, 2.5, 10, 6.5, 6.2], '#3f9bd2');         // asa de baixo (sombra)
  poly([20, 5, 13, 3.6, 3, 3.8, 0.5, 5, 3, 6.2, 13, 6.4], '#7fd3f5');
  poly([20, 5, 13, 5, 3, 5, 0.5, 5, 3, 6.2, 13, 6.4], '#4fb0e6');
  poly([3, 3.8, 0, 2, 1.8, 3.9], '#9bdcf7'); poly([3, 6.2, 0, 8, 1.8, 6.1], '#3f9bd2');
  ell(13, 5, 2.4, 1.1, '#1f4a8c'); ell(13.6, 4.7, 1, 0.45, 'rgba(255,255,255,.7)');
  ctx.restore();
}

function drawHouse(x, y, variant) {
  ctx.save(); ctx.translate(x + (variant === 'house2' ? 36 : 0), y); if (variant === 'house2') ctx.scale(-1, 1);
  groundShadow(14, 22, 15, 2);
  poly([0, 9, 4, 3, 21, 3, 25, 9], '#2a2d3a');
  poly([4, 3, 21, 3, 22.4, 5.2, 3, 5.2], '#4a4f63');
  ctx.fillStyle = '#ebe6d6'; ctx.fillRect(1, 9, 23, 12);
  ctx.fillStyle = '#c4bea8'; ctx.fillRect(16.5, 9, 7.5, 12);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(1, 9, 23, 1.6);
  ctx.fillStyle = '#4a9b4f'; ctx.fillRect(3.5, 12, 3.6, 3.4); ctx.fillRect(9.5, 12, 3.6, 3.4);
  ctx.fillStyle = '#397a3d'; ctx.fillRect(3.5, 14.2, 3.6, 1.2); ctx.fillRect(9.5, 14.2, 3.6, 1.2);
  ctx.fillStyle = '#6b4a2f'; ctx.fillRect(18.6, 14.5, 3.4, 6.5);
  ctx.fillStyle = '#5b3d22'; ctx.fillRect(29, 15.5, 2.2, 6.5);
  ell(30.5, 11.4, 5.8, 5.8, '#25652b'); ell(29, 9.8, 3.4, 3.4, '#4ea052');
  ctx.restore();
}

function drawTank(x, y, aim, dir) {
  ctx.save(); ctx.translate(x, y);
  groundShadow(14, 13.5, 14, 2);
  // esteiras
  for (const ty of [0, 10.5]) {
    rrect(0, ty, 26, 3.5, 1.6); ctx.fillStyle = '#2b2f26'; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)';
    const off = (frame * 0.5 * dir) % 3;
    for (let k = -1; k < 10; k++) { const tx = k * 3 + off + 1; if (tx > 1 && tx < 24) ctx.fillRect(tx, ty + 0.6, 1, 2.3); }
  }
  // casco
  rrect(1.5, 2.5, 23, 9, 2); ctx.fillStyle = '#6b7a3a'; ctx.fill();
  ctx.fillStyle = '#56622e'; ctx.fillRect(1.5, 7.5, 23, 3.4);
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(3, 3.2, 20, 1);
  // canhão + torre
  ctx.fillStyle = '#3d4422';
  if (aim > 0) ctx.fillRect(13, 6, 15, 2); else ctx.fillRect(-2, 6, 15, 2);
  ell(13, 7, 5, 4.4, '#7d8c45'); ell(13.6, 7.8, 4.2, 3.2, '#66733a'); ell(11.8, 5.6, 2.2, 1.4, 'rgba(255,255,255,.28)');
  ctx.restore();
}

function drawBalloon(x, y, hue, phase) {
  const bob = Math.sin(frame * 0.05 + phase) * 1.5;
  ell(x + 14, y + 30, 6, 2.2, 'rgba(0,0,30,.22)');              // sombra longe: está no ar
  ctx.save(); ctx.translate(x, y + bob);
  const c1 = hue ? '#f2b134' : '#e0453f', c2 = hue ? '#f7e27a' : '#f3efe6';
  ctx.save(); ctx.beginPath(); ctx.ellipse(8, 8.5, 7.6, 8.5, 0, 0, Math.PI * 2); ctx.clip();
  for (let k = 0; k < 5; k++) { ctx.fillStyle = k % 2 ? c2 : c1; ctx.fillRect(k * 3.2, 0, 3.2, 18); }
  const g = ctx.createLinearGradient(0, 0, 16, 0);
  g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(0.4, 'rgba(255,255,255,0)');
  g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,40,.35)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 16, 18);
  ctx.restore();
  ctx.strokeStyle = 'rgba(40,30,20,.7)'; ctx.lineWidth = 0.6;
  ctx.beginPath(); ctx.moveTo(3, 15); ctx.lineTo(6.2, 19.5); ctx.moveTo(13, 15); ctx.lineTo(9.8, 19.5); ctx.stroke();
  rrect(5.8, 19.5, 4.4, 3.6, 0.8); ctx.fillStyle = '#7a5130'; ctx.fill();
  ctx.fillStyle = '#9a6b42'; ctx.fillRect(5.8, 19.5, 4.4, 1);
  ctx.restore();
}

function drawJet(cx, top, bk, s, flame) {
  ctx.save(); ctx.translate(cx, top); ctx.scale(s, s);
  const th = bk * 0.9, c = Math.cos(th), sn = Math.sin(th);
  const spR = 2.3 + 5.5 * c * (1 - 0.3 * sn), spL = 2.3 + 5.5 * c * (1 + 0.3 * sn);   // asa de baixo encurta
  const base = '#e9c62c';
  const down = '#8f7013', up = '#ffe874';
  const rightCol = bk >= 0 ? mix(base, down, bk) : mix(base, up, -bk);
  const leftCol = bk >= 0 ? mix(base, up, bk) : mix(base, down, -bk);
  // estabilizadores
  poly([-1.8, 13, -(1.8 + 2.4 * c), 15.8, -1.8, 15.8], mix(leftCol, '#000000', 0.12));
  poly([1.8, 13, 1.8 + 2.4 * c, 15.8, 1.8, 15.8], mix(rightCol, '#000000', 0.12));
  // asas
  const wing = (sg, sp, col) => {
    poly([sg * 2.3, 6.4, sg * sp, 12.4, sg * sp, 14.2, sg * 2.3, 13.4], col);
    poly([sg * 2.3, 10, sg * sp, 13.3, sg * sp, 14.2, sg * 2.3, 13.4], 'rgba(0,0,0,.16)');
    ctx.strokeStyle = '#e8641e'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(sg * sp, 12.5); ctx.lineTo(sg * sp, 14.2); ctx.stroke();
  };
  wing(-1, spL, leftCol); wing(1, spR, rightCol);
  // fuselagem: lado esquerdo claro, direito sombreado
  const body = [0, 0, 2.2, 5, 2.6, 12, 1.6, 16, -1.6, 16, -2.6, 12, -2.2, 5];
  poly(body, '#f2d63a');
  poly([0, 0, 2.2, 5, 2.6, 12, 1.6, 16, 0, 16], '#cfae22');
  // deriva (vertical) inclina com o rolamento
  poly([-0.5 + 2.2 * sn, 11.5, 0.5 + 2.2 * sn, 11.5, 0.3, 15.6, -0.3, 15.6], '#b8921a');
  // cabine
  const kx = 1.2 * sn;
  ell(kx, 5.2, 1.4, 2.3, '#2f5fc4'); ell(kx - 0.35, 4.3, 0.55, 1, '#9fd0ff');
  // bocal + chama
  ctx.fillStyle = '#e8641e'; ctx.fillRect(-1, 15.6, 2, 1.2);
  if (flame) {
    const fl = 2 + (frame % 4) * 0.8;
    poly([-0.9, 16.8, 0.9, 16.8, 0, 16.8 + fl], '#ffb030');
    poly([-0.4, 16.8, 0.4, 16.8, 0, 16.8 + fl * 0.55], '#fff2a0');
  }
  ctx.restore();
}

function drawExplosion(x, y, t, big) {
  const sx = x, sy = VIEW_H - (y - scroll);
  const life = big ? t / 50 : t / 14, r = (big ? 4 + (1 - life) * 22 : 3 + (1 - life) * 12);
  ctx.globalAlpha = Math.min(1, life * 1.6);
  ell(sx, sy, r, r, '#c02020'); ell(sx, sy, r * 0.72, r * 0.72, '#e86020');
  ell(sx, sy, r * 0.45, r * 0.45, '#ffe040'); ell(sx, sy, r * 0.2, r * 0.2, '#ffffff');
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, VIEW_H + PANEL_H);
  if (!blocks) { drawTitle(); return; }

  ctx.fillStyle = PAL.water; ctx.fillRect(0, 0, W, VIEW_H);
  const g0 = Math.max(0, Math.floor(scroll / BH) - 1), g1 = Math.floor((scroll + VIEW_H) / BH) + 1;
  for (let ph = 0; ph < 3; ph++) for (let g = g0; g <= g1; g++) drawTerrain(getBlock(g), ph);
  for (let g = g0; g <= g1; g++) { const blk = getBlock(g); if (blk.bridge) drawBridge(blk); }
  // objetos
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (sy > VIEW_H || sy < -40) continue;
    if (o.type === 'fuel') drawFuel(o.x, sy);
    else if (o.type === 'house') drawHouse(o.x, sy, o.spr);
    else if (o.type === 'ship') drawShip(o.x, sy, o.dir);
    else if (o.type === 'heli') drawHeli(o.x, sy, o.dir);
    else if (o.type === 'tank') drawTank(o.x, sy, o.aim, o.dir);
    else if (o.type === 'balloon') drawBalloon(o.x, sy, o.hue, o.phase);
    else if (o.type === 'plane' && o.active) drawPlane(o.x, sy, o.dir);
  }
  for (const sh of shells) {
    const sy = VIEW_H - (sh.Y - scroll);
    ell(sh.x, sy, 2.6, 2.6, 'rgba(255,140,40,.35)'); ell(sh.x, sy, 1.4, 1.4, '#1c1c22');
  }
  // míssil
  if (missile) {
    const my = VIEW_H - (missile.Y + 8 - scroll);
    rrect(missile.x - 0.3, my, 2.6, 8, 1.2); ctx.fillStyle = '#ffd23a'; ctx.fill();
    ell(missile.x + 1, my + 1, 1.3, 1.6, '#ffffff');
  }
  if (state === 'play') drawJet(px + PW / 2, VIEW_H - (PLAYER_Y + PH), bank, 1, true);
  fx.forEach(e => drawExplosion(e.x, e.y, e.t, e.big));
  drawPanel();
  if (state === 'over') banner('FIM DE JOGO', 'ENTER para voltar');
  if (state === 'title') drawTitle();
}

function banner(a, b) {
  ctx.fillStyle = 'rgba(8,10,25,.72)'; rrect(20, 118, W - 40, 76, 8); ctx.fill();
  ctx.fillStyle = '#ffe45a'; ctx.textAlign = 'center';
  ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText(a, W / 2, 152);
  ctx.font = '12px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(b, W / 2, 175);
}

function drawTitle() {
  ctx.fillStyle = PAL.water; ctx.fillRect(0, 0, W, VIEW_H);
  ctx.fillStyle = PAL.dark.land; ctx.fillRect(0, 0, 70, VIEW_H); ctx.fillRect(W - 70, 0, 70, VIEW_H);
  drawJet(W / 2, 220, 0, 1.6, true);
  banner('RIVER RAID', 'ENTER para jogar');
}

function drawPanel() {
  const y0 = VIEW_H;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + PANEL_H);
  g.addColorStop(0, '#1b2036'); g.addColorStop(1, '#0c0f1c');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, PANEL_H);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, y0, W, 1);
  ctx.textAlign = 'left'; ctx.font = 'bold 20px "Courier New", monospace'; ctx.fillStyle = '#e8ecf5';
  ctx.fillText(String(score).padStart(6, '0'), 10, y0 + 24);
  // medidor de combustível
  const gx = 74, gy = y0 + 28, gw = 160, f = fuel / 100;
  rrect(gx, gy, gw, 9, 4.5); ctx.fillStyle = '#2b3042'; ctx.fill();
  if (f > 0.01) {
    rrect(gx, gy, Math.max(9, gw * f), 9, 4.5);
    const fg = ctx.createLinearGradient(gx, 0, gx + gw, 0);
    fg.addColorStop(0, '#e0453f'); fg.addColorStop(0.3, '#f2c33a'); fg.addColorStop(1, '#4fcf6a');
    ctx.fillStyle = fg; ctx.fill();
    rrect(gx, gy, Math.max(9, gw * f), 4, 2); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let k = 0; k <= 4; k++) ctx.fillRect(gx + (gw * k) / 4 - 0.4, gy + 11, 0.8, 3);
  ctx.fillStyle = '#c8cee0'; ctx.font = 'bold 10px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('E', gx - 8, gy + 8); ctx.fillText('F', gx + gw + 9, gy + 8);
  poly([gx + gw * f - 3, gy - 4, gx + gw * f + 3, gy - 4, gx + gw * f, gy + 1], '#ffffff');
  // vidas (o jato em jogo não conta)
  const n = Math.min(lives - (state === 'play' ? 1 : 0), 4);
  for (let k = 0; k < n; k++) drawJet(254 + k * 15, y0 + 14, 0, 0.9, false);
}

// ---------- loop ----------
keys = {};
state = 'title'; frame = 0; fx = []; scroll = 0;
addEventListener('keydown', e => {
  keys[e.key] = true; keys[e.key.toLowerCase()] = true;
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });

let last = performance.now(), acc = 0;
function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
