// gameover.js — TELA DE FIM DE JOGO
// O mapa continua rolando sob o quadro "FIM DE JOGO". Setas mudam a direção,
// PgUp/PgDn (ou Shift+setas) pulam entre pontes e −/+ mudam a velocidade.
// Os inimigos seguem se movendo (animateObjects), mas sem colisões.
// Usa: terrain.js, objects.js, state.js.
'use strict';

let overDir = 1, overTarget = null, overT = 0, overSpeed = 1.1;

const bridgeView = s => (s * BLOCKS_PER_SECTION + 15) * BH + 16 * LINE - VIEW_H / 2;   // ponte no meio da tela

function jumpBridge(d) {
  const cur = overTarget ?? scroll;
  // perto de uma ponte (±60 px) conta como "nela": PgUp vai para a seguinte, PgDn para a anterior
  let s = 0;
  while (bridgeView(s) <= cur + 60) s++;           // s = próxima ponte bem à frente
  if (d < 0) { s = 0; while (bridgeView(s + 1) < cur - 60) s++; if (bridgeView(s) >= cur - 60) s = -1; }
  overTarget = s < 0 ? 0 : Math.max(0, bridgeView(s));
}

function animateObjects() {
  const g0 = Math.max(0, Math.floor(scroll / BH) - 1), g1 = Math.floor((scroll + VIEW_H) / BH) + 2;
  getBlock(g1 + 2);
  for (let g = g0; g <= g1; g++) for (const o of blocks[g].objs) {
    if (!o.alive) continue;
    const sy = VIEW_H - (o.Y + o.h - scroll);
    if (o.type === 'plane') {
      if (!o.active && sy < 150 && sy > 0) { o.active = true; o.x = o.dir > 0 ? -o.w : W; }
      if (o.active) { o.x += o.dir * o.vx; if (o.x < -o.w - 4 || o.x > W + 4) o.alive = false; }
    } else if (o.type === 'tank' || o.type === 'balloon') {
      o.x += o.dir * o.vx;
      const lo = o.type === 'tank' ? o.minX : 4, hi = o.type === 'tank' ? o.maxX : W - o.w - 4;
      if (o.x < lo || o.x > hi) { o.dir = -o.dir; o.x = clamp(o.x, lo, hi); }
      if (o.onRoad) o.aim = o.dir;
    } else if (o.moving && sy > -20 && sy < VIEW_H) {
      const nx = o.x + o.dir * o.vx;
      if (waterFree(nx, nx + o.w, o.Y, o.Y + o.h)) o.x = nx; else o.dir = -o.dir;
    }
    if (o.type === 'heli') heliAltitude(o);
  }
}

function updateOver(tp) {
  overT++;
  if (overT > 40 && tp.some(t => t.key === ' ')) { state = 'title'; return; }   // pausa curta: quem estava atirando não pula o quadro
  for (const t of tp) {
    if (t.key === 'PageUp' || (t.shift && t.key === 'ArrowUp')) jumpBridge(1);
    else if (t.key === 'PageDown' || (t.shift && t.key === 'ArrowDown')) jumpBridge(-1);
    else if (t.key === 'ArrowUp') { overDir = 1; overTarget = null; }
    else if (t.key === 'ArrowDown') { overDir = -1; overTarget = null; }
    else if (t.key === '-' || t.key === '_') overSpeed = Math.max(0.25, overSpeed / 1.5);       // − diminui
    else if (t.key === '=' || t.key === '+') overSpeed = Math.min(12, overSpeed * 1.5);         // = / + aumenta
  }
  if (overTarget !== null) {
    scroll += (overTarget - scroll) * 0.12;
    if (Math.abs(overTarget - scroll) < 0.5) { scroll = overTarget; overTarget = null; }
  } else scroll = Math.max(0, scroll + overDir * overSpeed);
  animateObjects();
}
