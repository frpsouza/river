// ocean.js — MODO OCEANO (baseado no modo moderno)
// O jato sobrevoa o mar aberto: não há margens nem pontes, só ilhas (cenário que se
// sobrevoa), navios, porta-aviões que lançam aviões e esquadrilhas que entram em formação
// fazendo acrobacias. No fim de cada seção chega um CHEFE (quatro tipos, cada um com ataque
// e defesa próprios); derrotá-lo é o checkpoint. Aqui não há vidas extras: só a barra de vida.
// O voo alterna entre RASANTE (perto do mar: navios atiram, postos curam) e ALTO (acima das
// nuvens: só o combate aéreo importa); as lutas com chefes são lá em cima.
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
const bossSection = s => s % 2 === 1;                 // chefe a cada duas seções (2ª, 4ª, …): ~25 s de viagem entre eles
let fliers = [], squadT = 0, squadId = 0, squads = {}, boss = null, bossDone = {};
let camSp = 0;
let bombQueue = [];                                  // destruições da bomba agendadas pela onda de choque
const BOMB_WAVE = 6;                                  // velocidade da onda de choque (px por quadro)                                        // velocidade da câmera no passo atual (update.js)
// altitude: altT vai de 0 (rasante) a 1 (acima das nuvens), suavemente
const ALT_LOW = 14 * 60, ALT_HIGH = 10 * 60;          // duração de cada fase (quadros)
let altT = 0, altTarget = 0, altTimer = ALT_LOW, altMsg = 0, altText = '';
const oceanHigh = () => isOcean() && altT > 0.25;   // alto: a superfície fica fora de alcance

const worldY = sy => scroll + VIEW_H - sy;            // tela → mundo
const screenY = Y => VIEW_H - (Y - scroll);           // mundo → tela

function resetOcean() { maneuver = null; bombQueue = []; fliers = []; boss = null; squadT = 240; squads = {}; altT = 0; altTarget = 0; altTimer = ALT_LOW; altMsg = 0; }
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
  for (let i = 0; i < LINES; i++) { blk.L[i] = -400; blk.R[i] = W + 400; } // margens bem fora da tela (mesmo com o zoom do voo alto)
  blk.endC = W / 2; blk.endW = W + 800;
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
  pincer: (k, s) => {                          // pinça: metade entra pela esquerda, metade pela direita, e se cruzam
    const side = k % 2 ? 1 : -1, y0 = 30 + Math.floor(k / 2) * 26;
    return t => [side > 0 ? -20 + t * 2.6 : W + 20 - t * 2.6, y0 + t * 0.9 + Math.sin(t * 0.06) * 18];
  },
  dive: (k, s) => t => {                       // mergulho no ponto onde o jato estava e arremetida para o lado
    const x0 = s.x + (k - 1.5) * 22;
    if (t < 70) return [x0 + (s.tx - x0) * (t / 70) ** 2 * 0.8, -20 + t * 3];
    const a = t - 70;
    return [x0 + (s.tx - x0) * 0.8 + s.side * a * 2.4, 190 - a * 1.4 + a * a * 0.012];
  },
  zigzag: (k, s) => t => {                     // zigue-zague em fila
    const tri = 2 * Math.abs((t / 40) % 2 - 1) - 1;
    return [s.x + tri * 70 + (k - 2) * 14, -20 + t * 1.6 - k * 10];
  },
};
const SQUAD = { loop: [5, 14], vee: [5, 0], sweep: [6, 16], spiral: [4, 0], eight: [5, 16],
                pincer: [6, 10], dive: [4, 6], zigzag: [5, 0] };   // [membros, atraso]

function spawnSquad(kind, s, n, delay) {
  const id = ++squadId;
  squads[id] = { n, killed: 0 };
  for (let k = 0; k < n; k++)
    fliers.push({ path: PATTERNS[kind](k, s), t: -k * delay, squad: id, x: -99, y: -99, ang: Math.PI / 2, alive: true, seen: false,
      cool: 60 + Math.random() * 120, rollPh: Math.random() * 200 });   // rollPh: quando dá o parafuso
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
    pickupFx(f.x, worldY(f.y), { name: 'SQUADRON +500', col: '#ffc93c' });
    dropPowerup(f.x - 7, worldY(f.y) - 7, Math.random() < 0.5 ? 'bomb' : null);   // e solta um power-up
    [784, 988, 1175, 1568].forEach((fq, k) => setTimeout(() => beep(fq, 0.1, 'triangle', 0.05), k * 55));
  }
}

// ---------- chefes: quatro tipos, cada um com ataque e defesa próprios ----------
//   bombardeiro ... ataque: leque, rajadas mirando, lança caças · defesa: nenhuma (aguenta muito)
//   canhoneira .... ataque: espiral, muralha com brecha, foguetes teleguiados · defesa: escudo frontal intermitente
//   dirigível ..... ataque: 4 torres que miram, minas flutuantes, escoltas · defesa: núcleo blindado enquanto houver torre
//   interceptador . ataque: rajadas, investida em mergulho + onda de choque · defesa: esquiva mísseis e é intocável na investida
const BOSS_KINDS = ['bomber', 'gunship', 'airship', 'interceptor'];
const BOSS_INFO = {
  bomber:      { name: 'BOMBER',        hp: 60, rx: 64, ry: 14 },
  gunship:     { name: 'GUNSHIP',       hp: 80, rx: 56, ry: 22 },
  airship:     { name: 'AIRSHIP',       hp: 50, rx: 66, ry: 26 },
  interceptor: { name: 'INTERCEPTOR',   hp: 70, rx: 30, ry: 26 },
};
const BOSS_Y = 92;                                    // altura de patrulha dos chefes (abaixo do HUD e da barra de vida)
const AIRSHIP_TURRETS = [[-46, 8], [-20, 18], [20, 18], [46, 8]];   // na borda da frente (virada para o jato)

