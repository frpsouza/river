// ocean/bosses.js — os quatro CHEFES do oceano (BOSS_KINDS): entrada, padrões de ataque,
// defesas, tiros e a sequência de queda (bossDie) até o respingo no mar.
'use strict';

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
  if (B.hp <= 0) { B.dying = 1; shells = []; }                            // começa a queda (bossDie)
  return true;
}

// derrota do chefe: ele não some — perde o controle, solta fumaça preta dos motores, pega fogo,
// gira e deriva enquanto cai (vista de cima: encolhe ao se afastar da câmera rumo ao mar) e
// termina num grande respingo no oceano; só então vêm os pontos, o checkpoint e a cura
const BOSS_FALL = 150;                                // duração da queda (quadros)
const bossFallScale = B => B.fall ? 1 - 0.7 * (B.fall.t / BOSS_FALL) : 1;
function bossDie(B) {
  if (!B.fall) {
    const sg = () => (Math.random() < 0.5 ? -1 : 1);
    B.fall = { t: 0, vx: sg() * rnd(0.3, 0.7), vr: sg() * rnd(0.012, 0.022), rot: 0 };
    [622, 554, 494, 440, 392, 349, 311, 277].forEach((f, k) => setTimeout(() => beep(f, 0.22, 'sine', 0.03), k * 150));   // assobio de queda
  }
  const F = B.fall, u = ++F.t / BOSS_FALL, s = bossFallScale(B);
  B.x += F.vx; B.y += 0.25 + u * 0.6; F.rot += F.vr * (0.5 + u);
  const at = d => [B.x + Math.cos(F.rot) * d * s, B.y + Math.sin(F.rot) * d * s];   // ponto da asa, girado com o avião
  if (F.t % 2 === 0) for (const d of [-40, 0, 40]) {                       // fumaça preta e cinza
    const [x, y] = at(d + rnd(-6, 6));
    fx.push({ x, y: worldY(y), t: 64, life: 64, kind: 'smoke',
      parts: [P({ x: rnd(-2, 2), vx: rnd(-0.2, 0.2), vy: -rnd(0.1, 0.4), r: (2.5 + Math.random() * 2) * (0.6 + s * 0.6), grow: 1.035, col: Math.random() < 0.6 ? '#26334f' : '#5c6378', life: 64 })] });
  }
  if (F.t % 7 === 0) { const [x, y] = at(rnd(-44, 44)); fx.push({ x, y: worldY(y), t: 16, life: 16, kind: 'flame', fire: [[7 * s + 2, 16, 0]], parts: [] }); }   // motores em chamas
  if (F.t % 18 === 0 && u < 0.7) { const [x, y] = at(rnd(-40, 40)); boom(x, worldY(y), 'fuel'); }                         // explosões
  if (F.t < BOSS_FALL) return;
  // respingo no oceano
  boom(B.x, worldY(B.y), 'carrier');
  fx.push({ x: B.x, y: worldY(B.y), t: 80, life: 80, kind: 'splash', flash: 6,
    rings: [['rgba(191,227,255,.95)', 110, 56, 0.5, 0, 6], ['rgba(255,255,255,.9)', 70, 44, 0.5, 8, 4], ['rgba(191,227,255,.8)', 150, 70, 0.5, 16, 3]],
    parts: [...parts(46, () => P({ x: rnd(-20, 20), vx: rnd(-1.8, 1.8), vy: rnd(-4.5, -1.5), g: 0.12, r: rnd(1, 2.4), col: Math.random() < 0.5 ? '#ffffff' : '#bfe3ff', life: 60 })),
            ...parts(16, k => { const a = k / 16 * Math.PI * 2; return P({ x: Math.cos(a) * 14, y: Math.sin(a) * 6, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 0.5, r: 3.5, grow: 1.02, col: '#f5f2ea', life: 70, delay: 6 }); })] });
  shake(5, 30);
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
