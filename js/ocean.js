// ocean.js — MODO OCEANO (baseado no modo moderno)
// O jato sobrevoa o mar aberto: não há margens nem pontes, só ilhas (cenário que se
// sobrevoa), navios, porta-aviões que lançam aviões e esquadrilhas que entram em formação
// fazendo acrobacias (looping, leque em V, varredura, espiral, oito). No fim de cada
// seção chega um CHEFE: um bombardeiro gigante com barra de vida; derrotá-lo é o checkpoint.
//
// Os aviões das esquadrilhas, os lançados e o chefe vivem em COORDENADAS DE TELA (voam
// em relação à câmera); para colidir com coisas do mundo, worldY() converte.
//
//   genOceanBlock(blk) .... mar aberto + ilhas orgânicas (sem degraus entre blocos)
//   updateOcean(...) ...... esquadrilhas, lançamentos dos porta-aviões, chefe, colisões
//   oceanMissileHit(m) .... o míssil acertou um avião ou o chefe?
//   drawOceanAir() ........ desenha aviões, chefe e a barra de vida do chefe
//
// Usa: config, util, state, effects, audio, powerups (pw), terrain (blocks, getBlock).
'use strict';

const OCEAN_WATER = '#1d5fae';
const FLIER_W = 20 * SC.plane, FLIER_H = 10 * SC.plane;
const BOSS_AT = 11;                                   // bloco da seção em que o chefe aparece
let fliers = [], squadT = 0, squadId = 0, squads = {}, boss = null, bossDone = {};

const worldY = sy => scroll + VIEW_H - sy;            // tela → mundo
const screenY = Y => VIEW_H - (Y - scroll);           // mundo → tela

function resetOcean() { fliers = []; boss = null; squadT = 240; squads = {}; }
function newOceanGame() { resetOcean(); bossDone = {}; }

// ---------- terreno: mar aberto com ilhas ----------
// As ilhas podem ser bem mais compridas que um bloco: o estado da ilha em curso passa de um
// bloco para o seguinte (blk.isle), então ela continua sem emenda. Tipos:
//   longa ...... comprida no sentido do voo (2 a 5 blocos), espinha sinuosa e largura que respira
//   arquipélago  cadeia de ilhotas em zigue-zague, separadas por canais de água
//   atol ....... anel de areia e mato com uma lagoa turquesa no meio
//   redonda .... ilha pequena e arredondada
// Cada linha guarda um só trecho de ilha (IL/IR), o mesmo formato das ilhas do rio.
const ISLE_TYPES = {
  long:  { len: [70, 160], w: [40, 90] },
  chain: { len: [90, 150], w: [26, 46] },
  atoll: { len: [40, 64],  w: [80, 130] },
  round: { len: [22, 40],  w: [40, 100] },
};
function isleHalf(st, u, t) {                          // meia-largura e centro da ilha no ponto u (0→1)
  const env = Math.pow(Math.max(0, 1 - Math.abs(2 * u - 1) ** 2.2), 0.6);   // pontas ovais (começa estreita)
  let half, c = st.cx;
  if (st.kind === 'long') { half = st.w / 2 * env * (0.72 + 0.28 * Math.sin(u * 7 + st.ph)); c += Math.sin(u * 3.2 + st.ph) * 26; }
  else if (st.kind === 'chain') { const s = Math.abs(Math.sin(u * Math.PI * st.k)); half = st.w / 2 * Math.max(0, (s - 0.28) / 0.72) * (0.6 + 0.4 * env); c += Math.sin(u * Math.PI * st.k * 0.5 + st.ph) * 34; }
  else if (st.kind === 'atoll') { half = st.w / 2 * env; c += Math.sin(u * 2 + st.ph) * 6; }
  else { half = st.w / 2 * env * (1 + 0.12 * Math.sin(t * 0.35 + st.ph)); }
  return [half, c];
}

