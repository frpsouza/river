// ocean/altitude.js — voo RASANTE × ALTO (altT) e as manobras que fazem a transição.
'use strict';

// altitude: altT vai de 0 (rasante) a 1 (acima das nuvens), suavemente
const ALT_LOW = 14 * 60, ALT_HIGH = 10 * 60;          // duração de cada fase (quadros)
let altT = 0, altTarget = 0, altTimer = ALT_LOW, altMsg = 0, altText = '';
const oceanHigh = () => isOcean() && altT > 0.25;   // alto: a superfície fica fora de alcance

// ---------- altitude (rasante ↔ acima das nuvens) ----------
// ---------- manobra do jato na troca de altitude ----------
// subindo: LOOPING (o jato sobe na tela, vira de cabeça para baixo e volta, crescendo ao se
// aproximar da câmera); descendo: MERGULHO EM PARAFUSO (giro completo com o nariz apontando
// para o mar). Durante a manobra o jato não atira e não leva dano; deixa rastros de condensação.
let maneuver = null;                                  // { kind: 'loop' | 'dive', t, dur }
function maneuverPose() {                             // pose visual do jato: deslocamento e escalas
  if (!maneuver) return { dy: 0, sx: 1, sy: 1, s: 1 };
  const u = maneuver.t / maneuver.dur, th = u * Math.PI * 2;
  if (maneuver.kind === 'loop')
    return { dy: -Math.sin(Math.PI * u) * 46, sx: 1, sy: Math.cos(th), s: 1 + 0.4 * Math.sin(Math.PI * u) };   // sobe e volta; vira de cabeça para baixo no meio
  return { dy: Math.sin(Math.PI * u) * 22, sx: Math.cos(th), sy: 1 - 0.7 * Math.sin(Math.PI * u), s: 1 - 0.25 * Math.sin(Math.PI * u) };
}
function stepManeuver() {
  if (!maneuver) return;
  if (++maneuver.t >= maneuver.dur) { maneuver = null; return; }
  if (maneuver.t % 2 === 0) {                         // rastros de condensação nas pontas das asas
    const p = maneuverPose(), cx = px + PW / 2, cy = scroll + py + PH / 2 - p.dy;
    for (const side of [-1, 1])
      fx.push({ x: cx + side * 8 * p.s * Math.abs(p.sx), y: cy - 6, t: 28, life: 28, kind: 'trail',
        parts: [P({ r: 1.6, grow: 1.035, col: '#ffffff', life: 28 })] });
  }
}

function setAltitude(v) {
  if (altTarget === v) return;
  altTarget = v; altTimer = v ? ALT_HIGH : ALT_LOW; altMsg = 150;
  if (state === 'play') {                             // manobra + ronco (sobe) ou assobio (desce)
    maneuver = { kind: v ? 'loop' : 'dive', t: 0, dur: v ? 96 : 84 };
    (v ? [110, 147, 196, 262, 330] : [880, 740, 587, 466, 370]).forEach((fq, k) => setTimeout(() => beep(fq, 0.18, v ? 'sawtooth' : 'triangle', 0.03), k * 110));
  }
  altText = v ? '▲  ABOVE THE CLOUDS' : '▼  LOW-LEVEL FLIGHT';
  (v ? [330, 440, 554, 660] : [660, 554, 440, 330]).forEach((fq, k) => setTimeout(() => beep(fq, 0.12, 'sine', 0.035), k * 70));
}
function updateAltitude() {
  if (boss) setAltitude(1);                                   // chefes: luta lá em cima
  else if (--altTimer <= 0) setAltitude(altTarget ? 0 : 1);
  altT += clamp(altTarget - altT, -1 / 150, 1 / 150);         // transição de 2,5 s
  if (altMsg > 0) altMsg--;
}

// ---------- tiros especiais: foguete teleguiado e mina ----------
function stepSpecialShell(sh) {                               // devolve tiros novos (mina explodindo) ou null
  if (sh.kind === 'rocket') {
    if (sh.t++ < 100) {                                       // persegue o jato por ~1,7 s
      const want = Math.atan2(scroll + py + PH / 2 - sh.Y, px + PW / 2 - sh.x), cur = Math.atan2(sh.vy, sh.vx);
      let da = want - cur; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const a = cur + clamp(da, -0.045, 0.045), v = Math.min(2, Math.hypot(sh.vx, sh.vy) + 0.03);
      sh.vx = Math.cos(a) * v; sh.vy = Math.sin(a) * v;
    }
  } else if (sh.kind === 'mine') {
    sh.t++;
    if (Math.hypot(px + PW / 2 - sh.x, scroll + py + PH / 2 - sh.Y) < 30 || sh.t > 420) {   // detona perto do jato
      sh.dead = true;
      boom(sh.x, sh.Y, 'heli');
      const out = [];
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; out.push({ x: sh.x, Y: sh.Y, vx: Math.cos(a) * 1.6, vy: Math.sin(a) * 1.6 }); }
      return out;
    }
  }
  return null;
}
