// update.js — UM PASSO DA SIMULAÇÃO (60 vezes por segundo)
// Lê o teclado, move o jato e a câmera, gasta combustível, testa colisões com o
// terreno e os objetos, move os inimigos, dispara e move o míssil e os projéteis.
// Usa praticamente todos os módulos de lógica (state, terrain, objects, effects, gameover).
'use strict';

function update() {
  frame++;
  const tp = taps; taps = [];
  if (state === 'title') { if (tp.some(t => t.key === 'Enter' || t.key === ' ')) newGame(); return; }

  stepFx();

  if (state === 'over') { updateOver(tp); return; }
  if (state === 'dying') {
    if (--dyingT <= 0) {
      if (--lives <= 0) { state = 'over'; overT = 0; overDir = 1; overSpeed = 1.1; overTarget = null; missile = null; shells = []; }
      else respawn();
    }
    return;
  }

  // controles
  const lvl = 1 + Math.min(sectionOf(scroll), 8) * 0.07;       // fica mais rápido a cada seção
  const sp = (keys.ArrowUp || keys.w ? 1.9 : keys.ArrowDown || keys.s ? 0.6 : 1.1) * lvl;
  const steer = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0);
  px += steer * 2;
  bank += (steer - bank) * 0.18;                 // inclinação suave das asas
  scroll += sp;
  if ((keys[' '] || keys.z) && !missile) {
    missile = { x: px + PW / 2 - 1, Y: scroll + PLAYER_Y + PH };
    beep(700, 0.08, 'square', 0.03);
  }

  // combustível
  fuel -= 0.04 * (sp > 1.5 * lvl ? 1.2 : 1);
  if (fuel < 25 && frame % 20 === 0) beep(300, 0.05, 'square', 0.02);
  if (fuel <= 0) { fuel = 0; kill(); return; }

  // colisão com terreno e ponte
  const pBot = scroll + PLAYER_Y, pTop = pBot + PH;
  for (let Y = pBot; Y <= pTop; Y += LINE) {
    const { b, i } = lineAt(Y);
    if (px < b.L[i] || px + PW > b.R[i]) { kill(); return; }
    if (b.IL[i] >= 0 && px + PW > b.IL[i] && px < b.IR[i]) { kill(); return; }
    if (b.bridge && !b.broken && i >= 10 && i <= 21) { kill(); return; }
  }
  // checkpoint ao passar pela ponte
  const sec = Math.floor(pBot / BH / BLOCKS_PER_SECTION);
  const bridgeTop = (sec * BLOCKS_PER_SECTION + 15) * BH + 22 * LINE;
  if (pBot > bridgeTop && checkpoint < (sec + 1) * BLOCKS_PER_SECTION) checkpoint = (sec + 1) * BLOCKS_PER_SECTION;

  // objetos visíveis
  const g0 = Math.floor(scroll / BH) - 1, g1 = Math.floor((scroll + VIEW_H) / BH) + 2;
  getBlock(g1 + 2);
  const px0 = px + 2, px1 = px + PW - 2;
  for (let g = Math.max(0, g0); g <= g1; g++) {
    for (const o of blocks[g].objs) {
      if (!o.alive) continue;
      const sy = VIEW_H - (o.Y + o.h - scroll);
      if (o.type === 'plane') {
        if (!o.active && sy < 150 && sy > 0) { o.active = true; o.x = o.dir > 0 ? -o.w : W; }
        if (o.active) {
          o.x += o.dir * o.vx;
          if (o.x < -o.w - 4 || o.x > W + 4) o.alive = false;
        }
      } else if (o.type === 'tank') {
        if (sy > -30 && sy < VIEW_H) {
          o.x += o.dir * o.vx;
          if (o.x < o.minX || o.x > o.maxX) { o.dir = -o.dir; o.x = clamp(o.x, o.minX, o.maxX); }
          if (o.onRoad) {
            o.aim = o.dir;
            const b = blocks[g], cx = o.x + o.w / 2;
            if (b.broken && cx > b.L[16] && cx < b.R[16]) { o.alive = false; boom(cx, o.Y + o.h / 2, 'tank', o); }
          } else if (sy > 40 && sy < VIEW_H - 30 && --o.cool <= 0) {
            // atira na direção do rio
            o.cool = 110 + Math.random() * 90;
            shells.push({ x: o.aim > 0 ? o.x + o.w + 2 : o.x - 2, Y: o.Y + o.h - 3.4 * SC.tank, vx: o.aim * 1.8 });
            beep(220, 0.06, 'square', 0.02);
          }
        }
      } else if (o.type === 'balloon') {
        o.x += o.dir * o.vx;
        if (o.x < 4 || o.x > W - o.w - 4) o.dir = -o.dir;
      } else if (o.type === 'heli' && sy > -40 && sy < VIEW_H) {
        heliAltitude(o);
        if (o.moving) {
          const nx = o.x + o.dir * o.vx;
          if (waterFree(nx, nx + o.w, o.Y, o.Y + o.h)) o.x = nx; else o.dir = -o.dir;
        }
      } else if (o.moving && sy > -20 && sy < VIEW_H) {
        const nx = o.x + o.dir * o.vx;
        if (waterFree(nx, nx + o.w, o.Y, o.Y + o.h)) o.x = nx; else o.dir = -o.dir;
      }
      if (!o.alive) continue;
      // colisão com jogador
      if (px1 > o.x + 1 && px0 < o.x + o.w - 1 && pTop > o.Y + 1 && pBot < o.Y + o.h - 1) {
        if (o.type === 'fuel') { fuel = Math.min(100, fuel + 1); if (frame % 4 === 0) beep(500, 0.03, 'sine', 0.03); }
        else if (o.type !== 'house') { o.alive = false; boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o); kill(); return; }
        else { kill(); return; }
      }
    }
  }

  // projéteis dos tanques
  for (const sh of shells) {
    sh.x += sh.vx;
    if (sh.x > px + 1 && sh.x < px + PW - 1 && sh.Y > pBot && sh.Y < pTop) { sh.dead = true; kill(); }
  }
  shells = shells.filter(sh => !sh.dead && sh.x > -6 && sh.x < W + 6 && sh.Y > scroll - 10);
  if (state !== 'play') return;

  // míssil
  if (missile) {
    missile.Y += 9;
    const my0 = missile.Y, my1 = missile.Y + 8;
    let hit = missile.Y > scroll + VIEW_H;
    const { b, i } = lineAt(my1);
    if (missile.x < b.L[i] || missile.x > b.R[i] || (b.IL[i] >= 0 && missile.x > b.IL[i] && missile.x < b.IR[i])) hit = true;
    if (!hit) {
      for (let g = Math.max(0, g0); g <= g1 && !hit; g++) for (const o of blocks[g].objs) {
        if (!o.alive || o.type === 'house') continue;
        if (missile.x + 2 > o.x && missile.x < o.x + o.w && my1 > o.Y && my0 < o.Y + o.h) {
          o.alive = false; hit = true;
          addScore({ fuel: 80, ship: 30, heli: 60, plane: 100, tank: 250, balloon: 60 }[o.type]);
          boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o);
          break;
        }
      }
    }
    // a ponte é testada depois dos objetos, para o tanque sobre ela poder ser atingido
    if (!hit && b.bridge && !b.broken && i >= 10 && i <= 21) {
      b.broken = true; hit = true; addScore(500);
      boom(b.endC, b.g * BH + 16 * LINE, 'bridge');
    }
    if (hit) missile = null;
  }
}