function genOceanBlock(blk) {
  for (let i = 0; i < LINES; i++) { blk.L[i] = -40; blk.R[i] = W + 40; }   // margens fora da tela
  blk.endC = W / 2; blk.endW = W + 80;
  blk.LG = new Float32Array(LINES);                                         // meia-largura da lagoa (atol)
  const prev = blk.g > 0 ? blocks[blk.g - 1] : null;
  let st = prev && prev.isle ? Object.assign({}, prev.isle) : null;         // ilha que vem do bloco anterior
  // começar uma ilha nova neste bloco? (fora da zona de respiro e se nenhuma estiver em curso)
  let startAt = -1;
  if (!st && blk.g >= 2 && blk.b >= CALM_BLOCKS && rng() < 0.42) startAt = Math.floor(rng() * LINES);
  for (let i = 0; i < LINES; i++) {
    if (!st && i === startAt) {
      const kinds = ['long', 'long', 'chain', 'atoll', 'round', 'round'], kind = kinds[Math.floor(rng() * kinds.length)], T = ISLE_TYPES[kind];
      const w = T.w[0] + rng() * (T.w[1] - T.w[0]);
      st = { kind, t: 0, len: Math.round(T.len[0] + rng() * (T.len[1] - T.len[0])), w,
        cx: w / 2 + 6 + rng() * (W - w - 12), ph: rng() * 6.28, k: 3 + Math.floor(rng() * 3) };
    }
    if (!st) continue;
    const u = st.t / st.len, [half, c] = isleHalf(st, u, st.t);
    if (half > 1.5) {
      blk.IL[i] = c - half; blk.IR[i] = c + half;
      if (st.kind === 'atoll') blk.LG[i] = Math.max(0, half * 0.62 - st.w * 0.1);   // lagoa afina junto com o anel
    }
    if (++st.t > st.len) st = null;
  }
  blk.isle = st;                                                            // continua no próximo bloco
}

// ---------- esquadrilhas acrobáticas ----------
// cada padrão devolve, para o membro k, uma função t → [x, y] na tela
const PATTERNS = {
  loop: (k, s) => t => {                       // desce em fila, dá um looping completo e mergulha
    const v = 3, yL = 150, t1 = (yL + 20) / v, w = 0.06, R = 42;
    if (t < t1) return [s.x, -20 + t * v];
    const a = t - t1;
    if (a < 2 * Math.PI / w) { const th = (s.side > 0 ? Math.PI : 0) - s.side * w * a; return [s.x + s.side * R + R * Math.cos(th), yL + R * Math.sin(th)]; }
    return [s.x, yL + (a - 2 * Math.PI / w) * 3.2];
  },
  vee: (k, s) => t => {                        // formação em V que serpenteia e se abre em leque
    const y = -40 - Math.abs(k - 2) * 14 + t * 2;
    return [s.x + (k - 2) * 18 + Math.sin(t * 0.03) * 24 + Math.sign(k - 2) * Math.max(0, y - 170) * 0.9, y];
  },
  sweep: (k, s) => t => [s.side > 0 ? -20 + t * 2.4 : W + 20 - t * 2.4, s.y + Math.sin(t * 0.05) * 36 + t * 0.35],
  spiral: (k, s) => t => {                     // quatro aviões girando juntos enquanto descem
    const th = t * 0.07 + k * Math.PI / 2, r = 8 + t * 0.5;
    return [s.x + r * Math.cos(th), -20 + t * 1.1 + r * Math.sin(th) * 0.6];
  },
  eight: (k, s) => t => [s.x + 80 * Math.sin(t * 0.03), -20 + t * 0.9 + 36 * Math.sin(t * 0.06)],   // figura de oito
  takeoff: (k, s) => t => [s.x + s.side * (t * 1.4 + t * t * 0.006), s.y + Math.max(0, t - 35) * 1.1 + Math.sin(t * 0.05) * 8],
};
const SQUAD = { loop: [5, 14], vee: [5, 0], sweep: [6, 16], spiral: [4, 0], eight: [5, 16] };   // [membros, atraso]

