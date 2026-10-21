// update.js — UM PASSO DA SIMULAÇÃO (60 vezes por segundo)
// Lê o teclado, move o jato e a câmera, gasta combustível, testa colisões com o
// terreno e os objetos, move os inimigos, dispara e move o míssil e os projéteis.
// Usa praticamente todos os módulos de lógica (state, terrain, objects, effects, gameover).
'use strict';

let fireCool = 0, burstT = 0, burstLock = false, burstShots = 0;
// rajada: 10 tiros bem juntos (um a cada 4 quadros), no máximo 1 s; com tiro rápido, 15 tiros a cada 3 quadros
const BURST_FRAMES = 60, BURST_SHOTS = 10, BURST_GAP = 4, BURST_SHOTS_RAPID = 15, BURST_GAP_RAPID = 3;

function update() {
  frame++;
  const tp = taps; taps = [];
  // Q (ou LB + LT do controle por 1 s, que chega como Escape): volta ao menu principal de qualquer lugar, em todos os modos
  if (state !== 'title' && tp.some(t => t.key === 'q' || t.key === 'Q' || (t.pad && t.key === 'Escape'))) { state = 'title'; freezeT = 0; return; }
  if (state === 'title') {
    for (const t of tp) {
      const M = MODES, k = M.indexOf(mode);
      if (t.key === 'ArrowDown' || t.key === 'ArrowRight') mode = M[(k + 1) % M.length];
      if (t.key === 'ArrowUp' || t.key === 'ArrowLeft') mode = M[(k + M.length - 1) % M.length];
      if (t.key >= '1' && t.key <= String(M.length)) mode = M[+t.key - 1];
    }
    // começa o jogo: ENTER, ESPAÇO, Z ou X no teclado; no controle, qualquer botão ou gatilho (menos o direcional)
    if (tp.some(t => ['Enter', ' ', 'z', 'Z', 'x', 'X'].includes(t.key) || (t.pad && !t.key.startsWith('Arrow') && t.key !== 'Escape'))) newGame();
    return;
  }

  if (freezeT > 0) { freezeT--; return; }                          // pausa de impacto (bomba)
  stepFx();

  if (state === 'over') { updateOver(tp); return; }
  if (state === 'dying') {
    if (--dyingT <= 0) {
      if (--lives <= 0) { state = 'over'; overT = 0; overDir = 1; overSpeed = 1.1; overTarget = null; missiles = []; shells = []; resetPowerups(); resetOcean(); }
      else respawn();
    }
    return;
  }

  // controles
  const lvl = 1 + Math.min(sectionOf(scroll), 8) * 0.07;       // fica mais rápido a cada seção
  // entrada vertical e horizontal de -1 a 1: teclas valem ±1, o joystick da tela dá valores intermediários
  const vert = clamp((keys.ArrowUp || keys.w ? 1 : 0) - (keys.ArrowDown || keys.s ? 1 : 0) - stick.y - gpad.y, -1, 1);
  let sp;
  if (!isClassic()) {
    // moderno e oceano: a câmera anda em velocidade constante (no oceano, quase para durante o chefe) e o jato voa livre pela tela (↑↓ movem na vertical)
    sp = (isOcean() && boss ? 0.3 : 1.25 * (isOcean() ? 1.15 - 0.3 * altT : 1)) * lvl;   // rasante parece mais rápido
    camSp = sp;
    py = clamp(py + vert * 2, pyMin(), VIEW_H - PH - (isOcean() ? 12 : 36));   // não entra embaixo do HUD
  } else {
    // clássico: o jato fica embaixo; ↑ acelera e ↓ freia a rolagem
    sp = (1.1 + (vert > 0 ? vert * 0.8 : vert * 0.5)) * lvl;          // de 0,6 (freando) a 1,9 (acelerando)
  }
  const steer = clamp((keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0) + stick.x + gpad.x, -1, 1);
  px += steer * 2;
  bank += (steer - bank) * 0.18;                 // inclinação suave das asas
  scroll += sp;
  // disparo em RAJADA: segurando o gatilho saem BURST_SHOTS balas (10), uma a cada BURST_GAP
  // quadros, no máximo por BURST_FRAMES (1 s); depois é preciso soltar e apertar de novo.
  // TIRO RÁPIDO: mais balas e mais juntas; TIRO TRIPLO: cada bala sai em leque de três.
  tickPowerups();
  if (safeT > 0) safeT--;
  if (isOcean()) stepManeuver();
  if (isOcean() && tp.some(t => 'xXbB'.includes(t.key) && t.key.length === 1)) useBomb();   // 2º botão: bomba
  if (hurtT > 0) hurtT--;
  if (fireCool > 0) fireCool--;
  if (!(keys[' '] || keys.z)) { burstT = 0; burstShots = 0; burstLock = false; }   // soltou: rajada nova liberada
  else if (!burstLock && !(isOcean() && maneuver)) {               // em manobra o jato não atira
    const maxShots = pw.rapid > 0 ? BURST_SHOTS_RAPID : BURST_SHOTS;
    if (++burstT > BURST_FRAMES || burstShots >= maxShots) burstLock = true;   // acabou a rajada
    else if (fireCool <= 0) {
      burstShots++;
      const x = px + PW / 2 - 1, Y = scroll + py + PH;
      missiles.push({ x, Y, vx: 0 });
      if (pw.triple > 0) missiles.push({ x: x - 3, Y: Y - 2, vx: -1.1 }, { x: x + 3, Y: Y - 2, vx: 1.1 });
      fireCool = pw.rapid > 0 ? BURST_GAP_RAPID : BURST_GAP;
      beep((pw.rapid > 0 ? 900 : 720) + (burstT % 2) * 60, 0.05, 'square', 0.022);
    }
  }

  // combustível
  // combustível só existe no clássico; no voo livre os postos recuperam a vida
  if (isClassic()) {
    fuel -= 0.04 * (sp > 1.5 * lvl ? 1.2 : 1);
    if (fuel < 25 && frame % 20 === 0) beep(300, 0.05, 'square', 0.02);
    if (fuel <= 0) { fuel = 0; kill(); return; }
  }

  // colisão com terreno e ponte
  const pBot = scroll + py, pTop = pBot + PH;
  if (isClassic()) {
    // clássico: margens, ilhas e ponte inteira matam
    for (let Y = pBot; Y <= pTop; Y += LINE) {
      const { b, i } = lineAt(Y);
      if (px < b.L[i] || px + PW > b.R[i]) { kill(); return; }
      if (b.IR[i] > b.IL[i] && px + PW > b.IL[i] && px < b.IR[i]) { kill(); return; }
      if (b.bridge && !b.broken && i >= 10 && i <= 21) { kill(); return; }
    }
  } else {
    // moderno: voa por cima da terra; só não pode sair da tela nem bater num paredão de rocha
    px = clamp(px, 0, W - PW);
    if (cliffHit(px + 2, px + PW - 2, pBot + 2, pTop - 2)) {
      // bater no paredão tira 40 de vida e empurra o jato para fora da rocha
      const { b, i } = lineAt(pBot + PH / 2), cx = px + PW / 2;
      let dir = 0;
      if (b.cliffL[i] > 0 && cx < b.L[i] + PW) dir = cx < b.L[i] - b.cliffL[i] / 2 ? -1 : 1;
      else if (b.cliffR[i] > 0) dir = cx > b.R[i] + b.cliffR[i] / 2 ? 1 : -1;
      px = clamp(px + dir * 8, 0, W - PW);
      if (hurt(40)) return;
    }
  }
  // checkpoint ao passar pela ponte
  // (no oceano não há ponte: o checkpoint é derrotar o chefe — ocean/bosses.js)
  const sec = Math.floor(pBot / BH / BLOCKS_PER_SECTION);
  const bridgeTop = (sec * BLOCKS_PER_SECTION + 15) * BH + 22 * LINE;
  if (!isOcean() && pBot > bridgeTop && checkpoint < (sec + 1) * BLOCKS_PER_SECTION) checkpoint = (sec + 1) * BLOCKS_PER_SECTION;

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
        if (isOcean() && oceanHigh() && o.type !== 'pu') { /* voando alto: a superfície está lá embaixo */ }
        else if (o.type === 'fuel') {
          if (isClassic()) { fuel = Math.min(100, fuel + 1); if (frame % 4 === 0) beep(500, 0.03, 'sine', 0.03); }
          else if (hp < 100) { hp = Math.min(100, hp + 0.8); if (frame % 4 === 0) beep(620 + hp * 3, 0.03, 'sine', 0.03); }   // posto: recupera a vida
        }
        else if (o.type === 'pu') collectPowerup(o);                         // coleta imediata
        else if ((safeT > 0 || (isOcean() && maneuver)) && o.type !== 'house') { /* recém-renascido ou em manobra: atravessa sem bater */ }
        else if (!isClassic() && (o.type === 'house' || o.type === 'tank' || o.type === 'carrier')) { /* no chão/no mar: o jato passa por cima */ }
        else if (isOcean() && o.type === 'ship') { /* oceano: o jato sobrevoa os navios (mas eles atiram) */ }
        else if (pw.shield > 0 && o.type !== 'house') {
          o.alive = false; addScore(10); boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o);   // o escudo absorve
        }
        else if (o.type !== 'house') { o.alive = false; boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o); if (hurt(35)) return; }
        else { kill(); return; }
      }
    }
  }

  // projéteis dos tanques
  if (isOcean()) { updateOcean(pBot, g0, g1); if (state !== 'play') return; }

  const extra = [];
  for (const sh of shells) {
    if (sh.kind) { const out = stepSpecialShell(sh); if (out) extra.push(...out); if (sh.dead) continue; }   // foguete / mina
    sh.x += sh.vx; sh.Y += sh.vy || 0;
    if (sh.x > px + 1 && sh.x < px + PW - 1 && sh.Y > pBot && sh.Y < pTop) { sh.dead = true; if (pw.shield <= 0 && safeT <= 0) hurt(12); }
  }
  shells.push(...extra);
  shells = shells.filter(sh => !sh.dead && sh.x > -6 && sh.x < W + 6 && sh.Y > scroll - 10 && sh.Y < scroll + VIEW_H + 30);
  if (state !== 'play') return;

  // mísseis
  for (const m of missiles) {
    m.Y += 9; m.x += m.vx;
    const my0 = m.Y, my1 = m.Y + 8;
    let hit = m.Y > scroll + VIEW_H || m.x < -4 || m.x > W + 4;
    const { b, i } = lineAt(my1);
    if (isClassic()) {
      if (m.x < b.L[i] || m.x > b.R[i] || (b.IR[i] > b.IL[i] && m.x > b.IL[i] && m.x < b.IR[i])) hit = true;
    } else if (cliffHit(m.x, m.x + 2, my1, my1)) hit = true;            // moderno: só o paredão para o míssil
    if (!hit && isOcean() && oceanMissileHit(m, my0, my1)) hit = true;
    if (!hit) {
      for (let g = Math.max(0, g0); g <= g1 && !hit; g++) for (const o of blocks[g].objs) {
        if (!o.alive || o.type === 'house' || o.type === 'pu' || (isOcean() && oceanHigh())) continue;   // lá do alto não se acerta a superfície
        if (m.x + 2 > o.x && m.x < o.x + o.w && my1 > o.Y && my0 < o.Y + o.h) {
          hit = true;
          if (o.hp > 1) { o.hp--; o.flash = 4; addScore(10); break; }       // porta-aviões: aguenta vários tiros
          o.alive = false;
          addScore({ fuel: 80, ship: 30, heli: 60, plane: 100, tank: 250, balloon: 60, carrier: 800 }[o.type]);
          boom(o.x + o.w / 2, o.Y + o.h / 2, o.type, o);
          if (o.type === 'carrier' && isOcean()) carrierDrops(o);       // porta-aviões afundado solta prêmios
          break;
        }
      }
    }
    // a ponte é testada depois dos objetos, para o tanque sobre ela poder ser atingido
    if (!hit && b.bridge && !b.broken && i >= 10 && i <= 21 && m.x > b.L[16] - 3 && m.x < b.R[16] + 3) {
      b.broken = true; hit = true; addScore(500);
      boom(b.endC, b.g * BH + 16 * LINE, 'bridge');
    }
    m.dead = hit;
  }
  missiles = missiles.filter(m => !m.dead);
}
