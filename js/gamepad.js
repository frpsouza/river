// gamepad.js — JOYSTICK / CONTROLE FÍSICO (Gamepad API)
// Lê o primeiro controle conectado a cada passo do jogo (pollGamepad, chamado pelo laço em
// main.js) e alimenta as mesmas entradas do teclado e da tela:
//   analógico esquerdo ... `gpad` (-1..1), somado ao joystick da tela no update; também vira
//                          setas "tocadas" nos menus (título e fim de jogo)
//   direcional (d-pad) ... setas
//   A / RT (gatilho dir.)  FOGO (e, no fim de jogo, voltar)
//   B / LT (gatilho esq.)  BOMBA (oceano e retro; nos outros modos não faz nada)
//   Start ................ ENTER (começa o jogo)
//   LB / RB .............. ponte anterior / próxima (fim de jogo)
//   X / Y ................ − / + velocidade da rolagem (fim de jogo)
// Segue o mapeamento "standard" dos navegadores (Xbox, PlayStation e a maioria dos genéricos).
// Vale para todos os modos (Classic, Modern, Ocean, Retro Ocean, PICO-8), no título e no fim de jogo.
// No app Android, os eventos vêm do Java (ver nativePad/nativeAxes abaixo).
'use strict';

let gpad = { x: 0, y: 0 }, gpConnected = false;
const GP_BUTTONS = { 0: ' ', 1: 'b', 6: 'b', 7: ' ', 9: 'Enter', 12: 'ArrowUp', 13: 'ArrowDown', 14: 'ArrowLeft', 15: 'ArrowRight',
                     4: 'PageDown', 5: 'PageUp', 2: '-', 3: '+' };
const gpStickPrev = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

function pollGamepad() {
  if (nativePadActive) return;                         // no app Android o controle chega pelo Java (nativePad/nativeAxes)
  const list = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const gp = Array.from(list || []).find(g => g && g.connected);
  setConnected(!!gp, gp && gp.id);
  if (!gp) { gpad.x = gpad.y = 0; return; }
  // botões: aperta/solta as mesmas teclas do teclado (só nas transições, para não atrapalhar o teclado)
  const held = {};
  gp.buttons.forEach((b, i) => { const k = GP_BUTTONS[i]; if (k) held[k] = held[k] || b.pressed || b.value > 0.5; });
  for (const [k, on] of Object.entries(held)) padKey(k, on, 'btn');
  // direcional em cruz que chega como eixos (controles fora do mapeamento padrão): eixos 6/7, ou o "POV" no eixo 9
  if (gp.mapping !== 'standard') {
    let hx = gp.axes[6] || 0, hy = gp.axes[7] || 0;
    const pov = gp.axes[9];
    if (pov !== undefined && Math.abs(pov) <= 1.01 && !(hx || hy)) {          // POV: -1 = cima, depois sentido horário; >1 = solto
      const k = Math.round((pov + 1) / 2 * 7);
      hx = [0, 1, 1, 1, 0, -1, -1, -1][k] || 0; hy = [-1, -1, 0, 1, 1, 1, 0, -1][k] || 0;
    }
    padHat(hx, hy, 'hat');
  }
  applyAxes(gp.axes[0] || 0, gp.axes[1] || 0);
}

// cada tecla do controle pode ser segurada por várias fontes (botão, gatilho, cruz em eixo…);
// fica apertada enquanto alguma fonte a segurar, e o "toque" só conta na primeira
const gpHold = {};
function padKey(k, on, src = 'btn') {
  const set = gpHold[k] || (gpHold[k] = new Set()), was = set.size > 0;
  if (on) set.add(src); else set.delete(src);
  if (set.size > 0 && !was) { keys[k] = true; taps.push({ key: k, shift: false }); }
  if (set.size === 0 && was) keys[k] = false;
}
function padHat(hx, hy, src) {                        // cruz como eixos → setas
  padKey('ArrowLeft', hx < -0.5, src); padKey('ArrowRight', hx > 0.5, src);
  padKey('ArrowUp', hy < -0.5, src); padKey('ArrowDown', hy > 0.5, src);
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
window.nativePad = (k, down) => { nativePadActive = true; setConnected(true, 'Android'); padKey(k, down, 'key'); };
window.nativeAxes = (x, y, hx, hy, lt, rt) => {
  nativePadActive = true; setConnected(true, 'Android');
  applyAxes(x, y);
  padHat(hx, hy, 'hat');                              // cruz que chega como eixo (HAT)
  padKey(' ', rt > 0.5, 'rt'); padKey('b', lt > 0.5, 'lt');   // gatilhos analógicos: direito = fogo, esquerdo = bomba
};

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