function spawnSquad(kind, s, n, delay) {
  const id = ++squadId;
  squads[id] = { n, killed: 0 };
  for (let k = 0; k < n; k++)
    fliers.push({ path: PATTERNS[kind](k, s), t: -k * delay, squad: id, x: -99, y: -99, ang: Math.PI / 2, alive: true, seen: false,
      cool: 60 + Math.random() * 120 });
}

function aimShot(sx, sy, speed, spread = 0) {
  const X = sx, Y = worldY(sy);
  const dx = px + PW / 2 - X, dy = scroll + py + PH / 2 - Y;
  const a = Math.atan2(dy, dx) + spread;
  shells.push({ x: X, Y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed });
}

function destroyFlier(f, byPlayer) {
  f.alive = false;
  boom(f.x, worldY(f.y), 'plane', { dir: Math.cos(f.ang) >= 0 ? 1 : -1 });
  if (!byPlayer) return;
  addScore(120);
  const sq = squads[f.squad];
  if (sq && ++sq.killed === sq.n && sq.n > 2) {                          // esquadrilha inteira: bônus
    addScore(500);
    pickupFx(f.x, worldY(f.y), { name: 'ESQUADRILHA +500', col: '#ffc93c' });
    [784, 988, 1175, 1568].forEach((fq, k) => setTimeout(() => beep(fq, 0.1, 'triangle', 0.05), k * 55));
  }
}

// ---------- chefe: bombardeiro gigante ----------
function bossCheck(pBot) {
  const g = Math.floor(pBot / BH), s = Math.floor(g / BLOCKS_PER_SECTION), b = g % BLOCKS_PER_SECTION;
  if (boss || b < BOSS_AT || bossDone[s]) return;
  const hp = 60 + 20 * Math.min(s, 6);
  boss = { sec: s, x: W / 2, y: -90, hp, maxHp: hp, t: 0, flash: 0, dying: 0, atk: 0 };
  [196, 165, 196, 165].forEach((fq, k) => setTimeout(() => beep(fq, 0.25, 'sawtooth', 0.05), k * 260));   // alarme
}

function bossHitbox(x, y) {                                   // ponto de tela dentro do avião?
  const dx = Math.abs(x - boss.x), dy = y - boss.y;
  return (dx < 62 && Math.abs(dy + 2) < 12) || (dx < 10 && Math.abs(dy) < 42) || (dx < 26 && Math.abs(dy + 36) < 6);
}

function updateBoss(d) {
  const B = boss;
  B.t++; if (B.flash > 0) B.flash--;
  if (B.dying) {
    if (B.dying % 6 === 0) boom(B.x + rnd(-55, 55), worldY(B.y + rnd(-25, 25)), B.dying % 18 ? 'fuel' : 'bridge');
    if (--B.dying === 0) {
      boom(B.x, worldY(B.y), 'player');
      addScore(3000 + 1000 * Math.min(B.sec, 5));
      bossDone[B.sec] = true;
      checkpoint = Math.max(checkpoint, (B.sec + 1) * BLOCKS_PER_SECTION);   // derrotar o chefe é o checkpoint
      pickupFx(B.x, worldY(B.y), { name: 'CHEFE DERROTADO!', col: '#ffc93c' });
      [523, 659, 784, 1047, 1319].forEach((fq, k) => setTimeout(() => beep(fq, 0.14, 'triangle', 0.06), k * 90));
      boss = null;
    }
    return;
  }
  if (B.t < 140) { B.y = -90 + (160 * Math.min(1, B.t / 140)); return; }   // entrada
  B.x = W / 2 + Math.sin(B.t * 0.012) * (W / 2 - 75);
  B.y = 70 + Math.sin(B.t * 0.021) * 14;
  if (B.t % 22 === 0 && B.hp < B.maxHp / 2)                                 // motores fumegando
    fx.push({ x: B.x + (Math.random() < 0.5 ? -44 : 44), y: worldY(B.y), t: 40, life: 40, kind: 'smoke',
      parts: [P({ vy: -0.5, r: 3, grow: 1.03, col: '#3a3f58', life: 40 })] });
  const every = Math.max(50, 80 - 5 * Math.min(B.sec, 6));
  if (B.t % every) return;
  const spd = 1.5 + 0.3 * d, atk = B.atk++ % 3;
  if (atk === 0) for (let a = -3; a <= 3; a++) {                            // leque de 7 tiros para baixo
    const ang = Math.PI / 2 + a * 0.22;
    shells.push({ x: B.x, Y: worldY(B.y + 40), vx: Math.cos(ang) * spd, vy: -Math.sin(ang) * spd });
  }
  else if (atk === 1) for (const sp of [-0.14, 0, 0.14]) { aimShot(B.x - 30, B.y + 6, spd + 0.3, sp); aimShot(B.x + 30, B.y + 6, spd + 0.3, sp); }
  else for (const side of [-1, 1])                                         // lança dois caças das asas
    spawnSquad('takeoff', { x: B.x + side * 50, y: B.y + 4, side }, 1, 0);
}

