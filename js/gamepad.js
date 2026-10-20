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
// Vale para todos os modos (Classic, Modern, Ocean, Retro Ocean, PICO-8), no título e no fim de jogo.
// No app Android, os eventos vêm do Java (ver nativePad/nativeAxes abaixo).
'use strict';

let gpad = { x: 0, y: 0 }, gpConnected = false;
const GP_BUTTONS = { 0: ' ', 1: 'b', 7: ' ', 9: 'Enter', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight',
                     4: 'PageDown', 5: 'PageUp', 2: '-', 3: '+' };
const gpPrev = {}, gpStickPrev = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

function pollGamepad() {
  if (nativePadActive) return;                         // no app Android o controle chega pelo Java (nativePad/nativeAxes)
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(list || []).find(g => g && g.connected);
  setConnected(!!gp, gp && gp.id);
  if (!gp) { gpad.x = gpad.y = 0; return; }
  // botões: aperta/solta as mesmas teclas do teclado (só nas transições, para não atrapalhar o teclado)
  const held = {};
  gp.buttons.forEach((b, i) => { const k = GP_BUTTONS[i]; if (k) held[k] = held[k] || b.pressed || b.value > 0.5; });
  for (const [k, on] of Object.entries(held)) padKey(k, on);
  applyAxes(gp.axes[0] || 0, gp.axes[1] || 0);
}

function padKey(k, on) {
  if (on && !gpPrev[k]) { keys[k] = true; taps.push({ key: k, shift: false }); }
  if (!on && gpPrev[k]) keys[k] = false;
  gpPrev[k] = on;
}

function applyAxes(ax, ay) {
  const dz = v => Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85;     // zona morta
  gpad.x = dz(ax); gpad.y = dz(ay);
  // analógico vira "toque de seta" nos menus (ao cruzar 60% do curso)
  const dirs = { ArrowUp: gpad.y < -0.6, ArrowDown: gpad.y > 0.6, ArrowLeft: gpad.x < -0.6, ArrowRight: gpad.x > 0.6 };
  for (const [k, on] of Object.entries(dirs)) {
    if (on && !gpStickPrev[k] && state !== 'play') taps.push({ key: k, shift: false });
    gpStickPrev[k] = on;
  }
}

// ---------- app Android: o MainActivity.java repassa os eventos do controle para cá ----------
// (o WebView nem sempre expõe a Gamepad API; assim o controle funciona em qualquer aparelho)
let nativePadActive = false;
window.nativePad = (k, down) => { nativePadActive = true; setConnected(true, 'Android'); padKey(k, down); };
window.nativeAxes = (x, y, hx, hy) => { nativePadActive = true; setConnected(true, 'Android'); applyAxes(Math.abs(hx) > 0.5 ? hx : x, Math.abs(hy) > 0.5 ? hy : y); };

// ---------- aviso de conexão e botões de toque ----------
// Mostra "🎮 Controller connected" por 2,5 s (em qualquer tela e modo) e, no celular,
// esconde os botões de toque enquanto houver um controle conectado.
let gpToastEl = null, gpToastT = 0;
function setConnected(on, id) {
  if (on === gpConnected) return;
  gpConnected = on;
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle('gamepad', on);
  if (!gpToastEl) {
    gpToastEl = document.createElement('div');
    gpToastEl.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);padding:8px 14px;border-radius:18px;' +
      'background:rgba(12,15,28,.88);color:#e8ecf5;font:bold 14px Arial,sans-serif;z-index:9;transition:opacity .4s;pointer-events:none';
    document.body.appendChild(gpToastEl);
  }
  gpToastEl.textContent = on ? '🎮 Controller connected' : '🎮 Controller disconnected';
  gpToastEl.style.opacity = '1';
  clearTimeout(gpToastT); gpToastT = setTimeout(() => { gpToastEl.style.opacity = '0'; }, 2500);
}
if (typeof addEventListener !== 'undefined') {
  addEventListener('gamepadconnected', e => setConnected(true, e.gamepad && e.gamepad.id));
  addEventListener('gamepaddisconnected', () => { if (!Array.from(navigator.getGamepads ? navigator.getGamepads() : []).some(g => g && g.connected)) setConnected(false); });
}
