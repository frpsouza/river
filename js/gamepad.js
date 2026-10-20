// gamepad.js — JOYSTICK / CONTROLE FÍSICO (Gamepad API)
// Lê o primeiro controle conectado a cada passo do jogo (pollGamepad, chamado pelo laço em
// main.js) e alimenta as mesmas entradas do teclado e da tela:
//   analógico esquerdo ... `gpad` (-1..1), somado ao joystick da tela no update; também vira
//                          setas "tocadas" nos menus (título e fim de jogo)
//   direcional (d-pad) ... setas
//   A / RT ............... FOGO (e, no fim de jogo, voltar)
//   B .................... BOMBA (oceano)
//   Start ................ ENTER (começa o jogo)
//   LB / RB .............. ponte anterior / próxima (fim de jogo)
//   X / Y ................ − / + velocidade da rolagem (fim de jogo)
// Segue o mapeamento "standard" dos navegadores (Xbox, PlayStation e a maioria dos genéricos).
'use strict';

let gpad = { x: 0, y: 0 }, gpConnected = false;
const GP_BUTTONS = { 0: ' ', 1: 'b', 7: ' ', 9: 'Enter', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight',
                     4: 'PageDown', 5: 'PageUp', 2: '-', 3: '+' };
const gpPrev = {}, gpStickPrev = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

function pollGamepad() {
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(list || []).find(g => g && g.connected);
  gpConnected = !!gp;
  if (!gp) { gpad.x = gpad.y = 0; return; }
  const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;     // zona morta
  gpad.x = dz(gp.axes[0] || 0); gpad.y = dz(gp.axes[1] || 0);
  // botões: aperta/solta as mesmas teclas do teclado (só nas transições, para não atrapalhar o teclado)
  const held = {};
  gp.buttons.forEach((b, i) => { const k = GP_BUTTONS[i]; if (k) held[k] = held[k] || b.pressed || b.value > 0.5; });
  for (const [k, on] of Object.entries(held)) {
    if (on && !gpPrev[k]) { keys[k] = true; taps.push({ key: k, shift: false }); }
    if (!on && gpPrev[k]) keys[k] = false;
    gpPrev[k] = on;
  }
  // analógico vira "toque de seta" nos menus (ao cruzar 60% do curso)
  const dirs = { ArrowUp: gpad.y < -0.6, ArrowDown: gpad.y > 0.6, ArrowLeft: gpad.x < -0.6, ArrowRight: gpad.x > 0.6 };
  for (const [k, on] of Object.entries(dirs)) {
    if (on && !gpStickPrev[k] && state !== 'play') taps.push({ key: k, shift: false });
    gpStickPrev[k] = on;
  }
}