function bossCheck(pBot) {
  const g = Math.floor(pBot / BH), s = Math.floor(g / BLOCKS_PER_SECTION), b = g % BLOCKS_PER_SECTION;
  if (boss || b < BOSS_AT || bossDone[s] || !bossSection(s)) return;
  const kind = BOSS_KINDS[((s - 1) / 2) % BOSS_KINDS.length], hp = BOSS_INFO[kind].hp + 15 * Math.min(s, 8);
  boss = { kind, sec: s, x: W / 2, y: -90, hp, maxHp: hp, t: 0, flash: 0, dying: 0, atk: 0, mode: 'hover', modeT: 0, shield: 0, trail: [] };
  if (kind === 'airship') boss.turrets = AIRSHIP_TURRETS.map(([dx, dy], k) => ({ dx, dy, hp: 8 + 2 * Math.min(s, 6), cool: 40 + k * 20, flash: 0 }));
  [196, 165, 196, 165].forEach((fq, k) => setTimeout(() => beep(fq, 0.25, 'sawtooth', 0.05), k * 260));   // alarme
}

function bossHitbox(x, y) {                                   // ponto de tela dentro do chefe?
  const B = boss, dx = x - B.x, dy = y - B.y;
  if (B.kind === 'bomber') { const ax = Math.abs(dx); return (ax < 62 && Math.abs(dy + 2) < 12) || (ax < 10 && Math.abs(dy) < 42) || (ax < 26 && Math.abs(dy + 36) < 6); }
  const i = BOSS_INFO[B.kind];
  return (dx / i.rx) ** 2 + (dy / i.ry) ** 2 < 1;
}

function ping(x, sy) {                                        // tiro rebatido pela defesa do chefe
  fx.push({ x, y: worldY(sy), t: 10, life: 10, kind: 'spark', parts: burst(5, 1.6, { col: '#ffffff', r: 0.8, life: 10 }) });
  beep(1500, 0.04, 'square', 0.02);
}

function bossShot(mx, sy) {                                    // míssil chegando no chefe: true se foi consumido
  const B = boss;
  if (!B || B.dying || B.t < 60) return false;
  if (B.kind === 'airship') for (const tu of B.turrets) {
    // a torre fica no casco: um míssil alinhado com ela acerta a torre ao chegar no casco (ou nela)
    const near = Math.hypot(mx - (B.x + tu.dx), sy - (B.y + tu.dy)) < 9 || (Math.abs(mx - (B.x + tu.dx)) < 8 && bossHitbox(mx, sy));
    if (tu.hp <= 0 || !near) continue;
    tu.hp--; tu.flash = 4; addScore(10);
    if (tu.hp <= 0) { boom(B.x + tu.dx, worldY(B.y + tu.dy), 'tank'); addScore(300); }
    return true;
  }
  if (!bossHitbox(mx, sy)) return false;
  if (B.kind === 'interceptor' && B.mode === 'dash') { ping(mx, sy); return true; }          // intocável na investida
  if (B.kind === 'gunship' && B.shield > 0 && sy > B.y - 4) { ping(mx, sy); return true; }   // escudo frontal
  if (B.kind === 'airship' && B.turrets.some(t => t.hp > 0)) { ping(mx, sy); return true; }  // núcleo blindado
  B.hp--; B.flash = 4; addScore(10);
  fx.push({ x: mx, y: worldY(sy), t: 10, life: 10, kind: 'spark', parts: burst(5, 1.8, { col: '#ffe58a', r: 0.9, life: 10 }) });
  if (B.hp <= 0) { B.dying = 90; shells = []; }
  return true;
}

function bossDie(B) {
  if (B.dying % 6 === 0) boom(B.x + rnd(-55, 55), worldY(B.y + rnd(-25, 25)), B.dying % 18 ? 'fuel' : 'bridge');
  if (--B.dying) return;
  boom(B.x, worldY(B.y), 'player');
  addScore(3000 + 1000 * Math.min(B.sec, 5));
  bossDone[B.sec] = true;
  checkpoint = Math.max(checkpoint, (B.sec + 1) * BLOCKS_PER_SECTION);   // derrotar o chefe é o checkpoint
  hp = Math.min(100, hp + 40);                                           // e recupera 40 de vida
  pickupFx(B.x, worldY(B.y), { name: 'BOSS DOWN! +40', col: '#ffc93c' });
  [523, 659, 784, 1047, 1319].forEach((fq, k) => setTimeout(() => beep(fq, 0.14, 'triangle', 0.06), k * 90));
  boss = null;
  setAltitude(0);                                                        // volta ao voo rasante
}

