// objects.js — OBJETOS DO MAPA
// Cada bloco recebe um objeto sorteado (combustível, navio, helicóptero, casa, tanque ou
// balão), às vezes um avião, e a ponte pode ter um tanque atravessando. A posição é
// sorteada com a semente do bloco, então o mesmo bloco sempre tem os mesmos objetos.
//
// Usa: config.js, util.js, terrain.js (lineAt, waterFree).
'use strict';

function spawnObjs(blk) {
  blk.objs = [];
  if (blk.g < 2) return;
  const r = mulberry32(blk.seed);
  const base = blk.g * BH;
  if (blk.bridge) {
    // tanque atravessando a ponte pela estrada (dá para acertar enquanto está sobre o rio)
    if (r() < 0.6) {
      const dir = r() < 0.5 ? 1 : -1;
      blk.objs.push({ type: 'tank', onRoad: true, x: dir > 0 ? 4 : W - 23, Y: base + 12 * LINE, w: 19, h: 10,
        alive: true, dir, aim: dir, vx: 0.5 + Math.min(blk.s, 8) * 0.05, minX: 0, maxX: W - 19 });
    }
    return;
  }
  const k = r();
  const type = k < 0.26 ? 'fuel' : k < 0.46 ? 'ship' : k < 0.66 ? 'heli' : k < 0.78 ? 'house' : k < 0.9 ? 'tank' : 'balloon';
  const calm = blk.b < CALM_BLOCKS && type !== 'fuel' && type !== 'house';   // zona de respiro: sem inimigos
  const dims = { fuel: [18, 28], ship: [43, 14], heli: [27, 19], house: [36, 23], tank: [19, 10], balloon: [24, 36] }[type];
  const [w, h] = dims;
  for (let tries = 0; tries < 30 && !calm; tries++) {
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
      if (cliffHit(x - 2, x + w + 2, Y, Y + h)) continue;          // nunca dentro de um paredão
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
      moving: type !== 'fuel' && r() < 0.8, alt: 1, altPh: r() * 6.28, altSp: 0.6 + r() * 0.8 });
    break;
  }
  // avião inimigo ocasional: cruza a tela quando o jogador se aproxima
  if (blk.g > 3 && blk.b >= CALM_BLOCKS && r() < 0.18)
    blk.objs.push({ type: 'plane', x: -100, Y: base + 22 * LINE, w: 25, h: 13, alive: true,
      dir: r() < 0.5 ? -1 : 1, active: false, vx: 2.2 + Math.min(blk.s, 10) * 0.1 });
  spawnPowerup(blk, r);                              // modo moderno (powerups.js)
}

// altitude do helicóptero: 0,55 (baixo, pequeno) a 1,15 (alto, um pouco maior que o normal).

// O tamanho e a área de colisão mudam juntos, mantendo o centro no lugar.

const HELI_W = 27, HELI_H = 19;

function heliAltitude(o) {
  o.alt = 0.85 + 0.3 * Math.sin(frame * 0.01 * o.altSp + o.altPh);
  const cx = o.x + o.w / 2, cy = o.Y + o.h / 2;
  o.w = HELI_W * o.alt; o.h = HELI_H * o.alt;
  o.x = cx - o.w / 2; o.Y = cy - o.h / 2;
}