// ---------- passo do oceano (chamado pelo update) ----------
function updateOcean(pBot, g0, g1) {
  const d = Math.min(sectionOf(pBot), 8) / 8;
  const b = Math.floor(pBot / BH) % BLOCKS_PER_SECTION;
  // novas esquadrilhas (não durante o chefe nem na zona de respiro)
  if (!boss && b >= CALM_BLOCKS && --squadT <= 0) {
    const kinds = Object.keys(SQUAD), kind = kinds[Math.floor(Math.random() * kinds.length)];
    const [n, delay] = SQUAD[kind];
    spawnSquad(kind, { x: 70 + Math.random() * (W - 140), y: 40 + Math.random() * 100, side: Math.random() < 0.5 ? 1 : -1 }, n, delay);
    squadT = 300 - 120 * d + Math.random() * 120;
  }
  // navios atiram mirando no jogador; porta-aviões lançam caças
  for (let g = Math.max(0, g0); g <= g1; g++) for (const o of blocks[g].objs) {
    if (!o.alive) continue;
    if (o.type === 'ship') { shipFire(o, d); continue; }
    if (o.type !== 'carrier') continue;
    const sy = screenY(o.Y + o.h);
    if (o.flash > 0) o.flash--;
    if (sy > 20 && sy < VIEW_H - 90 && --o.cool <= 0) {
      o.cool = 170 - 50 * d + Math.random() * 60;
      spawnSquad('takeoff', { x: o.dir > 0 ? o.x + o.w : o.x, y: sy + o.h / 2, side: o.dir }, 1, 0);
      beep(330, 0.15, 'sawtooth', 0.02);
    }
  }
  bossCheck(pBot);
  if (boss) updateBoss(d);

  // aviões: seguem o caminho, apontam o nariz para onde vão, atiram no jogador
  const pcx = px + PW / 2, pcy = VIEW_H - py - PH / 2;
  for (const f of fliers) {
    if (!f.alive || ++f.t < 0) continue;
    const [nx, ny] = f.path(f.t);
    if (f.seen) f.ang = Math.atan2(ny - f.y, nx - f.x);
    f.x = nx; f.y = ny;
    if (ny > -10 && ny < VIEW_H && nx > -10 && nx < W + 10) f.seen = true;
    if (f.t > 40 && (ny > VIEW_H + 30 || nx < -60 || nx > W + 60 || ny < -140)) { f.alive = false; continue; }
    if (ny > 10 && ny < VIEW_H - 110 && --f.cool <= 0) { f.cool = 150 - 60 * d + Math.random() * 120; aimShot(nx, ny, 1.6 + 0.4 * d); }
    if (Math.abs(nx - pcx) < 13 && Math.abs(ny - pcy) < 12 && safeT <= 0) {
      destroyFlier(f, pw.shield > 0);
      if (pw.shield <= 0) { kill(); return; }
    }
  }
  fliers = fliers.filter(f => f.alive);
  if (boss && !boss.dying && safeT <= 0 && bossHitbox(pcx, pcy)) { kill(); return; }
}

