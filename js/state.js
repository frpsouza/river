// state.js — ESTADO DA PARTIDA
// Variáveis globais do jogo (posição do jato, rolagem, combustível, vidas, pontos…)
// e as ações que mudam a partida: começar, renascer no checkpoint, pontuar e morrer.
//
// `state` vale 'title', 'play', 'dying' ou 'over'.
// Usa: terrain.js, objects.js, effects.js (boom).
'use strict';

let mode = 'classic';                               // 'classic': terra mata · 'modern': voa sobre as margens · 'ocean' · 'retro'
const isOcean = () => mode === 'ocean' || mode === 'retro';   // o retro usa toda a lógica do oceano
const isClassic = () => mode === 'classic' || mode === 'pico'; // o PICO-8 usa toda a lógica do clássico
let bank = 0;
let safeT = 0;
let hp = 100, hurtT = 0;                             // voo livre: vida do jato (0–100) e invulnerabilidade após um dano                                       // proteção ao renascer: enquanto > 0, inimigos e tiros não derrubam
let py = PLAYER_Y;                                   // altura do jato acima do fundo da tela (no moderno ele sobe e desce)

let shells = [];

let state, scroll, px, fuel, lives, score, nextLife, checkpoint, missiles = [], fx, dyingT, keys, frame, audio;

function newGame() {
  // retro: 240×320 de verdade · pico: lógica em 256×224, desenhada pela metade = 128×112 + HUD de 16 px
  W = mode === 'retro' ? 240 : mode === 'pico' ? 256 : W_NORMAL;
  VIEW_H = mode === 'pico' ? 224 : isClassic() ? SCREEN_H - PANEL_H : mode === 'retro' ? 320 : SCREEN_H;   // voo livre: sem painel, HUD sobre o cenário
  newOceanGame();
  seed = (Math.random() * 1e9) | 0;
  rng = mulberry32(seed);
  blocks = [];
  score = 0; lives = isOcean() ? 1 : 3;                 // oceano: uma vida só — vale a barra de vida nextLife = 10000;
  checkpoint = 0;
  respawn();
}

function respawn() {
  for (let g = checkpoint; g < blocks.length; g++) {
    blocks[g].broken = false;
    spawnObjs(blocks[g]);
  }
  scroll = checkpoint * BH + (checkpoint > 0 ? 40 : 0);   // renasce um pouco depois da saída da ponte, onde o rio já abriu
  py = PLAYER_Y; safeT = SPAWN_SAFE; hp = 100; hurtT = 0;
  resetOcean();
  const { b, i } = lineAt(scroll + py);
  px = (b.L[i] + b.R[i]) / 2 - PW / 2;
  fuel = 100; missiles = []; fx = []; dyingT = 0; shells = []; resetPowerups();
  bank = 0;
  state = 'play';
}

function addScore(n) {
  score += n;
  if (score >= nextLife) {                         // a cada 10.000 pontos: vida extra (no oceano, +30 de reparo)
    nextLife += 10000; beep(880, 0.3);
    if (isOcean()) hp = Math.min(100, hp + 30); else lives++;
  }
}

// dano com gravidade: nos modos de voo livre (moderno e oceano) tira vida da barra;
// no clássico, qualquer dano derruba.
// Devolve true se o jato caiu (o chamador deve parar o passo).
function hurt(dmg) {
  if (isClassic()) { kill(); return true; }
  if (hurtT > 0 || safeT > 0) return false;
  hp -= dmg; hurtT = 45;
  beep(150, 0.12, 'square', 0.05);
  fx.push({ x: px + PW / 2, y: scroll + py + PH / 2, t: 16, life: 16, kind: 'spark', parts: burst(8, 2, { col: '#ffc93c', r: 1, life: 16 }) });
  if (hp <= 0) { hp = 0; kill(); return true; }
  return false;
}

function kill() {
  if (state !== 'play') return;
  state = 'dying'; dyingT = 70;
  boom(px + PW / 2, scroll + py + PH / 2, 'player');
}
