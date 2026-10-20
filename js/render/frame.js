// render/frame.js — MONTAGEM DE CADA QUADRO
// draw() desenha, na ordem: terreno, pontes, objetos, projéteis, míssil, jato,
// explosões e o painel (placar, combustível, vidas). Também desenha as telas de
// título e de fim de jogo.
// Usa: todos os módulos de render/ e effects.js.
'use strict';

function draw() {
  const scr = syncCanvas();                                         // modos em pixel art têm renderizador próprio
  if (scr === 'retro') return drawRetro();
  if (scr === 'pico') return drawPico();
  const [shx, shy] = shakeXY();                                   // tremor de tela (bomba)
  ctx.setTransform(SCALE, 0, 0, SCALE, shx * SCALE, shy * SCALE);
  ctx.fillStyle = '#000'; ctx.fillRect(-20, -20, W + 40, SCREEN_H + 40);
  if (!blocks) { drawTitle(); return; }

  ctx.fillStyle = isOcean() ? OCEAN_WATER : PAL.water; ctx.fillRect(0, 0, W, VIEW_H);
  // oceano: quanto mais alto o voo, menor e mais enevoado fica o mar (a superfície encolhe para o centro)
  const zs = isOcean() ? 1 - 0.28 * smooth(altT) : 1, ext = VIEW_H * (1 / zs - 1) / 2;
  if (zs < 1) { ctx.save(); ctx.translate(W / 2, VIEW_H / 2); ctx.scale(zs, zs); ctx.translate(-W / 2, -VIEW_H / 2); }
  const g0 = Math.max(0, Math.floor((scroll - ext) / BH) - 1), g1 = Math.floor((scroll + VIEW_H + ext) / BH) + 1;
  for (let ph = 0; ph < 6; ph++) for (let g = g0; g <= g1; g++) drawTerrain(getBlock(g), ph);
  for (let g = g0; g <= g1; g++) { const blk = getBlock(g); if (blk.bridge) drawBridge(blk); }
  for (let g = g0; g <= g1; g++) drawCliffs(getBlock(g));          // paredões (modo moderno)
  if (isOcean()) drawCloudShadows();
  // objetos
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (!o.alive) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (sy > VIEW_H + ext || sy < -40 - ext) continue;
    if (isOcean()) {                                         // oceano: tudo visto de cima
      if (o.type === 'fuel') drawFuelTop(o.x, sy);
      else if (o.type === 'ship') {                                 // gira conforme o rumo; o canhão mira o jato
        const gp = shipGun(o), rot = -(o.hdg !== undefined ? o.hdg : (o.dir > 0 ? 0 : Math.PI));
        const aim = Math.atan2(VIEW_H - py - PH / 2 - gp.y, px + PW / 2 - gp.x);
        ctx.save(); ctx.translate(o.x + o.w / 2, sy + o.h / 2); ctx.rotate(rot);
        drawShipTop(-o.w / 2, -o.h / 2, 1, aim - rot, o.gunFlash || 0);
        ctx.restore();
      }
      else if (o.type === 'heli') drawHeliTop(o.x, sy, o.dir, o.alt || 1);
      else if (o.type === 'balloon') drawBalloonTop(o.x, sy, o.hue, o.phase);
      else if (o.type === 'pu') drawPowerup(o, sy);
      else if (o.type === 'carrier') drawCarrier(o.x, sy, o.dir, o);
      else if (o.type === 'plane' && o.active) { ctx.save(); ctx.translate(o.x + o.w / 2, sy + o.h / 2); ctx.rotate(o.dir > 0 ? 0 : Math.PI); drawPlane(-o.w / 2, -o.h / 2, 1, FLIER_PAL); ctx.restore(); }
      continue;
    }
    if (o.type === 'fuel') drawFuel(o.x, sy);
    else if (o.type === 'house') drawHouse(o.x, sy, o.spr);
    else if (o.type === 'ship') drawShip(o.x, sy, o.dir);
    else if (o.type === 'heli') drawHeli(o.x, sy, o.dir, o.alt || 1);
    else if (o.type === 'tank') drawTank(o.x, sy, o.aim, o.dir);
    else if (o.type === 'balloon') drawBalloon(o.x, sy, o.hue, o.phase);
    else if (o.type === 'pu') drawPowerup(o, sy);
    else if (o.type === 'carrier') drawCarrier(o.x, sy, o.dir, o);
    else if (o.type === 'plane' && o.active) drawPlane(o.x, sy, o.dir);
  }
  if (zs < 1) ctx.restore();
  if (isOcean() && altT > 0) {                               // névoa da altitude + nuvens abaixo do jato
    ctx.fillStyle = 'rgba(205,225,245,' + (0.32 * altT).toFixed(3) + ')'; ctx.fillRect(0, 0, W, VIEW_H);
    drawCloudDeck(altT); drawClouds(altT, true);
  }
  if (isOcean()) drawOceanAir();
  for (const sh of shells) drawShell(sh, VIEW_H - (sh.Y - scroll));
  // míssil
  for (const m of missiles) {
    const my = VIEW_H - (m.Y + 8 - scroll);
    rrect(m.x - 0.3, my, 2.6, 8, 1.2); ctx.fillStyle = pw.rapid > 0 ? '#ffe58a' : '#ffd23a'; ctx.fill();
    ell(m.x + 1, my + 1, 1.3, 1.6, '#ffffff');
  }
  if (state === 'play' && !isClassic()) {                      // voo livre: sombra do jato lá embaixo
    const a = isOcean() ? altT : 0;                             // mais alto = sombra mais longe e mais fraca
    ell(px + PW / 2 + 7 + 22 * a, VIEW_H - py - PH * 0.35 + 9 + 34 * a, PW * 0.42 * (1 - 0.3 * a), 3, 'rgba(0,0,30,' + (0.28 - 0.18 * a).toFixed(2) + ')');
  }
  if (state === 'play') {
    if ((safeT > 0 || hurtT > 0) && frame % 10 < 5) ctx.globalAlpha = 0.35;   // pisca enquanto está protegido
    drawJet(px + PW / 2, VIEW_H - (py + PH), bank, JET_SC * (isOcean() ? 1 + 0.12 * altT : 1), true);   // no alto, mais perto da câmera
    ctx.globalAlpha = 1;
  }
  if (state === 'play') drawShield(px + PW / 2, VIEW_H - py - PH / 2);
  if (state === 'play' && !isClassic() && (hurtT > 0 || hp < 40)) {   // barrinha de vida sobre o jato
    const bx = px + PW / 2 - 12, by = VIEW_H - py - PH - 7;
    rrect(bx, by, 24, 3, 1.5); ctx.fillStyle = 'rgba(12,15,28,.7)'; ctx.fill();
    rrect(bx, by, Math.max(3, 24 * hp / 100), 3, 1.5); ctx.fillStyle = hp > 50 ? '#3fbf6a' : hp > 25 ? '#ffc93c' : '#e5484d'; ctx.fill();
  }
  fx.forEach(drawExplosion);
  if (isOcean()) drawClouds(1 - altT);                       // no rasante, as nuvens passam por cima de tudo
  if (isClassic()) drawPanel(); else drawHudTop();          // clássico: painel embaixo · voo livre: HUD no topo
  if (state === 'over') banner('GAME OVER', 'SPACE to return', ['↑ ↓ reverse scrolling · PgUp/PgDn or Shift+↑↓: bridges', '− / + scroll speed: ' + (overSpeed / 1.1).toFixed(2) + '×']);
  if (state === 'title') drawTitle();
}

