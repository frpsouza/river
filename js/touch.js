// touch.js — CONTROLES NA TELA (celular / versão Android)
// Botões de toque que "apertam" as mesmas teclas do teclado: escrevem em `keys`
// (tecla segurada) e em `taps` (toque novo), exatamente como os eventos de teclado
// em main.js. Assim o resto do jogo não precisa saber se o jogador usa toque ou teclado.
//
// Os botões aparecem quando o aparelho tem tela de toque (ou com ?touch=1 na URL).
// O conjunto muda conforme a tela: título, jogo ou fim de jogo.
// Na tela de título dá para clicar ou tocar direto nas opções de modo, no canvas (vale também com mouse).
//
// Usa: main.js (keys, taps), state.js (state, mode). Deve ser carregado depois de main.js.
'use strict';

const TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search);

// botões: [rótulo, tecla, shift?, classe]
const PADS = {
  play: [['DPAD'], ['FOGO', ' ', 0, 'fire round']],
  over: [['▲', 'ArrowUp', 0, 'u'], ['▼', 'ArrowDown', 0, 'd'], ['ponte ▲', 'PageUp', 0, 'pu'], ['ponte ▼', 'PageDown', 0, 'pd'],
         ['−', '-', 0, 'minus'], ['+', '+', 0, 'plus'], ['VOLTAR', ' ', 0, 'fire']],
  title: [['◀ ▶ modo', 'ArrowRight', 0, 'mode'], ['JOGAR', 'Enter', 0, 'fire']],
};

function press(key, shift) { keys[key] = true; taps.push({ key, shift: !!shift }); }
function release(key) { keys[key] = false; }
// segura o dedo no elemento mesmo se ele escorregar para fora (ignora falha em eventos sintéticos)
function capture(el, id) { try { el.setPointerCapture(id); } catch (e) { /* sem captura */ } }

// Direcional em cruz, como num controle físico: um único bloco que lê onde o dedo está
// em relação ao centro. São 8 setores de 45° (4 direções + 4 diagonais), com uma zona
// morta no meio; o dedo pode deslizar de uma direção para outra sem levantar.
const DIRS = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
function buildDpad() {
  const pad = document.createElement('div');
  pad.className = 'dpad';
  const arms = {};
  for (const [name, glyph] of [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']]) {
    const a = document.createElement('div');
    a.className = 'arm ' + name; a.textContent = glyph;
    pad.appendChild(a); arms[name] = a;
  }
  const hub = document.createElement('div'); hub.className = 'hub'; pad.appendChild(hub);

  let active = new Set();
  const apply = dirs => {
    for (const [name, key] of Object.entries(DIRS)) {
      const on = dirs.has(name);
      if (on && !active.has(name)) press(key);
      if (!on && active.has(name)) release(key);
      arms[name].classList.toggle('on', on);
    }
    active = dirs;
  };
  const read = e => {
    const r = pad.getBoundingClientRect();
    const dx = (e.clientX - r.left) / r.width * 2 - 1, dy = (e.clientY - r.top) / r.height * 2 - 1;
    const dirs = new Set();
    if (Math.hypot(dx, dy) < 0.16) return dirs;                       // zona morta no centro
    const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));    // -4..4, 0 = direita
    const map = { 0: ['right'], 1: ['right', 'down'], 2: ['down'], 3: ['down', 'left'], 4: ['left'], '-4': ['left'],
                  '-3': ['left', 'up'], '-2': ['up'], '-1': ['up', 'right'] };
    for (const d of map[sector]) dirs.add(d);
    return dirs;
  };
  let pid = null;
  pad.addEventListener('pointerdown', e => { e.preventDefault(); pid = e.pointerId; capture(pad, pid); apply(read(e)); });
  pad.addEventListener('pointermove', e => { if (e.pointerId === pid) apply(read(e)); });
  const end = e => { if (e.pointerId === pid) { pid = null; apply(new Set()); } };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
  return pad;
}

if (TOUCH) {
  document.body.classList.add('touch');
  const pad = document.createElement('div');
  pad.id = 'pad';
  document.body.appendChild(pad);
  let shown = '';

  const build = which => {
    pad.innerHTML = ''; pad.dataset.screen = which;
    for (const [label, key, shift, cls] of PADS[which]) {
      if (label === 'DPAD') { pad.appendChild(buildDpad()); continue; }
      const b = document.createElement('button');
      b.textContent = label; b.className = 'btn ' + cls;
      b.addEventListener('pointerdown', e => { e.preventDefault(); capture(b, e.pointerId); b.classList.add('on'); press(key, shift); });
      const up = () => { b.classList.remove('on'); release(key); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
      pad.appendChild(b);
    }
  };
  // troca o conjunto de botões quando muda a tela do jogo
  (function watch() {
    const which = state === 'over' ? 'over' : state === 'title' ? 'title' : 'play';
    if (which !== shown) { for (const k in keys) keys[k] = false; build(which); shown = which; }
    requestAnimationFrame(watch);
  })();

  addEventListener('contextmenu', e => e.preventDefault());
}

// título: clicar (mouse) ou tocar numa opção escolhe o modo; de novo na escolhida, começa o jogo
const titlePick = e => {
  const r = cv.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height * (VIEW_H + PANEL_H);
  return y >= 128 && y < 162 ? 'classic' : y >= 170 && y < 204 ? 'modern' : null;
};
cv.addEventListener('pointerdown', e => {
  if (state !== 'title') return;
  const pick = titlePick(e);
  if (!pick) return;
  if (pick === mode) press('Enter'); else mode = pick;
  setTimeout(() => release('Enter'), 50);
});
cv.addEventListener('pointermove', e => { cv.style.cursor = state === 'title' && titlePick(e) ? 'pointer' : 'default'; });
