// effects.js — EXPLOSÕES (lógica e desenho)
// Cada tipo de inimigo tem uma "receita" em FX: bolas de fogo, anéis de choque, clarão
// e partículas (gotas, destroços, fumaça, pás de rotor, retalhos…).
//   boom(x, y, tipo) ... cria uma explosão num ponto do mundo
//   stepFx() ........... move as partículas a cada quadro (física simples: velocidade + gravidade)
//   drawExplosion(e) ... desenha uma explosão
// Usa: util.js, audio.js; para desenhar, render/canvas.js (ctx, ell).
'use strict';

// Partículas em coordenadas de tela relativas a um ponto do mundo (o efeito rola junto com o mapa).

const rnd = (a, b) => a + Math.random() * (b - a);

function parts(n, f) { const out = []; for (let k = 0; k < n; k++) out.push(f(k)); return out; }

const P = (o) => Object.assign({ x: 0, y: 0, vx: 0, vy: 0, g: 0, r: 1.5, grow: 1, rot: 0, vr: 0, shape: 'c', col: '#fff', life: 30, delay: 0 }, o);

const burst = (n, sp, o) => parts(n, () => { const a = rnd(0, 6.283), v = rnd(sp * 0.4, sp); return P(Object.assign({ vx: Math.cos(a) * v, vy: Math.sin(a) * v }, o)); });

const FX = {
  ship: o => ({ life: 46, fire: [[9, 22, 0]], rings: [['rgba(191,227,255,.8)', 26, 30, 0.35]],
    parts: [...parts(16, () => P({ vx: rnd(-1.6, 1.6), vy: rnd(-3.2, -1.2), g: 0.13, r: rnd(0.8, 1.8), col: Math.random() < 0.5 ? '#ffffff' : '#bfe3ff', life: 40 })),
            ...parts(6, () => P({ vx: rnd(-1.8, 1.8), vy: rnd(-2.4, -0.8), g: 0.1, r: rnd(1.2, 2), shape: 'r', vr: rnd(-0.3, 0.3), col: Math.random() < 0.5 ? '#b8363b' : '#f5f2ea', life: 36 }))] }),
  heli: o => ({ life: 50, fire: [[10, 20, 0]],
    parts: [...parts(2, k => P({ vx: (k ? 1 : -1) * rnd(1.2, 2), vy: rnd(-2, -1), g: 0.06, r: 4.5, shape: 'blade', vr: (k ? 1 : -1) * 0.45, col: '#ffb547', life: 46 })),
            ...burst(10, 2.6, { col: '#ffb547', r: 0.9, life: 18 }),
            ...parts(6, k => P({ x: rnd(-4, 4), y: rnd(-4, 2), vx: rnd(-0.3, 0.3), vy: rnd(-0.6, -0.25), r: rnd(2, 3), grow: 1.03, col: '#5c6378', life: 44, delay: 8 + k * 2 }))] }),
  plane: o => ({ life: 34, fire: [[9, 16, 0]], flash: 6,
    parts: [...parts(14, () => P({ vx: o.dir * rnd(1.5, 4.5), vy: rnd(-1, 1), r: rnd(0.7, 1.4), col: Math.random() < 0.5 ? '#ffe58a' : '#9fe0ff', life: 24 })),
            ...parts(4, () => P({ vx: o.dir * rnd(1, 2.5), vy: rnd(-0.8, 0.8), g: 0.05, shape: 'r', r: 1.6, vr: rnd(-0.4, 0.4), col: '#4aa8e0', life: 30 }))] }),
  fuel: o => ({ life: 64, fire: [[22, 34, 0], [14, 26, 10]], flash: 8, rings: [['rgba(255,255,255,.9)', 34, 18, 1]],
    parts: [...parts(12, k => P({ x: rnd(-5, 5), vx: rnd(-0.3, 0.3), vy: rnd(-2.2, -1), r: rnd(2.5, 4), grow: 0.97, col: ['#fff3b0', '#ffc93c', '#ff8a3d', '#e5484d'][k % 4], life: 40, delay: k * 2 })),
            ...burst(8, 3, { g: 0.1, shape: 'r', r: 1.8, vr: 0.3, col: '#e5484d', life: 40 })] }),
  tank: o => ({ life: 56, fire: [[9, 18, 0]],
    parts: [P({ vx: rnd(-0.6, 0.6), vy: -3, g: 0.12, shape: 'turret', r: 3, vr: rnd(-0.25, 0.25), col: '#7a8a45', life: 50 }),
            ...parts(12, () => P({ vx: rnd(-1.8, 1.8), vy: rnd(-2.6, -0.8), g: 0.14, r: rnd(0.8, 1.6), shape: 'r', vr: 0.3, col: Math.random() < 0.5 ? '#7a5a3c' : '#33372d', life: 36 })),
            ...parts(6, k => P({ x: rnd(-3, 3), vx: rnd(-0.2, 0.2), vy: rnd(-0.5, -0.2), r: rnd(2, 3.2), grow: 1.03, col: '#2a2a30', life: 50, delay: 6 + k * 3 }))] }),
  balloon: o => {
    const c1 = o.hue ? '#ffb547' : '#e5484d';
    return { life: 70, rings: [['rgba(255,255,255,.7)', 12, 10, 1]],
      parts: [...parts(12, k => P({ x: rnd(-6, 6), y: rnd(-8, 2), vx: rnd(-0.8, 0.8), vy: rnd(-0.9, -0.2), g: 0.025, r: rnd(1.2, 2.2), shape: 'shred', vr: rnd(-0.2, 0.2), col: k % 3 ? c1 : '#f5f2ea', life: 66, sway: rnd(0, 6) })),
              P({ y: 10, vy: 0.2, g: 0.07, shape: 'r', r: 2.2, col: '#7a5a3c', life: 60 })] };
  },
  bridge: o => ({ life: 70, fire: [[14, 24, 0], [11, 22, 8, -18], [11, 22, 14, 18]], rings: [['rgba(255,255,255,.7)', 36, 22, 1]],
    parts: [...parts(14, () => P({ x: rnd(-20, 20), vx: rnd(-2, 2), vy: rnd(-3, -1), g: 0.12, shape: 'r', r: rnd(1.6, 2.6), vr: rnd(-0.3, 0.3), col: Math.random() < 0.5 ? '#8f6c3b' : '#6a4d27', life: 50 })),
            ...parts(8, k => P({ x: rnd(-24, 24), vx: rnd(-0.3, 0.3), vy: rnd(-0.4, -0.1), r: rnd(3, 4.5), grow: 1.02, col: '#9aa1ad', life: 56, delay: 10 + k * 2 }))] }),
  player: o => ({ life: 64, fire: [[24, 36, 0], [14, 24, 12]], flash: 10, rings: [['rgba(255,255,255,.85)', 30, 18, 1]],
    parts: [...burst(18, 3.4, { col: '#ffc93c', r: 1, life: 26 }),
            ...burst(8, 2.2, { g: 0.08, shape: 'r', r: 1.8, vr: 0.3, col: '#c9901c', life: 40 }),
            ...parts(8, k => P({ x: rnd(-6, 6), vx: rnd(-0.3, 0.3), vy: rnd(-0.6, -0.2), r: rnd(3, 4.5), grow: 1.025, col: '#3a3f58', life: 56, delay: 12 + k * 2 }))] }),
};