// projétil dos tanques: bem visível, com contraste laranja/branco/vermelho
// (rastro atrás, halo vermelho pulsando, corpo laranja com contorno escuro e núcleo branco)
function drawShell(sh, sy) {
  if (sh.kind === 'rocket') {                                        // foguete teleguiado: corpo, aletas e chama
    const a = Math.atan2(-sh.vy, sh.vx);
    ctx.save(); ctx.translate(sh.x, sy); ctx.rotate(a);
    ell(-8, 0, 4 + (frame % 3), 2, '#ff8a3d'); ell(-7, 0, 2, 1.1, '#fff3b0');
    rrect(-5, -1.6, 10, 3.2, 1.6); ctx.fillStyle = '#e8ecf5'; ctx.fill();
    poly([5, -1.6, 8, 0, 5, 1.6], '#e5484d'); poly([-5, -1.6, -7, -3.4, -3, -1.6], '#e5484d'); poly([-5, 1.6, -7, 3.4, -3, 1.6], '#e5484d');
    ctx.restore(); return;
  }
  if (sh.kind === 'mine') {                                          // mina flutuante: esfera com espetos e luz piscando
    const r = 4.2;
    ctx.strokeStyle = '#26334f'; ctx.lineWidth = 1.3;
    ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + frame * 0.02; ctx.moveTo(sh.x, sy); ctx.lineTo(sh.x + Math.cos(a) * (r + 3), sy + Math.sin(a) * (r + 3)); } ctx.stroke();
    ell(sh.x, sy, r, r, '#3a3f58'); ell(sh.x - 1.2, sy - 1.2, 1.5, 1.5, '#5c6378');
    ell(sh.x, sy, 1.4, 1.4, frame % 20 < 10 ? '#ff4d4d' : '#7a1f1f'); return;
  }
  const sv = Math.hypot(sh.vx, sh.vy || 0) || 1, bx = -sh.vx / sv, by = (sh.vy || 0) / sv;   // rastro oposto ao movimento (na tela)
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.4 + sh.x * 0.1);
  for (let k = 3; k >= 1; k--)                                       // rastro: vermelho → laranja
    ell(sh.x + bx * k * 3.2, sy + by * k * 3.2, 3.2 - k * 0.6, 2.4 - k * 0.4, ['#ffc93c', '#ff8a3d', '#e5484d'][k - 1]);
  ctx.globalAlpha = 0.35 + 0.25 * pulse;
  ell(sh.x, sy, 5.5 + pulse * 1.5, 5.5 + pulse * 1.5, '#e5484d');   // halo vermelho pulsando
  ctx.globalAlpha = 1;
  ctx.beginPath(); ctx.arc(sh.x, sy, 3.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ff8a3d'; ctx.fill();
  ctx.strokeStyle = '#26334f'; ctx.lineWidth = 0.8; ctx.stroke();    // contorno escuro: destaca na água clara
  ell(sh.x, sy, 1.7, 1.7, '#ffffff');                                 // núcleo branco
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

const TITLE_OPT_Y = 96, TITLE_OPT_GAP = 36;          // topo da 1ª opção de modo e distância entre elas

function drawTitle() {
  ctx.fillStyle = PAL.water; ctx.fillRect(0, 0, W, VIEW_H);
  ctx.fillStyle = PAL.dark.land; ctx.fillRect(0, 0, 70, VIEW_H); ctx.fillRect(W - 70, 0, 70, VIEW_H);
  drawJet(W / 2, 326, 0, 1.2, true);
  ctx.fillStyle = 'rgba(8,10,25,.78)'; rrect(16, 52, W - 32, 266, 8); ctx.fill();
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe45a'; ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillText('RIVER RAID', W / 2, 82);
  const opts = [['classic', '1  CLASSIC', 'banks and islands are deadly, like the Atari original'],
                ['modern', '2  MODERN', 'free flight · rock walls · power-ups'],
                ['ocean', '3  OCEAN', 'open sea · carriers · squadrons · bosses · clouds'],
                ['retro', '4  RETRO OCEAN', 'the ocean in pixel art, 240×320'],
                ['pico', '5  CLASSIC - PICO-8', 'classic mode at 128×128, 16-color palette']];
  opts.forEach(([m, name, desc], k) => {
    const y = TITLE_OPT_Y + k * TITLE_OPT_GAP, on = mode === m;
    rrect(32, y, W - 64, 32, 6); ctx.fillStyle = on ? '#ffc93c' : 'rgba(255,255,255,.08)'; ctx.fill();
    ctx.fillStyle = on ? '#26334f' : '#e8ecf5'; ctx.font = 'bold 13px Arial, sans-serif'; ctx.fillText(name, W / 2, y + 14);
    ctx.fillStyle = on ? '#26334f' : 'rgba(255,255,255,.6)'; ctx.font = '9px Arial, sans-serif'; ctx.fillText(desc, W / 2, y + 26);
  });
  ctx.fillStyle = '#fff'; ctx.font = '11px Arial, sans-serif';
  ctx.font = '10px Arial, sans-serif';
  ctx.fillText('arrows or click to choose · ENTER or 2nd click to play', W / 2, TITLE_OPT_Y + opts.length * TITLE_OPT_GAP + 16);
}

// HUD dos modos de voo livre: no topo, por cima do cenário (pílulas translúcidas)
function drawHudTop() {
  const pill = (x, y, w, h) => { rrect(x, y, w, h, h / 2); ctx.fillStyle = 'rgba(12,15,28,.55)'; ctx.fill(); };
  // placar e modo
  pill(6, 5, 84, 20);
  ctx.textAlign = 'left'; ctx.font = 'bold 14px "Courier New", monospace'; ctx.fillStyle = '#e8ecf5';
  ctx.fillText(String(score).padStart(6, '0'), 14, 20);
  ctx.font = 'bold 7px Arial, sans-serif'; ctx.fillStyle = { modern: '#9fe0ff', ocean: '#4fd1e0' }[mode] || '#ffc93c';
  ctx.fillText(({ modern: 'MODERN', ocean: 'OCEAN' }[mode] || '') + (isOcean() ? (altTarget ? ' · ▲ HIGH' : ' · ▼ LOW') : ''), 14, 33);
  if (isOcean() && altMsg > 0) {                              // aviso de troca de altitude
    ctx.globalAlpha = Math.min(1, altMsg / 30); ctx.textAlign = 'center'; ctx.font = 'bold 12px Arial, sans-serif';
    ctx.fillStyle = 'rgba(12,15,28,.6)'; rrect(W / 2 - 80, 62, 160, 20, 10); ctx.fill();
    ctx.fillStyle = altTarget ? '#9ff3ff' : '#ffc93c'; ctx.fillText(altText, W / 2, 76); ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // vida: barra larga no centro, pisca quando está baixa
  const f = hp / 100, hx = 104, hw = 118, low = f < 0.25 && frame % 20 < 10;
  pill(hx - 14, 7, hw + 20, 16);
  ctx.fillStyle = '#e5484d'; ctx.font = 'bold 10px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', hx - 5, 19);
  rrect(hx + 2, 11, hw, 8, 4); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill();
  if (f > 0) { rrect(hx + 2, 11, Math.max(8, hw * f), 8, 4); ctx.fillStyle = low ? '#ff8a8a' : f > 0.5 ? '#3fbf6a' : f > 0.25 ? '#ffc93c' : '#e5484d'; ctx.fill();
               rrect(hx + 2, 11, Math.max(8, hw * f), 3.5, 1.8); ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); }
  // oceano: bombas disponíveis (no lugar das vidas, que lá não existem)
  if (isOcean()) {
    const nb = Math.max(bombs, 1);
    pill(W - 14 - nb * 13, 5, nb * 13 + 8, 20);
    for (let k = 0; k < nb; k++) {
      const bx = W - 8 - nb * 13 + k * 13 + 6, on = k < bombs;
      ctx.globalAlpha = on ? 1 : 0.3;
      ell(bx, 16, 4.6, 4.6, on ? '#e5484d' : '#5c6378'); ctx.fillStyle = '#f5f2ea'; ctx.fillRect(bx + 1.6, 8.6, 1.4, 2.6);
      ell(bx - 1.4, 14.6, 1.4, 1.4, 'rgba(255,255,255,.5)');
      ctx.globalAlpha = 1;
    }
  }
  // vidas (o jato em jogo não conta)
  const n = Math.min(lives - (state === 'play' ? 1 : 0), 4);
  if (n > 0) { pill(W - 10 - n * 15, 5, n * 15 + 4, 20); for (let k = 0; k < n; k++) drawJet(W - 4 - n * 15 + k * 15 + 6, 7, 0, 0.8, false); }
  // power-ups ativos, logo abaixo da vida
  drawPowerHud(hx + 2, 28);
}

