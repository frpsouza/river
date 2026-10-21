// render/sprites.js — SPRITES VETORIAIS (flat design)
// Cada função desenha um objeto com formas chapadas: uma cor de base e uma de sombra,
// luz vindo de cima à esquerda. Os desenhos são feitos num tamanho base e escalados
// por SC (config.js). drawJet também desenha a inclinação das asas (`bank`).
// Usa: render/canvas.js.
'use strict';

function groundShadow(cx, cy, rx, ry) { ell(cx, cy, rx, ry, 'rgba(0,0,30,.22)'); }

function drawFuel(x, y) {
  ctx.save(); ctx.translate(x, y);
  groundShadow(10, 28, 8, 1.6);
  rrect(1, 1, 16, 27, 3); ctx.fillStyle = '#e5484d'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#c23a3f'; ctx.fillRect(11, 0, 7, 28); ctx.restore();
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(1, 10, 16, 8);
  ctx.fillStyle = '#ddd8cc'; ctx.fillRect(11, 10, 6, 8);
  ctx.fillStyle = '#c23a3f'; ctx.font = 'bold 5.4px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('FUEL', 9, 16);
  ctx.fillStyle = '#c23a3f'; ctx.fillRect(6, 0, 6, 2);
  ctx.restore();
}

function drawHeli(x, y, dir, alt = 1) {
  const k = SC.heli * alt, w = 20 * k, h = 14 * k;
  ell(x + w / 2 + alt * 9, y + h + alt * 10, 7 * SC.heli * (1.25 - alt * 0.4), 1.4, 'rgba(0,0,30,' + (0.3 - alt * 0.12).toFixed(2) + ')');
  ctx.save(); ctx.translate(x + (dir > 0 ? w : 0), y); ctx.scale(dir > 0 ? -k : k, k);
  const L = frame % 6 < 3 ? 9 : 4;
  ctx.fillStyle = '#ffb547'; ctx.fillRect(9 - L, 1.6, 2 * L, 1.2);
  ctx.fillStyle = '#ffb547'; ctx.fillRect(8.4, 1.6, 1.2, 3);
  poly([12, 6.8, 20, 6.4, 20, 8.4, 12, 9.4], '#2c4bb5');
  poly([18.6, 6.5, 20, 3.6, 20, 6.5], '#ffb547');
  ell(9, 8, 6.4, 3.8, '#3b63e0');
  ctx.save(); ctx.beginPath(); ctx.ellipse(9, 8, 6.4, 3.8, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#2c4bb5'; ctx.fillRect(0, 8.6, 20, 5); ctx.restore();
  ell(5.4, 7.2, 2.4, 1.9, '#bfe3ff');
  ctx.fillStyle = '#26334f'; ctx.fillRect(3, 12.2, 11, 1);
  ctx.restore();
}

function drawShip(x, y, dir) {
  ctx.save(); ctx.translate(x + (dir > 0 ? 36 * SC.ship : 0), y); ctx.scale(dir > 0 ? -SC.ship : SC.ship, SC.ship);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(30, 10.6, 6, 1); ctx.fillRect(33, 9, 3, 1);
  poly([0, 5, 34, 5, 31, 10.6, 5, 10.6], '#e5484d');
  poly([3.6, 8.4, 32.1, 8.4, 31, 10.6, 5, 10.6], '#b8363b');
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(19, 1.6, 11, 3.4);
  ctx.fillStyle = '#ddd8cc'; ctx.fillRect(25.5, 1.6, 4.5, 3.4);
  ctx.fillStyle = '#26334f'; ctx.fillRect(22, 0, 3, 1.6);
  ctx.restore();
}

const PLANE_PAL = { top: '#9fe0ff', bottom: '#4aa8e0', body: '#6cc8f2', belly: '#4aa8e0' };
function drawPlane(x, y, dir, pal = PLANE_PAL) {
  if (isEx() && pal === FLIER_PAL && exDraw('caca_vermelho', x, y + Math.sin(frame * 0.3) * 0.4, 1, dir < 0 ? 20 * SC.plane : 0)) return;   // OCEAN EX
  ctx.save(); ctx.translate(x + (dir < 0 ? 20 * SC.plane : 0), y + Math.sin(frame * 0.3) * 0.4); ctx.scale(dir < 0 ? -SC.plane : SC.plane, SC.plane);
  poly([13, 5, 4, 0, 2, 0, 6, 5], pal.top);             // asa de cima (luz)
  poly([13, 5, 4, 10, 2, 10, 6, 5], pal.bottom);        // asa de baixo (sombra)
  poly([20, 5, 14, 3.4, 1, 3.6, 0, 5, 1, 6.4, 14, 6.6], pal.body);
  poly([20, 5, 14, 6.6, 1, 6.4, 0, 5], pal.belly);
  ctx.restore();
}

function drawHouse(x, y, variant) {
  ctx.save(); ctx.translate(x + (variant === 'house2' ? 36 : 0), y); if (variant === 'house2') ctx.scale(-1, 1);
  groundShadow(16, 22, 14, 1.6);
  const roof = variant === 'house2' ? '#e5484d' : '#3a3f58', roofSh = variant === 'house2' ? '#b8363b' : '#2a2e42';
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(4, 10, 24, 12);
  ctx.fillStyle = '#ddd8cc'; ctx.fillRect(20, 10, 8, 12);
  poly([1, 10, 16, 2, 31, 10], roof);
  poly([16, 2, 31, 10, 16, 10], roofSh);
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(9, 15, 4, 7);
  ctx.fillStyle = '#6cc8f2'; ctx.fillRect(16, 13, 4, 4);
  ctx.restore();
}

function drawTank(x, y, aim, dir) {
  // vista lateral, flat: esteira, casco, cúpula e canhão virado para `aim`
  ctx.save(); ctx.translate(x + (aim < 0 ? 28 * SC.tank : 0), y); ctx.scale(aim < 0 ? -SC.tank : SC.tank, SC.tank);
  groundShadow(13.5, 14, 13, 1.4);
  rrect(1, 9, 23, 5, 2.5); ctx.fillStyle = '#33372d'; ctx.fill();
  const roll = ((frame * 0.25 * dir * (aim < 0 ? -1 : 1)) % 5 + 5) % 5;
  ctx.fillStyle = '#4c5243';
  for (let k = 0; k < 5; k++) { const cx = 3.5 + ((k * 4.6 + roll) % 20); ell(cx + 1, 11.5, 1.3, 1.3, '#4c5243'); }
  poly([1, 9, 25, 9, 23, 5, 3, 5], '#7a8a45');
  poly([1, 9, 25, 9, 24.2, 7.4, 1.8, 7.4], '#62703a');
  ctx.fillStyle = '#4c5530'; ctx.fillRect(15, 2.6, 12.5, 1.6);
  ctx.beginPath(); ctx.moveTo(7, 5); ctx.quadraticCurveTo(12.5, -1.4, 18, 5); ctx.closePath();
  ctx.fillStyle = '#8a9a52'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#7a8a45'; ctx.fillRect(13, 0, 6, 6); ctx.restore();
  ctx.restore();
}

function drawBalloon(x, y, hue, phase) {
  const bob = Math.sin(frame * 0.05 + phase) * 1.5;
  ell(x + 14 * SC.balloon, y + 30 * SC.balloon, 5 * SC.balloon, 1.6 * SC.balloon, 'rgba(0,0,30,.2)');               // sombra deslocada: está no ar
  ctx.save(); ctx.translate(x, y + bob); ctx.scale(SC.balloon, SC.balloon);
  const c1 = hue ? '#ffb547' : '#e5484d', c2 = hue ? '#e8962e' : '#b8363b';
  ctx.beginPath(); ctx.arc(8, 7.6, 7.4, Math.PI * 0.85, Math.PI * 2.15); ctx.lineTo(8, 17.6); ctx.closePath();
  ctx.fillStyle = c1; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = c2; ctx.fillRect(8, 0, 8, 18);
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(5.4, 0, 2.6, 18); ctx.fillStyle = '#ddd8cc'; ctx.fillRect(8, 0, 2.6, 18);
  ctx.restore();
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(6.4, 19.4, 3.2, 3);
  ctx.fillStyle = '#26334f'; ctx.fillRect(7.6, 17.4, 0.8, 2);
  ctx.restore();
}

function drawJet(cx, top, bk, s, flame) {
  if (isEx() && exJet(cx, top, bk, s)) return;                                 // OCEAN EX: imagem detalhada
  ctx.save(); ctx.translate(cx, top); ctx.scale(s, s);
  const th = bk * 0.9, c = Math.cos(th), sn = Math.sin(th);
  const spR = 2.3 + 5.5 * c * (1 - 0.3 * sn), spL = 2.3 + 5.5 * c * (1 + 0.3 * sn);   // asa de baixo encurta
  const base = '#ffc93c', down = '#c9901c', up = '#ffe58a';
  const rightCol = bk >= 0 ? mix(base, down, bk) : mix(base, up, -bk);
  const leftCol = bk >= 0 ? mix(base, up, bk) : mix(base, down, -bk);
  poly([-1.8, 13, -(1.8 + 2.4 * c), 15.6, -1.8, 15.6], leftCol);
  poly([1.8, 13, 1.8 + 2.4 * c, 15.6, 1.8, 15.6], rightCol);
  poly([-2.3, 6.4, -spL, 12.6, -spL, 14, -2.3, 13.2], leftCol);
  poly([2.3, 6.4, spR, 12.6, spR, 14, 2.3, 13.2], rightCol);
  poly([0, 0, 2.2, 5, 2.4, 13, 1.4, 16, -1.4, 16, -2.4, 13, -2.2, 5], base);
  poly([0, 0, 2.2, 5, 2.4, 13, 1.4, 16, 0, 16], down);
  ell(1.1 * sn, 5.4, 1.3, 2.2, '#3b63e0');
  if (flame) poly([-1, 16, 1, 16, 0, 18 + (frame % 4) * 0.7], '#ff8a3d');
  ctx.restore();
}

// ---------- vistas de cima (modo oceano) ----------
// No oceano a câmera olha o mar de cima, então os objetos sobre a água são desenhados
// em planta (top-down), no mesmo tamanho das versões de lado (mesmas áreas de colisão).

function drawFuelTop(x, y) {
  if (isEx() && exDraw('combustivel_cima', x, y)) return;                        // OCEAN EX
  // balsa de combustível: casco claro com dois tanques redondos vermelhos
  ctx.save(); ctx.translate(x, y);
  ell(11, 15, 9, 13, 'rgba(0,0,40,.18)');
  rrect(1, 1, 16, 26, 4); ctx.fillStyle = '#ddd8cc'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#c4beb0'; ctx.fillRect(10, 0, 8, 28); ctx.restore();
  for (const ty of [8, 20]) {
    ell(9, ty, 6, 6, '#e5484d');
    ctx.save(); ctx.beginPath(); ctx.ellipse(9, ty, 6, 6, 0, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = '#b8363b'; ctx.fillRect(9, ty - 6, 6, 12); ctx.restore();
    ell(9, ty, 2.4, 2.4, '#f5f2ea');
  }
  ctx.fillStyle = '#26334f'; ctx.font = 'bold 4px Arial, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('F', 9, 9.5); ctx.fillText('F', 9, 21.5);
  ctx.restore();
}

function drawShipTop(x, y, dir, aim = 0, flash = 0) {
  if (isEx() && exDraw(flash > 0 ? 'navio_cima_disparo' : 'navio_cima', x, y, 1, dir < 0 ? 43 : 0)) return;   // OCEAN EX
  // navio de patrulha visto de cima: casco afilado na proa, convés, ponte de comando e canhão
  const L = 43, H = 14;
  ctx.save(); ctx.translate(x + (dir > 0 ? 0 : L), y); if (dir < 0) ctx.scale(-1, 1);   // proa para `dir`
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  for (let k = 0; k < 3; k++) ctx.fillRect(-9 - k * 7, H / 2 - 2.5 + k * 2, 7, 1);            // esteira
  poly([0, 2, L - 10, 2, L, H / 2, L - 10, H - 2, 0, H - 2], '#e5484d');
  poly([0, H / 2, L, H / 2, L - 10, H - 2, 0, H - 2], '#b8363b');
  poly([3, 4, L - 12, 4, L - 5, H / 2, L - 12, H - 4, 3, H - 4], '#ddd8cc');                // convés
  ctx.fillStyle = '#f5f2ea'; ctx.fillRect(12, 4.5, 11, H - 9);                               // ponte de comando
  ctx.fillStyle = '#26334f'; ctx.fillRect(21, 5.5, 1.6, H - 11);
  // canhão girando para o alvo (aim = ângulo na tela; espelhado quando a proa aponta para a esquerda)
  ctx.save(); ctx.translate(L - 15, H / 2); ctx.rotate(dir > 0 ? aim : Math.PI - aim);
  ctx.fillStyle = '#3a3f58'; ctx.fillRect(0, -0.7, 8, 1.4);
  if (flash > 0) { ell(9.5, 0, 2.6, 2.2, '#fff3b0'); ell(9.5, 0, 1.4, 1.2, '#ffffff'); }       // clarão do disparo
  ctx.restore();
  ell(L - 15, H / 2, 2.8, 2.8, '#5c6378'); ell(L - 15.6, H / 2 - 0.6, 1.2, 1.2, '#7d8394');
  ctx.restore();
}

function drawHeliTop(x, y, dir, alt = 1) {
  if (isEx() && exDraw('heli_cima', x, y, alt, dir > 0 ? 27 : 0)) return;        // OCEAN EX (a imagem olha para a esquerda)
  // helicóptero visto de cima: cabine em gota, cauda, disco do rotor girando; sombra longe = alto
  const k = alt, w = 27 * k, h = 19 * k, cx = x + w / 2, cy = y + h / 2;
  ell(cx + 10 * alt, cy + 12 * alt, 8 * k, 4 * k, 'rgba(0,0,30,' + (0.3 - alt * 0.12).toFixed(2) + ')');
  ctx.save(); ctx.translate(cx, cy); ctx.scale(dir > 0 ? -k : k, k);                 // nariz para o lado em que anda
  ctx.fillStyle = '#2c4bb5'; ctx.fillRect(2, -1, 11, 2);                            // cauda
  poly([12, -4, 14, -4, 14, 4, 12, 4], '#ffb547');                                  // estabilizador
  ell(-2, 0, 6.5, 4.6, '#3b63e0');                                                   // cabine
  ctx.save(); ctx.beginPath(); ctx.ellipse(-2, 0, 6.5, 4.6, 0, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = '#2c4bb5'; ctx.fillRect(-9, 0, 14, 5); ctx.restore();
  ell(-5.5, -0.5, 2.6, 2.2, '#bfe3ff');                                              // vidro
  ctx.globalAlpha = 0.18; ell(-2, 0, 11, 11, '#e8ecf5'); ctx.globalAlpha = 1;         // disco do rotor
  const a = frame * 0.55;
  ctx.strokeStyle = '#ffb547'; ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  ctx.beginPath();
  for (const b of [0, Math.PI / 2]) { ctx.moveTo(-2 - Math.cos(a + b) * 11, -Math.sin(a + b) * 11); ctx.lineTo(-2 + Math.cos(a + b) * 11, Math.sin(a + b) * 11); }
  ctx.stroke();
  ell(-2, 0, 1.4, 1.4, '#26334f');
  ctx.restore();
}

function drawBalloonTop(x, y, hue, phase) {
  if (isEx() && exDraw('balao_cima_' + (hue ? 1 : 0), x, y + Math.sin(frame * 0.05 + phase) * 1.2)) return;   // OCEAN EX
  // balão visto de cima: círculo em gomos coloridos, cesto no centro; sombra bem longe (está alto)
  const r = 12, cx = x + 12, cy = y + 14 + Math.sin(frame * 0.05 + phase) * 1.2;
  ell(cx + 18, cy + 26, r * 0.8, r * 0.55, 'rgba(0,0,30,.16)');
  const c1 = hue ? '#ffb547' : '#e5484d', c2 = '#f5f2ea';
  for (let k = 0; k < 8; k++) {
    const a0 = k * Math.PI / 4 + frame * 0.004, a1 = a0 + Math.PI / 4;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, a0, a1); ctx.closePath();
    ctx.fillStyle = k % 2 ? c2 : c1; ctx.fill();
  }
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();              // sombra no lado de baixo/direita
  ctx.fillStyle = 'rgba(0,0,40,.18)'; ctx.beginPath(); ctx.arc(cx + 5, cy + 5, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ell(cx - 4, cy - 4, 3.2, 2.2, 'rgba(255,255,255,.45)');
  ctx.fillStyle = '#7a5a3c'; ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

function drawTreeTop(x, y, sc, pal) {
  // árvore vista de cima: copa redonda com luz em cima à esquerda e sombra projetada
  const r = 5 * sc * SC.tree;
  ell(x + r * 0.5, y + r * 0.45, r, r * 0.9, 'rgba(0,0,0,.2)');
  ell(x, y, r, r, pal.bush);
  ell(x - r * 0.3, y - r * 0.3, r * 0.6, r * 0.6, pal.bushHi);
}