// canhão do navio (vista de cima): fica na proa, gira para o jato e dispara de tempos em tempos
function shipGun(o) {
  const sy = screenY(o.Y + o.h);
  return { x: o.dir > 0 ? o.x + o.w - 15 : o.x + 15, y: sy + o.h / 2 };
}
function shipFire(o, d) {
  if (o.gunFlash > 0) o.gunFlash--;
  const gpos = shipGun(o);
  if (gpos.y < 10 || gpos.y > VIEW_H - 40) return;                 // só atira quando está na tela, à frente do jato
  if (o.gunCool === undefined) o.gunCool = 40 + Math.random() * 80;
  if (--o.gunCool > 0) return;
  o.gunCool = 170 - 70 * d + Math.random() * 90;
  aimShot(gpos.x, gpos.y, 1.5 + 0.3 * d);
  o.gunFlash = 6;
  beep(260, 0.07, 'square', 0.025);
}

function oceanMissileHit(m, my0, my1) {
  const top = screenY(my1), bot = screenY(my0), mx = m.x + 1;
  for (const f of fliers) {
    if (!f.alive || f.t < 0) continue;
    if (Math.abs(mx - f.x) < 11 && f.y > top - 8 && f.y < bot + 8) { destroyFlier(f, true); return true; }
  }
  if (boss && !boss.dying && boss.t > 60 && bossHitbox(mx, top)) {
    boss.hp--; boss.flash = 4; addScore(10);
    fx.push({ x: mx, y: my1, t: 10, life: 10, kind: 'spark', parts: burst(5, 1.8, { col: '#ffe58a', r: 0.9, life: 10 }) });
    if (boss.hp <= 0) { boss.dying = 90; shells = []; }
    return true;
  }
  return false;
}

function oceanBomb() {                                        // BOMBA: derruba os aviões e fere o chefe
  for (const f of fliers) if (f.alive && f.t >= 0 && f.y > -10) destroyFlier(f, true);
  if (boss && !boss.dying) { boss.hp = Math.max(1, boss.hp - 15); boss.flash = 8; }
}

// ---------- desenho ----------
const FLIER_PAL = { top: '#ff9d9a', bottom: '#c23a3f', body: '#e5484d', belly: '#b8363b' };

function drawOceanAir() {
  for (const f of fliers) {
    if (!f.alive || f.t < 0) continue;
    ell(f.x + 10, f.y + 16, 7, 2, 'rgba(0,0,30,.22)');           // sombra no mar
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    drawPlane(-FLIER_W / 2, -FLIER_H / 2, 1, FLIER_PAL);
    ctx.restore();
  }
  if (boss) { drawBoss(boss); drawBossBar(boss); }
}