function updateBoss(d) {
  const B = boss;
  B.t++; if (B.flash > 0) B.flash--;
  if (B.dying) { bossDie(B); return; }
  if (B.t < 140) { B.y = -90 + (BOSS_Y + 90) * Math.min(1, B.t / 140); return; }   // entrada
  if (B.t % 22 === 0 && B.hp < B.maxHp / 2)                                 // fumaça quando está mal
    fx.push({ x: B.x + (Math.random() < 0.5 ? -30 : 30), y: worldY(B.y), t: 40, life: 40, kind: 'smoke',
      parts: [P({ vy: -0.5, r: 3, grow: 1.03, col: '#3a3f58', life: 40 })] });
  const spd = 1.5 + 0.3 * d, pcx = px + PW / 2, pcy = VIEW_H - py - PH / 2, T = B.t - 140;
  if (T > 0 && T % 300 === 150) bossDrop();                                // a cada ~5 s, um power-up de ajuda

  if (B.kind === 'bomber') {
    B.x = W / 2 + Math.sin(B.t * 0.012) * (W / 2 - 75);
    B.y = BOSS_Y + Math.sin(B.t * 0.021) * 14;
    const every = Math.max(50, 80 - 5 * Math.min(B.sec, 6));
    if (B.t % every) return;
    const atk = B.atk++ % 3;
    if (atk === 0) for (let a = -3; a <= 3; a++) {                          // leque de 7 tiros
      const ang = Math.PI / 2 + a * 0.22;
      shells.push({ x: B.x, Y: worldY(B.y + 40), vx: Math.cos(ang) * spd, vy: -Math.sin(ang) * spd });
    }
    else if (atk === 1) for (const sp of [-0.14, 0, 0.14]) { aimShot(B.x - 30, B.y + 6, spd + 0.3, sp); aimShot(B.x + 30, B.y + 6, spd + 0.3, sp); }
    else for (const side of [-1, 1]) spawnSquad('takeoff', { x: B.x + side * 50, y: B.y + 4, side }, 1, 0);
  }

  else if (B.kind === 'gunship') {
    B.x = W / 2 + Math.sin(B.t * 0.01) * (W / 2 - 70);
    B.y = BOSS_Y + 10 + Math.sin(B.t * 0.02) * 20;
    if (T % 420 === 0) { B.shield = 180; beep(880, 0.2, 'sine', 0.03); }   // liga o escudo de tempos em tempos
    if (B.shield > 0) B.shield--;
    const phase = Math.floor(T / 150) % 3, loc = T % 150;
    if (phase === 0 && loc < 90 && loc % 4 === 0)                          // espiral de dois braços
      for (const arm of [0, Math.PI]) { const a = B.t * 0.18 + arm; shells.push({ x: B.x, Y: worldY(B.y + 10), vx: Math.cos(a) * spd, vy: -Math.sin(a) * spd }); }
    if (phase === 1 && (loc === 20 || loc === 80)) {                       // muralha com uma brecha
      const gap = 1 + Math.floor(Math.random() * 8);
      for (let k = 0; k < 11; k++) if (k !== gap && k !== gap + 1) shells.push({ x: 12 + k * 28, Y: worldY(B.y + 20), vx: 0, vy: -spd * 0.9 });
    }
    if (phase === 2 && (loc === 10 || loc === 70))                         // foguetes teleguiados
      for (const side of [-1, 1]) shells.push({ x: B.x + side * 40, Y: worldY(B.y + 8), vx: side * 0.6, vy: -1.0, kind: 'rocket', t: 0 });
  }

  else if (B.kind === 'airship') {
    B.x = W / 2 + Math.sin(B.t * 0.006) * (W / 2 - 80);
    B.y = BOSS_Y + 10;
    for (const tu of B.turrets) {                                          // cada torre mira e atira
      if (tu.flash > 0) tu.flash--;
      if (tu.hp > 0 && --tu.cool <= 0) { tu.cool = 85 - 20 * d + Math.random() * 30; aimShot(B.x + tu.dx, B.y + tu.dy, spd); }
    }
    if (T % 140 === 70) shells.push({ x: B.x + rnd(-20, 20), Y: worldY(B.y + 30), vx: rnd(-0.3, 0.3), vy: -0.35, kind: 'mine', t: 0 });
    if (T % 420 === 300) spawnSquad('pincer', { x: W / 2, y: 0, side: 1 }, 4, 10);   // escolta
  }

  else if (B.kind === 'interceptor') {
    B.trail.push([B.x, B.y]); if (B.trail.length > 8) B.trail.shift();
    B.modeT++;
    if (B.mode === 'hover') {
      B.x += (pcx + Math.sin(B.t * 0.03) * 60 - B.x) * 0.02;
      B.y = BOSS_Y + Math.sin(B.t * 0.05) * 8;
      for (const m of missiles) {                                          // esquiva: desvia de míssil vindo de baixo
        const msy = screenY(m.Y + 8);
        if (Math.abs(m.x - B.x) < 34 && msy > B.y && msy - B.y < 90) B.x += m.x < B.x ? 2.6 : -2.6;
      }
      B.x = clamp(B.x, 40, W - 40);
      if (B.modeT % 50 === 0) for (const sp of [-0.1, 0, 0.1]) aimShot(B.x, B.y + 20, spd + 0.4, sp);
      if (B.modeT > 220) { B.mode = 'aim'; B.modeT = 0; B.tx = pcx; B.ty = clamp(pcy, 140, VIEW_H - 60); }
    } else if (B.mode === 'aim') {                                        // telegrafa a investida (treme)
      B.x += Math.sin(B.modeT * 1.7) * 1.2;
      if (B.modeT === 1) beep(330, 0.4, 'sawtooth', 0.04);
      if (B.modeT > 32) { B.mode = 'dash'; B.modeT = 0; B.vx = (B.tx - B.x) / 34; B.vy = (B.ty - B.y) / 34; }
    } else if (B.mode === 'dash') {
      B.x += B.vx; B.y += B.vy;
      if (B.modeT >= 34) {                                                 // fim da investida: onda de choque
        for (let k = 0; k < 14; k++) { const a = k * Math.PI * 2 / 14; shells.push({ x: B.x, Y: worldY(B.y), vx: Math.cos(a) * spd, vy: -Math.sin(a) * spd }); }
        boom(B.x, worldY(B.y), 'plane', { dir: 1 });
        B.mode = 'back'; B.modeT = 0;
      }
    } else if (B.mode === 'back') {
      B.y += (BOSS_Y - B.y) * 0.06;
      if (B.modeT > 60) { B.mode = 'hover'; B.modeT = 0; }
    }
  }
}