const FX_SOUND = { ship: [140, 0.35], heli: [190, 0.3], plane: [240, 0.25], fuel: [70, 0.7], tank: [110, 0.45], balloon: [700, 0.08], bridge: [60, 0.8], player: [80, 0.7] };

function boom(x, y, kind = 'heli', o = {}) {
  const e = (FX[kind] || FX.heli)(o);
  fx.push(Object.assign({ x, y, t: e.life, kind }, e));
  const [f, d] = FX_SOUND[kind] || FX_SOUND.heli;
  beep(f, d, kind === 'balloon' ? 'triangle' : 'sawtooth', 0.06);
}

function pickupFx(x, y, def) {
  fx.push({ x, y, t: 60, life: 60, kind: 'pickup', label: def.name, labelCol: def.col, flash: 4,
    rings: [[hexA(def.col, 0.9), 26, 22, 1], ['rgba(255,255,255,.9)', 14, 14, 1]],
    parts: [...burst(14, 2.6, { col: def.col, r: 1.3, life: 30 }),
            ...parts(8, k => P({ x: Math.cos(k * 0.785) * 6, y: Math.sin(k * 0.785) * 6, vx: Math.cos(k * 0.785) * 1.4, vy: Math.sin(k * 0.785) * 1.4,
              shape: 'star', r: 2.2, vr: 0.2, col: '#ffffff', life: 26, delay: 3 }))] });
}
const hexA = (hex, a) => 'rgba(' + [1, 3, 5].map(k => parseInt(hex.slice(k, k + 2), 16)).join(',') + ',' + a + ')';

