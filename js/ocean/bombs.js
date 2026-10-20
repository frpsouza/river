// ocean/bombs.js — a bomba do oceano (orçamento de dano + onda de choque em cascata)
// e os power-ups de recompensa dos chefes e porta-aviões.
'use strict';

let bombQueue = [];                                  // destruições da bomba agendadas pela onda de choque
const BOMB_WAVE = 6;                                  // velocidade da onda de choque (px por quadro)

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