// ---------- altitude (rasante ↔ acima das nuvens) ----------
// ---------- manobra do jato na troca de altitude ----------
// subindo: LOOPING (o jato sobe na tela, vira de cabeça para baixo e volta, crescendo ao se
// aproximar da câmera); descendo: MERGULHO EM PARAFUSO (giro completo com o nariz apontando
// para o mar). Durante a manobra o jato não atira e não leva dano; deixa rastros de condensação.
let maneuver = null;                                  // { kind: 'loop' | 'dive', t, dur }
function maneuverPose() {                             // pose visual do jato: deslocamento e escalas
  if (!maneuver) return { dy: 0, sx: 1, sy: 1, s: 1 };
  const u = maneuver.t / maneuver.dur, th = u * Math.PI * 2;
  if (maneuver.kind === 'loop')
    return { dy: -Math.sin(Math.PI * u) * 46, sx: 1, sy: Math.cos(th), s: 1 + 0.4 * Math.sin(Math.PI * u) };   // sobe e volta; vira de cabeça para baixo no meio
  return { dy: Math.sin(Math.PI * u) * 22, sx: Math.cos(th), sy: 1 - 0.7 * Math.sin(Math.PI * u), s: 1 - 0.25 * Math.sin(Math.PI * u) };
}
function stepManeuver() {
  if (!maneuver) return;
  if (++maneuver.t >= maneuver.dur) { maneuver = null; return; }
  if (maneuver.t % 2 === 0) {                         // rastros de condensação nas pontas das asas
    const p = maneuverPose(), cx = px + PW / 2, cy = scroll + py + PH / 2 - p.dy;
    for (const side of [-1, 1])
      fx.push({ x: cx + side * 8 * p.s * Math.abs(p.sx), y: cy - 6, t: 28, life: 28, kind: 'trail',
        parts: [P({ r: 1.6, grow: 1.035, col: '#ffffff', life: 28 })] });
  }
}

function setAltitude(v) {
  if (altTarget === v) return;
  altTarget = v; altTimer = v ? ALT_HIGH : ALT_LOW; altMsg = 150;
  if (state === 'play') {                             // manobra + ronco (sobe) ou assobio (desce)
    maneuver = { kind: v ? 'loop' : 'dive', t: 0, dur: v ? 96 : 84 };
    (v ? [110, 147, 196, 262, 330] : [880, 740, 587, 466, 370]).forEach((fq, k) => setTimeout(() => beep(fq, 0.18, v ? 'sawtooth' : 'triangle', 0.03), k * 110));
  }
  altText = v ? '▲  ABOVE THE CLOUDS' : '▼  LOW-LEVEL FLIGHT';
  (v ? [330, 440, 554, 660] : [660, 554, 440, 330]).forEach((fq, k) => setTimeout(() => beep(fq, 0.12, 'sine', 0.035), k * 70));
}
function updateAltitude() {
  if (boss) setAltitude(1);                                   // chefes: luta lá em cima
  else if (--altTimer <= 0) setAltitude(altTarget ? 0 : 1);
  altT += clamp(altTarget - altT, -1 / 150, 1 / 150);         // transição de 2,5 s
  if (altMsg > 0) altMsg--;
}

// ---------- tiros especiais: foguete teleguiado e mina ----------
function stepSpecialShell(sh) {                               // devolve tiros novos (mina explodindo) ou null
  if (sh.kind === 'rocket') {
    if (sh.t++ < 100) {                                       // persegue o jato por ~1,7 s
      const want = Math.atan2(scroll + py + PH / 2 - sh.Y, px + PW / 2 - sh.x), cur = Math.atan2(sh.vy, sh.vx);
      let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const a = cur + clamp(da, -0.045, 0.045), v = Math.min(2, Math.hypot(sh.vx, sh.vy) + 0.03);
      sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v;
    }
  } else if (sh.kind === 'mine') {
    sh.t++;
    if (Math.hypot(px + PW / 2 - sh.x, scroll + py + PH / 2 - sh.Y) < 30 || sh.t > 420) {   // detona perto do jato
      sh.dead = true;
      boom(sh.x, sh.Y, 'heli');
      const out = [];
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; out.push({ x: sh.x, Y: sh.Y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 }); }
      return out;
    }
  }
  return null;
}