function drawBoss(B) {
  // bombardeiro de quatro motores visto de cima, nariz para baixo (voa em direção ao jogador)
  const x = B.x, y = B.y;
  ell(x + 22, y + 36, 70, 16, 'rgba(0,0,30,.22)');               // sombra no mar
  ctx.save(); ctx.translate(x, y);
  poly([-26, -38, 26, -38, 22, -32, -22, -32], '#5c6378');        // estabilizador horizontal
  poly([0, -38, 26, -38, 22, -32, 0, -32], '#474d60');
  poly([-66, -6, 66, -6, 58, 8, -58, 8], '#6f7588');              // asas
  poly([0, -6, 66, -6, 58, 8, 0, 8], '#5c6378');
  poly([-66, -6, -54, -6, -50, 0, -62, 0], '#ff8a3d'); poly([66, -6, 54, -6, 50, 0, 62, 0], '#ff8a3d');   // pontas laranja
  for (const ex of [-44, -22, 22, 44]) {                          // motores e hélices girando
    rrect(ex - 4, -4, 8, 18, 3); ctx.fillStyle = '#3a3f58'; ctx.fill();
    ctx.globalAlpha = 0.35; ell(ex, 15, 8, 2.2, '#c4c9d4'); ctx.globalAlpha = 1;
    const a = B.t * 0.9 + ex;
    ctx.strokeStyle = '#26334f'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(ex - Math.cos(a) * 7, 15); ctx.lineTo(ex + Math.cos(a) * 7, 15); ctx.stroke();
  }
  rrect(-9, -42, 18, 86, 8); ctx.fillStyle = '#9097a8'; ctx.fill();      // fuselagem
  ctx.save(); ctx.clip(); ctx.fillStyle = '#7d8394'; ctx.fillRect(0, -42, 9, 86); ctx.restore();
  ell(0, 34, 5, 6, '#9fe0ff'); ell(-1.5, 32.5, 1.8, 2.4, '#ffffff');      // nariz de vidro
  poly([-6, 12, 0, 18, 6, 12, 0, 15], '#ff8a3d');                         // divisa laranja
  if (B.flash > 0) {                                                      // clarão ao ser atingido
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#ffffff';
    ctx.fillRect(-66, -6, 132, 14); ctx.fillRect(-9, -42, 18, 86); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function drawBossBar(B) {
  const w = W - 60, f = Math.max(0, B.hp / B.maxHp);
  const by = 48;                                        // abaixo do HUD do topo
  rrect(30, by, w, 7, 3.5); ctx.fillStyle = 'rgba(12,15,28,.75)'; ctx.fill();
  rrect(30, by, Math.max(7, w * f), 7, 3.5); ctx.fillStyle = f > 0.3 ? '#e5484d' : '#ff8a3d'; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px Arial, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('CHEFE — SEÇÃO ' + (B.sec + 1), 32, by + 17);
}

function drawCarrier(x, y, dir, o) {
  // porta-aviões visto de cima: casco, convés com pista, ilha de comando e caças estacionados
  const L = o.w, H = o.h;
  ctx.save(); ctx.translate(x + (dir > 0 ? 0 : L), y); if (dir < 0) ctx.scale(-1, 1);   // proa para `dir`
  ctx.fillStyle = 'rgba(255,255,255,.3)';
  for (let k = 0; k < 3; k++) ctx.fillRect(-10 - k * 9, H / 2 - 3 + k * 2.5, 8, 1.2);      // esteira atrás da popa
  poly([0, 2, L - 14, 2, L, H / 2, L - 14, H - 2, 0, H - 2], '#5d6474');                   // casco
  poly([0, H / 2, L, H / 2, L - 14, H - 2, 0, H - 2], '#4a5060');
  poly([4, 4, L - 16, 4, L - 6, H / 2, L - 16, H - 4, 4, H - 4], '#6b7280');               // convés
  ctx.fillStyle = '#f5f2ea';
  for (let sx = 8; sx < L - 22; sx += 9) ctx.fillRect(sx, H / 2 - 0.5, 5, 1);              // linha da pista
  ctx.fillRect(6, 5, L - 30, 0.7);
  ctx.fillStyle = '#9aa1b2'; ctx.fillRect(L * 0.55, H - 9, 14, 6);                         // ilha de comando
  ctx.fillStyle = '#7d8394'; ctx.fillRect(L * 0.55 + 7, H - 9, 7, 6);
  ctx.fillStyle = '#26334f'; ctx.fillRect(L * 0.55 + 3, H - 8, 2, 2);
  for (const sx of [12, 24, 36]) { poly([sx + 6, 7.5, sx, 6, sx, 9], '#c4c9d4'); }        // caças no convés
  if (o.flash > 0) { ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff'; ctx.fillRect(0, 2, L, H - 4); ctx.globalAlpha = 1; }
  ctx.restore();
  if (o.hp < o.maxHp) {                                                                     // vida do porta-aviões
    rrect(x + L * 0.2, y - 5, L * 0.6, 2.5, 1.2); ctx.fillStyle = 'rgba(12,15,28,.6)'; ctx.fill();
    rrect(x + L * 0.2, y - 5, L * 0.6 * o.hp / o.maxHp, 2.5, 1.2); ctx.fillStyle = '#ff8a3d'; ctx.fill();
  }
}

// ---------- nuvens (só no oceano) ----------
// Ficam numa camada alta: andam 1,6× mais rápido que o mar (paralaxe), projetam sombra na
// água e ficam translúcidas quando o jato está embaixo, para não esconder o jogador.
const CLOUD_PAR = 1.6;
// tipos de nuvem (tamanhos em px de tela; dy negativo = para cima):
//   flocos ... grupo pequeno e redondo          torre .... cúmulo alto, empilhado
//   faixa .... banco comprido no sentido do voo (até ~260 px), serpenteando
//   fiapos ... véus finos e esticados na vertical, mais transparentes
// cada floco: [dx, dy, raio, esticamento vertical]
function getClouds(blk) {
  if (blk.clouds) return blk.clouds;
  const r = mulberry32(blk.seed ^ 0xc10d), list = [];
  if (r() < 0.45) {
    const k = r(), x = r() * W, Y = blk.g * BH + r() * BH, puffs = [];
    let kind, alpha = 0.88;
    if (k < 0.32) {                                     // flocos
      kind = 'puff';
      const cw = 40 + r() * 60;
      for (let p = 0; p < 5 + Math.floor(r() * 4); p++) puffs.push([(r() - 0.5) * cw, (r() - 0.5) * cw * 0.4, cw * (0.16 + r() * 0.14), 1]);
    } else if (k < 0.62) {                              // faixa comprida e sinuosa
      kind = 'bank';
      const len = 120 + r() * 140, ph = r() * 6.28, amp = 12 + r() * 22;
      for (let d = 0; d < len; d += 12 + r() * 6) {
        const sx = Math.sin(d * 0.025 + ph) * amp, rr = 13 + r() * 12 * (0.6 + 0.4 * Math.sin(Math.PI * d / len));
        puffs.push([sx, -d, rr, 1.1]);
        if (r() < 0.6) puffs.push([sx + (r() < 0.5 ? -1 : 1) * rr * 0.9, -d - r() * 8, rr * 0.7, 1]);
      }
    } else if (k < 0.82) {                              // fiapos esticados
      kind = 'wisp'; alpha = 0.6;
      const n = 3 + Math.floor(r() * 3);
      for (let p = 0; p < n; p++) puffs.push([(r() - 0.5) * 50, -r() * 140, 5 + r() * 6, 3.5 + r() * 3]);
    } else {                                            // torre (cúmulo)
      kind = 'tower';
      const h = 70 + r() * 70;
      for (let d = 0; d < h; d += 10) { const rr = 24 * (1 - d / h * 0.55) * (0.85 + r() * 0.3); puffs.push([(r() - 0.5) * 14, -d, rr, 0.9]); }
    }
    list.push({ x, Y, kind, alpha, puffs });
  }
  return (blk.clouds = list);
}
const cloudY = c => VIEW_H - (c.Y - scroll) * CLOUD_PAR;

function forClouds(fn) {
  // nuvens altas começam abaixo da tela e se estendem para cima: olha blocos um pouco antes
  const g0 = Math.max(0, Math.floor((scroll - 200) / BH)), g1 = Math.floor((scroll + (VIEW_H + 80) / CLOUD_PAR) / BH);
  for (let g = g0; g <= g1; g++) for (const c of getClouds(getBlock(g))) fn(c, cloudY(c));
}

function drawCloudShadows() {
  forClouds((c, y) => { for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx + 24, y + dy + 34, r, r * 0.8 * st, 'rgba(0,0,40,' + (c.kind === 'wisp' ? '.05' : '.10') + ')'); });
}

function drawClouds() {
  const jx = px + PW / 2, jy = VIEW_H - py - PH / 2;
  forClouds((c, y) => {
    if (y - 300 > VIEW_H || y + 40 < -300) return;
    const over = state === 'play' && c.puffs.some(([dx, dy, r, st]) => Math.abs(jx - c.x - dx) < r + 4 && Math.abs(jy - y - dy) < r * st + 4);
    ctx.globalAlpha = over ? Math.min(0.45, c.alpha) : c.alpha;
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx, y + dy + r * 0.25, r, r * 0.85 * st, '#d6e2f0');   // base sombreada
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx - r * 0.12, y + dy - r * 0.08, r * 0.9, r * 0.78 * st, '#ffffff');
    ctx.globalAlpha = 1;
  });
}