function stepFx() {
  for (const e of fx) {
    e.t--;
    const age = e.life - e.t;
    for (const p of e.parts) {
      if (age < p.delay) continue;
      p.x += p.vx + (p.sway !== undefined ? Math.sin(age * 0.18 + p.sway) * 0.35 : 0);
      p.y += p.vy; p.vy += p.g; p.rot += p.vr; p.r *= p.grow;
    }
  }
  fx = fx.filter(e => e.t > 0);
}

function drawExplosion(e) {
  const sx = e.x, sy = VIEW_H - (e.y - scroll), age = e.life - e.t;
  if (e.flash && age < e.flash) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 * (1 - age / e.flash)).toFixed(3) + ')'; ctx.fillRect(0, 0, W, VIEW_H); }
  for (const [col, R, dur, flat] of e.rings || []) {
    if (age > dur) continue;
    const q = age / dur;
    ctx.strokeStyle = col.replace(/[\d.]+\)$/, (1 - q).toFixed(2) + ')'); ctx.lineWidth = 2 * (1 - q) + 0.5;
    ctx.beginPath(); ctx.ellipse(sx, sy, R * q + 2, (R * q + 2) * flat, 0, 0, Math.PI * 2); ctx.stroke();
  }
  for (const [R, dur, delay, dx = 0] of e.fire || []) {
    const a2 = age - delay;
    if (a2 < 0 || a2 > dur) continue;
    const q = a2 / dur, r = R * (0.35 + 0.65 * Math.sqrt(q));
    ctx.globalAlpha = 1 - q * q;
    ell(sx + dx, sy, r, r, '#e5484d'); ell(sx + dx, sy, r * 0.74, r * 0.74, '#ff8a3d');
    ell(sx + dx, sy, r * 0.48, r * 0.48, '#ffc93c');
    if (q < 0.35) ell(sx + dx, sy, r * 0.24, r * 0.24, '#fff8e0');
    ctx.globalAlpha = 1;
  }
  for (const p of e.parts) {
    if (age < p.delay || age - p.delay > p.life) continue;
    const left = 1 - (age - p.delay) / p.life;
    ctx.globalAlpha = Math.min(1, left * 2.5);
    const x = sx + p.x, y = sy + p.y;
    if (p.shape === 'c') ell(x, y, p.r, p.r, p.col);
    else {
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.rot); ctx.fillStyle = p.col;
      if (p.shape === 'r') ctx.fillRect(-p.r * 1.2, -p.r * 0.5, p.r * 2.4, p.r);
      else if (p.shape === 'blade') ctx.fillRect(-p.r, -0.6, p.r * 2, 1.2);                  // pá do rotor girando
      else if (p.shape === 'turret') {                                                      // torre do tanque voando
        ctx.beginPath(); ctx.moveTo(-p.r, 1); ctx.quadraticCurveTo(0, -p.r * 1.3, p.r, 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#4c5530'; ctx.fillRect(p.r * 0.4, -1, p.r * 1.6, 0.9);
      } else if (p.shape === 'star') {                                                      // brilho de 4 pontas
        poly([0, -p.r * 1.6, p.r * 0.4, -p.r * 0.4, p.r * 1.6, 0, p.r * 0.4, p.r * 0.4, 0, p.r * 1.6, -p.r * 0.4, p.r * 0.4, -p.r * 1.6, 0, -p.r * 0.4, -p.r * 0.4], p.col);
      } else if (p.shape === 'shred') {                                                     // retalho do balão
        ctx.beginPath(); ctx.moveTo(-p.r, -p.r * 0.4); ctx.lineTo(p.r, -p.r * 0.8); ctx.lineTo(p.r * 0.6, p.r * 0.7); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  if (e.label) {                                                     // nome do power-up subindo
    const q = age / e.life;
    ctx.globalAlpha = Math.min(1, (1 - q) * 2.2);
    ctx.font = 'bold 10px Arial, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#0c0f1c'; ctx.fillText(e.label, sx + 0.8, sy - 14 - age * 0.45 + 0.8);
    ctx.fillStyle = e.labelCol; ctx.fillText(e.label, sx, sy - 14 - age * 0.45);
    ctx.globalAlpha = 1;
  }
}
