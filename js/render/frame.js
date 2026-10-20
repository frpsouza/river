// render/frame.js — MONTAGEM DE CADA QUADRO
// draw() desenha, na ordem: terreno, pontes, objetos, projéteis, míssil, jato,
// explosões e o painel (placar, combustível, vidas). Também desenha as telas de
// título e de fim de jogo.
// Usa: todos os módulos de render/ e effects.js.
'use strict';

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
    else if (o.type === 'heli') drawHeli(o.x, sy, o.dir, o.alt || 1);
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
  if (state === 'play') drawJet(px + PW / 2, VIEW_H - (PLAYER_Y + PH), bank, JET_SC, true);
  fx.forEach(drawExplosion);
  drawPanel();
  if (state === 'over') banner('FIM DE JOGO', 'ESPAÇO para voltar', ['↑ ↓ invertem a rolagem · PgUp/PgDn ou Shift+↑↓: pontes', '− / + velocidade da rolagem: ' + (overSpeed / 1.1).toFixed(2) + '×']);
  if (state === 'title') drawTitle();
}

function banner(a, b, c) {
  const lines = c ? [].concat(c) : [];
  ctx.fillStyle = 'rgba(8,10,25,.72)'; rrect(16, 118, W - 32, 76 + lines.length * 13, 8); ctx.fill();
  ctx.fillStyle = '#ffe45a'; ctx.textAlign = 'center';
  ctx.font = 'bold 22px Arial, sans-serif'; ctx.fillText(a, W / 2, 152);
  ctx.font = '12px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(b, W / 2, 175);
  ctx.font = '9.5px Arial, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,.7)';
  lines.forEach((t, k) => ctx.fillText(t, W / 2, 196 + k * 13));
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