// ---------- passo do oceano (chamado pelo update) ----------
function updateOcean(pBot, g0, g1) {
  const d = Math.min(sectionOf(pBot), 8) / 8;
  const b = Math.floor(pBot / BH) % BLOCKS_PER_SECTION, high = oceanHigh();
  updateAltitude();
  for (const q of bombQueue) if (--q.t <= 0) q.act();                // cascata da bomba
  bombQueue = bombQueue.filter(q => q.t > 0);
  // novas esquadrilhas (não durante o chefe nem na zona de respiro); lá em cima vêm em dobro
  squadT -= high ? 2 : 1;
  if (!boss && b >= CALM_BLOCKS && squadT <= 0) {
    const kinds = Object.keys(SQUAD), kind = kinds[Math.floor(Math.random() * kinds.length)];
    const [n, delay] = SQUAD[kind];
    spawnSquad(kind, { x: 70 + Math.random() * (W - 140), y: 40 + Math.random() * 100, side: Math.random() < 0.5 ? 1 : -1, tx: px + PW / 2 }, n, delay);
    squadT = 300 - 120 * d + Math.random() * 120;
  }
  // inimigos de superfície: navios navegam e atiram, helicópteros perseguem, balões vão com o vento
  for (let g = Math.max(0, g0); g <= g1; g++) for (const o of blocks[g].objs) {
    if (!o.alive) continue;
    if (o.type === 'ship') { shipMove(o); if (!high) shipFire(o, d); continue; }
    if (o.type === 'heli') { heliChase(o, d, high); continue; }
    if (o.type === 'balloon') { o.x += Math.sin(frame * 0.01 + o.phase) * 0.4; o.Y += 0.15; continue; }
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
    if (f.t > 40 && (ny > VIEW_H + 30 || nx < -60 || nx > W + 60 || ny < -160)) { f.alive = false; continue; }
    if (ny > 10 && ny < VIEW_H - 110 && --f.cool <= 0) { f.cool = 150 - 60 * d + Math.random() * 120; aimShot(nx, ny, 1.6 + 0.4 * d); }
    if (Math.abs(nx - pcx) < 13 && Math.abs(ny - pcy) < 12 && safeT <= 0 && hurtT <= 0 && !maneuver) {
      destroyFlier(f, pw.shield > 0);
      if (pw.shield <= 0 && hurt(30)) return;
    }
  }
  fliers = fliers.filter(f => f.alive);
  if (boss && !boss.dying && boss.t > 140 && bossHitbox(pcx, pcy) && hurt(50)) return;
}

// navio: navega com rumo que oscila até ±29° em torno da horizontal e dá meia-volta ao
// encontrar ilha ou a borda da tela (hdg = ângulo no mundo, 0 = para a direita)
function shipMove(o) {
  if (o.base === undefined) { o.base = o.dir > 0 ? 0 : Math.PI; o.sp = 0.45 + Math.random() * 0.5; o.ph = Math.random() * 6.28; o.moving = false; }
  const sy = screenY(o.Y + o.h);
  if (sy < -60 || sy > VIEW_H + 60) return;
  const off = 0.5 * Math.sin(frame * 0.012 + o.ph);
  o.hdg = o.base + (o.base === 0 ? off : -off);
  const nx = o.x + Math.cos(o.hdg) * o.sp, nY = o.Y + Math.sin(o.hdg) * o.sp * 0.7;
  if (nx > -10 && nx < W - o.w + 10 && waterFree(nx, nx + o.w, nY, nY + o.h)) { o.x = nx; o.Y = nY; }
  else o.base = o.base === 0 ? Math.PI : 0;                              // meia-volta
  o.dir = Math.cos(o.hdg) >= 0 ? 1 : -1;
}

// helicóptero: acompanha a câmera por um tempo (fica na metade de cima da tela), persegue
// o jato pelos lados, ziguezagueando, e atira quando o voo está baixo
function heliChase(o, d, high) {
  if (o.ph === undefined) { o.ph = Math.random() * 6.28; o.moving = false; o.fireCool = 60 + Math.random() * 90; }
  const sy = screenY(o.Y + o.h);
  if (sy < -40 || sy > VIEW_H) return;
  const tx = px + PW / 2 + Math.sin(frame * 0.02 + o.ph) * 60 - o.w / 2;
  o.x += clamp(tx - o.x, -1.1, 1.1);
  o.dir = tx > o.x ? 1 : -1;
  if (sy < VIEW_H * 0.5) o.Y += camSp * 0.75;                            // "pega carona" na câmera
  if (!high && sy > 10 && --o.fireCool <= 0) { o.fireCool = 150 - 50 * d + Math.random() * 60; aimShot(o.x + o.w / 2, sy + o.h / 2, 1.5 + 0.3 * d); beep(300, 0.05, 'square', 0.02); }
}

// canhão do navio (vista de cima): fica perto da proa, gira para o jato e dispara de tempos em tempos
function shipGun(o) {
  const sy = screenY(o.Y + o.h), a = -(o.hdg || (o.dir > 0 ? 0 : Math.PI)), r = o.w / 2 - 15;
  return { x: o.x + o.w / 2 + Math.cos(a) * r, y: sy + o.h / 2 + Math.sin(a) * r };
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
  for (const sh of shells) {                                   // dá para derrubar foguetes e minas
    if (!sh.kind || sh.dead) continue;
    const ssy = screenY(sh.Y);
    if (Math.abs(mx - sh.x) < 6 && ssy > top - 6 && ssy < bot + 6) { sh.dead = true; boom(sh.x, sh.Y, 'plane', { dir: 1 }); addScore(20); return true; }
  }
  return bossShot(mx, top);
}

