// state.js — ESTADO DA PARTIDA
// Variáveis globais do jogo (posição do jato, rolagem, combustível, vidas, pontos…)
// e as ações que mudam a partida: começar, renascer no checkpoint, pontuar e morrer.
//
// `state` vale 'title', 'play', 'dying' ou 'over'.
// Usa: terrain.js, objects.js, effects.js (boom).
'use strict';

let mode = 'classic';                               // 'classic': terra mata · 'modern': voa sobre as margens
let bank = 0;
let py = PLAYER_Y;                                   // altura do jato acima do fundo da tela (no moderno ele sobe e desce)

let shells = [];

let state, scroll, px, fuel, lives, score, nextLife, checkpoint, missiles = [], fx, dyingT, keys, frame, audio;

function newGame() {
  seed = (Math.random() * 1e9) | 0;
  rng = mulberry32(seed);
  blocks = [];
  score = 0; lives = 3; nextLife = 10000;
  checkpoint = 0;
  respawn();
}

function respawn() {
  for (let g = checkpoint; g < blocks.length; g++) {
    blocks[g].broken = false;
    spawnObjs(blocks[g]);
  }
  scroll = checkpoint * BH;
  py = PLAYER_Y;
  const { b, i } = lineAt(scroll + py);
  px = (b.L[i] + b.R[i]) / 2 - PW / 2;
  fuel = 100; missiles = []; fx = []; dyingT = 0; shells = []; resetPowerups();
  bank = 0;
  state = 'play';
}

function addScore(n) {
  score += n;
  if (score >= nextLife) { nextLife += 10000; lives++; beep(880, 0.3); }
}

function kill() {
  if (state !== 'play') return;
  state = 'dying'; dyingT = 70;
  boom(px + PW / 2, scroll + py + PH / 2, 'player');
}
