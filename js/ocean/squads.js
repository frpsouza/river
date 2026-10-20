// ocean/squads.js — esquadrilhas acrobáticas (PATTERNS) e os inimigos que andam no mar
// (navios e helicópteros que perseguem o jato), mais oceanMissileHit(): o míssil acertou
// um avião ou o chefe?
'use strict';

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