// BOMBA do oceano: um "orçamento" de dano. Primeiro apaga todos os tiros inimigos; depois
// derruba os inimigos pequenos mais próximos do jato (1 ponto cada) até o orçamento acabar;
// o que sobrar fere porta-aviões (até 6 cada) e o chefe (até 15). Não resolve tudo sozinha.
function oceanBomb(budget = BOMB_POWER) {
  for (const sh of shells) fx.push({ x: sh.x, y: sh.Y, t: 12, life: 12, kind: 'spark', parts: burst(3, 1, { col: '#ffffff', r: 0.8, life: 12 }) });
  shells = [];
  const pcx = px + PW / 2, pcy = VIEW_H - py - PH / 2, low = !oceanHigh(), small = [];
  for (const f of fliers) if (f.alive && f.t >= 0 && f.y > -10 && f.y < VIEW_H) small.push({ d: Math.hypot(f.x - pcx, f.y - pcy), kill: () => destroyFlier(f, true) });
  const g0 = Math.max(0, Math.floor(scroll / BH) - 1), g1 = Math.floor((scroll + VIEW_H) / BH) + 1, carriers = [];
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive || !low) continue;                                    // lá do alto a bomba não chega à superfície
    const sy = screenY(o.Y + o.h);
    if (sy < -o.h || sy > VIEW_H) continue;
    if (o.type === 'carrier') { carriers.push(o); continue; }
    if (['ship', 'heli', 'balloon', 'plane'].includes(o.type) && !(o.type === 'plane' && !o.active))
      small.push({ d: Math.hypot(o.x + o.w / 2 - pcx, sy + o.h / 2 - pcy), kill: () => {
        o.alive = false; addScore({ ship: 30, heli: 60, plane: 100, balloon: 60 }[o.type]); boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o); } });
  }
  // cada alvo é atingido quando a onda de choque chega até ele (cascata do mais perto ao mais longe)
  const later = (d, act) => bombQueue.push({ t: Math.round(d / BOMB_WAVE), act });
  small.sort((p, q) => p.d - q.d);
  for (const t of small) { if (budget <= 0) break; later(t.d, t.kill); budget--; }
  for (const o of carriers) {
    if (budget <= 0) break;
    const dmg = Math.min(budget, 6, o.hp); budget -= dmg;
    later(Math.hypot(o.x + o.w / 2 - pcx, screenY(o.Y + o.h / 2) - pcy), () => {
      if (!o.alive) return;
      o.hp -= dmg; o.flash = 8;
      if (o.hp <= 0) { o.alive = false; addScore(800); boom(o.x + o.w / 2, o.Y + o.h / 2, 'carrier', o); carrierDrops(o); }
    });
  }
  if (boss && !boss.dying && boss.t > 140 && budget > 0) later(Math.hypot(boss.x - pcx, boss.y - pcy), () => bossBombHit(budget));
}

function bossBombHit(budget) {
  if (boss && !boss.dying) {
    let dmg = Math.min(budget, 15);
    if (boss.kind === 'airship') for (const tu of boss.turrets) {               // dirigível: a bomba pega as torres primeiro
      if (dmg <= 0 || tu.hp <= 0) continue;
      const k = Math.min(dmg, tu.hp); tu.hp -= k; dmg -= k; tu.flash = 6;
      if (tu.hp <= 0) { boom(boss.x + tu.dx, worldY(boss.y + tu.dy), 'tank'); addScore(300); }
    }
    if (dmg > 0 && !(boss.kind === 'airship' && boss.turrets.some(t => t.hp > 0))) {
      boss.hp = Math.max(1, boss.hp - dmg); boss.flash = 8;
    }
    boom(boss.x + rnd(-30, 30), worldY(boss.y + rnd(-10, 10)), 'fuel');
  }
}

// power-ups de recompensa: caem durante a luta com o chefe (a cada ~5 s), quando uma
// esquadrilha inteira é derrubada e quando um porta-aviões afunda
const BOSS_DROPS = [['bomb', 0.34], ['shield', 0.2], ['triple', 0.2], ['rapid', 0.14], ['life', 0.12]];
function dropPowerup(x, Y, kind) {
  if (!kind) { let k = Math.random(); kind = 'bomb'; for (const [name, w] of BOSS_DROPS) { if (k < w) { kind = name; break; } k -= w; } }
  x = clamp(x, 6, W - PU_SIZE - 6);
  getBlock(Math.floor(Y / BH)).objs.push({ type: 'pu', kind, x, Y, w: PU_SIZE, h: PU_SIZE, alive: true, phase: Math.random() * 6.28 });
  fx.push({ x: x + 7, y: Y + 7, t: 24, life: 24, kind: 'spark', parts: burst(10, 1.6, { col: PU[kind].col, r: 1.2, life: 24 }) });
  beep(988, 0.08, 'triangle', 0.04); setTimeout(() => beep(1319, 0.1, 'triangle', 0.04), 70);
}
function bossDrop() { dropPowerup(30 + Math.random() * (W - 74), worldY(150 + Math.random() * 60)); }
function carrierDrops(o) {                            // porta-aviões afundado: uma bomba e mais um power-up
  dropPowerup(o.x + o.w / 2 - 20, o.Y + o.h / 2, 'bomb');
  dropPowerup(o.x + o.w / 2 + 6, o.Y + o.h / 2 + 10);
}

// ---------- desenho ----------
const FLIER_PAL = { top: '#ff9d9a', bottom: '#c23a3f', body: '#e5484d', belly: '#b8363b' };

function drawOceanAir() {
  for (const f of fliers) {
    if (!f.alive || f.t < 0) continue;
    ell(f.x + 10 + 18 * altT, f.y + 16 + 26 * altT, 7, 2, 'rgba(0,0,30,' + (0.22 - 0.14 * altT).toFixed(2) + ')');   // sombra no mar
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.ang);
    const rp = (f.t + f.rollPh) % 200;                           // parafuso: de tempos em tempos gira no eixo
    if (rp < 26) ctx.scale(1, Math.cos(rp / 26 * Math.PI * 2));
    drawPlane(-FLIER_W / 2, -FLIER_H / 2, 1, FLIER_PAL);
    ctx.restore();
  }
  if (boss) { drawBoss(boss); drawBossBar(boss); }
}