function drawPanel() {
  const y0 = VIEW_H;
  const g = ctx.createLinearGradient(0, y0, 0, y0 + PANEL_H);
  g.addColorStop(0, '#1b2036'); g.addColorStop(1, '#0c0f1c');
  ctx.fillStyle = g; ctx.fillRect(0, y0, W, PANEL_H);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, y0, W, 1);
  ctx.textAlign = 'left'; ctx.font = 'bold 20px "Courier New", monospace'; ctx.fillStyle = '#e8ecf5';
  ctx.fillText(String(score).padStart(6, '0'), 10, y0 + 24);
  ctx.font = 'bold 8px Arial, sans-serif'; ctx.fillStyle = { classic: '#ffc93c', modern: '#9fe0ff', ocean: '#4fd1e0' }[mode];
  ctx.fillText({ classic: 'CLASSIC', modern: 'MODERN', ocean: 'OCEAN' }[mode], 12, y0 + 40);
  if (isOcean()) {                                            // barra de vida do jato
    const f = hp / 100, hx = 74, hy = y0 + 42;
    rrect(hx, hy, 160, 4, 2); ctx.fillStyle = '#2b3042'; ctx.fill();
    if (f > 0) { rrect(hx, hy, Math.max(4, 160 * f), 4, 2); ctx.fillStyle = f > 0.5 ? '#3fbf6a' : f > 0.25 ? '#ffc93c' : '#e5484d'; ctx.fill(); }
    ctx.fillStyle = '#e5484d'; ctx.font = 'bold 8px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', hx - 8, hy + 4.5);
  }
  drawPowerHud(108, y0 + 4);                                          // power-ups ativos
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
