// ocean/update.js — o passo do modo oceano, chamado pelo update.js a cada quadro:
// esquadrilhas, lançamentos dos porta-aviões, chefe, altitude e colisões.
'use strict';

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
