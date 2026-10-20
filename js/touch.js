// touch.js — CONTROLES NA TELA (celular / versão Android)
// Joystick analógico (escreve em `stick`) e botões de toque que "apertam" as mesmas teclas do teclado: escrevem em `keys`
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
  play: [['STICK'], ['FOGO', ' ', 0, 'fire round']],
  over: [['▲', 'ArrowUp', 0, 'u'], ['▼', 'ArrowDown', 0, 'd'], ['ponte ▲', 'PageUp', 0, 'pu'], ['ponte ▼', 'PageDown', 0, 'pd'],
         ['−', '-', 0, 'minus'], ['+', '+', 0, 'plus'], ['VOLTAR', ' ', 0, 'fire']],
  title: [['◀ ▶ modo', 'ArrowRight', 0, 'mode'], ['JOGAR', 'Enter', 0, 'fire']],
};

function press(key, shift) { keys[key] = true; taps.push({ key, shift: !!shift }); }
function release(key) { keys[key] = false; }
// segura o dedo no elemento mesmo se ele escorregar para fora (ignora falha em eventos sintéticos)
function capture(el, id) { try { el.setPointerCapture(id); } catch (e) { /* sem captura */ } }

// Joystick analógico: uma área circular com um botão que segue o dedo. A distância do
// centro dá a intensidade (0 no meio, 1 na borda) e a direção é livre, em 360°. O valor
// vai para `stick` (main.js), que o update soma às teclas. Há uma zona morta pequena no
// meio, e ao soltar o botão volta para o centro.
function buildStick() {
  const base = document.createElement('div'); base.className = 'stick';
  for (const d of ['up', 'down', 'left', 'right']) { const m = document.createElement('i'); m.className = 'mark ' + d; base.appendChild(m); }
  const knob = document.createElement('div'); knob.className = 'knob'; base.appendChild(knob);
  const DEAD = 0.12, REACH = 0.62;                          // zona morta e alcance do botão (fração do raio)
  let pid = null;
  const move = e => {
    const r = base.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - r.left - R) / (R * REACH), dy = (e.clientY - r.top - R) / (R * REACH);
    const m = Math.hypot(dx, dy);
    if (m > 1) { dx /= m; dy /= m; }                        // limita à borda do círculo
    knob.style.transform = `translate(${dx * R * REACH}px, ${dy * R * REACH}px)`;
    const k = Math.min(1, m), s = k < DEAD ? 0 : (k - DEAD) / (1 - DEAD) / (k || 1);   // reescala após a zona morta
    stick.x = dx * s; stick.y = dy * s;
  };
  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null; stick.x = stick.y = 0;
    knob.classList.add('free'); knob.style.transform = ''; base.classList.remove('on');
  };
  base.addEventListener('pointerdown', e => {
    e.preventDefault(); pid = e.pointerId; capture(base, pid);
    knob.classList.remove('free'); base.classList.add('on'); move(e);
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === pid) move(e); });
  base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end); base.addEventListener('lostpointercapture', end);
  return base;
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
      if (label === 'STICK') { pad.appendChild(buildStick()); continue; }
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
    if (which !== shown) { for (const k in keys) keys[k] = false; stick.x = stick.y = 0; build(which); shown = which; }
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
