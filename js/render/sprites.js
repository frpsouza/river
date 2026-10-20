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

function drawPlane(x, y, dir) {
  ctx.save(); ctx.translate(x + (dir < 0 ? 20 * SC.plane : 0), y + Math.sin(frame * 0.3) * 0.4); ctx.scale(dir < 0 ? -SC.plane : SC.plane, SC.plane);
  poly([13, 5, 4, 0, 2, 0, 6, 5], '#9fe0ff');            // asa de cima (luz)
  poly([13, 5, 4, 10, 2, 10, 6, 5], '#4aa8e0');          // asa de baixo (sombra)
  poly([20, 5, 14, 3.4, 1, 3.6, 0, 5, 1, 6.4, 14, 6.6], '#6cc8f2');
  poly([20, 5, 14, 6.6, 1, 6.4, 0, 5], '#4aa8e0');
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