function drawBoss(B) {
  if (B.kind === 'gunship') return drawGunship(B);
  if (B.kind === 'airship') return drawAirship(B);
  if (B.kind === 'interceptor') return drawInterceptor(B);
  drawBomber(B);
}

const bossShadow = (B, rx, ry) => ell(B.x + 22 + 20 * altT, B.y + 36 + 30 * altT, rx, ry, 'rgba(0,0,30,' + (0.22 - 0.12 * altT).toFixed(2) + ')');
function bossFlash(B, draw) { if (B.flash > 0) { ctx.globalAlpha = 0.55; draw(); ctx.globalAlpha = 1; } }

function drawGunship(B) {
  // canhoneira: asa voadora em delta, dois motores de brilho ciano, pods de foguete; escudo em arco na frente
  bossShadow(B, 60, 16);
  ctx.save(); ctx.translate(B.x, B.y);
  const wing = [0, 30, 58, -18, 40, -24, 0, -14, -40, -24, -58, -18];
  poly(wing, '#3a3f58'); poly([0, 30, 58, -18, 40, -24, 0, -14], '#2c3044');
  poly([-58, -18, -46, -20, -44, -14, -56, -12], '#4fd1e0'); poly([58, -18, 46, -20, 44, -14, 56, -12], '#4fd1e0');
  for (const ex of [-20, 20]) {
    rrect(ex - 6, -28, 12, 14, 4); ctx.fillStyle = '#26334f'; ctx.fill();
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(B.t * 0.4 + ex); ell(ex, -30, 4.5, 3, '#4fd1e0'); ctx.globalAlpha = 1;
  }
  for (const pxd of [-44, 36]) { rrect(pxd, -14, 8, 18, 3); ctx.fillStyle = '#5c6378'; ctx.fill(); ell(pxd + 4, 5, 2.4, 2.4, '#e5484d'); }
  ell(0, 10, 5, 9, '#9fe0ff'); ell(-1.5, 6.5, 1.8, 3, '#ffffff');
  bossFlash(B, () => poly(wing, '#ffffff'));
  if (B.shield > 0) {                                          // escudo frontal (pisca ao acabar)
    if (B.shield > 40 || frame % 8 < 4) {
      ctx.globalAlpha = 0.18; ctx.beginPath(); ctx.ellipse(0, 8, 66, 36, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.lineTo(0, 8); ctx.closePath(); ctx.fillStyle = '#4fd1e0'; ctx.fill();
      ctx.globalAlpha = 0.9; ctx.strokeStyle = '#9ff3ff'; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.ellipse(0, 8, 66, 36, 0, 0.12 * Math.PI, 0.88 * Math.PI); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

function drawAirship(B) {
  // dirigível visto de cima: envelope comprido, faixas vermelhas, gôndola com hélices e quatro torres
  bossShadow(B, 68, 22);
  ctx.save(); ctx.translate(B.x, B.y);
  poly([62, 0, 76, -16, 80, -16, 72, 0, 80, 16, 76, 16], '#8a90a0');                     // lemes na cauda
  ell(0, 0, 66, 26, '#c9cfdb');
  ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 66, 26, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#aab1c0'; ctx.fillRect(-70, 2, 140, 30);
  ctx.fillStyle = '#e5484d'; ctx.fillRect(-30, -30, 8, 60); ctx.fillRect(22, -30, 8, 60);
  ctx.restore();
  ell(-20, -10, 30, 6, 'rgba(255,255,255,.35)');
  rrect(-16, -6, 32, 12, 5); ctx.fillStyle = '#5c6378'; ctx.fill();                       // gôndola
  for (const gx of [-20, 20]) { const a = B.t * 0.8; ctx.strokeStyle = '#26334f'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(gx, -Math.cos(a) * 6); ctx.lineTo(gx, Math.cos(a) * 6); ctx.stroke(); }
  const armored = B.turrets.some(t => t.hp > 0);
  if (armored) { ctx.strokeStyle = 'rgba(255,201,60,' + (0.35 + 0.2 * Math.sin(B.t * 0.15)).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(0, 0, 70, 30, 0, 0, Math.PI * 2); ctx.stroke(); }
  bossFlash(B, () => ell(0, 0, 66, 26, '#ffffff'));
  for (const tu of B.turrets) {
    if (tu.hp <= 0) { ell(tu.dx, tu.dy, 5, 5, '#1c1c22'); ell(tu.dx - 1, tu.dy - 1, 2, 2, '#3a3f58'); continue; }
    const a = Math.atan2(VIEW_H - py - PH / 2 - (B.y + tu.dy), px + PW / 2 - (B.x + tu.dx));
    ctx.save(); ctx.translate(tu.dx, tu.dy); ctx.rotate(a); ctx.fillStyle = '#26334f'; ctx.fillRect(0, -1, 9, 2); ctx.restore();
    ell(tu.dx, tu.dy, 5.5, 5.5, tu.flash > 0 ? '#ffffff' : '#3a3f58'); ell(tu.dx - 1.2, tu.dy - 1.2, 2, 2, '#5c6378');
  }
  ctx.restore();
}

function drawInterceptor(B) {
  // interceptador: caça grande de asas enflechadas, vermelho e preto, pós-combustão; rastro na investida
  const shape = (x, y, a) => {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a;
    poly([0, 30, 30, -10, 34, -22, 10, -14, 0, -26, -10, -14, -34, -22, -30, -10], '#26334f');
    poly([0, 30, 30, -10, 34, -22, 10, -14, 0, -26], '#1b2438');
    poly([30, -10, 34, -22, 28, -20, 25, -9], '#e5484d'); poly([-30, -10, -34, -22, -28, -20, -25, -9], '#e5484d');
    ctx.restore(); ctx.globalAlpha = 1;
  };
  if (B.mode === 'dash' || B.mode === 'back') B.trail.forEach(([x, y], k) => shape(x, y, 0.08 + 0.05 * k));
  bossShadow(B, 34, 14);
  if (B.mode === 'aim') {                                       // aviso: linha tracejada até o alvo
    ctx.strokeStyle = 'rgba(229,72,77,' + (0.4 + 0.4 * Math.sin(B.modeT * 0.6)).toFixed(2) + ')'; ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(B.x, B.y); ctx.lineTo(B.tx, B.ty); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(B.tx, B.ty, 10, 0, Math.PI * 2); ctx.stroke();
  }
  shape(B.x, B.y, 1);
  ctx.save(); ctx.translate(B.x, B.y);
  const burn = B.mode === 'dash' ? 9 : 4 + Math.sin(B.t * 0.6);
  for (const ex of [-6, 6]) { ell(ex, -27 - burn / 2, 3, burn / 2 + 1, '#ff8a3d'); ell(ex, -27 - burn / 3, 1.6, burn / 3, '#fff3b0'); }
  ell(0, 8, 4, 7, '#ff9d9a'); ell(-1, 5.5, 1.4, 2.4, '#ffffff');
  bossFlash(B, () => poly([0, 30, 30, -10, 34, -22, 10, -14, 0, -26, -10, -14, -34, -22, -30, -10], '#ffffff'));
  ctx.restore();
}

function drawBomber(B) {
  // bombardeiro de quatro motores visto de cima, nariz para baixo (voa em direção ao jogador)
  const x = B.x, y = B.y;
  bossShadow(B, 70, 16);                                           // sombra no mar
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
  const by = 6;                                         // no topo (o HUD do oceano fica embaixo)
  rrect(24, by - 3, W - 48, 30, 8); ctx.fillStyle = 'rgba(12,15,28,.55)'; ctx.fill();   // fundo: legível sobre as nuvens
  rrect(30, by, w, 7, 3.5); ctx.fillStyle = 'rgba(12,15,28,.75)'; ctx.fill();
  rrect(30, by, Math.max(7, w * f), 7, 3.5); ctx.fillStyle = f > 0.3 ? '#e5484d' : '#ff8a3d'; ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 8px Arial, sans-serif'; ctx.textAlign = 'left';
  const st = B.kind === 'gunship' && B.shield > 0 ? ' · SHIELD' : B.kind === 'airship' && B.turrets.some(t => t.hp > 0) ? ' · ARMORED (' + B.turrets.filter(t => t.hp > 0).length + ' turrets)' : B.kind === 'interceptor' && B.mode === 'dash' ? ' · UNTOUCHABLE' : '';
  ctx.fillText(BOSS_INFO[B.kind].name + ' — SECTION ' + (B.sec + 1) + st, 32, by + 17);
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

// mult: opacidade da camada (as nuvens aparecem acima do jato no rasante e abaixo dele no voo alto)
// below: true quando desenhadas abaixo do jato (não precisam ficar translúcidas sobre ele)
function drawClouds(mult = 1, below = false) {
  if (mult <= 0.01) return;
  const jx = px + PW / 2, jy = VIEW_H - py - PH / 2;
  forClouds((c, y) => {
    if (y - 300 > VIEW_H || y + 40 < -300) return;
    const over = !below && state === 'play' && c.puffs.some(([dx, dy, r, st]) => Math.abs(jx - c.x - dx) < r + 4 && Math.abs(jy - y - dy) < r * st + 4);
    ctx.globalAlpha = (over ? Math.min(0.45, c.alpha) : c.alpha) * mult;
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx, y + dy + r * 0.25, r, r * 0.85 * st, '#d6e2f0');   // base sombreada
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx - r * 0.12, y + dy - r * 0.08, r * 0.9, r * 0.78 * st, '#ffffff');
    ctx.globalAlpha = 1;
  });
}

// convés de nuvens visto de cima (voo alto): grandes massas brancas que encobrem parte do mar
function getDeck(blk) {
  if (blk.deck) return blk.deck;
  const r = mulberry32(blk.seed ^ 0xdec4), list = [];
  for (let k = 0; k < 2; k++) {
    const x = r() * W, Y = blk.g * BH + r() * BH, puffs = [];
    for (let p = 0; p < 8; p++) puffs.push([(r() - 0.5) * 120, -(r()) * 70, 18 + r() * 22, 0.8]);
    list.push({ x, Y, puffs });
  }
  return (blk.deck = list);
}
function drawCloudDeck(mult) {
  if (mult <= 0.01) return;
  const g0 = Math.max(0, Math.floor((scroll - 120) / BH)), g1 = Math.floor((scroll + VIEW_H + 40) / BH);
  for (let g = g0; g <= g1; g++) for (const c of getDeck(getBlock(g))) {
    const y = VIEW_H - (c.Y - scroll);
    ctx.globalAlpha = 0.82 * mult;
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx, y + dy + r * 0.25, r, r * 0.85 * st, '#d6e2f0');
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx - r * 0.12, y + dy - r * 0.08, r * 0.9, r * 0.78 * st, '#ffffff');
  }
  ctx.globalAlpha = 1;
}
