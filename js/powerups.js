// powerups.js — POWER-UPS DO MODO MODERNO
// Itens flutuantes que o jato coleta só de encostar (não precisa atirar). Cada um tem
// cor, ícone, efeito, animação de coleta e um arpejo próprio.
//
//   shield (escudo) ..... 8 s: inimigos e projéteis explodem no escudo em vez de derrubar o jato
//   triple (tiro triplo)  10 s: cada disparo sai em leque de três mísseis
//   rapid (tiro rápido) . 10 s: dispara sem esperar o míssil anterior sumir
//   bomb (bomba) ........ na hora: destrói todos os inimigos na tela
//   life (vida extra) ... na hora: +1 vida
//
//   spawnPowerup(blk, r) ... às vezes acrescenta um power-up ao bloco (chamada por spawnObjs)
//   collectPowerup(o) ...... aplica o efeito, toca o som e cria a animação de coleta
//   pw ..................... tempo restante (em quadros) dos efeitos com duração
//
// Usa: config.js, state.js, effects.js, audio.js, cliffs.js.
'use strict';

const PU = {
  shield: { name: 'ESCUDO',      col: '#3b63e0', dark: '#2c4bb5', dur: 8 * 60,  notes: [523, 659, 784, 1047], w: 0.22 },
  triple: { name: 'TIRO TRIPLO', col: '#ff8a3d', dark: '#d9672a', dur: 10 * 60, notes: [440, 554, 659, 880],  w: 0.28 },
  rapid:  { name: 'TIRO RÁPIDO', col: '#ffc93c', dark: '#c9901c', dur: 10 * 60, notes: [659, 784, 988, 1319], w: 0.28 },
  bomb:   { name: 'BOMBA!',      col: '#e5484d', dark: '#b8363b', dur: 0,       notes: [392, 330, 262, 196],  w: 0.14 },
  life:   { name: '+1 VIDA',     col: '#3fbf6a', dark: '#2c9150', dur: 0,       notes: [523, 784, 1047, 1568], w: 0.08 },
};
const PU_SIZE = 14;
let pw = { shield: 0, triple: 0, rapid: 0 };

function spawnPowerup(blk, r) {
  if (mode === 'classic' || blk.bridge || r() > 0.16) return;
  let k = r(), kind = 'life';
  for (const [name, def] of Object.entries(PU)) { if (k < def.w) { kind = name; break; } k -= def.w; }
  for (let tries = 0; tries < 12; tries++) {
    const x = 10 + r() * (W - 20 - PU_SIZE), Y = blk.g * BH + (4 + r() * 22) * LINE;
    if (cliffHit(x - 4, x + PU_SIZE + 4, Y, Y + PU_SIZE)) continue;   // nunca dentro do paredão
    blk.objs.push({ type: 'pu', kind, x, Y, w: PU_SIZE, h: PU_SIZE, alive: true, phase: r() * 6.28 });
    return;
  }
}

function collectPowerup(o) {
  const def = PU[o.kind];
  o.alive = false;
  if (def.dur) pw[o.kind] = def.dur;
  if (o.kind === 'life') { lives++; hp = 100; }               // no oceano também recupera a vida
  if (o.kind === 'bomb') smartBomb();
  addScore(50);
  def.notes.forEach((f, k) => setTimeout(() => beep(f, 0.12, 'triangle', 0.05), k * 60));   // arpejo
  pickupFx(o.x + o.w / 2, o.Y + o.h / 2, def);
}

function smartBomb() {
  const g0 = Math.max(0, Math.floor(scroll / BH) - 1), g1 = Math.floor((scroll + VIEW_H) / BH) + 1;
  if (mode === 'ocean') oceanBomb();
  for (let g = g0; g <= g1; g++) for (const o of getBlock(g).objs) {
    if (o.alive && o.type === 'carrier') { o.hp = Math.max(1, o.hp - 5); o.flash = 8; continue; }
    if (!o.alive || !['ship', 'heli', 'plane', 'tank', 'balloon'].includes(o.type)) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (sy < -o.h || sy > VIEW_H || (o.type === 'plane' && !o.active)) continue;
    o.alive = false;
    addScore({ ship: 30, heli: 60, plane: 100, tank: 250, balloon: 60 }[o.type]);
    boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o);
  }
  shells = [];
}

function tickPowerups() { for (const k in pw) if (pw[k] > 0) pw[k]--; }
function resetPowerups() { pw = { shield: 0, triple: 0, rapid: 0 }; }

// ---- desenho ----
function drawPowerup(o, sy) {
  const def = PU[o.kind], t = frame * 0.08 + o.phase;
  const x = o.x, y = sy + Math.sin(t) * 1.5, s = PU_SIZE, c = x + s / 2, m = y + s / 2;
  ell(c + 4, sy + s + 5, 6, 1.5, 'rgba(0,0,30,.22)');                          // sombra (flutua)
  ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 1.6);
  ell(c, m, s * 0.85, s * 0.85, def.col);                                       // halo pulsando
  ctx.globalAlpha = 1;
  rrect(x, y, s, s, 4); ctx.fillStyle = def.col; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = def.dark; ctx.fillRect(c, y, s, s); ctx.restore();
  drawPuIcon(o.kind, c, m, 1);
}

function drawPuIcon(kind, cx, cy, k) {
  ctx.fillStyle = '#f5f2ea';
  if (kind === 'shield') poly([cx - 4 * k, cy - 4 * k, cx + 4 * k, cy - 4 * k, cx + 4 * k, cy, cx, cy + 5 * k, cx - 4 * k, cy], '#f5f2ea');
  else if (kind === 'triple') [-3.2, 0, 3.2].forEach(dx => ctx.fillRect(cx + dx * k - 0.8 * k, cy - 4 * k, 1.6 * k, 8 * k));
  else if (kind === 'rapid') { poly([cx - 4 * k, cy, cx, cy - 4.5 * k, cx + 4 * k, cy], '#f5f2ea'); poly([cx - 4 * k, cy + 4 * k, cx, cy - 0.5 * k, cx + 4 * k, cy + 4 * k], '#f5f2ea'); }
  else if (kind === 'bomb') { ell(cx, cy + 0.8 * k, 3.6 * k, 3.6 * k, '#f5f2ea'); ctx.fillRect(cx + 1.5 * k, cy - 4.6 * k, 1.4 * k, 2.4 * k); }
  else if (kind === 'life') { ctx.fillRect(cx - 4 * k, cy - 0.9 * k, 8 * k, 1.8 * k); ctx.fillRect(cx - 0.9 * k, cy - 4 * k, 1.8 * k, 8 * k); }
}

function drawShield(cx, cy) {
  if (pw.shield <= 0) return;
  const blink = pw.shield < 90 && frame % 10 < 5;            // pisca quando está acabando
  if (blink) return;
  const r = 15 + Math.sin(frame * 0.2) * 1.2;
  ctx.globalAlpha = 0.22; ell(cx, cy, r, r, '#9fe0ff'); ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(159,224,255,.85)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

// ícones dos efeitos ativos, com barra de tempo (no painel)
function drawPowerHud(x, y) {
  for (const k of ['shield', 'triple', 'rapid']) {
    if (pw[k] <= 0) continue;
    const def = PU[k];
    rrect(x, y, 12, 12, 3); ctx.fillStyle = def.col; ctx.fill();
    drawPuIcon(k, x + 6, y + 6, 0.8);
    ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(x, y + 14, 12, 2);
    ctx.fillStyle = def.col; ctx.fillRect(x, y + 14, 12 * pw[k] / def.dur, 2);
    x += 16;
  }
}
