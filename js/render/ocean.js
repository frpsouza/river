// render/ocean.js — desenho do modo oceano (vetorial, vista de cima): aviões das
// esquadrilhas, os quatro chefes e a barra de vida, porta-aviões e as nuvens.
// O Retro Ocean reaproveita a lógica e algumas peças daqui (porta-aviões, nuvens).
'use strict';

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
  const falling = !!B.fall;
  if (falling) {                                     // caindo: gira e encolhe rumo ao mar
    const s = bossFallScale(B);
    ctx.save(); ctx.translate(B.x, B.y); ctx.rotate(B.fall.rot); ctx.scale(s, s); ctx.translate(-B.x, -B.y);
  }
  if (isEx() && exBoss(B)) { /* OCEAN EX: imagem detalhada */ }
  else if (B.kind === 'gunship') drawGunship(B);
  else if (B.kind === 'airship') drawAirship(B);
  else if (B.kind === 'interceptor') drawInterceptor(B);
  else drawBomber(B);
  if (falling) ctx.restore();
}

// sombra no mar; durante a queda ela se aproxima do avião (ele está chegando à água)
const bossShadow = (B, rx, ry) => { const k = B.fall ? 1 - B.fall.t / BOSS_FALL : 1; ell(B.x + (22 + 20 * altT) * k, B.y + (36 + 30 * altT) * k, rx, ry, 'rgba(0,0,30,' + ((0.22 - 0.12 * altT) * (2 - k)).toFixed(2) + ')'); };
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
  const st2 = B.dying ? ' · GOING DOWN!' : st;
  ctx.fillText(BOSS_INFO[B.kind].name + ' — SECTION ' + (B.sec + 1) + st2, 32, by + 17);
}

function drawCarrier(x, y, dir, o) {
  if (isEx() && exCarrier(x, y, dir, o)) return;                                // OCEAN EX
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
    if (isEx() && exCloud(c, y, (over ? Math.min(0.45, c.alpha) : c.alpha) * mult)) return;   // OCEAN EX
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
    if (isEx() && exCloud(c, y, 0.82 * mult)) continue;           // OCEAN EX
    ctx.globalAlpha = 0.82 * mult;
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx, y + dy + r * 0.25, r, r * 0.85 * st, '#d6e2f0');
    for (const [dx, dy, r, st] of c.puffs) ell(c.x + dx - r * 0.12, y + dy - r * 0.08, r * 0.9, r * 0.78 * st, '#ffffff');
  }
  ctx.globalAlpha = 1;
}
