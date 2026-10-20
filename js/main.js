// main.js — ENTRADA E LAÇO PRINCIPAL
// Registra o teclado (teclas seguradas em `keys`, toques novos em `taps`) e roda o
// laço: update() a passos fixos de 1/60 s e draw() a cada quadro da tela.
// Deve ser o último script carregado.
'use strict';

keys = {};
let stick = { x: 0, y: 0 };                          // joystick analógico da tela (-1..1 em cada eixo; y < 0 = para cima)

let taps = [];                                       // teclas apertadas neste quadro (sem auto-repetição)

state = 'title'; frame = 0; fx = []; scroll = 0;

addEventListener('keydown', e => {
  keys[e.key] = true; keys[e.key.toLowerCase()] = true;
  if (!e.repeat) taps.push({ key: e.key, shift: e.shiftKey });
  if (e.key.startsWith('Arrow') || e.key === ' ' || e.key.startsWith('Page')) e.preventDefault();
});

addEventListener('keyup', e => { keys[e.key] = false; keys[e.key.toLowerCase()] = false; });

let last = performance.now(), acc = 0;

function loop(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { update(); acc -= 1000 / 60; }
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
